# 英语二阅读数据源

- 覆盖：2010—2026，每年 Text 1—4，共 68 篇。
- `拆句_JSONL`：从对应年份正式真题 PDF 复原并人工校订的逐句英文，ID 格式为 `E2-YYYY-TN-P1-S#`。
- `translations`：与每条 ID 一一对应的中文译文。
- `analyses`：每篇正好 3 个长难句，包含主干、结构、逻辑与考点。
- 构建：`node scripts/build-passages.mjs` 与英语一数据合并到 `public/data/passages.json`；英语一保留原有 `ky-YYYY-tN`，英语二使用 `ky-e2-YYYY-tN`，通过 `exam` 字段严格分库。

原始 PDF、来源记录、逐文件校验、可读 Markdown 与辅助文本源保存在项目根目录 `考研英语二历年真题`。资料仅用于个人学习、研究和整理。
