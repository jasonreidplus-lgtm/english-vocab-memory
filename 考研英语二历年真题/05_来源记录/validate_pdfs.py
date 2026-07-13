from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader


def compact(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def inspect_pdf(path: Path, root: Path) -> dict:
    raw_head = path.read_bytes()[:1024]
    result = {
        "path": path.relative_to(root).as_posix(),
        "size": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "pdf_signature": raw_head.startswith(b"%PDF-"),
        "html_signature": bool(re.search(br"<!doctype\s+html|<html", raw_head, re.I)),
        "page_count": 0,
        "encrypted": False,
        "extract_errors": 0,
        "text_chars": 0,
        "year_hits": [],
        "english2_markers": 0,
        "english1_markers": 0,
        "answer_markers": 0,
        "sample": "",
        "open_status": "failed",
        "error": "",
    }

    try:
        reader = PdfReader(path, strict=False)
        result["encrypted"] = bool(reader.is_encrypted)
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:
                pass
        result["page_count"] = len(reader.pages)

        chunks = []
        for page in reader.pages:
            try:
                chunks.append(page.extract_text() or "")
            except Exception:
                result["extract_errors"] += 1
        text = compact("\n".join(chunks))
        result["text_chars"] = len(text)
        result["year_hits"] = sorted(set(re.findall(r"(?:19|20)\d{2}", text)))
        result["english2_markers"] = len(
            re.findall(r"英语\s*二|科目(?:代码)?\s*[:：]?\s*204|204\s*英语", text)
        )
        result["english1_markers"] = len(
            re.findall(r"英语\s*一|科目(?:代码)?\s*[:：]?\s*201|201\s*英语", text)
        )
        result["answer_markers"] = len(re.findall(r"参考答案|答案与解析|试题答案|答案", text))
        result["sample"] = text[:1200]
        result["open_status"] = "ok" if result["page_count"] > 0 else "empty"
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
    return result


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    root = Path(sys.argv[1]).resolve()
    for path in sorted(root.rglob("*.pdf")):
        print(json.dumps(inspect_pdf(path, root), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
