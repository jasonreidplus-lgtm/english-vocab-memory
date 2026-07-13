# 来源与重建说明

## 交付记录

- `资料来源.csv`：每份最终 PDF 的年份、类型、原始名、仓库/URL、大小、页数、状态和备注；另记录一个非 PDF 辅助文本源。
- `SHA256校验值.csv`：资料库内全部最终文件的 SHA256（索引自身除外）。
- `_pdf_validation_raw.jsonl`：逐 PDF 技术检查的机器可读原始结果。

## 可复核脚本

1. `validate_pdfs.py`：检查所有 PDF 的文件头、HTML 特征、打开状态、页数、加密状态、全文提取、年份和考试标记。
2. `generate_source_records.mjs`：由 PDF 原始检查结果生成 `资料来源.csv`。
3. `extract_reading_from_pdfs.py`：从正式年度 PDF 定位 4 篇阅读的初始文本；输出必须再人工逐句校订。
4. `validate_reading_data.mjs`：检查 68 篇的 JSON、连续 ID、逐句译文、每篇 3 条长难句和 OCR 异常。
5. `sync_reading_derivatives.mjs`：生成阅读文章、手译版、逐句精读、长难句 Markdown，并同步到应用 `data-src/英语二`。
6. `generate_sha256.mjs`：全部文档定稿后最后运行，生成哈希表。

`build_english2_reading.mjs` 是从未校对 TeX 辅助源构建初稿和阅读答案索引的留档脚本，不能替代正式 PDF 与人工复核。
