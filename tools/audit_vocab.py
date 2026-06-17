#!/usr/bin/env python3
"""Audit one vocabulary level without changing the source workbook."""

from __future__ import annotations

import csv
import html
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from pathlib import Path

from convert_vocab import DEFAULT_WORKBOOK, NS, cell_column, cell_text, shared_strings, sheet_paths


PROJECT_DIR = Path(__file__).resolve().parent.parent
REPORT_DIR = PROJECT_DIR / "reports"
TARGET_LEVEL = (sys.argv[1] if len(sys.argv) > 1 else "N2").upper()
WORKBOOK_PATH = (
    Path(sys.argv[2]).expanduser().resolve()
    if len(sys.argv) > 2
    else DEFAULT_WORKBOOK
)

SIMPLIFIED_MAP = {
    "爱": "愛", "边": "辺", "变": "変", "宾": "賓", "处": "処",
    "传": "伝", "单": "単", "动": "動", "发": "発", "复": "復",
    "观": "観", "广": "広", "机": "機", "济": "済", "价": "価",
    "间": "間", "节": "節", "进": "進", "经": "経", "觉": "覚",
    "开": "開", "乐": "楽", "历": "歴", "练": "練", "两": "両",
    "疗": "療", "龙": "竜", "卖": "売", "门": "門", "难": "難",
    "气": "気", "轻": "軽", "请": "請", "权": "権", "让": "譲",
    "热": "熱", "认": "認", "荣": "栄", "烧": "焼", "实": "実",
    "时": "時", "书": "書", "术": "術", "说": "説", "听": "聴",
    "团": "団", "图": "図", "为": "為", "围": "囲", "问": "問",
    "无": "無", "习": "習", "戏": "戯", "县": "県", "乡": "郷",
    "协": "協", "药": "薬", "业": "業", "译": "訳", "营": "営",
    "应": "応", "邮": "郵", "预": "予", "园": "園", "远": "遠",
    "运": "運", "杂": "雑", "脏": "臓", "战": "戦", "证": "証",
    "职": "職", "质": "質", "钟": "鐘", "终": "終", "种": "種",
    "专": "専", "转": "転", "总": "総", "组": "組", "贝": "貝",
    "车": "車", "东": "東", "岛": "島", "电": "電", "华": "華",
    "块": "塊", "览": "覧", "类": "類", "临": "臨", "满": "満",
    "桥": "橋", "确": "確", "线": "線", "义": "義", "阴": "陰",
    "愿": "願", "则": "則", "针": "針", "众": "衆", "锅": "鍋",
    "剧": "劇", "视": "視", "调": "調", "办": "辦", "验": "験",
    "续": "続", "减": "減",
}


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = value.replace("〜", "～")
    value = re.sub(r"[\[［]する[\]］]", "する", value)
    value = re.sub(r"[（）()]", "", value)
    return re.sub(r"\s+", "", value)


def pair_key(row: dict[str, str | int]) -> tuple[str, str]:
    return normalize(str(row["jp"])), normalize(str(row["kana"]))


def word_key(row: dict[str, str | int]) -> str:
    return normalize(str(row["jp"]))


def row_dict(values: list[str], row_number: int) -> dict[str, str | int]:
    return {
        "row": row_number,
        "level": values[0].upper(),
        "jp": values[1],
        "kana": values[2],
        "cn": values[3],
    }


def read_level_for_audit(
    archive: zipfile.ZipFile,
    sheet_path: str,
    strings: list[str],
) -> list[dict[str, str | int]]:
    root = ET.fromstring(archive.read(sheet_path))
    records = []
    for row in root.findall(".//x:sheetData/x:row", NS):
        values = ["", "", "", ""]
        for cell in row.findall("x:c", NS):
            column = cell_column(cell.attrib.get("r", "A1"))
            if column < 4:
                values[column] = cell_text(cell, strings).strip()
        if [value.lower() for value in values] == ["level", "jp", "kana", "cn"]:
            continue
        if not any(values):
            continue
        if values[0] and not any(values[1:]):
            continue
        records.append(row_dict(values, int(row.attrib.get("r", "0"))))
    return records


def write_csv(name: str, headers: list[str], rows: list[list[object]]) -> Path:
    path = REPORT_DIR / name
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(headers)
        writer.writerows(rows)
    return path


with zipfile.ZipFile(WORKBOOK_PATH) as archive:
    strings = shared_strings(archive)
    paths = sheet_paths(archive)
    if TARGET_LEVEL not in paths:
        raise ValueError(f"Excel中没有工作表：{TARGET_LEVEL}")

    all_rows: dict[str, list[dict[str, str | int]]] = {}
    for level, sheet_path in paths.items():
        if level not in {"N5", "N4", "N3", "N2", "N1"}:
            continue
        all_rows[level] = read_level_for_audit(archive, sheet_path, strings)

target_rows = all_rows[TARGET_LEVEL]
lower_levels = [
    level for level in ("N5", "N4", "N3", "N2", "N1")
    if level in all_rows and level != TARGET_LEVEL
]
lower_rows = [row for level in lower_levels for row in all_rows[level]]

lower_by_pair: dict[tuple[str, str], list[dict[str, str | int]]] = defaultdict(list)
lower_by_word: dict[str, list[dict[str, str | int]]] = defaultdict(list)
for row in lower_rows:
    lower_by_pair[pair_key(row)].append(row)
    lower_by_word[word_key(row)].append(row)

exact_duplicates: list[list[object]] = []
same_word_different_kana: list[list[object]] = []
simplified_candidates: list[list[object]] = []
field_issues: list[list[object]] = []
target_by_pair: dict[tuple[str, str], list[dict[str, str | int]]] = defaultdict(list)

for row in target_rows:
    target_by_pair[pair_key(row)].append(row)
    exact_matches = lower_by_pair.get(pair_key(row), [])
    if exact_matches:
        for old in exact_matches:
            exact_duplicates.append([
                row["row"], row["jp"], row["kana"], row["cn"],
                old["level"], old["row"], old["jp"], old["kana"], old["cn"],
                f"删除{TARGET_LEVEL}该项",
            ])
    else:
        for old in lower_by_word.get(word_key(row), []):
            if normalize(str(row["kana"])) != normalize(str(old["kana"])):
                same_word_different_kana.append([
                    row["row"], row["jp"], row["kana"], row["cn"],
                    old["level"], old["row"], old["kana"], old["cn"],
                    "人工确认是否为多音词或录入错误",
                ])

    replacements = sorted({
        f"{char}→{SIMPLIFIED_MAP[char]}"
        for char in str(row["jp"])
        if char in SIMPLIFIED_MAP
    })
    if replacements:
        simplified_candidates.append([
            row["row"], row["jp"], row["kana"], row["cn"],
            "、".join(replacements), "核对后改为日汉字",
        ])

    if not all(str(row[field]).strip() for field in ("level", "jp", "kana", "cn")):
        field_issues.append([
            "字段缺失", row["row"], row["level"], row["jp"], row["kana"], row["cn"],
        ])
    if row["level"] != TARGET_LEVEL:
        field_issues.append([
            "等级错误", row["row"], row["level"], row["jp"], row["kana"], row["cn"],
        ])

internal_groups = [rows for rows in target_by_pair.values() if len(rows) > 1]
internal_rows: list[list[object]] = []
for group_number, rows in enumerate(internal_groups, start=1):
    for index, row in enumerate(rows):
        internal_rows.append([
            group_number, row["row"], row["jp"], row["kana"], row["cn"],
            "保留或合并释义" if index == 0 else "删除或合并",
        ])

REPORT_DIR.mkdir(parents=True, exist_ok=True)
files = [
    write_csv(
        f"{TARGET_LEVEL}-确定重复.csv",
        [f"{TARGET_LEVEL}原行号", f"{TARGET_LEVEL}日语", f"{TARGET_LEVEL}假名", f"{TARGET_LEVEL}中文", "重复等级",
         "旧表原行号", "旧表日语", "旧表假名", "旧表中文", "建议"],
        exact_duplicates,
    ),
    write_csv(
        f"{TARGET_LEVEL}-同词不同读音.csv",
        [f"{TARGET_LEVEL}原行号", f"{TARGET_LEVEL}日语", f"{TARGET_LEVEL}假名", f"{TARGET_LEVEL}中文", "旧等级",
         "旧表原行号", "旧表假名", "旧表中文", "建议"],
        same_word_different_kana,
    ),
    write_csv(
        f"{TARGET_LEVEL}-内部重复.csv",
        ["重复组", f"{TARGET_LEVEL}原行号", "日语", "假名", "中文", "建议"],
        internal_rows,
    ),
    write_csv(
        f"{TARGET_LEVEL}-疑似简体字.csv",
        [f"{TARGET_LEVEL}原行号", "日语", "假名", "中文", "疑似字符", "建议"],
        simplified_candidates,
    ),
    write_csv(
        f"{TARGET_LEVEL}-字段问题.csv",
        ["类型", f"{TARGET_LEVEL}原行号", "level", "日语", "假名", "中文"],
        field_issues,
    ),
]

summary = {
    "target_level": TARGET_LEVEL,
    "target_count": len(target_rows),
    "compared_levels": lower_levels,
    "exact_duplicate_matches": len(exact_duplicates),
    "exact_duplicate_target_rows": len({row[0] for row in exact_duplicates}),
    "same_word_different_kana": len(same_word_different_kana),
    "internal_duplicate_groups": len(internal_groups),
    "simplified_candidates": len(simplified_candidates),
    "field_issues": len(field_issues),
}
(REPORT_DIR / f"{TARGET_LEVEL}-检查摘要.json").write_text(
    json.dumps(summary, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
(REPORT_DIR / f"{TARGET_LEVEL}-检查明细.json").write_text(
    json.dumps(
        {
            "summary": summary,
            "exact_duplicates": exact_duplicates,
            "same_word_different_kana": same_word_different_kana,
            "internal_duplicates": internal_rows,
            "simplified_candidates": simplified_candidates,
            "field_issues": field_issues,
        },
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)

html_rows = "".join(
    f"<tr><th>{html.escape(label)}</th><td>{value}</td></tr>"
    for label, value in [
        ("检查等级", TARGET_LEVEL),
        ("原始词条", len(target_rows)),
        ("对比等级", "、".join(lower_levels)),
        ("确定重复词条", summary["exact_duplicate_target_rows"]),
        ("同词不同读音", len(same_word_different_kana)),
        ("内部重复组", len(internal_groups)),
        ("疑似简体字", len(simplified_candidates)),
        ("字段问题", len(field_issues)),
    ]
)
links = "".join(
    f'<li><a href="{html.escape(file.name)}">{html.escape(file.name)}</a></li>'
    for file in files
)
report_html = f"""<!doctype html>
<html lang="zh-CN"><meta charset="utf-8">
<title>{TARGET_LEVEL}词汇检查报告</title>
<style>
body{{font-family:-apple-system,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#263238}}
table{{width:100%;border-collapse:collapse;margin:24px 0}}th,td{{padding:10px;border:1px solid #d9e3ea;text-align:left}}
th{{background:#eef8f1}}h1{{font-size:26px}}a{{color:#2f7d4a}}
</style>
<h1>{TARGET_LEVEL}词汇检查报告</h1>
<p>本报告只检查，不会修改原始Excel。</p>
<table>{html_rows}</table>
<h2>详细文件</h2><ul>{links}</ul>
</html>"""
(REPORT_DIR / f"{TARGET_LEVEL}-检查报告.html").write_text(report_html, encoding="utf-8")

print(json.dumps(summary, ensure_ascii=False, indent=2))
print(f"报告目录：{REPORT_DIR}")
