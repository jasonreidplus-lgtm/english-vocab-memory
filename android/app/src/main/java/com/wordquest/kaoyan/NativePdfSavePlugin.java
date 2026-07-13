package com.wordquest.kaoyan;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "NativePdfSave")
public final class NativePdfSavePlugin extends Plugin {
    private static final int CHUNK_BYTES = 256 * 1024;
    private static final int MAX_BASE64_CHARS = 4 * ((CHUNK_BYTES + 2) / 3);
    private static final long MAX_PDF_BYTES = 128L * 1024L * 1024L;
    private static final long STALE_MILLIS = 24L * 60L * 60L * 1000L;

    private static final class Transfer {
        final File file;
        final long totalBytes;

        Transfer(File file, long totalBytes) {
            this.file = file;
            this.totalBytes = totalBytes;
        }
    }

    private final Map<String, Transfer> transfers = new ConcurrentHashMap<>();
    private final AtomicBoolean saveInProgress = new AtomicBoolean(false);

    @Override
    public void load() {
        File directory = transferDirectory();
        if (!directory.exists()) directory.mkdirs();
        File[] files = directory.listFiles();
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - STALE_MILLIS;
        for (File file : files) {
            if (file.isFile() && file.lastModified() < cutoff) file.delete();
        }
    }

    @PluginMethod
    public void begin(PluginCall call) {
        Long requestedBytes = readWholeNumber(call, "totalBytes");
        if (requestedBytes == null || requestedBytes < 5 || requestedBytes > MAX_PDF_BYTES) {
            call.reject("PDF 文件大小无效", "INVALID_PDF_SIZE");
            return;
        }

        File directory = transferDirectory();
        if (!directory.exists() && !directory.mkdirs()) {
            call.reject("无法准备 PDF 临时目录", "CACHE_UNAVAILABLE");
            return;
        }

        String transferId = UUID.randomUUID().toString();
        File target = transferFile(transferId);
        try {
            if (!target.createNewFile()) {
                call.reject("无法创建 PDF 临时文件", "CACHE_CREATE_FAILED");
                return;
            }
        } catch (Exception error) {
            call.reject("无法创建 PDF 临时文件", "CACHE_CREATE_FAILED", error);
            return;
        }

        transfers.put(transferId, new Transfer(target, requestedBytes));
        JSObject result = new JSObject();
        result.put("transferId", transferId);
        result.put("chunkBytes", CHUNK_BYTES);
        call.resolve(result);
    }

    @PluginMethod
    public void appendChunk(PluginCall call) {
        String transferId = validTransferId(call.getString("transferId"));
        Long requestedOffset = readWholeNumber(call, "offset");
        String encoded = call.getString("base64");
        Transfer transfer = transferId == null ? null : transfers.get(transferId);
        if (transfer == null || requestedOffset == null || requestedOffset < 0 || encoded == null) {
            call.reject("PDF 分块参数无效", "INVALID_CHUNK");
            return;
        }
        if (encoded.length() > MAX_BASE64_CHARS) {
            call.reject("PDF 分块编码过大", "CHUNK_TOO_LARGE");
            return;
        }

        final byte[] bytes;
        try {
            bytes = Base64.decode(encoded, Base64.NO_WRAP);
        } catch (IllegalArgumentException error) {
            call.reject("PDF 分块编码无效", "INVALID_BASE64", error);
            return;
        }
        if (bytes.length == 0 || bytes.length > CHUNK_BYTES || requestedOffset + bytes.length > transfer.totalBytes) {
            call.reject("PDF 分块大小无效", "INVALID_CHUNK_SIZE");
            return;
        }

        synchronized (transfer) {
            try (RandomAccessFile output = new RandomAccessFile(transfer.file, "rw")) {
                if (output.length() != requestedOffset) {
                    call.reject("PDF 分块顺序不正确", "INVALID_CHUNK_OFFSET");
                    return;
                }
                output.seek(requestedOffset);
                output.write(bytes);
                JSObject result = new JSObject();
                result.put("receivedBytes", output.length());
                call.resolve(result);
            } catch (Exception error) {
                call.reject("PDF 分块写入失败", "CHUNK_WRITE_FAILED", error);
            }
        }
    }

    @PluginMethod
    public void save(PluginCall call) {
        String transferId = validTransferId(call.getString("transferId"));
        Long requestedBytes = readWholeNumber(call, "totalBytes");
        Transfer transfer = transferId == null ? null : transfers.get(transferId);
        if (transfer == null || requestedBytes == null || requestedBytes != transfer.totalBytes) {
            call.reject("PDF 保存参数无效", "INVALID_TRANSFER");
            return;
        }
        if (!transfer.file.isFile() || transfer.file.length() != transfer.totalBytes || !hasPdfHeader(transfer.file)) {
            call.reject("PDF 文件不完整，请重新生成", "INVALID_PDF_FILE");
            return;
        }
        if (!saveInProgress.compareAndSet(false, true)) {
            call.reject("已有 PDF 正在选择保存位置", "SAVE_IN_PROGRESS");
            return;
        }

        String fileName = safePdfFileName(call.getString("fileName"));
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/pdf");
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        try {
            startActivityForResult(call, intent, "documentCreated");
        } catch (Exception error) {
            saveInProgress.set(false);
            call.reject("无法打开 PDF 保存位置", "SAVE_PICKER_FAILED", error);
        }
    }

    @ActivityCallback
    private void documentCreated(PluginCall call, ActivityResult activityResult) {
        if (call == null) {
            saveInProgress.set(false);
            return;
        }
        String transferId = validTransferId(call.getString("transferId"));
        File source = transferId == null ? null : transferFile(transferId);
        String fileName = safePdfFileName(call.getString("fileName"));
        Long expectedBytes = readWholeNumber(call, "totalBytes");

        Intent data = activityResult.getData();
        Uri target = data == null ? null : data.getData();
        if (activityResult.getResultCode() != Activity.RESULT_OK || target == null) {
            saveInProgress.set(false);
            removeTransfer(transferId, source);
            JSObject result = new JSObject();
            result.put("status", "cancelled");
            call.resolve(result);
            return;
        }
        if (!ContentResolver.SCHEME_CONTENT.equals(target.getScheme())) {
            saveInProgress.set(false);
            removeTransfer(transferId, source);
            call.reject("所选 PDF 保存位置无效", "INVALID_TARGET_URI");
            return;
        }
        if (source == null || !source.isFile() || expectedBytes == null || source.length() != expectedBytes) {
            saveInProgress.set(false);
            removeTransfer(transferId, source);
            call.reject("PDF 临时文件已失效，请重新生成", "MISSING_PDF_FILE");
            return;
        }

        getBridge().execute(() -> {
            long copied = 0;
            try (InputStream input = new FileInputStream(source);
                 OutputStream output = getContext().getContentResolver().openOutputStream(target, "rwt")) {
                if (output == null) throw new IllegalStateException("无法打开目标文件");
                byte[] buffer = new byte[64 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    output.write(buffer, 0, count);
                    copied += count;
                }
                output.flush();
                if (copied != expectedBytes) throw new IllegalStateException("PDF 写入长度不一致");
                removeTransfer(transferId, source);
                saveInProgress.set(false);
                JSObject result = new JSObject();
                result.put("status", "saved");
                result.put("fileName", fileName);
                result.put("bytes", copied);
                call.resolve(result);
            } catch (Exception error) {
                try {
                    DocumentsContract.deleteDocument(getContext().getContentResolver(), target);
                } catch (Exception ignored) {
                    // 某些第三方文档提供者不允许删除；原错误仍返回给页面。
                }
                saveInProgress.set(false);
                call.reject("PDF 保存失败，请重新选择位置", "PDF_WRITE_FAILED", error);
            }
        });
    }

    @PluginMethod
    public void abort(PluginCall call) {
        String transferId = validTransferId(call.getString("transferId"));
        removeTransfer(transferId, transferId == null ? null : transferFile(transferId));
        call.resolve();
    }

    private File transferDirectory() {
        return new File(getContext().getCacheDir(), "pdf-exports");
    }

    private File transferFile(String transferId) {
        return new File(transferDirectory(), transferId + ".part");
    }

    private void removeTransfer(String transferId, File file) {
        if (transferId != null) transfers.remove(transferId);
        if (file != null && file.isFile()) file.delete();
    }

    private static String validTransferId(String value) {
        if (value == null) return null;
        try {
            return UUID.fromString(value).toString();
        } catch (IllegalArgumentException error) {
            return null;
        }
    }

    /** Capacitor JSON 对普通 JS 整数通常保存为 Integer，而 getLong() 只接受 Long。 */
    private static Long readWholeNumber(PluginCall call, String key) {
        Object value = call.getData().opt(key);
        if (!(value instanceof Number)) return null;
        Number number = (Number) value;
        double decimal = number.doubleValue();
        long whole = number.longValue();
        if (!Double.isFinite(decimal) || decimal != (double) whole) return null;
        return whole;
    }

    private static boolean hasPdfHeader(File file) {
        byte[] header = new byte[5];
        try (InputStream input = new FileInputStream(file)) {
            return input.read(header) == header.length && "%PDF-".equals(new String(header, StandardCharsets.US_ASCII));
        } catch (Exception error) {
            return false;
        }
    }

    private static String safePdfFileName(String requested) {
        String raw = requested == null ? "" : requested.trim();
        String cleaned = raw
            .replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "-")
            .replaceAll("\\s+", " ")
            .replaceAll("[.\\s-]+$", "");
        if (cleaned.toLowerCase().endsWith(".pdf")) cleaned = cleaned.substring(0, cleaned.length() - 4);
        cleaned = cleaned.replaceAll("[.\\s-]+$", "");
        if (cleaned.isEmpty()) cleaned = "考研词关";
        if (cleaned.length() > 80) cleaned = cleaned.substring(0, 80).replaceAll("[.\\s-]+$", "");
        return cleaned + ".pdf";
    }
}
