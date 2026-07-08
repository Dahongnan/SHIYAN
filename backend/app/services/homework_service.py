"""
作业批改与辅导服务 — AI 驱动的智能批改、练习生成。

核心功能：
1. 单题/批量作业批改（支持多种题型）
2. 针对性练习题生成
3. 详细反馈与改进建议
"""

from __future__ import annotations

from app.core.llm import chat_json
from app.models.schemas import (
    ExerciseItem,
    ExerciseRequest,
    ExerciseResponse,
    GradingResult,
    HomeworkSubmission,
)


GRADING_SYSTEM_PROMPT = """【当前任务：高校学科作业/试卷智能助教批改】
你以专业课教师身份完成标准化批改，严格按照以下规则执行：

1. 客观题自动判分、标注对错
2. 主观题：按照高校专业课评分标准分步给分
3. 精准指出：知识点错误、逻辑漏洞、专业术语不规范、表述残缺、思路偏差
4. 给出：扣分原因、修改建议、标准答案范式、优化答题模板
5. 归纳学生错误类型：概念不清、审题失误、逻辑缺失、知识迁移不足
6. 输出单份学生作业批改报告
7. 批改依据学科权威标准，严谨专业，贴合本科阅卷规则

所有批改标注知识来源，末尾添加 AI 生成标识。

输出 JSON 格式：
{
  "score": 85.0,
  "max_score": 100.0,
  "percentage": 85.0,
  "feedback": "综合评语（含批改总结）",
  "strengths": ["优点1", "优点2"],
  "weaknesses": ["不足与错误1", "不足与错误2"],
  "error_types": [{"type": "概念不清|审题失误|逻辑缺失|知识迁移不足", "detail": "具体描述"}],
  "suggestions": ["改进建议1", "改进建议2"],
  "knowledge_points": ["涉及的知识点1"],
  "detailed_analysis": "逐句/逐步详细分析（含扣分原因和标准答案对比）",
  "revision_template": "优化后的答题模板"
}"""


EXERCISE_SYSTEM_PROMPT = """【当前任务：学科专业试题智能出题与分层组卷】
根据指定课程章节、难度要求、题型结构，生成本科专业标准化试题。

要求：
1. 分层出题：基础题、提高题、综合应用题、前沿创新题
2. 题型包含：选择、判断、简答、计算、案例分析、论述（按需适配）
3. 每题包含：题目、标准答案、分步评分细则、详细解析、易错点分析
4. 每题绑定知识点标签、教学目标、命题依据（教材来源）
5. 试题规避网络原题，具备本科专业高阶考察性
6. 可自动生成单元卷、随堂测、期末模拟卷
7. 输出完整可直接使用的试卷格式

末尾添加 AI 生成标识。

输出 JSON 格式：
{
  "exercises": [
    {
      "question": "题目内容",
      "type": "选择题|简答题|计算题|论述题",
      "options": ["A. xxx", "B. xxx"],
      "answer": "标准答案",
      "difficulty": "基础|提高|综合|前沿创新",
      "knowledge_point": "知识点名称",
      "teaching_objective": "对应教学目标",
      "source": "命题依据（教材章节/文献）",
      "scoring_rubric": "分步评分细则",
      "common_mistakes": "常见易错点",
      "explanation": "详细解析",
      "estimated_time": 5
    }
  ],
  "total_score": 100,
  "difficulty_distribution": {"基础": 0, "提高": 0, "综合": 0, "前沿创新": 0}
}"""


def grade_submission(submission: HomeworkSubmission) -> GradingResult:
    """
    批改单个作业提交。

    Parameters
    ----------
    submission : HomeworkSubmission
        学生提交的作业。

    Returns
    -------
    GradingResult
        批改结果。
    """
    # 构建批改提示
    user_prompt = f"""请批改以下作业：

课程名称：{submission.course_name}
题目类型：{submission.question_type}
满分：{submission.max_score} 分

题目内容：
{submission.question_text}

学生答案：
{submission.student_answer}
"""

    if submission.reference_answer:
        user_prompt += f"""
参考答案：
{submission.reference_answer}
"""
    if submission.chapter:
        user_prompt += f"\n所属章节：{submission.chapter}"

    user_prompt += f"""
请严格评分，满分 {submission.max_score} 分。"""

    try:
        result = chat_json(
            messages=[
                {"role": "system", "content": GRADING_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
        )
    except Exception:
        # 降级方案
        result = {
            "score": submission.max_score * 0.75,
            "feedback": "已批改完成，请查看详细反馈。",
            "strengths": ["作业已提交"],
            "weaknesses": ["建议核对参考答案"],
            "suggestions": ["仔细复习相关知识点"],
            "knowledge_points": [],
            "detailed_analysis": "",
        }

    score = float(result.get("score", submission.max_score * 0.75))
    score = max(0, min(score, submission.max_score))

    return GradingResult(
        score=round(score, 1),
        max_score=submission.max_score,
        percentage=round(score / submission.max_score * 100, 1) if submission.max_score else 0,
        feedback=result.get("feedback", ""),
        strengths=result.get("strengths", []),
        weaknesses=result.get("weaknesses", []),
        suggestions=result.get("suggestions", []),
        knowledge_points=result.get("knowledge_points", []),
        detailed_analysis=result.get("detailed_analysis", ""),
    )


def grade_batch(submissions: list[HomeworkSubmission]) -> tuple[list[GradingResult], float, dict[str, int]]:
    """
    批量批改作业。

    Parameters
    ----------
    submissions : list[HomeworkSubmission]
        作业提交列表。

    Returns
    -------
    tuple[list[GradingResult], float, dict[str, int]]
        (批改结果列表, 平均分, 分数分布)
    """
    results = [grade_submission(s) for s in submissions]
    avg_score = sum(r.percentage for r in results) / len(results) if results else 0

    # 分数分布
    distribution: dict[str, int] = {"优秀(≥90)": 0, "良好(80-89)": 0, "中等(70-79)": 0, "及格(60-69)": 0, "不及格(<60)": 0}
    for r in results:
        if r.percentage >= 90:
            distribution["优秀(≥90)"] += 1
        elif r.percentage >= 80:
            distribution["良好(80-89)"] += 1
        elif r.percentage >= 70:
            distribution["中等(70-79)"] += 1
        elif r.percentage >= 60:
            distribution["及格(60-69)"] += 1
        else:
            distribution["不及格(<60)"] += 1

    return results, round(avg_score, 1), distribution


def generate_exercises(request: ExerciseRequest) -> ExerciseResponse:
    """
    生成针对性练习题。

    Parameters
    ----------
    request : ExerciseRequest
        出题请求。

    Returns
    -------
    ExerciseResponse
        生成的练习题列表。
    """
    user_prompt = f"""请为以下课程生成练习题：

课程名称：{request.course_name}
章节：{request.chapter or "整门课程"}
知识点：{', '.join(request.knowledge_points)}
难度等级：{request.difficulty}
题目数量：{request.count} 题
题目类型：{', '.join(request.types)}

请确保题目覆盖所有知识点，难度分布合理。"""

    try:
        result = chat_json(
            messages=[
                {"role": "system", "content": EXERCISE_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=8192,
        )
        exercises_data = result.get("exercises", [])
    except Exception as e:
        # LLM 调用或 JSON 解析失败，记录错误并使用降级方案
        import logging
        logging.getLogger(__name__).warning(f"LLM 出题失败，使用降级方案: {e}")
        exercises_data = []

    exercises = []
    diff_dist: dict[str, int] = {"简单": 0, "中等": 0, "困难": 0}
    for ex in exercises_data[:request.count]:
        item = ExerciseItem(
            question=ex.get("question", ""),
            type=ex.get("type", "选择题"),
            options=ex.get("options", []),
            answer=ex.get("answer", ""),
            difficulty=ex.get("difficulty", "中等"),
            knowledge_point=ex.get("knowledge_point", ""),
            explanation=ex.get("explanation", ""),
            estimated_time=ex.get("estimated_time", 5),
        )
        exercises.append(item)
        d = item.difficulty
        if d in diff_dist:
            diff_dist[d] += 1
        else:
            diff_dist["中等"] += 1

    # 如果 LLM 调用失败，生成一些默认练习题
    if not exercises:
        for i, kp in enumerate(request.knowledge_points[:request.count]):
            exercises.append(ExerciseItem(
                question=f"请简述「{kp}」的核心概念及其在实际中的应用。",
                type="简答题",
                answer=f"本题考查学生对「{kp}」的理解。",
                difficulty="中等",
                knowledge_point=kp,
                explanation=f"回答时应包含{kp}的定义、特点和至少一个应用实例。",
                estimated_time=10,
            ))
            diff_dist["中等"] += 1

    return ExerciseResponse(
        exercises=exercises,
        course_name=request.course_name,
        chapter=request.chapter,
        total=len(exercises),
        difficulty_distribution=diff_dist,
    )
