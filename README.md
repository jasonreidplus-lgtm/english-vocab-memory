# 考研词关 · WordQuest

考研 5500 词「闯关学习」web app。Vite + React 单页，**纯前端、可安装（PWA）、离线可用、进度存本地**。v1.2.0 加入考研英语一 / 英语二双入口及分库阅读精读；v1.2.1 改为应用直接生成、保存真正的 PDF，不再依赖打印服务。
数据来自 `public/data/vocab.json`，每 10 词一组共约 550 关。手机/电脑通用，移动端优先。

## 运行 / 构建 / 测试

```bash
npm install
npm run dev       # 本地开发 http://localhost:5173
npm run build     # 产出静态文件到 dist/
npm run preview   # 预览构建产物（PWA / service worker 只在这里和线上生效，dev 不缓存）
npm test          # 逻辑、进度、双分库阅读数据的全量自测
```

> `predev` / `prebuild` 会先把英语一、英语二逐句源合并成 `passages.json`，再运行 `scripts/split-vocab.cjs` 拆分词库（见下文「性能」）。

### 部署到 GitHub Pages（推代码即自动发布）

已配好 GitHub Actions（[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)），**push 到 `main` 就自动构建并发布**，不用手动 build。首次设置：

```bash
# 1) 在 GitHub 新建一个空仓库（例如 wordquest），拿到它的地址
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
# 2) 仓库 Settings → Pages → Build and deployment → Source 选 "GitHub Actions"
```

之后每次 `git push`，Actions 会自动构建 + 部署，几十秒后访问 `https://<用户名>.github.io/<仓库名>/`。

> 构建产物用相对路径（`vite.config.js` 里 `base: './'`），任意子路径都能跑，无需改配置。
> 也可手机浏览器本地打开 `dist/index.html`。打开线上地址后**「添加到主屏幕」**即变成全屏 app，断网也能背。
> 偏好手动发布的话：`npm i -D gh-pages` 再 `npx gh-pages -d dist`（把 dist 推到 gh-pages 分支）。

## 三条架构铁律（写死在结构里）

1. **画风 = 纯主题层。** 所有视觉差异只来自 CSS 变量（`src/index.css` 里 `.vg{}` 给默认值）+ 每种画风可选的一段背景装饰组件。
   游戏逻辑里**没有任何** `theme === 'pixel'` 式的按名分支（可全局搜索验证）。
   👉 **新增一种画风 = 在 [`src/config/themes.jsx`](src/config/themes.jsx) 的数组里加一个对象**（`vars` 覆盖 + 可选 `Deco` + 可选 `fontHref`），其它代码一行都不用动。当前 5 种画风里，「羊皮纸」「墨白」就是这样纯靠加配置实现的。
2. **数据驱动。** 所有关卡全部由 `vocab.json` 渲染，没有任何一关写死内容或 UI。
3. **数据只读。** app 只展示词库，绝不修改 `word / phonetic / base_meaning` 等字段；错词池只存 `id`。

## 目录结构

```
public/
  data/vocab.json          ★ 真实词库（只读数据源；替换它即可换全部内容）
  data/vocab-index.json    （自动生成）懒加载用的轻量索引
  data/groups/g{N}.json    （自动生成）各关的富字段（词根/例句/辨析…）
  manifest.webmanifest     PWA 清单     sw.js  service worker（离线缓存）
  fonts/pdf/               PDF 内嵌中英文/音标字体子集及 SIL OFL 许可证
  licenses/                PDF 引擎等随包开源组件许可证
  icon-*.png               应用图标（朱印风，scripts/generate-icons.cjs 生成）
data-src/
  拆句_JSONL/              英语一逐句源（保留既有 ID）
  英语二/                  英语二逐句源、翻译、长难句分析（2010—2026）
src/
  config/themes.tsx        ★ 画风配置（唯一的视觉差异来源）+ decos.tsx 背景装饰
  data/loadVocab.ts        加载（先索引、进关懒加载详情，缺拆分则回退整包）
  game/quiz.ts             出题（英选中/中选英）、判分、长释义取首义
  state/progress.ts        进度模型 + 选择器（解锁/星级/XP/打卡/偏好）
  state/useProgress.ts     localStorage 持久化 hook
  lib/                     speech / shuffle / annotate(词形还原标注) / passages(真题阅读关卡库,本机存储)
  components/              HeaderBar / ThemeSwitcher / Stars / DailyCard / SettingsPanel / ErrorBoundary / WordPopup
  screens/                 LevelSelect / Learn / Quiz / Result / Match / Read(真题精读) / Cloze(句子猜词) / Passage(真题阅读闯关) 八屏
  ../public/data/sentences.json  内置句子猜词句库（自写，带翻译）
  App.tsx                  串起数据、进度、画风、流程（含懒加载 hydrate）
  index.css                全局样式（只用变量，不出现画风名）
scripts/
  build-passages.mjs       合并英语一/二并生成带 exam 字段的 passages.json
  split-vocab.cjs          vocab.json → 索引 + 分组文件（predev/prebuild 自动跑）
  build-vocab.cjs          从 kajweb/dict 词表重建 vocab.json
  merge-enrich.cjs         把 enrich*.json 的助记/词根合并进 vocab.json
  generate-icons.cjs       手写 PNG 编码器生成应用图标
  test.mjs                 纯函数自测
  build-pdf-fonts.py       从 Noto 字体生成离线 PDF 专用子集
  enrich*.json             手写的趣味助记（14 个批次，1579 条）
```

## 直接导出 PDF

统计页可按日期或分类整理单词，进入导出页后选择每页 20 / 30 / 50 / 100 词。应用会在本机生成可搜索、可复制的 A4 PDF：

- Android APK：打开系统“保存到”文件选择器，可选文件夹和文件名，不需要存储权限。
- 电脑浏览器：支持时打开“另存为”；微信等内置浏览器不支持时提供真实 `.pdf` 下载链接。
- iPhone / iPad / 手机网页：优先共享真实 PDF，可在系统面板选“存储到文件”，并保留直接下载入口。

导出过程不会调用打印机或打印预览；PDF 引擎和字体随 PWA / APK 离线内置。

## 数据契约

`vocab.json` 是一个数组，每条：

```jsonc
{
  "id": 1, "group": 1,
  "word": "abandon", "phonetic": "/əˈbændən/",
  "base_meaning": "放弃，抛弃", "pos": "v.",
  "roots": "a-(去) + band(捆绑) → 解开束缚 → 抛弃",
  "examples": [{ "en": "...", "cn": "..." }],
  "confusions": "...", "exam_tip": "...", "mnemonic": "...",
  "status": "done"        // 只有 "done" 的词才会进入学习/闯关
}
```

- 一关 = 一个 `group`（10 个词）；`status !== "done"` 的关在关卡页显示「待生成」并锁定。
- **想换词库**：按此契约组织好，直接覆盖 `public/data/vocab.json`，代码零改动（构建时会自动重拆索引）。

### 当前词库

`public/data/vocab.json` 是**完整考研词库：4533 词 / 454 关**，含音标、词性、释义、例句、词根记忆、同根词、常考短语。
- 来源：开源词表 [kajweb/dict](https://github.com/kajweb/dict)（百词斩 KaoYan 词表），仅做字段映射、**未改写任何释义/音标**，供个人学习使用。
- 备份：最初手写的 30 词演示种子在 `public/data/vocab.seed.json`；重建脚本 [`scripts/build-vocab.cjs`](scripts/build-vocab.cjs)。

#### 人工增强（趣味助记）

数据集自带音标/释义/例句/词根(45%)/同根词/短语，但**没有趣味助记**。手写助记分批放在 `scripts/enrich*.json`（`{ "word": { "mnemonic": "...", "roots": "..." } }`），运行 `node scripts/merge-enrich.cjs` 按 word 合并进 vocab.json：
- `mnemonic` 直接写入；`roots` 仅在原本为空时补（不覆盖数据集真实词根）。幂等、可反复跑、只动这两个字段。
- **已手写 1579 条助记**（覆盖 34.8%）；加上 2058 个真实词根，**2533 词（55.9%）至少有一个记忆抓手**。覆盖了全部高/中频的抽象难词；剩下的多是 potato/rabbit 这类具体名词，故意留空。
- 继续补：往新的 `enrich-0XX.json` 加词条，再跑一次合并即可。

## 性能（懒加载）

整包 `vocab.json` 约 3.3MB。`scripts/split-vocab.cjs`（构建前自动运行）把它拆成：
- `vocab-index.json`（约 736KB）：只含 `id/group/word/phonetic/base_meaning/pos/status` —— 关卡页、闯关、连连看干扰项都够用；
- `groups/g{N}.json`：每关的富字段（词根/例句/辨析/考点/助记），**进关时才按需懒加载**并合并到词卡。

`loadVocab` 优先读索引；进关后 `hydrate` 拉对应分组（带缓存与防竞态）。若拆分文件缺失会**自动回退**整包 `vocab.json`，所以「直接覆盖 vocab.json」的工作流不受影响。首屏从 3.3MB 降到 736KB。

## 进度持久化

`localStorage` 键 `wordquest:v1`，存：已通关关卡 / 星级 / 累计 XP / 连胜 / 错词池 / 每日打卡 / 画风 / 音效·口音偏好。刷新不丢。设置面板可一键重置（保留画风）。

## 功能一览

- **P0**：关卡选择 → 学习翻卡（信息分层展开）→ 闯关（即时反馈）→ 三星结算 + 错词入池；持久化。
- **P1**：错词复习模式 · 两种选择题（英选中/中选英）随机混合 + 词根连连看配对 · SpeechSynthesis 发音 · 每日目标 + 连续打卡 · 进关单词随机打乱。
- **P2**：5 种画风（水墨/像素/霓虹/羊皮纸RPG/极简墨白）· 解锁脉冲 / 连击 / 三星+奖杯爆裂动画（全走通用类/变量）。
- **优化升级**：
  - **PWA**：可安装、离线可用、状态栏颜色随画风变。
  - **懒加载**：首屏 3.3MB → 736KB，进关秒开。
  - **关卡跳转**：「继续学习·第 N 关」直达进度前沿、跳转到任意关、进页自动滚到当前位置。
  - **选择题**：长释义只显首义，避免选项过挤。
  - **浏览模式**：结算页/错词本可「只翻卡不测验」。
  - **桌面键盘**：选择题 `1-4` 选、`Enter` 下一题。
  - **设置面板**：音效开关 / 美英音切换 / 每日目标 / 重置进度。
  - **健壮性**：ErrorBoundary 防白屏；`npm test` 纯函数自测全绿。
- **真题语境背词**：在阅读原文里背单词，英语一、英语二先分入口再进入三种玩法：
  - **真题阅读 · 闯关**（[`PassageScreen.tsx`](src/screens/PassageScreen.tsx) + [`passages.ts`](src/lib/passages.ts)）：**每篇文章 = 一关**，按年份 / Text 分类。每句英文直接显示并高亮考研词；点「翻译 · 看词义」查看整句译文和词义，点词可打开完整词卡。英语二内置 2010—2026 共 68 篇、逐句译文完整，每篇正好 3 条长难句拆解；英语一保留原有数据及 ID，不破坏旧完成记录。
  - **句子精读**（[`ClozeScreen.tsx`](src/screens/ClozeScreen.tsx)）：只载入当前考试分库的逐句语料，可查看翻译、主干、结构和考点，也可粘贴自己的原文。
  - **粘贴精读**（[`ReadScreen.tsx`](src/screens/ReadScreen.tsx)）：粘贴段落 → 自动高亮考研词 → 点词弹卡（释义/词根/例句/助记）。
  - 三者共用词形还原引擎 [`src/lib/annotate.ts`](src/lib/annotate.ts)（纯规则去屈折+小不规则表，命中词库即标注，**离线毫秒级、不用 NLP 库、只读词库**）与点词弹层 [`WordPopup.tsx`](src/components/WordPopup.tsx)。
  - **自行导入**：两个分库都仍支持单篇或批量导入；导入内容只存本机 localStorage，不上传，并自动归入当前选择的英语一或英语二。
  - **版权**：内置历年阅读仅用于个人学习、研究与整理；试题版权归原权利人所有，不用于商业销售。

> 全部功能已在浏览器端到端验证；`npm run build` 通过，`npm test` 全绿。
