/**
 * API 客户端 — 封装所有后端接口调用。
 *
 * 自动从 localStorage 读取 LLM 供应商配置，
 * 以 HTTP 头形式发送给后端，实现「每人独立配置」。
 */

import axios from 'axios';
import { getActiveModel } from '../utils/providerStorage';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,  // LLM 生成可能较慢
  headers: { 'Content-Type': 'application/json' },
});

// ── 自动携带 LLM 配置（多模型版） ─────────────────────
// 每次请求自动携带当前激活供应商的默认模型配置
api.interceptors.request.use((config) => {
  const active = getActiveModel();
  if (active) {
    config.headers['X-LLM-Api-Key'] = active.model.api_key;
    config.headers['X-LLM-Base-Url'] = active.provider.base_url;
    config.headers['X-LLM-Model-Name'] = active.model.model_name;
  }
  return config;
});

// ── 智能备课 ──────────────────────────────────────────

export interface LessonPlanRequest {
  course_name: string;
  chapter: string;
  textbook_content?: string;
  teaching_hours?: number;
  additional_requirements?: string;
}

export const lessonApi = {
  generate: (data: LessonPlanRequest) => api.post('/lesson/generate', data),
  list: (course?: string) => api.get('/lesson/plans', { params: { course } }),
  get: (id: string) => api.get(`/lesson/plans/${id}`),
  delete: (id: string) => api.delete(`/lesson/plans/${id}`),
};

// ── 作业批改 ──────────────────────────────────────────

export interface HomeworkSubmission {
  student_name: string;
  course_name: string;
  chapter?: string;
  question_text: string;
  student_answer: string;
  reference_answer?: string;
  question_type?: string;
  max_score?: number;
}

export interface ExerciseRequest {
  course_name: string;
  chapter?: string;
  knowledge_points: string[];
  difficulty?: string;
  count?: number;
  types?: string[];
}

export const homeworkApi = {
  grade: (data: HomeworkSubmission) => api.post('/homework/grade', data),
  batchGrade: (submissions: HomeworkSubmission[]) =>
    api.post('/homework/batch-grade', { submissions }),
  generateExercises: (data: ExerciseRequest) =>
    api.post('/homework/exercises', data),
  /** 上传单个 PDF/Word 文件，后端负责文本提取 + 批改 */
  uploadFile: (file: File, course = '') => {
    const form = new FormData();
    form.append('file', file);
    form.append('course', course);
    return api.post('/homework/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },
  /** 批量上传 PDF/Word 文件，后端负责文本提取 + 批改 */
  uploadFiles: (files: File[], course = '') => {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    form.append('course', course);
    return api.post('/homework/batch-upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
  },
};

// ── 学情洞察 ──────────────────────────────────────────

export interface PerformanceRecord {
  date?: string;
  exam_name?: string;
  score: number;
  total_score?: number;
  category?: string;
}

export interface StudentInsightRequest {
  student_id: string;
  course_name: string;
  records?: PerformanceRecord[];
}

export const insightApi = {
  analyzeStudent: (data: StudentInsightRequest) =>
    api.post('/insight/student', data),
  analyzeClass: (students: StudentInsightRequest[]) =>
    api.post('/insight/class', { course_name: students[0]?.course_name || '', students }),
};

// ── 知识库 ────────────────────────────────────────────

export const knowledgeApi = {
  search: (query: string, course_name = '', top_k = 5) =>
    api.post('/knowledge/search', { query, course_name, top_k }),
  upload: (file: File, course = 'default', chapter = '') => {
    const form = new FormData();
    form.append('file', file);
    form.append('course', course);
    form.append('chapter', chapter);
    return api.post('/knowledge/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  status: () => api.get('/knowledge/status', { timeout: 30000 }),
  collections: () => api.get('/knowledge/collections', { timeout: 30000 }),
  deleteCollection: (course: string) => api.delete(`/knowledge/collections/${course}`, { timeout: 30000 }),
};

// ── 教学资料与题库 ─────────────────────────────────────

export const materialApi = {
  /** 上传PDF教学资料 */
  upload: (file: File, course = '', chapter = '') => {
    const form = new FormData();
    form.append('file', file);
    form.append('course', course);
    form.append('chapter', chapter);
    return api.post('/materials/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  },
  /** 资料列表 */
  list: (course = '') => api.get('/materials/list', { params: { course } }),
  /** 资料详情 */
  detail: (id: string) => api.get(`/materials/detail/${id}`),
  /** 删除资料 */
  delete: (id: string) => api.delete(`/materials/delete/${id}`),
  /** AI 生成题目 */
  generateQuestions: (materialId: string, count = 5, difficulty = '中等', types = ['选择题', '填空题', '简答题']) =>
    api.post('/materials/generate-questions', { material_id: materialId, count, difficulty, types }),
  /** 下载文件 */
  download: (materialId: string) => `/api/materials/download/${materialId}`,
  /** 题目列表 */
  listQuestions: (materialId = '', status = '', course = '') =>
    api.get('/materials/questions', { params: { material_id: materialId, status, course } }),
  /** 更新题目 */
  updateQuestion: (data: any) => api.post('/materials/questions/update', data),
  /** 发布题目 */
  publish: (questionIds: string[], course: string, title: string, deadline = '') =>
    api.post('/materials/publish', { question_ids: questionIds, course, title, deadline }),
  /** 已发布列表 */
  listPublished: () => api.get('/materials/publish/list'),
};

// ── 系统设置（多供应商） ───────────────────────────────

export interface ProviderConfig {
  id?: string;
  name: string;
  api_key?: string;
  base_url: string;
  model_name: string;
  is_active?: boolean;
}

export const settingsApi = {
  /** 获取所有供应商配置 */
  listProviders: () => api.get('/settings/providers'),
  /** 新增供应商 */
  addProvider: (data: ProviderConfig) => api.post('/settings/providers', data),
  /** 更新供应商 */
  updateProvider: (id: string, data: Partial<ProviderConfig>) => api.put(`/settings/providers/${id}`, data),
  /** 删除供应商 */
  deleteProvider: (id: string) => api.delete(`/settings/providers/${id}`),
  /** 切换激活 */
  activateProvider: (id: string) => api.post(`/settings/providers/${id}/activate`),
  /** 获取当前激活的供应商 */
  getActive: () => api.get('/settings/active'),
  /** 测试连接 */
  test: (data?: Partial<ProviderConfig>) => api.post('/settings/test', data || {}),
};

// ── 课程管理 ─────────────────────────────────────────

export const courseMgmtApi = {
  /** 获取枚举配置 */
  getEnums: () => api.get('/course-mgmt/enums'),
  /** 获取教师列表 */
  listTeachers: () => api.get('/course-mgmt/teachers'),
  /** 新增教师 */
  addTeacher: (name: string, title?: string) => api.post('/course-mgmt/teachers', { name, title }),
  /** 删除教师 */
  deleteTeacher: (id: string) => api.delete(`/course-mgmt/teachers/${id}`),
  /** 课程列表 */
  listCourses: (semester?: string) => api.get('/course-mgmt/courses', { params: { semester } }),
  /** 课程详情 */
  getCourse: (id: string) => api.get(`/course-mgmt/courses/${id}`),
  /** 新增课程 */
  createCourse: (data: any) => api.post('/course-mgmt/courses', data),
  /** 更新课程 */
  updateCourse: (id: string, data: any) => api.put(`/course-mgmt/courses/${id}`, data),
  /** 删除课程 */
  deleteCourse: (id: string) => api.delete(`/course-mgmt/courses/${id}`),
  /** 新增课时 */
  addSession: (id: string) => api.post(`/course-mgmt/courses/${id}/add-session`),
  listSessions: (cid: string) => api.get(`/course-mgmt/courses/${cid}/sessions`),
  createSession: (cid: string, data: any) => api.post(`/course-mgmt/courses/${cid}/sessions`, data),
  updateSession: (cid: string, sid: string, data: any) => api.put(`/course-mgmt/courses/${cid}/sessions/${sid}`, data),
  deleteSession: (cid: string, sid: string) => api.delete(`/course-mgmt/courses/${cid}/sessions/${sid}`),
  batchSessions: (cid: string, items: any[]) => api.post(`/course-mgmt/courses/${cid}/sessions/batch`, { items }),
  listStudents: (cid: string, search = '') => api.get(`/course-mgmt/courses/${cid}/students`, { params: { search } }),
};

export default api;
