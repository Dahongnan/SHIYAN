"""
智能备课服务 — 基于 LLM + RAG 自动生成教案。

核心功能：
1. 根据课程名称和章节生成完整教案
2. 支持教材内容增强（RAG）
3. 支持自定义教学要求
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime

from app.core.llm import chat_json, chat_with_prompt
from app.models.schemas import (
    LessonPlanRequest,
    LessonPlanResponse,
    SessionPlan,
    TeachingActivity,
    TeachingObjective,
)
from app.services.rag_service import generate_with_rag


SYSTEM_PROMPT = """【当前任务：高校本科专业课完整课时教案生成】
你是一流学科建设专家型教师，请根据提供的课程信息生成一份可直接用于课堂授课的标准化本科教案。

教案必须包含以下完整结构化内容，输出 JSON 格式：

1. 课程基本信息：章节定位、前置知识点、本节课重难点、教学三维目标（知识目标+能力目标+创新素养目标）
2. 学情分析：本章节学生常见误区、理解难点、能力薄弱点
3. 完整课堂教学流程：按时间切片，精确到每10分钟教学内容、教师话术、课堂提问、案例导入、师生互动
4. 课堂板书结构化设计（可直接投屏使用）
5. 分层课堂任务：基础任务、提升任务、创新探究任务
6. 分层课后作业：基础巩固、综合应用、学科前沿拓展
7. 课堂考核与过程性评价标准
8. 教学创新设计：结合学科前沿、科研案例、课程思政、一流学科培养要求

所有知识点、理论、案例必须标注权威来源（教材/文献/标准），末尾添加 AI 生成标识。

输出 JSON 格式：
{
  "course_info": {"title": "", "chapter": "", "prerequisites": [], "key_points": [], "difficult_points": [], "objectives": [{"dimension": "知识|能力|创新素养", "content": ""}]},
  "learner_analysis": {"common_misconceptions": [], "difficult_areas": [], "weak_abilities": []},
  "teaching_flow": [{"time_slot": "0-10min", "content": "", "teacher_talk": "", "interaction": "", "case": ""}],
  "board_design": {"structure": "", "key_formulas": []},
  "class_tasks": [{"level": "基础|提升|创新", "content": "", "source": ""}],
  "homework": [{"level": "基础巩固|综合应用|前沿拓展", "content": "", "source": ""}],
  "assessment": {"standards": [], "rubric": []},
  "innovation": {"frontier_cases": [], "research_integration": "", "ideological_political": ""}
}"""


def generate_lesson_plan(request: LessonPlanRequest) -> LessonPlanResponse:
    """
    生成教案。

    流程：
    1. 通过 RAG 检索教材相关内容（如果有课程/章节信息）
    2. 构建提示词调用 LLM
    3. 解析结构化输出
    4. 返回完整教案
    """
    # 尝试从知识库检索教材内容
    textbook_context = request.textbook_content
    if not textbook_context and request.course_name:
        try:
            from app.services.knowledge_base import search as kb_search
            chunks = kb_search(
                f"{request.course_name} {request.chapter}",
                course=request.course_name,
                top_k=10,
            )
            if chunks:
                textbook_context = "\n".join(
                    f"[{c.source}] {c.content}" for c in chunks
                )
        except Exception:
            pass

    # 构建用户提示
    user_prompt = f"""请为以下课程设计教案：

课程名称：{request.course_name}
章节名称：{request.chapter}
课时数：{request.teaching_hours} 课时
附加要求：{request.additional_requirements or "无"}

教材内容（供参考）：
{textbook_context[:8000] if textbook_context else "（未提供教材内容，请基于学科常识设计）"}
"""

    # 调用 LLM（JSON 模式）
    try:
        result = chat_json(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
        )

        # 兼容新旧两种格式解析
        course_info = result.get("course_info", {})

        # 教学目标：新格式 course_info.objectives / 旧格式 objectives
        objectives_raw = course_info.get("objectives", result.get("objectives", []))
        objectives = [TeachingObjective(**o) for o in objectives_raw if isinstance(o, dict)]

        # 教学流程：新格式 teaching_flow / 旧格式 sessions
        flow = result.get("teaching_flow", [])
        sessions_data = result.get("sessions", [])

        sessions = []
        if flow:
            # 新格式：按时间切片
            for i, slot in enumerate(flow):
                sessions.append(SessionPlan(
                    session_order=i + 1,
                    session_topic=slot.get("content", f"第{i+1}时段")[:50],
                    activities=[TeachingActivity(
                        duration=10,
                        activity_type="讲授",
                        content=slot.get("content", ""),
                        teacher_activity=slot.get("teacher_talk", ""),
                        student_activity=slot.get("interaction", ""),
                    )],
                    key_points=course_info.get("key_points", []),
                    difficult_points=course_info.get("difficult_points", []),
                    homework="",
                ))
        else:
            # 旧格式
            for s in sessions_data:
                activities = [
                    TeachingActivity(**a) for a in s.get("activities", [])
                ]
                s_objectives = [
                    TeachingObjective(**o) for o in s.get("objectives", [])
                ]
                sessions.append(SessionPlan(
                    session_order=s.get("session_order", 1),
                    session_topic=s.get("session_topic", ""),
                    objectives=s_objectives,
                    key_points=s.get("key_points", []),
                    difficult_points=s.get("difficult_points", []),
                    activities=activities,
                    homework=s.get("homework", ""),
                ))

        # 分层作业
        homework = result.get("homework", [])
        homework_text = "\n".join(
            f"[{h.get('level','')}] {h.get('content','')}"
            for h in homework
        ) if homework else ""

        # 最后一条 session 补充作业
        if homework_text and sessions:
            sessions[-1].homework = homework_text

        return LessonPlanResponse(
            id=str(uuid.uuid4())[:8],
            course_name=request.course_name,
            chapter=request.chapter,
            total_hours=request.teaching_hours,
            objectives=objectives,
            methods=result.get("methods", course_info.get("methods", [])),
            resources=result.get("resources", course_info.get("resources", [])),
            sessions=sessions or None,
            created_at=datetime.now().isoformat(),
        )

    except Exception as e:
        # 降级方案：返回基本结构
        return LessonPlanResponse(
            id=str(uuid.uuid4())[:8],
            course_name=request.course_name,
            chapter=request.chapter,
            total_hours=request.teaching_hours,
            objectives=[
                TeachingObjective(dimension="知识", content=f"掌握{request.chapter}的核心概念与基本原理"),
                TeachingObjective(dimension="能力", content=f"能够运用{request.chapter}的知识解决实际问题"),
                TeachingObjective(dimension="素质", content="培养科学思维和严谨的学习态度"),
            ],
            methods=["讲授法", "案例教学法", "讨论法"],
            resources=["教材", "多媒体课件", "在线学习平台"],
            sessions=[
                SessionPlan(
                    session_order=1,
                    session_topic=f"{request.chapter}（第1课时）",
                    activities=[
                        TeachingActivity(
                            duration=10,
                            activity_type="导入",
                            content=f"通过案例或问题引入{request.chapter}",
                            teacher_activity="展示案例，提出问题",
                            student_activity="思考并讨论",
                        ),
                        TeachingActivity(
                            duration=30,
                            activity_type="讲授",
                            content=f"讲解{request.chapter}的核心知识点",
                            teacher_activity="系统讲授，辅以多媒体演示",
                            student_activity="听讲、做笔记、提问",
                        ),
                    ],
                    homework="复习本章内容，完成课后习题",
                )
            ],
            created_at=datetime.now().isoformat(),
        )
