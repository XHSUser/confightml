#!/usr/bin/env python3
"""Fetch the public Feishu documents and render them as static, read-only HTML."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "legal"

DOCUMENTS = [
    (
        "user-agreement",
        "用户协议",
        "https://my.feishu.cn/docx/Fdr7d3FWBoY7lpxM9Duc4J5mnMf",
    ),
    (
        "technical-support",
        "技术支持",
        "https://my.feishu.cn/docx/A17rdR6RlojXjpxwpJHc4EHVnpb",
    ),
    (
        "privacy-policy",
        "隐私政策",
        "https://my.feishu.cn/docx/IzAhdoS1gog7AcxxAc5ca4Mdn2d",
    ),
    (
        "membership-agreement",
        "会员协议",
        "https://my.feishu.cn/docx/Q6UfdrBqMoQIQjxT4jacQjC7nMc",
    ),
]


def extract_data(source: str) -> dict:
    marker = "window.DATA = Object.assign"
    start = source.index(marker)
    start = source.index("Object(", start) + len("Object(")
    depth = 0
    quoted = False
    escaped = False
    end = None
    for index in range(start, len(source)):
        char = source[index]
        if quoted:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quoted = False
            continue
        if char == '"':
            quoted = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                end = index + 1
                break
    if end is None:
        raise ValueError("Could not locate Feishu document data")
    return json.loads(source[start:end])["data"]


def fetch(url: str) -> dict:
    response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    response.raise_for_status()
    return extract_data(response.text)


def block_text(block: dict) -> str:
    text = block.get("text", {}).get("initialAttributedTexts", {}).get("text", {})
    return "".join(text.values()).replace("\u200b", "").strip()


def is_section_heading(text: str) -> bool:
    return bool(
        re.match(r"^(?:[一二三四五六七八九十百]+[、.]|\d+(?:\.\d+)*[、.]?)\S", text)
        and len(text) < 80
    )


def render_body(data: dict) -> str:
    chunks: list[str] = []
    for block_id in data["block_sequence"]:
        block = data["block_map"][block_id]["data"]
        kind = block.get("type")
        text = block_text(block)
        if kind == "page" or not text:
            continue
        escaped = html.escape(text)
        if kind == "heading1":
            chunks.append(f"<h2>{escaped}</h2>")
        elif kind == "ordered":
            sequence = html.escape(str(block.get("seq", "")))
            chunks.append(
                f'<p class="ordered"><span class="marker">{sequence}.</span>{escaped}</p>'
            )
        elif is_section_heading(text):
            chunks.append(f"<h2>{escaped}</h2>")
        else:
            chunks.append(f"<p>{escaped}</p>")
    return "\n".join(chunks)


def page(title: str, source_url: str, body: str) -> str:
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)}</title>
  <link rel="stylesheet" href="legal.css">
</head>
<body>
  <main class="reading-page">
    <nav class="topbar" aria-label="文档导航"><a href="index.html">文档目录</a></nav>
    <article class="document">
      <header class="document-header">
        <p class="eyebrow">公开文档</p>
        <h1>{html.escape(title)}</h1>
        <p class="source">内容来源：飞书云文档</p>
      </header>
      <section class="content">
{body}
      </section>
    </article>
    <footer class="footer"><a href="index.html">返回文档目录</a></footer>
  </main>
</body>
</html>
'''


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for slug, title, url in DOCUMENTS:
        data = fetch(url)
        (OUT / f"{slug}.html").write_text(page(title, url, render_body(data)), encoding="utf-8")


if __name__ == "__main__":
    main()
