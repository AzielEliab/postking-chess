"""Tiny markdown-to-HTML converter. No extra deps."""

from __future__ import annotations

import html
import re


def _inline(text: str) -> str:
    text = html.escape(text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    return text


def markdown_to_html(md: str) -> str:
    lines = md.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    in_ul = False
    in_ol = False
    para: list[str] = []

    def flush_para() -> None:
        nonlocal para
        if para:
            out.append("<p>" + " ".join(_inline(x) for x in para) + "</p>")
            para = []

    def close_lists() -> None:
        nonlocal in_ul, in_ol
        if in_ul:
            out.append("</ul>")
            in_ul = False
        if in_ol:
            out.append("</ol>")
            in_ol = False

    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            flush_para()
            close_lists()
            continue
        if line.strip() == "---":
            flush_para()
            close_lists()
            out.append("<hr>")
            continue
        if line.startswith("### "):
            flush_para()
            close_lists()
            out.append(f"<h3>{_inline(line[4:])}</h3>")
            continue
        if line.startswith("## "):
            flush_para()
            close_lists()
            out.append(f"<h2>{_inline(line[3:])}</h2>")
            continue
        if line.startswith("# "):
            flush_para()
            close_lists()
            out.append(f"<h1>{_inline(line[2:])}</h1>")
            continue
        m_ul = re.match(r"^[-*] (.+)$", line)
        if m_ul:
            flush_para()
            if in_ol:
                out.append("</ol>")
                in_ol = False
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{_inline(m_ul.group(1))}</li>")
            continue
        m_ol = re.match(r"^\d+\. (.+)$", line)
        if m_ol:
            flush_para()
            if in_ul:
                out.append("</ul>")
                in_ul = False
            if not in_ol:
                out.append("<ol>")
                in_ol = True
            out.append(f"<li>{_inline(m_ol.group(1))}</li>")
            continue
        if line.startswith("> "):
            flush_para()
            close_lists()
            out.append(f"<blockquote>{_inline(line[2:])}</blockquote>")
            continue
        para.append(line.strip())
    flush_para()
    close_lists()
    return "\n".join(out)
