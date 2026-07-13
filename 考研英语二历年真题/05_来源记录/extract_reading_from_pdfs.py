"""Extract English II Reading Part A (Text 1-4) from the verified single-year PDFs."""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader


ABBR = [
    "Mr", "Mrs", "Ms", "Dr", "Prof", "Sr", "Jr", "St", "vs", "etc", "Inc", "Ltd", "Co", "No", "Vol",
    "U.S", "U.K", "U.N", "e.g", "i.e", "a.m", "p.m",
]


def normalize(raw: str) -> str:
    lines: list[str] = []
    for line in raw.replace("\r", "").split("\n"):
        s = line.strip()
        if not s:
            continue
        if re.fullmatch(r"[-·—\s]*\d+[-·—\s]*", s):
            continue
        if re.fullmatch(r"英语\s*[（(]二[）)]\s*试题.*", s):
            continue
        if re.fullmatch(r"[（(]共\s*14\s*页[）)]", s):
            continue
        lines.append(s)
    text = " ".join(lines)
    return (
        text
        .replace("“", '"').replace("”", '"').replace("„", '"').replace("″", '"')
        .replace("‘", "'").replace("’", "'").replace("‛", "'").replace("′", "'")
        .replace("—", " - ").replace("–", " - ")
    )


def clean_spacing(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([,.;:!?%])", r"\1", text)
    text = re.sub(r"([,;:])(?=[A-Za-z])", r"\1 ", text)
    return text.strip()


def split_sentences(text: str) -> list[str]:
    protected = f" {text} "
    for idx, abbr in enumerate(ABBR):
        protected = re.sub(
            rf"\b{re.escape(abbr)}\.",
            f"{abbr}<D{idx}>",
            protected,
        )
    protected = re.sub(r"\b([A-Z])\.(?=\s[A-Z])", r"\1<DI>", protected)
    parts = re.findall(r"[^.!?]+[.!?]+[\"']*(?=\s|$)", protected)
    if not parts:
        parts = [protected]
    out: list[str] = []
    for part in parts:
        part = re.sub(r"<D(\d+)>", lambda m: f"{ABBR[int(m.group(1))]}.", part)
        part = part.replace("<DI>", ".")
        part = re.sub(r"^[\"']\s+", "", part)
        part = clean_spacing(part)
        if len(re.sub(r"[^A-Za-z]", "", part)) >= 15:
            out.append(part)
    return out


def read_pdf(path: Path) -> str:
    reader = PdfReader(path, strict=False)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def extract_text(full: str, text_no: int) -> str:
    start_match = re.search(rf"\bText\s*{text_no}\b", full, re.I)
    if not start_match:
        raise ValueError(f"missing Text {text_no}")
    start = start_match.end()
    question = 16 + text_no * 5  # 21, 26, 31, 36
    end_match = re.search(rf"\b{question // 10}\s*{question % 10}\s*[.．]", full[start:], re.I)
    if not end_match and text_no == 4:
        end_match = re.search(r"\bPart\s*B\b", full[start:], re.I)
    if not end_match:
        raise ValueError(f"missing question boundary {question}")
    return clean_spacing(normalize(full[start : start + end_match.start()]))


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    library = Path(sys.argv[1]).resolve()
    source = library / "01_单年份真题"
    out = library / "06_阅读加工"
    article_dir = out / "阅读文章"
    md_dir = out / "拆句_Markdown"
    jsonl_dir = out / "拆句_JSONL"
    for directory in (article_dir, md_dir, jsonl_dir):
        directory.mkdir(parents=True, exist_ok=True)

    audit_rows: list[dict] = []
    passage_count = 0
    sentence_count = 0
    for year in range(2010, 2027):
        pdf = source / str(year) / f"{year}年考研英语二真题.pdf"
        full = read_pdf(pdf)
        for text_no in range(1, 5):
            article = extract_text(full, text_no)
            sentences = split_sentences(article)
            records = [
                {
                    "id": f"E2-{year}-T{text_no}-P1-S{idx}",
                    "exam": "english2",
                    "year": year,
                    "text": text_no,
                    "paragraph": 1,
                    "sentence": idx,
                    "en": sentence,
                }
                for idx, sentence in enumerate(sentences, 1)
            ]
            title = f"{year} 英语二 Text {text_no}"
            (article_dir / f"{year}-Text{text_no}.md").write_text(
                f"## {title}\n\n{article}\n", encoding="utf-8"
            )
            (md_dir / f"{year}-Text{text_no}.md").write_text(
                f"## {title}\n\n" + "\n".join(f"- {r['id']}  {r['en']}" for r in records) + "\n",
                encoding="utf-8",
            )
            (jsonl_dir / f"{year}-Text{text_no}.jsonl").write_text(
                "\n".join(json.dumps(r, ensure_ascii=False) for r in records) + "\n",
                encoding="utf-8",
            )
            suspicious = sorted(set(re.findall(r"\b\w*(?:\d|[\u4e00-\u9fff])\w*\b", article)))
            audit_rows.append({
                "年份": year,
                "篇目": f"Text {text_no}",
                "句数": len(sentences),
                "字符数": len(article),
                "可疑OCR片段": " | ".join(suspicious),
            })
            passage_count += 1
            sentence_count += len(sentences)

    with (out / "英文提取校验.csv").open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(audit_rows[0]))
        writer.writeheader()
        writer.writerows(audit_rows)
    print(f"PDF reading extraction: {passage_count} passages / {sentence_count} sentences")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
