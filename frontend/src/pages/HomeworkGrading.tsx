/**
 * 作业智能辅批 — Edu-TA 智教星 三大标签页
 *
 * Tab1 智能批改：单题手动批改 + 8大模块批改报告
 * Tab2 出题助手：AI分层出题 + 导出Word/保存题库
 * Tab3 文件批改：批量上传文件 + CSV/TXT/PDF批量批改
 * 所有AI功能受API Key守卫保护
 */

import React, { useState } from 'react';
import {
  Card, Form, Input, Select, InputNumber, Button, Spin, Alert, Typography,
  Tag, Divider, Space, Tabs, Descriptions, List, Progress, Row, Col,
  Statistic, message, Collapse, Upload, Table, Tooltip, Empty, Modal, Popconfirm,
} from 'antd';
import {
  RobotOutlined, CheckCircleOutlined, CloseCircleOutlined, BulbOutlined,
  BookOutlined, ThunderboltOutlined, FileAddOutlined, UploadOutlined,
  InboxOutlined, FileTextOutlined, FilePdfOutlined, FileWordOutlined,
  DeleteOutlined, DownloadOutlined, HistoryOutlined, KeyOutlined,
  StarOutlined, CodeOutlined, ExperimentOutlined, SaveOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { homeworkApi, ExerciseRequest } from '../api/client';
import { BRAND, CARD_SPECS } from '../utils/brand';
import { useApiKeyGuard, ApiKeyGuardModal, ApiKeyBanner, DisabledAIButton } from '../utils/apiKeyGuard';
import SettingsModal from '../components/SettingsModal';
import '../styles/brand.css';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const BrandBadge: React.FC<{ size?: number; color?: string }> = ({ size = 14, color }) => (
  <span dangerouslySetInnerHTML={{ __html: BRAND.badgeSvg.replace('currentColor', color || BRAND.colors.primary) }}
    style={{ width: size, height: size, display: 'inline-flex', verticalAlign: 'middle', flexShrink: 0 }} />
);

// 课程选项
const courseOptions = [
  { value: '机器学习', label: '机器学习' }, { value: '深度学习', label: '深度学习' },
  { value: '自然语言处理', label: '自然语言处理' }, { value: '计算机视觉', label: '计算机视觉' },
];

const questionTypeOptions = [
  { value: '选择题', label: '选择题' }, { value: '多选题', label: '多选题' },
  { value: '判断题', label: '判断题' }, { value: '填空题', label: '填空题' },
  { value: '简答题', label: '简答题' }, { value: '证明题', label: '证明题' },
  { value: '代码编程题', label: '代码编程题' }, { value: '计算题', label: '计算题' },
];

const difficultyOptions = [
  { value: '基础', label: '基础' }, { value: '提高', label: '提高' },
  { value: '综合', label: '综合' }, { value: '拓展', label: '拓展' },
];

const HomeworkGrading: React.FC = () => {
  const [gradeForm] = Form.useForm();
  const [exerciseForm] = Form.useForm();

  // API Key 守卫
  const guard = useApiKeyGuard();
  const canGenerate = guard.hasKey;

  // 批改状态
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<any>(null);
  const [gradeError, setGradeError] = useState('');

  // 出题状态
  const [generating, setGenerating] = useState(false);
  const [exercises, setExercises] = useState<any[]>([]);
  const [exError, setExError] = useState('');

  // 文件批改
  interface UploadedFileItem {
    uid: string; name: string; size: number; type: 'csv' | 'txt' | 'pdf' | 'word';
    file: File; status: 'pending' | 'parsing' | 'parsed' | 'error'; recordCount?: number; errorMessage?: string;
  }
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [fileSubmissions, setFileSubmissions] = useState<any[]>([]);
  const [batchGrading, setBatchGrading] = useState(false);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [batchError, setBatchError] = useState('');

  // 历史记录侧栏
  const [historyVisible, setHistoryVisible] = useState(false);

  const getFileType = (fileName: string): UploadedFileItem['type'] => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'csv') return 'csv'; if (ext === 'txt') return 'txt';
    if (ext === 'pdf') return 'pdf'; if (ext === 'docx' || ext === 'doc') return 'word';
    return 'txt';
  };

  const getFileIcon = (type: UploadedFileItem['type']) => {
    switch (type) {
      case 'csv': return <FileTextOutlined style={{ color: '#52c41a' }} />;
      case 'txt': return <FileTextOutlined style={{ color: '#1677ff' }} />;
      case 'pdf': return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
      case 'word': return <FileWordOutlined style={{ color: '#2f54eb' }} />;
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const cols: string[] = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') { if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = false; }
        else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',' || ch === '\t') { cols.push(current.trim()); current = ''; }
        else current += ch;
      }
    }
    cols.push(current.trim());
    return cols;
  };

  const parseTextFile = (file: File, uid: string) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target?.result as string) || '';
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
          setUploadedFiles(prev => prev.map(f => f.uid === uid ? { ...f, status: 'error', errorMessage: '内容为空' } : f));
          message.warning(`"${file.name}" 内容为空`); return;
        }
        const submissions: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols.length >= 4 && cols[0] && cols[2] && cols[3]) {
            submissions.push({
              student_name: cols[0], course_name: cols[1], question_text: cols[2],
              student_answer: cols[3], reference_answer: cols[4] || '', question_type: cols[5] || '主观题',
              max_score: parseFloat(cols[6]) || 100, _sourceFile: file.name,
            });
          }
        }
        if (submissions.length === 0) {
          setUploadedFiles(prev => prev.map(f => f.uid === uid ? { ...f, status: 'error', errorMessage: '未解析到有效记录' } : f));
          message.warning(`"${file.name}" 未能解析到有效记录`);
        } else {
          setFileSubmissions(prev => [...prev, ...submissions]);
          setUploadedFiles(prev => prev.map(f => f.uid === uid ? { ...f, status: 'parsed', recordCount: submissions.length } : f));
          message.success(`已解析 "${file.name}"（${submissions.length} 条记录）`);
        }
      } catch {
        setUploadedFiles(prev => prev.map(f => f.uid === uid ? { ...f, status: 'error', errorMessage: '编码错误' } : f));
        message.error(`"${file.name}" 读取失败`);
      }
    };
    reader.onerror = () => setUploadedFiles(prev => prev.map(f => f.uid === uid ? { ...f, status: 'error', errorMessage: '读取失败' } : f));
    reader.readAsText(file, 'UTF-8');
  };

  const handleFileAdd = (file: File): false => {
    const ALLOWED_EXTS = ['csv', 'txt', 'pdf', 'docx', 'doc'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTS.includes(ext)) { message.error(`不支持: .${ext}`); return false; }
    if (uploadedFiles.some(f => f.name === file.name && f.size === file.size)) { message.warning(`"${file.name}" 已添加`); return false; }
    const fileType = getFileType(file.name);
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setUploadedFiles(prev => [...prev, { uid, file, name: file.name, size: file.size, type: fileType, status: fileType === 'csv' || fileType === 'txt' ? 'parsing' : 'pending' }]);
    if (fileType === 'csv' || fileType === 'txt') parseTextFile(file, uid);
    return false;
  };

  const handleRemoveFile = (uid: string) => {
    const removed = uploadedFiles.find(f => f.uid === uid);
    setUploadedFiles(prev => prev.filter(f => f.uid !== uid));
    if (removed) setFileSubmissions(prev => prev.filter(s => s._sourceFile !== removed.name));
  };

  const handleClearFiles = () => { setUploadedFiles([]); setFileSubmissions([]); setBatchResults([]); setBatchError(''); };

  const handleBatchGrade = async () => {
    if (!canGenerate) { guard.showGuard(); return; }
    const csvSubmissions = fileSubmissions;
    const pendingDocFiles = uploadedFiles.filter(f => (f.type === 'pdf' || f.type === 'word') && (f.status === 'pending' || f.status === 'error'));
    if (csvSubmissions.length === 0 && pendingDocFiles.length === 0) { message.warning('没有可批改的作业'); return; }
    setBatchGrading(true); setBatchError(''); setBatchResults([]);
    let docResults: any[] = []; let producedResults = false;
    for (const item of pendingDocFiles) {
      setUploadedFiles(prev => prev.map(f => f.uid === item.uid ? { ...f, status: 'parsing' } : f));
      try {
        const res = await homeworkApi.uploadFile(item.file);
        if (res.data.success) {
          const results = res.data.data?.results || res.data.data?.submissions || [];
          docResults = [...docResults, ...(Array.isArray(results) ? results : [results]).map((r: any) => ({ ...r, _sourceFile: item.name }))];
          setUploadedFiles(prev => prev.map(f => f.uid === item.uid ? { ...f, status: 'parsed', recordCount: (Array.isArray(results) ? results : [results]).length } : f));
        } else setUploadedFiles(prev => prev.map(f => f.uid === item.uid ? { ...f, status: 'error', errorMessage: res.data.message || '失败' } : f));
      } catch (e: any) { setUploadedFiles(prev => prev.map(f => f.uid === item.uid ? { ...f, status: 'error', errorMessage: e.response?.data?.detail || '上传失败' } : f)); }
    }
    const allToGrade = [...csvSubmissions];
    if (docResults.length > 0) {
      if (docResults.some((r: any) => r.score !== undefined || r.percentage !== undefined)) {
        setBatchResults(docResults); producedResults = true;
      } else allToGrade.push(...docResults.map((s: any) => { const { _sourceFile, ...rest } = s; return rest; }));
    }
    if (allToGrade.length > 0) {
      try {
        const res = await homeworkApi.batchGrade(allToGrade);
        if (res.data.success) { setBatchResults(prev => [...prev, ...(res.data.data?.results || [])]); producedResults = true; message.success(`批改完成！共 ${allToGrade.length} 份`); }
        else setBatchError(res.data.message || '批量批改失败');
      } catch (e: any) { setBatchError(e.response?.data?.detail || '请求失败'); }
    }
    if (!producedResults) setBatchError('未能提取有效作业记录');
    setBatchGrading(false);
  };

  const handleGrade = async (values: any) => {
    if (!canGenerate) { guard.showGuard(); return; }
    setGrading(true); setGradeError(''); setGradeResult(null);
    try {
      const res = await homeworkApi.grade({
        student_name: values.student_name, course_name: values.course_name, chapter: values.chapter || '',
        question_text: values.question_text, student_answer: values.student_answer,
        reference_answer: values.reference_answer || '', question_type: values.question_type, max_score: values.max_score,
      });
      if (res.data.success) { setGradeResult(res.data.data); message.success('AI 批改完成！'); }
      else setGradeError(res.data.message || '批改失败');
    } catch (e: any) { setGradeError(e.response?.data?.detail || '请求失败'); }
    finally { setGrading(false); }
  };

  const handleGenerateExercises = async (values: any) => {
    if (!canGenerate) { guard.showGuard(); return; }
    setGenerating(true); setExError(''); setExercises([]);
    try {
      const res = await homeworkApi.generateExercises({
        course_name: values.course_name, chapter: values.chapter || '',
        knowledge_points: values.knowledge_points.split(/[,，、]/).filter((s: string) => s.trim()),
        difficulty: values.difficulty || '中等', count: values.count || 5,
        types: values.types || ['选择题', '填空题', '简答题'],
      });
      if (res.data.success) { setExercises(res.data.data.exercises || []); message.success(`已生成 ${res.data.data.total} 道练习题！`); }
      else setExError(res.data.message || '生成失败');
    } catch (e: any) { setExError(e.response?.data?.detail || '请求失败'); }
    finally { setGenerating(false); }
  };

  return (
    <div className="page-enter" style={{ position: 'relative' }}>
      {/* API Key 横幅 */}
      {!canGenerate && <ApiKeyBanner onGoSettings={guard.goToSettings} />}

      {/* 页面头部 */}
      <div style={{ marginBottom: 16 }}>
        <Space align="center" size={10}>
          <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }}
            style={{ width: 32, height: 32, display: 'inline-flex', animation: 'logoPulse 0.8s ease-out' }} />
          <div>
            <Title level={4} style={{ margin: 0, fontSize: 17, fontWeight: 700, color: BRAND.colors.textPrimary }}>
              智教星 · 作业智能辅批
            </Title>
            <Text type="secondary" style={{ fontSize: 11 }}>AI 智能批改 · 分层出题 · 批量文件批改</Text>
          </div>
        </Space>
      </div>

      <Tabs defaultActiveKey="grade" style={{ background: '#fff', borderRadius: 12, padding: '4px 16px 16px', boxShadow: CARD_SPECS.shadow }}
        tabBarExtraContent={
          <Button icon={<HistoryOutlined />} type="text" onClick={() => setHistoryVisible(true)}
            style={{ color: BRAND.colors.primary }}>批改记录</Button>
        }
        items={[
          // ═══════════════════════════════════════════════════
          // Tab 1: 智能批改
          // ═══════════════════════════════════════════════════
          {
            key: 'grade',
            label: <span><CheckCircleOutlined style={{ color: BRAND.colors.primary }} />智能批改</span>,
            children: (
              <Row gutter={20}>
                <Col xs={24} lg={12}>
                  <Card className="brand-card" bodyStyle={{ padding: '16px 20px', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: 8, right: 10, color: BRAND.colors.primary, opacity: 0.3 }}><BrandBadge size={16} /></span>
                    <Space style={{ marginBottom: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: BRAND.colors.primaryGradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RobotOutlined style={{ fontSize: 14, color: '#fff' }} />
                      </div>
                      <Text strong style={{ fontSize: 14 }}>AI 智能批改</Text>
                      {!canGenerate && <Tag color="warning" style={{ borderRadius: 8, fontSize: 10 }}>需API密钥</Tag>}
                    </Space>
                    <Form form={gradeForm} layout="vertical" onFinish={handleGrade} size="middle">
                      <Row gutter={12}>
                        <Col span={12}>
                          <Form.Item name="student_name" label="学生姓名" rules={[{ required: true, message: '请输入学生姓名' }]}>
                            <Select placeholder="选择或输入" style={{ borderRadius: 8 }} options={[
                              { value: '张三', label: '张三' }, { value: '李四', label: '李四' },
                              { value: '王五', label: '王五' }, { value: '赵六', label: '赵六' },
                            ]} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="course_name" label="课程" rules={[{ required: true }]}>
                            <Select style={{ borderRadius: 8 }} options={courseOptions} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item name="chapter" label="章节">
                        <Input placeholder="联动课程自动填充" style={{ borderRadius: 8 }} />
                      </Form.Item>
                      <Row gutter={12}>
                        <Col span={12}>
                          <Form.Item name="question_type" label="题目类型" initialValue="简答题">
                            <Select style={{ borderRadius: 8 }} options={questionTypeOptions} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="max_score" label="满分" initialValue={100}>
                            <InputNumber min={1} max={1000} style={{ width: '100%', borderRadius: 8 }} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item name="question_text" label="题目内容" rules={[{ required: true, message: '请输入题目' }]}>
                        <TextArea rows={3} placeholder="支持粘贴公式、代码块、题目内容..." style={{ borderRadius: 8, fontFamily: 'monospace' }} />
                      </Form.Item>
                      <Form.Item name="student_answer" label="学生答案" rules={[{ required: true, message: '请输入学生答案' }]}>
                        <TextArea rows={4} placeholder="粘贴学生提交的答案、代码、推导过程..." style={{ borderRadius: 8, fontFamily: 'monospace' }} />
                      </Form.Item>
                      <Form.Item name="reference_answer" label="参考答案（可选，用于对比评分）">
                        <TextArea rows={2} placeholder="标准解答..." style={{ borderRadius: 8 }} />
                      </Form.Item>
                      <Form.Item style={{ marginBottom: 0 }}>
                        <Space>
                          {canGenerate ? (
                            <Button type="primary" htmlType="submit" loading={grading} icon={<ThunderboltOutlined />}
                              style={{ borderRadius: 8, border: 'none', background: BRAND.colors.primaryGradient, height: 40, minWidth: 160 }}>
                              {grading ? 'AI 批改中...' : '开始 AI 智能批改'}
                            </Button>
                          ) : (
                            <DisabledAIButton label="AI 批改已锁定" icon={<KeyOutlined />} />
                          )}
                          <Button onClick={() => gradeForm.resetFields()} style={{ borderRadius: 8, borderColor: BRAND.colors.border }}>重置表单</Button>
                        </Space>
                      </Form.Item>
                    </Form>
                    {gradeError && <Alert message={gradeError} type="error" showIcon style={{ marginTop: 12, borderRadius: 8 }} />}
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  {/* 加载态 */}
                  {grading && (
                    <Card className="brand-card" bodyStyle={{ padding: 40, textAlign: 'center' }}>
                      <div style={{ animation: 'logoGlow 1.5s ease-in-out infinite' }}>
                        <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 48, height: 48, display: 'inline-block' }} />
                      </div>
                      <Spin style={{ marginTop: 12 }} />
                      <Paragraph style={{ marginTop: 8, color: BRAND.colors.textSecondary, fontSize: 12 }}>AI 正在逐项批改...</Paragraph>
                    </Card>
                  )}

                  {/* 批改结果 */}
                  {gradeResult && !grading && (
                    <Card className="brand-card" bodyStyle={{ padding: '16px 20px', position: 'relative' }}>
                      <span style={{ position: 'absolute', top: 8, right: 10, color: BRAND.colors.green, opacity: 0.3 }}><BrandBadge size={16} color={BRAND.colors.green} /></span>
                      <Space style={{ marginBottom: 16 }}>
                        <CheckCircleOutlined style={{ color: BRAND.colors.green, fontSize: 20 }} />
                        <Title level={5} style={{ margin: 0, fontSize: 15 }}>AI 批改报告</Title>
                        <Tag style={{ borderRadius: 6, background: `${BRAND.colors.green}15`, color: BRAND.colors.green, border: 'none' }}>来源可追溯</Tag>
                      </Space>
                      {/* 1. 总分评定 */}
                      <Card size="small" style={{ marginBottom: 8, borderRadius: 8 }}>
                        <Row gutter={16} align="middle">
                          <Col span={6}><Statistic title="批改得分" value={gradeResult.score} suffix={`/ ${gradeResult.max_score}`} valueStyle={{ color: (gradeResult.percentage || 0) >= 60 ? BRAND.colors.green : BRAND.colors.error }} /></Col>
                          <Col span={6}><Progress type="circle" percent={gradeResult.percentage || 0} size={60} status={(gradeResult.percentage || 0) >= 60 ? 'success' : 'exception'} /></Col>
                          <Col span={12}>
                            <Space>
                              {gradeResult.knowledge_points?.map((kp: string, i: number) => <Tag key={i} style={{ borderRadius: 6, background: `${BRAND.colors.primary}10`, color: BRAND.colors.primary, border: 'none' }}>{kp}</Tag>)}
                            </Space>
                          </Col>
                        </Row>
                      </Card>
                      {/* 3. 综合评语 */}
                      <Card size="small" title="📝 综合评语" style={{ marginBottom: 8, borderRadius: 8 }}>
                        <Paragraph style={{ fontSize: 13 }}>{gradeResult.feedback}</Paragraph>
                      </Card>
                      {/* 4. 逐点批注 - 详细分析 */}
                      {gradeResult.detailed_analysis && (
                        <Card size="small" title="🔍 逐点批改批注" style={{ marginBottom: 8, borderRadius: 8 }}>
                          <Paragraph style={{ fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{gradeResult.detailed_analysis}</Paragraph>
                        </Card>
                      )}
                      {/* 5. 优点与不足 */}
                      <Row gutter={8} style={{ marginBottom: 8 }}>
                        <Col span={12}>
                          <Card size="small" title="✅ 优点" bodyStyle={{ padding: '8px 12px' }} style={{ borderRadius: 8 }}>
                            {gradeResult.strengths?.map((s: string, i: number) => <Tag key={i} color="success" style={{ borderRadius: 6, marginBottom: 4 }}>{s}</Tag>) || <Text type="secondary">—</Text>}
                          </Card>
                        </Col>
                        <Col span={12}>
                          <Card size="small" title="❌ 不足与错误" bodyStyle={{ padding: '8px 12px' }} style={{ borderRadius: 8 }}>
                            {gradeResult.weaknesses?.map((w: string, i: number) => <Tag key={i} color="error" style={{ borderRadius: 6, marginBottom: 4 }}>{w}</Tag>) || <Text type="secondary">—</Text>}
                          </Card>
                        </Col>
                      </Row>
                      {/* 6. 改进建议 */}
                      <Card size="small" title="💡 针对性改进建议" style={{ marginBottom: 8, borderRadius: 8 }}>
                        <List size="small" dataSource={gradeResult.suggestions || []} renderItem={(item: string) => <List.Item style={{ padding: '2px 0' }}><BulbOutlined style={{ color: BRAND.colors.orange, marginRight: 8 }} />{item}</List.Item>} />
                      </Card>
                      {/* 操作 */}
                      <Divider style={{ margin: '8px 0' }} />
                      <Space>
                        <Button icon={<DownloadOutlined />} style={{ borderRadius: 8, borderColor: BRAND.colors.primary, color: BRAND.colors.primary }}>导出 Word 报告</Button>
                        <Button icon={<HistoryOutlined />} style={{ borderRadius: 8, borderColor: BRAND.colors.purple, color: BRAND.colors.purple }}>归档至教学台账</Button>
                      </Space>
                      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 10 }}>【本内容由学科垂类AI助教生成】</Text>
                    </Card>
                  )}

                  {!gradeResult && !grading && (
                    <Card className="brand-card" bodyStyle={{ padding: 60, textAlign: 'center' }}>
                      <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 48, height: 48, display: 'inline-block', opacity: 0.3 }} />
                      <Paragraph style={{ marginTop: 8, color: BRAND.colors.textTertiary, fontSize: 13 }}>填写表单后开始 AI 批改</Paragraph>
                      <Button type="link" icon={<FileTextOutlined />} style={{ color: BRAND.colors.primary }}>从题库导入题目</Button>
                    </Card>
                  )}
                </Col>
              </Row>
            ),
          },
          // ═══════════════════════════════════════════════════
          // Tab 2: 出题助手
          // ═══════════════════════════════════════════════════
          {
            key: 'exercise',
            label: <span><FileAddOutlined style={{ color: BRAND.colors.purple }} />出题助手</span>,
            children: (
              <Row gutter={20}>
                <Col xs={24} lg={8}>
                  <Card className="brand-card" bodyStyle={{ padding: '16px 20px', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: 8, right: 10, color: BRAND.colors.purple, opacity: 0.3 }}><BrandBadge size={16} color={BRAND.colors.purple} /></span>
                    <Space style={{ marginBottom: 12 }}>
                      <BookOutlined style={{ color: BRAND.colors.purple }} />
                      <Text strong style={{ fontSize: 14 }}>AI 分层出题</Text>
                    </Space>
                    <Form form={exerciseForm} layout="vertical" onFinish={handleGenerateExercises}
                      initialValues={{ difficulty: '中等', count: 5, types: ['选择题', '填空题', '简答题'] }} size="middle">
                      <Form.Item name="course_name" label="课程" rules={[{ required: true }]}>
                        <Select style={{ borderRadius: 8 }} options={courseOptions} />
                      </Form.Item>
                      <Form.Item name="chapter" label="章节"><Input placeholder="例：决策树" style={{ borderRadius: 8 }} /></Form.Item>
                      <Form.Item name="knowledge_points" label="知识点" rules={[{ required: true }]} help="逗号分隔">
                        <Input placeholder="过拟合, 剪枝, 信息增益" style={{ borderRadius: 8 }} />
                      </Form.Item>
                      <Row gutter={12}>
                        <Col span={12}>
                          <Form.Item name="difficulty" label="难度">
                            <Select style={{ borderRadius: 8 }} options={difficultyOptions} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="count" label="数量">
                            <InputNumber min={1} max={50} style={{ width: '100%', borderRadius: 8 }} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item name="types" label="题型">
                        <Select mode="multiple" style={{ borderRadius: 8 }} options={questionTypeOptions.slice(0, 6)} />
                      </Form.Item>
                      <Form.Item style={{ marginBottom: 0 }}>
                        {canGenerate ? (
                          <Button type="primary" htmlType="submit" loading={generating} icon={<ThunderboltOutlined />} block
                            style={{ borderRadius: 8, border: 'none', background: BRAND.colors.primaryGradient, height: 40 }}>
                            {generating ? 'AI 出题中...' : '生成题目'}
                          </Button>
                        ) : (
                          <DisabledAIButton label="AI 出题已锁定" icon={<KeyOutlined />} />
                        )}
                      </Form.Item>
                    </Form>
                    {exError && <Alert message={exError} type="error" showIcon style={{ marginTop: 12, borderRadius: 8 }} />}
                  </Card>
                </Col>
                <Col xs={24} lg={16}>
                  {generating && (
                    <Card className="brand-card" bodyStyle={{ padding: 40, textAlign: 'center' }}>
                      <div style={{ animation: 'logoGlow 1.5s ease-in-out infinite' }}>
                        <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 48, height: 48, display: 'inline-block' }} />
                      </div>
                      <Spin style={{ marginTop: 12 }} />
                      <Paragraph style={{ marginTop: 8, color: BRAND.colors.textSecondary, fontSize: 12 }}>AI 正在分层出题...</Paragraph>
                    </Card>
                  )}
                  {exercises.length > 0 && !generating && (
                    <Card className="brand-card"
                      title={<Space><BrandBadge color={BRAND.colors.purple} /><FileAddOutlined style={{ color: BRAND.colors.purple }} /><Text strong>共 {exercises.length} 道练习题</Text></Space>}
                      bodyStyle={{ padding: '12px 16px' }}
                      extra={
                        <Space>
                          <Button icon={<DownloadOutlined />} size="small" style={{ borderRadius: 6, borderColor: BRAND.colors.green, color: BRAND.colors.green }}>导出 Word</Button>
                          <Button icon={<SaveOutlined />} size="small" style={{ borderRadius: 6, borderColor: BRAND.colors.primary, color: BRAND.colors.primary }}>保存至题库</Button>
                        </Space>
                      }
                    >
                      <Space style={{ marginBottom: 12 }}>
                        <Text strong style={{ fontSize: 12 }}>难度分布：</Text>
                        {['简单', '中等', '困难'].map(d => { const c = exercises.filter(e => e.difficulty === d).length; return c > 0 ? <Tag key={d} style={{ borderRadius: 6 }}>{d}: {c}题</Tag> : null; })}
                      </Space>
                      {exercises.map((ex, idx) => (
                        <Card key={idx} size="small" style={{ marginBottom: 8, borderRadius: 8 }}
                          title={<Space><Tag style={{ borderRadius: 6 }}>#{idx + 1}</Tag><Text strong style={{ fontSize: 13 }}>[{ex.type}]</Text></Space>}
                          extra={<Tag color={ex.difficulty === '简单' ? 'green' : ex.difficulty === '困难' ? 'red' : 'orange'} style={{ borderRadius: 6 }}>{ex.difficulty}</Tag>}>
                          <Paragraph><Text strong>{ex.question}</Text></Paragraph>
                          {ex.options?.length > 0 && <div style={{ marginLeft: 16, marginBottom: 8 }}>{ex.options.map((opt: string, oi: number) => <Paragraph key={oi} style={{ margin: 0, fontSize: 12 }}>{opt}</Paragraph>)}</div>}
                          <Space><Tag style={{ borderRadius: 6, background: `${BRAND.colors.primary}10`, color: BRAND.colors.primary, border: 'none' }}>{ex.knowledge_point}</Tag><Text type="secondary" style={{ fontSize: 11 }}>预计 {ex.estimated_time} 分钟</Text></Space>
                          <Collapse items={[{ key: 'a', label: '查看答案与解析', children: <div><Text strong>答案：</Text><Paragraph>{ex.answer}</Paragraph><Text strong>解析：</Text><Paragraph>{ex.explanation}</Paragraph></div> }]} style={{ marginTop: 6, borderRadius: 8 }} />
                        </Card>
                      ))}
                    </Card>
                  )}
                  {exercises.length === 0 && !generating && (
                    <Card className="brand-card" bodyStyle={{ padding: 60, textAlign: 'center' }}>
                      <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 48, height: 48, display: 'inline-block', opacity: 0.3 }} />
                      <Paragraph style={{ marginTop: 8, color: BRAND.colors.textTertiary, fontSize: 13 }}>设置参数后开始 AI 出题</Paragraph>
                    </Card>
                  )}
                </Col>
              </Row>
            ),
          },
          // ═══════════════════════════════════════════════════
          // Tab 3: 文件批改
          // ═══════════════════════════════════════════════════
          {
            key: 'file',
            label: <span><UploadOutlined style={{ color: BRAND.colors.green }} />文件批改</span>,
            children: (
              <Row gutter={20}>
                <Col xs={24} lg={10}>
                  <Card className="brand-card" bodyStyle={{ padding: '16px 20px', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: 8, right: 10, color: BRAND.colors.green, opacity: 0.3 }}><BrandBadge size={16} color={BRAND.colors.green} /></span>
                    <Space style={{ marginBottom: 12 }}>
                      <InboxOutlined style={{ color: BRAND.colors.green, fontSize: 18 }} />
                      <Text strong style={{ fontSize: 14 }}>上传作业文件</Text>
                    </Space>
                    <Alert message="支持 CSV / TXT / PDF / Word (.docx) 格式" type="info" showIcon style={{ borderRadius: 8, marginBottom: 12, fontSize: 11 }} />
                    <Upload.Dragger accept=".csv,.txt,.pdf,.docx,.doc" beforeUpload={handleFileAdd} showUploadList={false} multiple style={{ borderRadius: 8 }}>
                      <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                      <p className="ant-upload-text">点击或拖拽文件</p>
                      <p className="ant-upload-hint">支持 PDF / Word / CSV / TXT</p>
                    </Upload.Dragger>
                    {uploadedFiles.length > 0 && (
                      <Card size="small" style={{ marginTop: 12, borderRadius: 8 }}
                        title={<Space><span>已添加 {uploadedFiles.length} 个文件</span>
                          {!batchGrading && <Button type="link" size="small" danger onClick={handleClearFiles}>清空</Button>}</Space>}>
                        <List size="small" dataSource={uploadedFiles} renderItem={(item) => {
                          const tagColor = item.type === 'csv' ? 'green' : item.type === 'txt' ? 'blue' : item.type === 'pdf' ? 'red' : 'geekblue';
                          return (
                            <List.Item actions={[<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemoveFile(item.uid)} disabled={batchGrading} />]}>
                              <List.Item.Meta
                                avatar={getFileIcon(item.type)}
                                title={<Space><Text ellipsis={{ tooltip: item.name }} style={{ maxWidth: 180 }}>{item.name}</Text><Tag color={tagColor} style={{ fontSize: 10 }}>{item.type.toUpperCase()}</Tag></Space>}
                                description={<Space size={8}>
                                  <Text style={{ fontSize: 11 }}>{(item.size / 1024).toFixed(1)} KB</Text>
                                  {item.status === 'parsing' && <Tag color="processing" style={{ fontSize: 10 }}>解析中...</Tag>}
                                  {item.status === 'parsed' && <Tag color="success" style={{ fontSize: 10 }}>{item.recordCount} 条</Tag>}
                                  {item.status === 'error' && <Tag color="error" style={{ fontSize: 10 }}>{item.errorMessage || '失败'}</Tag>}
                                  {item.status === 'pending' && <Tag style={{ fontSize: 10 }}>待处理</Tag>}
                                </Space>}
                              />
                            </List.Item>
                          );
                        }} />
                      </Card>
                    )}
                    {fileSubmissions.length > 0 && <Tag color="blue" style={{ marginTop: 8 }}>共 {fileSubmissions.length} 条待批改</Tag>}
                    <div style={{ marginTop: 12 }}>
                      {canGenerate ? (
                        <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleBatchGrade} loading={batchGrading} size="large" block
                          disabled={fileSubmissions.length === 0 && !uploadedFiles.some(f => (f.type === 'pdf' || f.type === 'word') && f.status === 'pending')}
                          style={{ borderRadius: 8, border: 'none', background: BRAND.colors.primaryGradient, height: 44 }}>
                          {batchGrading ? 'AI 批量批改中...' : '开始批量批改'}
                        </Button>
                      ) : (
                        <DisabledAIButton label="批量批改已锁定" icon={<KeyOutlined />} />
                      )}
                    </div>
                    {batchError && <Alert message={batchError} type="error" showIcon closable style={{ marginTop: 8, borderRadius: 8 }} />}
                  </Card>
                </Col>
                <Col xs={24} lg={14}>
                  {fileSubmissions.length > 0 && !batchGrading && batchResults.length === 0 && (
                    <Card title={<Space><BrandBadge />📋 待批改列表（{fileSubmissions.length} 份）</Space>} size="small" className="brand-card">
                      <Table dataSource={fileSubmissions} rowKey={(_, i) => String(i)} size="small" pagination={false} scroll={{ y: 400 }}
                        columns={[
                          { title: '学生', dataIndex: 'student_name', width: 80 },
                          { title: '课程', dataIndex: 'course_name', width: 90 },
                          { title: '题目', dataIndex: 'question_text', ellipsis: true },
                          { title: '答案', dataIndex: 'student_answer', ellipsis: true, width: 150 },
                          { title: '来源', dataIndex: '_sourceFile', width: 110, ellipsis: true, render: (v: string) => v ? <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text> : '-' },
                        ]} />
                    </Card>
                  )}
                  {batchGrading && (
                    <Card className="brand-card" bodyStyle={{ padding: 40, textAlign: 'center' }}>
                      <div style={{ animation: 'logoGlow 1.5s ease-in-out infinite' }}>
                        <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 48, height: 48, display: 'inline-block' }} />
                      </div>
                      <Spin style={{ marginTop: 12 }} />
                      <Paragraph style={{ marginTop: 8, color: BRAND.colors.textSecondary, fontSize: 12 }}>AI 批量批改中...</Paragraph>
                    </Card>
                  )}
                  {batchResults.length > 0 && !batchGrading && (
                    <Card className="brand-card" title={<Space><CheckCircleOutlined style={{ color: BRAND.colors.green }} /><Text strong>批改结果（{batchResults.length} 份）</Text></Space>}
                      bodyStyle={{ padding: '12px 16px' }}
                      extra={<Button icon={<DownloadOutlined />} size="small" style={{ borderRadius: 6, borderColor: BRAND.colors.primary, color: BRAND.colors.primary }}>导出汇总 Excel</Button>}>
                      <Row gutter={12} style={{ marginBottom: 12 }}>
                        <Col span={6}><Card size="small"><Statistic title="平均分" value={(batchResults.reduce((s, r) => s + (r.percentage || 0), 0) / batchResults.length).toFixed(1)} suffix="%" /></Card></Col>
                        <Col span={6}><Card size="small"><Statistic title="最高分" value={Math.max(...batchResults.map((r: any) => r.percentage || 0)).toFixed(1)} suffix="%" /></Card></Col>
                        <Col span={6}><Card size="small"><Statistic title="最低分" value={Math.min(...batchResults.map((r: any) => r.percentage || 0)).toFixed(1)} suffix="%" /></Card></Col>
                        <Col span={6}><Card size="small"><Statistic title="通过率" value={(batchResults.filter((r: any) => (r.percentage || 0) >= 60).length / batchResults.length * 100).toFixed(1)} suffix="%" /></Card></Col>
                      </Row>
                      <List dataSource={batchResults} renderItem={(item: any, idx: number) => (
                        <Card size="small" style={{ marginBottom: 6, borderRadius: 8 }} key={idx}
                          title={<Space><Text strong>#{idx + 1}</Text>{item.student_name && <Tag color="blue" style={{ borderRadius: 6 }}>{item.student_name}</Tag>}<Progress type="circle" percent={item.percentage || 0} size={36} status={(item.percentage || 0) >= 60 ? 'success' : 'exception'} /></Space>}>
                          <Descriptions column={2} size="small">
                            <Descriptions.Item label="得分">{item.score} / {item.max_score}</Descriptions.Item>
                            <Descriptions.Item label="知识点">{item.knowledge_points?.join(', ') || '-'}</Descriptions.Item>
                          </Descriptions>
                          {item.feedback && <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>{item.feedback}</Paragraph>}
                          <Space wrap style={{ marginTop: 4 }}>{item.strengths?.map((s: string, i: number) => <Tag color="success" key={i} style={{ borderRadius: 6 }}>{s}</Tag>)}</Space>
                        </Card>
                      )} />
                      <div style={{ textAlign: 'center', marginTop: 12 }}>
                        <Space>
                          <Button icon={<HistoryOutlined />} style={{ borderRadius: 8, borderColor: BRAND.colors.purple, color: BRAND.colors.purple }}>一键归档至台账</Button>
                          <Button icon={<DownloadOutlined />} style={{ borderRadius: 8, borderColor: BRAND.colors.primary, color: BRAND.colors.primary }}>导出全部报告</Button>
                        </Space>
                      </div>
                    </Card>
                  )}
                  {!batchGrading && batchResults.length === 0 && fileSubmissions.length === 0 && uploadedFiles.length === 0 && (
                    <Card className="brand-card" bodyStyle={{ padding: 60, textAlign: 'center' }}>
                      <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 48, height: 48, display: 'inline-block', opacity: 0.3 }} />
                      <Paragraph style={{ marginTop: 8, color: BRAND.colors.textTertiary, fontSize: 13 }}>上传文件开始批量批改</Paragraph>
                    </Card>
                  )}
                </Col>
              </Row>
            ),
          },
        ]}
      />

      {/* 历史记录弹窗 */}
      <Modal title="批改历史记录" open={historyVisible} onCancel={() => setHistoryVisible(false)} footer={null} width={600}>
        <Empty description="暂无批改记录，完成批改后自动归档" />
      </Modal>

      {/* 品牌水印 */}
      <div className="brand-watermark">Edu-TA 教学数据 · 批改可追溯</div>

      {/* API Key 弹窗 */}
      <ApiKeyGuardModal visible={guard.modalVisible} onClose={guard.hideGuard} onGoSettings={guard.goToSettings} />
      <SettingsModal open={guard.settingsVisible} onClose={() => guard.setSettingsVisible(false)} />
    </div>
  );
};

export default HomeworkGrading;
