"""
作业批改与辅导 API — 智能批改、练习生成的 RESTful 接口（数据库持久化版）。
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import ExerciseBatch, HomeworkGrade, get_db
from app.models.schemas import (
    APIResponse,
    BatchGradingRequest,
    BatchGradingResponse,
    ExerciseRequest,
    ExerciseResponse,
    GradingResult,
    HomeworkSubmission,
)
from app.services.homework_service import generate_exercises as gen_exercises
from app.services.homework_service import grade_batch, grade_submission

router = APIRouter(prefix="/api/homework", tags=["作业批改"])


@router.post("/grade", response_model=APIResponse)
async def grade_homework(submission: HomeworkSubmission, db: Session = Depends(get_db)):
    """批改单个作业并保存结果。"""
    try:
        result = grade_submission(submission)

        # 保存到数据库
        record = HomeworkGrade(
            id=str(uuid.uuid4())[:12],
            student_name=submission.student_name,
            course_name=submission.course_name,
            chapter=submission.chapter or "",
            question_text=submission.question_text,
            student_answer=submission.student_answer,
            question_type=submission.question_type or "主观题",
            max_score=submission.max_score or 100,
            score=result.score,
            percentage=result.percentage,
            feedback=result.feedback or "",
            strengths=json.dumps(result.strengths, ensure_ascii=False),
            weaknesses=json.dumps(result.weaknesses, ensure_ascii=False),
            suggestions=json.dumps(result.suggestions, ensure_ascii=False),
            knowledge_points=json.dumps(result.knowledge_points, ensure_ascii=False),
            detailed_analysis=result.detailed_analysis or "",
            created_at=datetime.now(),
        )
        db.add(record)
        db.commit()

        return APIResponse(
            success=True,
            message="批改完成",
            data=result.model_dump() | {"id": record.id},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-grade", response_model=APIResponse)
async def batch_grade(request: BatchGradingRequest, db: Session = Depends(get_db)):
    """批量批改作业并保存全部结果。"""
    try:
        results, avg_score, distribution = grade_batch(request.submissions)

        # 批量保存
        now = datetime.now()
        for i, s in enumerate(request.submissions):
            r = results[i] if i < len(results) else None
            if r:
                record = HomeworkGrade(
                    id=str(uuid.uuid4())[:12],
                    student_name=s.student_name,
                    course_name=s.course_name,
                    chapter=s.chapter or "",
                    question_text=s.question_text,
                    student_answer=s.student_answer,
                    question_type=s.question_type or "主观题",
                    max_score=s.max_score or 100,
                    score=r.score,
                    percentage=r.percentage,
                    feedback=r.feedback or "",
                    strengths=json.dumps(r.strengths, ensure_ascii=False),
                    weaknesses=json.dumps(r.weaknesses, ensure_ascii=False),
                    suggestions=json.dumps(r.suggestions, ensure_ascii=False),
                    knowledge_points=json.dumps(r.knowledge_points, ensure_ascii=False),
                    detailed_analysis=r.detailed_analysis or "",
                    created_at=now,
                )
                db.add(record)
        db.commit()

        return APIResponse(
            success=True,
            message=f"共批改 {len(results)} 份作业，平均分 {avg_score}",
            data=BatchGradingResponse(
                results=results,
                total_submissions=len(results),
                avg_score=avg_score,
                class_distribution=distribution,
            ).model_dump(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exercises", response_model=APIResponse)
async def generate_exercises_api(request: ExerciseRequest, db: Session = Depends(get_db)):
    """生成练习题并保存。"""
    try:
        result = gen_exercises(request)

        # 保存到数据库
        batch = ExerciseBatch(
            id=str(uuid.uuid4())[:12],
            course_name=request.course_name,
            chapter=request.chapter or "",
            difficulty=request.difficulty or "中等",
            total=result.total,
            exercises_json=json.dumps([e.model_dump() for e in result.exercises], ensure_ascii=False),
            created_at=datetime.now(),
        )
        db.add(batch)
        db.commit()

        return APIResponse(
            success=True,
            message=f"已生成 {result.total} 道练习题",
            data=result.model_dump() | {"batch_id": batch.id},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 历史记录查询 ──────────────────────────────────────

@router.get("/grades", response_model=APIResponse)
async def list_grades(course: str = "", db: Session = Depends(get_db)):
    """获取批改历史记录。"""
    query = db.query(HomeworkGrade)
    if course:
        query = query.filter(HomeworkGrade.course_name == course)
    records = query.order_by(HomeworkGrade.created_at.desc()).limit(100).all()
    return APIResponse(success=True, data={
        "total": len(records),
        "items": [r.to_dict() for r in records],
    })


@router.get("/exercises/list", response_model=APIResponse)
async def list_exercises(course: str = "", db: Session = Depends(get_db)):
    """获取出题历史。"""
    query = db.query(ExerciseBatch)
    if course:
        query = query.filter(ExerciseBatch.course_name == course)
    batches = query.order_by(ExerciseBatch.created_at.desc()).limit(50).all()
    return APIResponse(success=True, data={
        "total": len(batches),
        "items": [b.to_dict() for b in batches],
    })


@router.get("/grades/{grade_id}", response_model=APIResponse)
async def get_grade(grade_id: str, db: Session = Depends(get_db)):
    """获取单条批改详情。"""
    record = db.query(HomeworkGrade).filter(HomeworkGrade.id == grade_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return APIResponse(success=True, data=record.to_dict())
