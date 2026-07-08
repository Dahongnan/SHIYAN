# ─── 学科助教系统 Edu-TA  —  后端 Dockerfile（精简版） ──────
# 已移除 sentence-transformers / torch，无需 gcc/g++ 编译。
# 构建更快、镜像更小、内存占用更低。
#
# 使用方式: docker build -t edu-ta-backend ./backend

# ── Stage 1: 构建 ──────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# 复制依赖文件并安装（纯 Python 包，无需编译）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 移除 chromadb 引入的 kubernetes 依赖（~77MB，生产环境完全无用）
RUN pip uninstall -y kubernetes || true

# ── Stage 2: 运行 ──────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# 从构建阶段复制已安装的 Python 包
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 复制应用代码
COPY . .

# 创建必要目录
RUN mkdir -p /app/knowledge_base/vector_store \
             /app/knowledge_base/textbooks \
             /app/data

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
