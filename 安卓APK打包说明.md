# 安卓 APK 打包说明（完全离线内置版）

用 [Capacitor](https://capacitorjs.com) 把网页 + 词库 + **5500×2 真人发音(约 144MB)** 整包打进 APK，
**装上即完全离线**（不联网也能背词、看拆解、听发音）。APK 约 **150MB**。

二选一：

---

## 方式 A：从 GitHub Release 下载（推荐）

1. 打开仓库的 **Releases**：<https://github.com/jasonreidplus-lgtm/english-vocab-memory/releases/latest>。
2. 在 **Assets** 里直接下载 `wordquest-v*.apk`（无需解压）。
3. 传到安卓平板并点击安装；首次需在系统里允许「安装未知来源应用」。

推送 `v*` 标签会自动构建并创建 Release；推送 `main` 也会构建，临时产物仍可在 Actions 的 `wordquest-apk` 下载。

> **最终 v1.2.1 是固定签名链的起点。** 本次逐项验收发现，旧工作流声明的签名缓存路径实际没有保存成功，因此 v1.1.0、v1.2.0 以及 2026-07-14 01:52 前下载的首版 v1.2.1 都可能无法直接覆盖。安装最终 v1.2.1 前，请先在 APP 设置中点「跨设备同步 → 复制」或「数据备份 → 导出」，保存好完整进度；若系统提示签名冲突，再卸载旧版、安装新版并粘贴/导入恢复。从最终 v1.2.1 起，CI 会显式生成、校验、缓存并每周保活同一把签名，后续版本可继续覆盖安装。

---

## 方式 B：本地构建（Android Studio）

前置：装 [Android Studio](https://developer.android.com/studio)（自带 JDK 21，并会装好 Android SDK 35）。

```bash
npm install              # 首次
npm run build            # 生成 dist/
npx cap sync android     # 把 dist(含发音) 同步进 android/
npx cap open android     # 用 Android Studio 打开 android 工程
```

在 Android Studio 里：菜单 **Build → Build App Bundle(s) / APK(s) → Build APK(s)**，
完成后点提示里的 **locate**，得到：

```
android/app/build/outputs/apk/debug/app-debug.apk
```

把它传手机安装即可。（命令行替代：`cd android && ./gradlew assembleDebug`）

---

## 说明

- **debug 签名**：当前为个人侧载用固定调试签名，证书 SHA256 为 `D7160E22EB7BF7ECC1FE2C8BB53A97AE756C143EAEE2E89C78DF643AFA81BFBA`；CI 会在每次构建前恢复并校验它，并通过定时任务持续保活。若要上应用商店，仍需改成由 GitHub Secrets 注入的正式 release keystore。
- **体积**：约 150MB，因为把全词库真人发音都内置了。若想要**小体积版**（不内置发音、首次联网后用 app 内「一键缓存发音」离线），告诉我，可改 Capacitor 配置排除 `audio/`。
- **更新**：APK 是某次构建的快照，不会自动更新；改了内容后重新构建一个新 APK 安装即可。
- **v1.2.0 阅读资料**：新增考研英语一 / 英语二双入口；英语二内置 2010—2026 共 68 篇阅读、逐句译文和每篇 3 个长难句拆解，全部离线可用。
- **v1.2.1 直接 PDF**：导出页先调整每页词数，再点「保存 PDF」。应用会生成真正的 PDF 文件，不调用打印服务。Android APK 直接打开“保存到”界面选择文件夹和文件名；电脑支持“另存为”或直接下载；iPhone/iPad 可在系统共享面板选“存储到文件”。微信未自动下载时可点页面中的“直接下载 PDF”。
- 改动配置：[`capacitor.config.ts`](capacitor.config.ts)（包名 `com.wordquest.kaoyan`、应用名「考研词关」）。
