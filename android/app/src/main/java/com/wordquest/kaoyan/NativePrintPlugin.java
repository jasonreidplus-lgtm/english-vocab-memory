package com.wordquest.kaoyan;

import android.app.Activity;
import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativePrint")
public class NativePrintPlugin extends Plugin {

    @PluginMethod
    public void print(PluginCall call) {
        String requestedName = call.getString("documentName");
        String rawName = requestedName == null ? "" : requestedName.trim();
        String cleanedName = rawName
            .replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "-")
            .replaceAll("\\s+", " ")
            .replaceAll("[.\\s-]+$", "");
        if (cleanedName.isEmpty()) cleanedName = "考研词关";
        final String documentName = cleanedName.length() > 80 ? cleanedName.substring(0, 80) : cleanedName;
        Activity activity = getActivity();

        if (activity == null) {
            call.reject("当前页面已关闭，无法打开系统打印服务");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                PrintManager printManager = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                if (webView == null || printManager == null) {
                    call.reject("系统打印服务不可用");
                    return;
                }

                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(documentName);
                PrintAttributes attributes = new PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                    .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                    .build();
                printManager.print(documentName, adapter, attributes);
                call.resolve();
            } catch (Exception error) {
                call.reject("无法打开系统打印服务", error);
            }
        });
    }
}
