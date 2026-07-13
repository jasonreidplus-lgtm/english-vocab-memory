"""Build the small offline font files used by the direct PDF exporter.

The source fonts are Noto Sans SC and Noto Sans under the SIL Open Font
License.  This script keeps only characters that can appear in exported word
records, then renames the subsets so they cannot be confused with upstream
font builds.

Example (Windows):
  python scripts/build-pdf-fonts.py \
    --sc C:/Windows/Fonts/NotoSansSC-VF.ttf \
    --latin-regular C:/Windows/Fonts/NotoSans-Regular.ttf \
    --latin-bold C:/Windows/Fonts/NotoSans-Bold.ttf
"""

from __future__ import annotations

import argparse
import json
import unicodedata
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
DEFAULT_OUTPUT = ROOT / "public" / "fonts" / "pdf"

UI_TEXT = """
考研词关 考研背单词 每日生词 错词本 全部 困难词 易错 学习中 熟悉 即将到期
全部已学单词 生成并保存PDF 下载PDF 共词 每页 页 由考研词关生成
年月日 保存成功 PDF已生成 可直接下载 重新保存
ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
.,;:!?-_/()[]{}<>+='%&@#·，。；：！？（）【】《》“”‘’—…
"""


def usable_character(char: str) -> bool:
    if char in "\n\r\t":
        return False
    category = unicodedata.category(char)
    return category not in {"Cc", "Cf", "Cs", "Co", "Cn"}


def exported_characters() -> set[str]:
    chars = {char for char in UI_TEXT if usable_character(char)}

    vocab = json.loads((DATA / "vocab-index.json").read_text(encoding="utf-8"))
    for word in vocab:
        for key in ("word", "phonetic", "base_meaning", "pos"):
            chars.update(char for char in str(word.get(key) or "") if usable_character(char))

    dictionary = json.loads((DATA / "dict.json").read_text(encoding="utf-8"))
    for spelling, entry in dictionary.items():
        chars.update(char for char in spelling if usable_character(char))
        for key in ("t", "p", "pos"):
            chars.update(char for char in str(entry.get(key) or "") if usable_character(char))

    return chars


def cmap(font: TTFont) -> set[int]:
    points: set[int] = set()
    for table in font["cmap"].tables:
        points.update(table.cmap)
    return points


def rename_font(font: TTFont, family: str, style: str, postscript: str) -> None:
    name_table = font["name"]
    replacements = {
        1: family,
        2: style,
        3: f"WordQuest; {family}; {style}",
        4: f"{family} {style}",
        6: postscript,
        16: family,
        17: style,
    }
    for name_id, value in replacements.items():
        name_table.setName(value, name_id, 3, 1, 0x409)
        name_table.setName(value, name_id, 1, 0, 0)


def load_static_font(path: Path, weight: int) -> TTFont:
    font = TTFont(path)
    if "fvar" in font:
        font = instantiateVariableFont(font, {"wght": weight}, inplace=False, optimize=True)
    return font


def write_subset(
    source: Path,
    destination: Path,
    requested: set[int],
    family: str,
    style: str,
    postscript: str,
    weight: int,
) -> set[int]:
    font = load_static_font(source, weight)
    available = cmap(font)
    included = requested & available

    options = subset.Options()
    options.hinting = False
    options.layout_features = ["*"]
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.notdef_glyph = True
    options.notdef_outline = True
    options.recommended_glyphs = True

    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=included)
    subsetter.subset(font)
    rename_font(font, family, style, postscript)
    destination.parent.mkdir(parents=True, exist_ok=True)
    font.save(destination)
    return included


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sc", type=Path, required=True)
    parser.add_argument("--latin-regular", type=Path, required=True)
    parser.add_argument("--latin-bold", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    chars = exported_characters()
    requested = {ord(char) for char in chars}

    sc_regular = write_subset(
        args.sc,
        args.output_dir / "WordQuestSansSC-Regular.ttf",
        requested,
        "WordQuest PDF Sans SC",
        "Regular",
        "WordQuestPDFSansSC-Regular",
        400,
    )
    latin_regular = write_subset(
        args.latin_regular,
        args.output_dir / "WordQuestSans-Regular.ttf",
        requested,
        "WordQuest PDF Sans",
        "Regular",
        "WordQuestPDFSans-Regular",
        400,
    )
    latin_bold = write_subset(
        args.latin_bold,
        args.output_dir / "WordQuestSans-Bold.ttf",
        requested,
        "WordQuest PDF Sans",
        "Bold",
        "WordQuestPDFSans-Bold",
        700,
    )

    missing = sorted(requested - sc_regular - latin_regular)
    latin_safe = latin_regular & latin_bold
    sc_fallback = sorted(
        point for point in requested
        if point < 0x2E80 and point not in latin_safe
    )
    runtime_missing = sorted(
        point for point in requested
        if (point < 0x2E80 and point not in latin_safe and point not in sc_regular)
        or (point >= 0x2E80 and point not in sc_regular)
    )
    manifest = {
        "sourceCharacters": len(requested),
        "scGlyphs": len(sc_regular),
        "latinRegularGlyphs": len(latin_regular),
        "latinBoldGlyphs": len(latin_bold),
        "missingCodepoints": [f"U+{point:04X}" for point in missing],
        "scFallbackCodepoints": [f"U+{point:04X}" for point in sc_fallback],
        "runtimeMissingCodepoints": [f"U+{point:04X}" for point in runtime_missing],
    }
    (args.output_dir / "font-subset-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False))
    if runtime_missing:
        raise RuntimeError("PDF runtime font routing still has missing glyphs")


if __name__ == "__main__":
    main()
