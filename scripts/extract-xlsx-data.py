#!/usr/bin/env python3
import json
import re
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "全国大学宿舍情况.xlsx"
OUTPUT = ROOT / "data.js"
BAD_TEXT_VALUES = {"关注上了么(安徽升学)"}
TIME_FIELDS = {"洗澡热水时段", "夜间断电", "夜间断网", "晚归门禁时间"}

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    "office_rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def column_index(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref or "")
    if not letters:
        return 0

    total = 0
    for char in letters.group(0):
        total = total * 26 + ord(char) - ord("A") + 1
    return total - 1


def shared_strings(zip_file: ZipFile) -> list[str]:
    root = ET.fromstring(zip_file.read("xl/sharedStrings.xml"))
    strings = []
    for item in root.findall("main:si", NS):
        text = "".join(node.text or "" for node in item.findall(".//main:t", NS))
        strings.append(text)
    return strings


def workbook_sheet_path(zip_file: ZipFile, sheet_name: str) -> str:
    workbook = ET.fromstring(zip_file.read("xl/workbook.xml"))
    rels_root = ET.fromstring(zip_file.read("xl/_rels/workbook.xml.rels"))
    rels = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels_root.findall("rel:Relationship", NS)
    }

    for sheet in workbook.findall("main:sheets/main:sheet", NS):
        if sheet.attrib.get("name") == sheet_name:
            rel_id = sheet.attrib[f"{{{NS['office_rel']}}}id"]
            target = rels[rel_id]
            return f"xl/{target}" if not target.startswith("xl/") else target

    raise ValueError(f"Sheet not found: {sheet_name}")


def cell_value(cell: ET.Element, strings: list[str]) -> str:
    value_node = cell.find("main:v", NS)
    raw_value = "" if value_node is None or value_node.text is None else value_node.text
    cell_type = cell.attrib.get("t")

    if cell_type == "s" and raw_value:
        return strings[int(raw_value)].strip()
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//main:t", NS)).strip()
    return raw_value.strip()


def read_sheet(zip_file: ZipFile, sheet_path: str, strings: list[str]) -> tuple[list[str], list[list[str]]]:
    rows = []
    for _, row in ET.iterparse(zip_file.open(sheet_path), events=("end",)):
        if not row.tag.endswith("}row"):
            continue

        values = []
        for cell in row.findall("main:c", NS):
            index = column_index(cell.attrib.get("r", ""))
            while len(values) <= index:
                values.append("")
            values[index] = cell_value(cell, strings)

        if any(values):
            rows.append(values)
        row.clear()

    headers = rows[0]
    data_rows = []
    for row in rows[1:]:
        row = row[: len(headers)]
        if len(row) < len(headers):
            row.extend([""] * (len(headers) - len(row)))
        data_rows.append(clean_row(headers, row))
    return headers, data_rows


def excel_time(value: str) -> str:
    try:
        number = float(value)
    except ValueError:
        return value

    if number < 0 or number > 1:
        return value

    total_minutes = int(round(number * 24 * 60))
    hours = total_minutes // 60
    minutes = total_minutes % 60
    if hours == 24 and minutes == 0:
        return "24:00"
    return f"{hours:02d}:{minutes:02d}"


def clean_row(headers: list[str], row: list[str]) -> list[str]:
    cleaned = []
    for field, value in zip(headers, row):
        value = value.strip()
        if value in BAD_TEXT_VALUES:
            value = ""
        elif field in TIME_FIELDS and re.fullmatch(r"\d+(?:\.\d+)?", value):
            value = excel_time(value)
        cleaned.append(value)
    return cleaned


def is_valid_row(headers: list[str], row: list[str]) -> bool:
    item = dict(zip(headers, row))
    province = item.get("省份", "").strip()
    school = item.get("院校名称", "").strip()
    if not province or not school:
        return False
    if province in BAD_TEXT_VALUES or school in BAD_TEXT_VALUES:
        return False
    return True


def main() -> None:
    with ZipFile(SOURCE) as zip_file:
        strings = shared_strings(zip_file)
        sheet_path = workbook_sheet_path(zip_file, "Sheet1")
        headers, rows = read_sheet(zip_file, sheet_path, strings)
        rows = [row for row in rows if is_valid_row(headers, row)]

    payload = {
        "source": SOURCE.name,
        "fields": headers,
        "rows": rows,
    }
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    OUTPUT.write_text(f"window.DORM_DATA={body};\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.name}: {len(rows)} rows, {len(headers)} fields")


if __name__ == "__main__":
    main()
