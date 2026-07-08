"""
知识库服务 — 基于 ChromaDB 的学科向量知识库。

功能：
- 文档导入与分块
- 向量化存储
- 语义检索（RAG 底层）
- 知识库管理
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import settings
from app.core.embeddings import get_embedding, embed_batch
from app.models.schemas import DocumentChunk, KnowledgeBaseStatus

# ── ChromaDB 客户端单例（避免多 worker 并发创建 SQLite 连接导致锁竞争）──
_client: chromadb.Client | None = None


def _get_client() -> chromadb.Client:
    """获取 ChromaDB 客户端（持久化模式，模块级单例）。"""
    global _client
    if _client is not None:
        return _client
    _client = chromadb.PersistentClient(
        path=settings.vector_db_path,
        settings=ChromaSettings(anonymized_telemetry=False),
    )
    return _client


def _get_collection(course_name: str = "default"):
    """获取或创建集合。"""
    client = _get_client()
    safe_name = course_name.replace(" ", "_").replace("/", "_")
    return client.get_or_create_collection(
        name=safe_name,
        metadata={"hnsw:space": "cosine"},
    )


def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """
    将文本切分为重叠的块。

    Parameters
    ----------
    text : str
        原始文本。
    chunk_size : int
        每块最大字符数。
    overlap : int
        相邻块重叠字符数。

    Returns
    -------
    list[str]
        文本块列表。
    """
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk:
            chunks.append(chunk)
        start = end - overlap
        if start >= len(text):
            break
    return chunks if chunks else [text]


def add_document(
    content: str,
    metadata: dict[str, Any] | None = None,
    source: str = "",
    course: str = "default",
    chunk_size: int = 500,
) -> int:
    """
    将文档添加到知识库。

    Parameters
    ----------
    content : str
        文档内容。
    metadata : dict, optional
        文档元数据。
    source : str
        文档来源（文件名/URL）。
    course : str
        所属课程。
    chunk_size : int
        分块大小。

    Returns
    -------
    int
        添加的文本块数量。
    """
    collection = _get_collection(course)
    metadata = metadata or {}

    chunks = _chunk_text(content, chunk_size=chunk_size)
    ids = []
    documents = []
    metadatas = []

    for i, chunk in enumerate(chunks):
        unique_id = hashlib.md5(f"{source}:{i}:{chunk[:50]}".encode()).hexdigest()
        ids.append(unique_id)
        documents.append(chunk)
        metadatas.append({
            **metadata,
            "source": source,
            "course": course,
            "chunk_index": i,
            "total_chunks": len(chunks),
        })

    # 使用项目 embedding 服务预计算向量，避免 ChromaDB 下载默认模型
    embeddings = embed_batch(chunks)

    collection.add(
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids,
    )
    return len(chunks)


def add_textbook(
    file_path: str,
    course: str,
    chapter: str = "",
) -> int:
    """
    添加教材文件到知识库（支持 PDF/TXT）。

    Parameters
    ----------
    file_path : str
        文件路径。
    course : str
        课程名称。
    chapter : str
        章节名称。

    Returns
    -------
    int
        添加的文本块数量。
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")

    # 读取文件
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        content = "\n".join((page.extract_text() or "") for page in reader.pages)
        # 清理 PDF 中可能存在的非法代理字符
        content = content.encode("utf-8", errors="replace").decode("utf-8")
    elif suffix in (".docx", ".doc"):
        try:
            from docx import Document
            doc = Document(str(path))
            content = "\n".join(p.text for p in doc.paragraphs)
        except Exception:
            # .doc 旧格式不支持，尝试作为纯文本
            raise RuntimeError("无法解析 .doc 文件，请转换为 .docx 格式后重试")
    else:
        content = path.read_text(encoding="utf-8")

    return add_document(
        content=content,
        metadata={"chapter": chapter, "filename": path.name},
        source=path.name,
        course=course,
    )


def search(
    query: str,
    course: str = "default",
    top_k: int = 5,
    filter_criteria: dict[str, Any] | None = None,
) -> list[DocumentChunk]:
    """
    语义检索知识库。

    Parameters
    ----------
    query : str
        查询内容。
    course : str
        课程名称。
    top_k : int
        返回结果数量。
    filter_criteria : dict, optional
        过滤条件。

    Returns
    -------
    list[DocumentChunk]
        检索结果。
    """
    try:
        collection = _get_collection(course)
    except Exception:
        return []

    query_vector = get_embedding(query)
    where = filter_criteria if filter_criteria else None

    results = collection.query(
        query_embeddings=[query_vector],
        n_results=min(top_k, 20),
        where=where,
    )

    chunks = []
    if results["documents"] and results["documents"][0]:
        for i, doc in enumerate(results["documents"][0]):
            meta = (results["metadatas"][0][i]) if results["metadatas"] else {}
            dist = (results["distances"][0][i]) if results["distances"] else 0
            score = max(0, 1 - dist)  # 余弦距离转相似度
            chunks.append(DocumentChunk(
                id=results["ids"][0][i] if results["ids"] else "",
                content=doc,
                metadata=meta,
                source=meta.get("source", ""),
                score=round(score, 4),
            ))
    return chunks


def get_status() -> KnowledgeBaseStatus:
    """获取知识库状态信息。"""
    try:
        client = _get_client()
        collections = client.list_collections()
        total_chunks = 0
        courses = []
        for col in collections:
            total_chunks += col.count()
            courses.append(col.name)
        return KnowledgeBaseStatus(
            total_chunks=total_chunks,
            total_documents=len(collections),
            courses=courses,
            last_updated="",
            vector_db_path=settings.vector_db_path,
        )
    except Exception as e:
        return KnowledgeBaseStatus(
            total_chunks=0,
            vector_db_path=settings.vector_db_path,
        )


def delete_collection(course: str) -> bool:
    """删除指定课程的知识库。"""
    try:
        client = _get_client()
        safe_name = course.replace(" ", "_").replace("/", "_")
        client.delete_collection(safe_name)
        return True
    except Exception:
        return False


def list_collections() -> list[dict]:
    """列出所有知识库集合。"""
    try:
        client = _get_client()
        collections = client.list_collections()
        return [
            {
                "name": col.name,
                "count": col.count(),
                "metadata": col.metadata,
            }
            for col in collections
        ]
    except Exception:
        return []
