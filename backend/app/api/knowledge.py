"""
知识库管理 API — 知识库的增删查管 RESTful 接口。
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, UploadFile

from app.models.schemas import APIResponse, KnowledgeBaseStatus, SearchRequest, SearchResponse
from app.services import knowledge_base as kb_service

router = APIRouter(prefix="/api/knowledge", tags=["知识库"])


@router.post("/search", response_model=APIResponse)
async def search_knowledge(request: SearchRequest):
    """
    语义搜索知识库。

    基于向量相似度检索与查询语义最相关的知识片段，
    支持按课程和章节过滤。
    """
    try:
        chunks = kb_service.search(
            query=request.query,
            course=request.course_name or "default",
            top_k=request.top_k,
            filter_criteria=request.filter_criteria or None,
        )
        return APIResponse(
            success=True,
            data=SearchResponse(
                results=chunks,
                total_found=len(chunks),
                query=request.query,
            ).model_dump(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload", response_model=APIResponse)
async def upload_document(
    file: UploadFile,
    course: str = Form("default"),
    chapter: str = Form(""),
):
    """
    上传教材文件到知识库。

    支持 PDF 和 TXT 格式（最大 200MB），自动进行文本分块和向量化存储。
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="请选择文件")

    # 检查文件大小（200MB 限制）
    MAX_SIZE = 200 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="文件大小超过 200MB 限制")

    # 保存上传文件
    upload_dir = Path(__file__).parent.parent.parent / "knowledge_base" / "textbooks"
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / file.filename

    file_path.write_bytes(content)

    try:
        chunk_count = kb_service.add_textbook(
            file_path=str(file_path),
            course=course,
            chapter=chapter,
        )
        return APIResponse(
            success=True,
            message=f"文件 {file.filename} 已导入，共 {chunk_count} 个文本块",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.get("/status", response_model=APIResponse)
async def get_knowledge_status():
    """获取知识库状态信息。"""
    status = kb_service.get_status()
    return APIResponse(success=True, data=status.model_dump())


@router.get("/collections", response_model=APIResponse)
async def list_collections():
    """列出所有知识库集合。"""
    collections = kb_service.list_collections()
    return APIResponse(success=True, data=collections)


@router.delete("/collections/{course}", response_model=APIResponse)
async def delete_collection(course: str):
    """删除指定课程的知识库。"""
    success = kb_service.delete_collection(course)
    if success:
        return APIResponse(success=True, message=f"已删除课程 '{course}' 的知识库")
    raise HTTPException(status_code=404, detail=f"课程 '{course}' 的知识库不存在")
