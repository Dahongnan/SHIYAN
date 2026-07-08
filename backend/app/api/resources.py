"""
资源下载 API — 后端生成有效的 .docx / .pptx 文件并返回二进制流。
"""

from __future__ import annotations

import io
import zipfile
from urllib.parse import quote

from fastapi import APIRouter
from fastapi.responses import Response

router = APIRouter(prefix="/api/resources", tags=["资源下载"])


def _build_docx(title: str, body: str) -> bytes:
    """生成最小有效 .docx 文件（Office Open XML 格式）。"""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            '</Types>',
        )
        zf.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            '</Relationships>',
        )
        zf.writestr(
            "word/_rels/document.xml.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
        )
        paragraphs = []
        for line in body.split("\n"):
            escaped = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            paragraphs.append(
                f'<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr>'
                f'<w:t xml:space="preserve">{escaped}</w:t></w:r></w:p>'
            )
        zf.writestr(
            "word/document.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
            ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<w:body>'
            f'<w:p><w:pPr><w:jc w:val="center"/></w:pPr>'
            f'<w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr>'
            f'<w:t xml:space="preserve">{title}</w:t></w:r></w:p>'
            f'<w:p/>'
            f'{"".join(paragraphs)}'
            '</w:body></w:document>',
        )
    return buf.getvalue()


def _build_pptx(title: str, body: str) -> bytes:
    """生成最小有效 .pptx 文件。"""
    lines = [l for l in body.split("\n") if l.strip()]
    slides_xml_parts = []
    for i, line in enumerate(lines):
        escaped = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        slides_xml_parts.append(
            '<p:sld>'
            '<p:cSld><p:spTree>'
            '<p:sp><p:nvSpPr><p:cNvPr id="1" name="Text"/><p:cNvSpPr><a:spLocks noGrp="1"/>'
            '</p:cNvSpPr><p:nvPr/></p:nvSpPr>'
            '<p:spPr><a:xfrm><a:off x="914400" y="457200"/>'
            '<a:ext cx="8229600" cy="914400"/></a:xfrm></p:spPr>'
            '<p:txBody><a:bodyPr/><a:lstStyle/>'
            '<a:p><a:r><a:rPr lang="zh-CN" sz="2400" b="1"/>'
            f'<a:t>{escaped}</a:t></a:r></a:p>'
            '</p:txBody></p:sp>'
            '</p:spTree></p:cSld>'
            '</p:sld>'
        )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
            '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
            '</Types>',
        )
        zf.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>'
            '</Relationships>',
        )
        zf.writestr(
            "ppt/_rels/presentation.xml.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>'
            '</Relationships>',
        )
        zf.writestr(
            "ppt/presentation.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
            '<p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>'
            '</p:presentation>',
        )
        zf.writestr(
            "ppt/slides/slide1.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
            ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
            ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<p:cSld><p:spTree>'
            f'{"".join(slides_xml_parts)}'
            '</p:spTree></p:cSld>'
            '</p:sld>',
        )
    return buf.getvalue()


@router.get("/download/{filename}")
async def download_resource(filename: str, content: str = ""):
    """下载教学资源文件。根据扩展名动态生成有效的 Office 文档。"""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    base_name = filename.rsplit(".", 1)[0] if "." in filename else filename

    if not content:
        content = (
            "═══════════════════════════════════════\n"
            "  学科助教系统 Edu-TA — 演示文档\n"
            "═══════════════════════════════════════\n\n"
            f"文件名：{filename}\n"
            "所属项目：挑战杯 · 学科垂类大模型赛道\n\n"
            "此文件由后端 Python zipfile 生成，\n"
            "符合 Office Open XML 标准。\n"
            "═══════════════════════════════════════"
        )

    if ext == "docx":
        file_data = _build_docx(title=base_name, body=content)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif ext == "pptx":
        file_data = _build_pptx(title=base_name, body=content)
        media_type = "application/vnd.openxmlformats-officedocument.presentationml.document"
    else:
        # PDF / ZIP 等其余格式：纯文本 + .txt 后缀，确保能打开
        file_data = content.encode("utf-8")
        media_type = "text/plain; charset=utf-8"
        filename = filename + ".txt"

    encoded_filename = quote(filename, safe="")
    return Response(
        content=file_data,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "Content-Length": str(len(file_data)),
        },
    )
