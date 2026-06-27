# 安卓 APK 打包说明（完全离线内置版）

用 [Capacitor](https://capacitorjs.com) 把网页 + 词库 + **5500×2 真人发音(约 144MB)** 整包打进 APK，
**装上即完全离线**（不联网也能背词、看拆解、听发音）。APK 约 **150MB**。

二选一：

---

## 方式 A：云端构建（推荐，免装任何开发工具）

1. 打开 GitHub 仓库 → 顶部 **Actions** 标签。
2. 左侧选 **Build Android APK** → 右侧 **Run workflow**（分支选 `main`）→ 绿色 Run。
3. 等几分钟跑完 → 点进这次运行 → 页面底部 **Artifacts** → 下载 **wordquest-apk**。
4. 解压得到 `app-debug.apk`，传到安卓手机，点击安装（首次需在系统里允许「安装未知来源应用」）。

> 也可以打个 tag 触发：`git tag v1.0 && git push origin v1.0`。

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

- **debug 签名**：用调试密钥签名，可直接侧载安装，个人/分发自用足够。若要正式签名（上应用商店或长期分发），需另生成 keystore 做 release 签名——需要时再加。
- **体积**：约 150MB，因为把全词库真人发音都内置了。若想要**小体积版**（不内置发音、首次联网后用 app 内「一键缓存发音」离线），告诉我，可改 Capacitor 配置排除 `audio/`。
- **更新**：APK 是某次构建的快照，不会自动更新；改了内容后重新构建一个新 APK 安装即可。
- 改动配置：[`capacitor.config.ts`](capacitor.config.ts)（包名 `com.wordquest.kaoyan`、应用名「考研词关」）。
