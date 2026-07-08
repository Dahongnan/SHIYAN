"""
学情洞察 API — 学情分析和预警的 RESTful 接口。
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    APIResponse,
    ClassInsightRequest,
    ClassInsightResponse,
    StudentInsightRequest,
    StudentInsightResponse,
)
from app.services.student_service import analyze_class, analyze_student

router = APIRouter(prefix="/api/insight", tags=["学情洞察"])


@router.post("/student", response_model=APIResponse)
async def analyze_student_api(request: StudentInsightRequest):
    """
    分析学生个体学情。

    基于学生的成绩记录和作业数据，分析知识掌握度、
    薄弱环节、学习趋势，并给出个性化学习建议和预警。
    """
    try:
        result = analyze_student(request)
        return APIResponse(
            success=True,
            message="学情分析完成",
            data=result.model_dump(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/class", response_model=APIResponse)
async def analyze_class_api(request: ClassInsightRequest):
    """
    分析班级整体学情。

    汇总全班学生的学情数据，分析班级整体水平、
    分数分布、共性薄弱环节，生成重点关注名单。
    """
    try:
        result = analyze_class(request)
        return APIResponse(
            success=True,
            message="班级学情分析完成",
            data=result.model_dump(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
