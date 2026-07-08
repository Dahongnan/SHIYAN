"""
智能备课 API — 教案生成与管理的 RESTful 接口（数据库持久化版）。
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import LessonPlan, get_db
from app.models.schemas import APIResponse, LessonPlanListResponse, LessonPlanRequest, LessonPlanResponse
from app.services.lesson_service import generate_lesson_plan as generate_plan_service

router = APIRouter(prefix="/api/lesson", tags=["智能备课"])


@router.post("/generate", response_model=APIResponse)
async def generate_plan(request: LessonPlanRequest, db: Session = Depends(get_db)):
    """生成教案并保存到数据库。"""
    try:
        plan = generate_plan_service(request)
        plan_dict = plan.model_dump()

        # 保存到数据库
        lesson = LessonPlan(
            id=plan.id,
            course_name=request.course_name,
            chapter=request.chapter,
            total_hours=request.teaching_hours,
            additional_requirements=request.additional_requirements,
            plan_data=json.dumps(plan_dict, ensure_ascii=False),
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.add(lesson)
        db.commit()

        return APIResponse(
            success=True,
            message="教案生成成功",
            data=plan_dict,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/plans", response_model=LessonPlanListResponse)
async def list_plans(course: str = "", db: Session = Depends(get_db)):
    """获取所有已生成的教案列表（按时间倒序）。"""
    query = db.query(LessonPlan)
    if course:
        query = query.filter(LessonPlan.course_name == course)
    plans = query.order_by(LessonPlan.created_at.desc()).all()
    return LessonPlanListResponse(
        plans=[p.to_dict() for p in plans],
        total=len(plans),
    )


@router.get("/plans/{plan_id}", response_model=APIResponse)
async def get_plan(plan_id: str, db: Session = Depends(get_db)):
    """获取指定教案的详细信息。"""
    plan = db.query(LessonPlan).filter(LessonPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="教案不存在")
    return APIResponse(success=True, data=plan.to_dict())


@router.delete("/plans/{plan_id}", response_model=APIResponse)
async def delete_plan(plan_id: str, db: Session = Depends(get_db)):
    """删除指定教案。"""
    plan = db.query(LessonPlan).filter(LessonPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="教案不存在")
    db.delete(plan)
    db.commit()
    return APIResponse(success=True, message="教案已删除")


@router.get("/courses", response_model=APIResponse)
async def list_courses(db: Session = Depends(get_db)):
    """获取有教案记录的所有课程列表。"""
    rows = db.query(LessonPlan.course_name).distinct().all()
    courses = [r[0] for r in rows if r[0]]
    return APIResponse(success=True, data={"courses": courses})
