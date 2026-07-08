"""
学科助教系统 (Edu-TA)  —  FastAPI 应用入口

运行方式（开发）：
    cd backend
    uvicorn app.main:app --reload --port 8000

运行方式（Docker）：
    docker-compose up -d
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api import course_mgmt, homework, knowledge, lesson_plan, materials, resources, settings as settings_api, student_insight, teaching

# ── 应用信息 ────────────────────────────────────────────────
APP_TITLE = "学科助教系统 Edu-TA"
APP_DESCRIPTION = """
面向一流学科建设的学科垂类大模型与创新应用 — 助教端

## 核心功能

### 📝 智能备课
- 基于 LLM + RAG 自动生成教案
- 支持从知识库检索教材内容增强生成
- 输出结构化教案（教学目标、活动设计、课后作业）

### ✅ 作业批改与辅导
- 智能批改多种题型（选择题/填空题/主观题/计算题）
- 批量批改与成绩分布分析
- 针对薄弱知识点自动生成练习题

### 📊 学情精准洞察
- 学生个体知识掌握度分析（雷达图）
- 成绩变化趋势分析
- 薄弱知识点识别与学习预警
- 个性化学习建议生成

### 📚 学科知识库
- 教材/讲义 PDF 导入与向量化
- 语义检索（RAG 底层）
- 多课程知识库独立管理
"""


# ── 生命周期 ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动/关闭时的钩子。"""
    # 确保数据目录存在（Docker 挂载卷可能为空）
    os.makedirs("/app/data", exist_ok=True)
    os.makedirs("/app/knowledge_base/vector_store", exist_ok=True)
    os.makedirs("/app/knowledge_base/textbooks", exist_ok=True)

    # 自动导入教材 PDF 到知识库（首次启动）
    _auto_import_textbooks()
    yield


def _auto_import_textbooks() -> None:
    """扫描 textbooks 目录，将未导入的 PDF 自动导入知识库。"""
    import glob
    from pathlib import Path
    from app.services.knowledge_base import add_textbook, get_status

    textbooks_dir = Path("/app/knowledge_base/textbooks")
    pdf_files = sorted(glob.glob(str(textbooks_dir / "*.pdf")))
    if not pdf_files:
        return

    # 检查已导入的课程集合
    try:
        status = get_status()
        imported_courses = set(status.courses or [])
    except Exception:
        imported_courses = set()

    # 已导入的以 AI-Agent 开头则跳过（已经导入过）
    if any(c.startswith("AI-Agent") for c in imported_courses):
        return

    import logging
    logger = logging.getLogger("uvicorn.info")
    logger.info(f"📚 检测到 {len(pdf_files)} 本教材 PDF，正在导入知识库...")

    for f in pdf_files:
        name = Path(f).name
        # 用文件名做章节标识
        chapter = name.replace(".pdf", "")
        try:
            n = add_textbook(file_path=str(f), course="AI-Agent", chapter=chapter)
            logger.info(f"  ✓ {name} → {n} 个文本块")
        except Exception as e:
            logger.warning(f"  ✗ {name} 导入失败: {e}")

    logger.info("✅ 教材导入完成")


# ── 应用创建 ──────────────────────────────────────────────
app = FastAPI(
    title=APP_TITLE,
    description=APP_DESCRIPTION,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────
# 允许开发服务器、Docker Nginx 代理、以及任意来源（用于演示）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",        # Vite 开发服务器
        "http://localhost:3000",        # 备用
        "http://localhost:8080",        # Docker Nginx
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ── LLM 配置中间件 ─────────────────────────────────
# 从前端请求头提取 LLM 配置（API Key / 地址 / 模型），
# 设置为请求级上下文，优先级高于服务端存储的配置。
# 这样每个用户可以在浏览器里配置自己的 API Key。


@app.middleware("http")
async def llm_config_middleware(request: Request, call_next):
    api_key = request.headers.get("X-LLM-Api-Key", "")
    if api_key:
        from app.core.llm import set_request_config, LLMConfig
        set_request_config(LLMConfig(
            api_key=api_key,
            base_url=request.headers.get("X-LLM-Base-Url", ""),
            model_name=request.headers.get("X-LLM-Model-Name", ""),
        ))
    response = await call_next(request)
    return response

# ── 注册路由 ──────────────────────────────────────────────
app.include_router(lesson_plan.router)
app.include_router(homework.router)
app.include_router(student_insight.router)
app.include_router(knowledge.router)
app.include_router(settings_api.router)
app.include_router(materials.router)
app.include_router(resources.router)
app.include_router(course_mgmt.router)
app.include_router(teaching.router)


# ── 健康检查 ──────────────────────────────────────────────
@app.get("/health")
async def health_check():
    """健康检查端点（供 Docker 容器探针使用）。"""
    return {
        "status": "healthy",
        "app": APP_TITLE,
        "version": "1.0.0",
    }


# ── 根路径 ────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "app": APP_TITLE,
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "智能备课": "/api/lesson/generate",
            "作业批改": "/api/homework/grade",
            "学情洞察": "/api/insight/student",
            "知识库": "/api/knowledge/search",
        },
    }


# ── 直接运行入口 ──────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
