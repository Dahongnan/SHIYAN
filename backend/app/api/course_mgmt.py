"""
课程管理 API — 全动态后端驱动，无前端硬编码

提供：枚举配置 / 课程CRUD / 教师管理 / 学期管理
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.schemas import APIResponse

router = APIRouter(prefix="/api/course-mgmt", tags=["课程管理"])

# ── 数据文件存储（生产环境应使用 DB） ─────────────────
# 统一使用 /app/data/（Docker 持久化卷），本地开发时自动创建 data/ 目录
import os as _os
_DATA_ROOT = _os.environ.get("DATA_DIR", str(Path(__file__).parent.parent.parent / "data"))
DATA_DIR = Path(_DATA_ROOT)
COURSES_FILE = DATA_DIR / "courses.json"
ENUMS_FILE = DATA_DIR / "course_enums.json"
TEACHERS_FILE = DATA_DIR / "course_teachers.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)


def _read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ═══════════════════════════════════════════════════════
# 枚举配置
# ═══════════════════════════════════════════════════════

@router.get("/enums", response_model=APIResponse)
async def get_enums():
    """获取全部动态枚举配置（所有下拉选项从此接口读取）。"""
    enums = _read_json(ENUMS_FILE)
    defaults = {
        "semesters": [
            {"value": "2026春季", "label": "2026 春季"},
            {"value": "2025秋季", "label": "2025 秋季"},
            {"value": "2025春季", "label": "2025 春季"},
        ],
        "statuses": [
            {"value": "进行中", "label": "进行中", "color": "#1677ff", "type": "processing"},
            {"value": "已过半", "label": "已过半", "color": "#fa8c16", "type": "warning"},
            {"value": "已结课", "label": "已结课", "color": "#52c41a", "type": "success"},
        ],
        "course_categories": [
            {"value": "专业核心", "label": "专业核心"},
            {"value": "专业选修", "label": "专业选修"},
            {"value": "通识基础", "label": "通识基础"},
        ],
        "progress_thresholds": {
            "half": 50,      # 进度 ≥50% 标记为"已过半"
            "complete": 100, # 进度=100% 标记为"已结课"
            "max_hours": 64, # 课时上限
        },
    }
    # 合并默认值与已保存的自定义配置
    for k, v in defaults.items():
        if k not in enums or not enums[k]:
            enums[k] = v
    _write_json(ENUMS_FILE, enums)
    return APIResponse(success=True, data=enums)


@router.post("/enums/semesters", response_model=APIResponse)
async def add_semester(data: dict):
    """新增学期（如"2026秋季"）。"""
    enums = _read_json(ENUMS_FILE)
    semesters = enums.get("semesters", [])
    value = data.get("value", "").strip()
    label = data.get("label", value)
    if not value:
        raise HTTPException(status_code=400, detail="学期值不能为空")
    if any(s["value"] == value for s in semesters):
        raise HTTPException(status_code=400, detail="学期已存在")
    semesters.append({"value": value, "label": label})
    enums["semesters"] = semesters
    _write_json(ENUMS_FILE, enums)
    return APIResponse(success=True, message=f"已添加学期「{label}」", data=enums)


# ═══════════════════════════════════════════════════════
# 教师管理
# ═══════════════════════════════════════════════════════

@router.get("/teachers", response_model=APIResponse)
async def list_teachers():
    """获取教师列表。"""
    teachers = _read_json(TEACHERS_FILE)
    return APIResponse(success=True, data={"teachers": teachers.get("list", []), "total": len(teachers.get("list", []))})


@router.post("/teachers", response_model=APIResponse)
async def add_teacher(data: dict):
    """新增教师。"""
    name = data.get("name", "").strip()
    title = data.get("title", "讲师").strip()
    if not name:
        raise HTTPException(status_code=400, detail="教师姓名不能为空")
    teachers = _read_json(TEACHERS_FILE)
    lst = teachers.get("list", [])
    if any(t["name"] == name for t in lst):
        raise HTTPException(status_code=400, detail="教师已存在")
    lst.append({"name": name, "title": title, "id": str(uuid.uuid4())[:8]})
    teachers["list"] = lst
    _write_json(TEACHERS_FILE, teachers)
    return APIResponse(success=True, message=f"已添加教师「{name}」")


@router.delete("/teachers/{teacher_id}", response_model=APIResponse)
async def delete_teacher(teacher_id: str):
    """删除教师。"""
    teachers = _read_json(TEACHERS_FILE)
    before = len(teachers.get("list", []))
    teachers["list"] = [t for t in teachers["list"] if t["id"] != teacher_id]
    if len(teachers["list"]) == before:
        raise HTTPException(status_code=404, detail="教师不存在")
    _write_json(TEACHERS_FILE, teachers)
    return APIResponse(success=True, message="已删除")


# ═══════════════════════════════════════════════════════
# 课程 CRUD
# ═══════════════════════════════════════════════════════

class CourseCreate(BaseModel):
    name: str
    code: str = ""
    teacher: str = ""
    semester: str = "2026春季"
    category: str = "专业核心"
    description: str = ""
    max_hours: int = 48
    status: str = "进行中"


class CourseUpdate(BaseModel):
    name: str
    code: str = ""
    teacher: str = ""
    semester: str = "2026春季"
    category: str = "专业核心"
    description: str = ""
    max_hours: int = 48
    status: str = ""
    updated_by: str = ""


@router.get("/courses", response_model=APIResponse)
async def list_courses(semester: str = ""):
    """获取课程列表。"""
    courses = _read_json(COURSES_FILE)
    lst = courses.get("list", [])
    if semester:
        lst = [c for c in lst if c.get("semester") == semester]
    # 按创建时间倒序
    lst.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return APIResponse(success=True, data={"total": len(lst), "items": lst})


@router.get("/courses/{course_id}", response_model=APIResponse)
async def get_course(course_id: str):
    """获取单门课程详情。"""
    courses = _read_json(COURSES_FILE)
    for c in courses.get("list", []):
        if c["id"] == course_id:
            return APIResponse(success=True, data=c)
    raise HTTPException(status_code=404, detail="课程不存在")


@router.post("/courses", response_model=APIResponse)
async def create_course(data: CourseCreate):
    """新增课程（含编号重复校验）。"""
    courses = _read_json(COURSES_FILE)
    lst = courses.get("list", [])

    # 编号重复校验
    new_code = data.code.strip()
    if new_code:
        for c in lst:
            if c.get("code") == new_code:
                raise HTTPException(status_code=409, detail=f"课程编号「{new_code}」已被「{c['name']}」使用")

    course_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()[:19]
    status = data.status.strip() or "进行中"

    max_h = max(1, min(data.max_hours, 64))
    course = {
        "id": course_id,
        "name": data.name.strip(),
        "code": new_code or f"AI{course_id}",
        "teacher": data.teacher.strip(),
        "semester": data.semester,
        "category": data.category,
        "description": data.description.strip(),
        "max_hours": max_h,
        "students": 0,
        "sessions": 0,
        "progress": 0,
        "status": status,
        "color": "#1677ff",
        "created_at": now,
        "updated_at": now,
        "updated_by": "",
    }
    lst.append(course)
    courses["list"] = lst
    _write_json(COURSES_FILE, courses)
    return APIResponse(success=True, message=f"课程「{course['name']}」创建成功", data=course)


@router.put("/courses/{course_id}", response_model=APIResponse)
async def update_course(course_id: str, data: CourseUpdate):
    """更新课程（编号重复校验 / 状态联动进度 / 编辑历史）。"""
    courses = _read_json(COURSES_FILE)
    lst = courses.get("list", [])

    # 课程编号重复校验
    new_code = data.code.strip()
    if new_code:
        for c in lst:
            if c["id"] != course_id and c.get("code") == new_code:
                raise HTTPException(status_code=409, detail=f"课程编号「{new_code}」已被「{c['name']}」使用")

    for i, c in enumerate(lst):
        if c["id"] == course_id:
            lst[i]["name"] = data.name.strip()
            lst[i]["code"] = new_code or lst[i]["code"]
            lst[i]["teacher"] = data.teacher.strip()
            lst[i]["semester"] = data.semester
            lst[i]["category"] = data.category
            lst[i]["description"] = data.description.strip()
            lst[i]["max_hours"] = max(1, min(data.max_hours, 64))
            lst[i]["updated_at"] = datetime.now().isoformat()[:19]
            if data.updated_by.strip():
                lst[i]["updated_by"] = data.updated_by.strip()

            # 状态联动
            new_status = data.status.strip()
            if new_status:
                lst[i]["status"] = new_status
                if new_status == "已结课":
                    lst[i]["progress"] = 100
                    lst[i]["sessions"] = lst[i].get("max_hours", 48)
                elif new_status == "进行中" and lst[i].get("progress", 0) >= 100:
                    lst[i]["progress"] = min(lst[i].get("progress", 99), 99)

            # 非手动设状态时重算进度
            max_h = lst[i].get("max_hours", 48) or 1
            sess = lst[i].get("sessions", 0)
            lst[i]["progress"] = min(round(sess / max_h * 100), 100)

            courses["list"] = lst
            _write_json(COURSES_FILE, courses)
            return APIResponse(success=True, message="已更新", data=lst[i])
    raise HTTPException(status_code=404, detail="课程不存在")


@router.delete("/courses/{course_id}", response_model=APIResponse)
async def delete_course(course_id: str):
    """删除课程。"""
    courses = _read_json(COURSES_FILE)
    before = len(courses.get("list", []))
    courses["list"] = [c for c in courses["list"] if c["id"] != course_id]
    if len(courses["list"]) == before:
        raise HTTPException(status_code=404, detail="课程不存在")
    _write_json(COURSES_FILE, courses)
    return APIResponse(success=True, message="已删除")


@router.post("/courses/{course_id}/add-session", response_model=APIResponse)
async def add_session(course_id: str):
    """新增一节课时，自动更新进度和状态（后端计算）。"""
    courses = _read_json(COURSES_FILE)
    lst = courses.get("list", [])
    for i, c in enumerate(lst):
        if c["id"] == course_id:
            sessions = c.get("sessions", 0) + 1
            max_h = c.get("max_hours", 48)
            progress = min(round(sessions / max_h * 100), 100)
            # 状态判定（后端统一逻辑，前端不参与）
            if progress >= 100:
                status = "已结课"
            elif progress >= c.get("_half_threshold", 50):
                status = "已过半"
            else:
                status = "进行中"
            lst[i]["sessions"] = sessions
            lst[i]["progress"] = progress
            lst[i]["status"] = status
            lst[i]["updated_at"] = datetime.now().isoformat()[:19]
            courses["list"] = lst
            _write_json(COURSES_FILE, courses)
            return APIResponse(success=True, data=lst[i])
    raise HTTPException(status_code=404, detail="课程不存在")


# ═══════════════════════════════════════════════════════
# 课时明细管理（单节课 CRUD / 批量录入）
# ═══════════════════════════════════════════════════════

class SessionCreate(BaseModel):
    date: str = ""
    hours: int = 1
    topic: str = ""
    attendance: int = 0


class BatchSessions(BaseModel):
    items: list = []


def _recalc_course_progress(course: dict) -> dict:
    details = course.get("session_details", [])
    total_sessions = sum(d.get("hours", 0) for d in details)
    max_h = max(course.get("max_hours", 48), 1)
    progress = min(round(total_sessions / max_h * 100), 100)
    course["sessions"] = total_sessions
    course["progress"] = progress
    course["status"] = "已结课" if progress >= 100 else ("已过半" if progress >= 50 else "进行中")
    course["updated_at"] = datetime.now().isoformat()[:19]
    return course


@router.get("/courses/{course_id}/sessions", response_model=APIResponse)
async def list_sessions(course_id: str):
    courses = _read_json(COURSES_FILE)
    for c in courses.get("list", []):
        if c["id"] == course_id:
            details = sorted(c.get("session_details", []), key=lambda x: x.get("date", ""))
            return APIResponse(success=True, data={"items": details, "total": len(details)})
    raise HTTPException(status_code=404, detail="课程不存在")


@router.post("/courses/{course_id}/sessions", response_model=APIResponse)
async def create_session(course_id: str, data: SessionCreate):
    courses = _read_json(COURSES_FILE)
    for i, c in enumerate(courses.get("list", [])):
        if c["id"] == course_id:
            c.setdefault("session_details", []).append({
                "id": str(uuid.uuid4())[:8],
                "date": data.date or datetime.now().strftime("%Y-%m-%d"),
                "hours": max(1, data.hours),
                "topic": data.topic,
                "attendance": max(0, data.attendance),
            })
            _recalc_course_progress(c)
            courses["list"][i] = c
            _write_json(COURSES_FILE, courses)
            return APIResponse(success=True, message="已添加课时", data=c)
    raise HTTPException(status_code=404, detail="课程不存在")


@router.put("/courses/{course_id}/sessions/{session_id}", response_model=APIResponse)
async def update_session(course_id: str, session_id: str, data: SessionCreate):
    courses = _read_json(COURSES_FILE)
    for i, c in enumerate(courses.get("list", [])):
        if c["id"] == course_id:
            for d in c.get("session_details", []):
                if d["id"] == session_id:
                    d["date"] = data.date or d["date"]
                    d["hours"] = max(1, data.hours)
                    d["topic"] = data.topic
                    d["attendance"] = max(0, data.attendance)
                    break
            _recalc_course_progress(c)
            courses["list"][i] = c
            _write_json(COURSES_FILE, courses)
            return APIResponse(success=True, message="已更新课时", data=c)
    raise HTTPException(status_code=404, detail="课程不存在")


@router.delete("/courses/{course_id}/sessions/{session_id}", response_model=APIResponse)
async def delete_session(course_id: str, session_id: str):
    courses = _read_json(COURSES_FILE)
    for i, c in enumerate(courses.get("list", [])):
        if c["id"] == course_id:
            c["session_details"] = [d for d in c.get("session_details", []) if d["id"] != session_id]
            _recalc_course_progress(c)
            courses["list"][i] = c
            _write_json(COURSES_FILE, courses)
            return APIResponse(success=True, message="已删除课时", data=c)
    raise HTTPException(status_code=404, detail="课程不存在")


@router.post("/courses/{course_id}/sessions/batch", response_model=APIResponse)
async def batch_create_sessions(course_id: str, data: BatchSessions):
    courses = _read_json(COURSES_FILE)
    for i, c in enumerate(courses.get("list", [])):
        if c["id"] == course_id:
            for item in data.items:
                c.setdefault("session_details", []).append({
                    "id": str(uuid.uuid4())[:8],
                    "date": item.get("date", datetime.now().strftime("%Y-%m-%d")),
                    "hours": max(1, item.get("hours", 1)),
                    "topic": item.get("topic", ""),
                    "attendance": max(0, item.get("attendance", 0)),
                })
            _recalc_course_progress(c)
            courses["list"][i] = c
            _write_json(COURSES_FILE, courses)
            return APIResponse(success=True, message=f"已批量添加 {len(data.items)} 节课时", data=c)
    raise HTTPException(status_code=404, detail="课程不存在")


# ═══════════════════════════════════════════════════════
# 课程学生管理
# ═══════════════════════════════════════════════════════

@router.get("/courses/{course_id}/students", response_model=APIResponse)
async def list_course_students(course_id: str, search: str = ""):
    """获取某门课的选课学生列表（含个人进度/出勤）。"""
    courses = _read_json(COURSES_FILE)
    for c in courses.get("list", []):
        if c["id"] == course_id:
            slist = c.get("student_list", [])
            if search:
                slist = [s for s in slist if search in s.get("name", "") or search in s.get("student_id", "")]
            return APIResponse(success=True, data={
                "items": slist,
                "total": len(slist),
                "studentCount": len(c.get("student_list", [])),
            })
    raise HTTPException(status_code=404, detail="课程不存在")