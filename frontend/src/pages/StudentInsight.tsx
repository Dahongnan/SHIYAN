/**
 * 班级学情分析 — Edu-TA 智教星 品牌化双标签页
 *
 * Tab1 班级学情概览：班级筛选/KPI指标/学生列表/薄弱知识点/预警
 * Tab2 AI个体分析：学生画像/AI诊断报告/可视化图表
 * 全部AI功能受API Key守卫保护
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Card, Form, Input, Button, Spin, Alert, Typography, Tag, Space, Row, Col,
  Progress, List, Statistic, Divider, message, Empty, Tabs, Select, Table, Modal,
  Tooltip, Popconfirm, Checkbox, Radio,
} from 'antd';
import {
  RobotOutlined, WarningOutlined, BulbOutlined, ArrowUpOutlined,
  ArrowDownOutlined, MinusOutlined, ThunderboltOutlined, UserOutlined,
  TeamOutlined, TrophyOutlined, RiseOutlined, DownloadOutlined,
  KeyOutlined, BarChartOutlined, FileTextOutlined, CheckCircleOutlined,
  HistoryOutlined, ExportOutlined, StarOutlined, BookOutlined,
  HeatMapOutlined, PieChartOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import { insightApi } from '../api/client';
import { BRAND, CARD_SPECS } from '../utils/brand';
import { useApiKeyGuard, ApiKeyGuardModal, ApiKeyBanner, DisabledAIButton } from '../utils/apiKeyGuard';
import SettingsModal from '../components/SettingsModal';
import '../styles/brand.css';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

// ── 品牌角标 ────────────────────────────────────────
const BrandBadge: React.FC<{ size?: number; color?: string }> = ({ size = 14, color }) => (
  <span
    dangerouslySetInnerHTML={{
      __html: BRAND.badgeSvg.replace('currentColor', color || BRAND.colors.primary),
    }}
    style={{ width: size, height: size, display: 'inline-flex', verticalAlign: 'middle', flexShrink: 0 }}
  />
);

// ── Mock 班级数据（保留原数据） ──────────────────────
interface StudentRecord {
  studentId: string; name: string; className: string;
  scores: { exam: string; score: number; total: number; date: string }[];
  knowledgeMastery: { name: string; mastery: number; trend: string; practiceCount: number; avgScore: number }[];
  strongPoints: string[]; weakPoints: string[]; warnings: string[]; recommendations: string[];
}

const classStudents: Record<string, StudentRecord[]> = {
  '机器学习-1班': [
    { studentId: '2024001', name: '张三', className: '1班', scores: [
      { exam: '期中', score: 85, total: 100, date: '2026-03-15' }, { exam: '作业1', score: 90, total: 100, date: '2026-04-10' },
      { exam: '月考', score: 88, total: 100, date: '2026-05-05' }, { exam: '期末', score: 92, total: 100, date: '2026-06-20' },
    ], knowledgeMastery: [
      { name: '线性回归', mastery: 92, trend: '上升', practiceCount: 24, avgScore: 90 },
      { name: '决策树', mastery: 85, trend: '上升', practiceCount: 18, avgScore: 83 },
      { name: 'SVM', mastery: 91, trend: '稳定', practiceCount: 20, avgScore: 89 },
    ], strongPoints: ['线性回归', 'SVM'], weakPoints: ['决策树剪枝'], warnings: [], recommendations: ['加强决策树剪枝练习'] },
    { studentId: '2024002', name: '李四', className: '1班', scores: [
      { exam: '期中', score: 72, total: 100, date: '2026-03-15' }, { exam: '作业1', score: 80, total: 100, date: '2026-04-10' },
      { exam: '月考', score: 75, total: 100, date: '2026-05-05' }, { exam: '期末', score: 78, total: 100, date: '2026-06-20' },
    ], knowledgeMastery: [
      { name: '线性回归', mastery: 78, trend: '稳定', practiceCount: 20, avgScore: 76 },
      { name: '决策树', mastery: 65, trend: '下降', practiceCount: 15, avgScore: 68 },
      { name: 'SVM', mastery: 82, trend: '上升', practiceCount: 18, avgScore: 80 },
    ], strongPoints: ['SVM'], weakPoints: ['决策树', '特征工程'], warnings: ['决策树持续下降'], recommendations: ['重点复习决策树', '增加练习量'] },
    { studentId: '2024003', name: '王五', className: '1班', scores: [
      { exam: '期中', score: 91, total: 100, date: '2026-03-15' }, { exam: '月考', score: 87, total: 100, date: '2026-05-05' },
      { exam: '期末', score: 88, total: 100, date: '2026-06-20' },
    ], knowledgeMastery: [
      { name: '线性回归', mastery: 90, trend: '稳定', practiceCount: 22, avgScore: 88 },
      { name: '决策树', mastery: 86, trend: '上升', practiceCount: 16, avgScore: 84 },
      { name: 'SVM', mastery: 88, trend: '上升', practiceCount: 19, avgScore: 86 },
    ], strongPoints: ['线性回归'], weakPoints: [], warnings: [], recommendations: ['保持当前学习节奏'] },
    { studentId: '2024004', name: '赵六', className: '1班', scores: [
      { exam: '期中', score: 60, total: 100, date: '2026-03-15' }, { exam: '作业1', score: 68, total: 100, date: '2026-04-10' },
      { exam: '期末', score: 65, total: 100, date: '2026-06-20' },
    ], knowledgeMastery: [
      { name: '线性回归', mastery: 62, trend: '下降', practiceCount: 12, avgScore: 60 },
      { name: '决策树', mastery: 52, trend: '下降', practiceCount: 10, avgScore: 50 },
      { name: 'SVM', mastery: 70, trend: '上升', practiceCount: 14, avgScore: 68 },
    ], strongPoints: [], weakPoints: ['线性回归', '决策树'], warnings: ['成绩持续下降，需重点关注', '决策树严重薄弱'], recommendations: ['安排辅导', '从基础概念重新学习', '每日额外练习'] },
  ],
  '深度学习-1班': [
    { studentId: '2024001', name: '张三', className: '1班', scores: [
      { exam: '期中', score: 82, total: 100, date: '2026-03-20' }, { exam: '期末', score: 85, total: 100, date: '2026-06-25' },
    ], knowledgeMastery: [
      { name: 'CNN', mastery: 86, trend: '上升', practiceCount: 18, avgScore: 84 }, { name: 'RNN', mastery: 82, trend: '稳定', practiceCount: 15, avgScore: 80 },
    ], strongPoints: ['CNN'], weakPoints: [], warnings: [], recommendations: ['保持'] },
    { studentId: '2024002', name: '李四', className: '1班', scores: [
      { exam: '期中', score: 70, total: 100, date: '2026-03-20' }, { exam: '期末', score: 72, total: 100, date: '2026-06-25' },
    ], knowledgeMastery: [
      { name: 'CNN', mastery: 74, trend: '稳定', practiceCount: 14, avgScore: 72 }, { name: 'RNN', mastery: 66, trend: '下降', practiceCount: 12, avgScore: 64 },
    ], strongPoints: [], weakPoints: ['RNN'], warnings: ['RNN持续下降'], recommendations: ['加强RNN练习'] },
  ],
  '自然语言处理-1班': [
    { studentId: '2024001', name: '张三', className: '1班', scores: [
      { exam: '期中', score: 94, total: 100, date: '2026-04-01' }, { exam: '期末', score: 96, total: 100, date: '2026-06-30' },
    ], knowledgeMastery: [
      { name: 'Word2Vec', mastery: 95, trend: '上升', practiceCount: 22, avgScore: 94 }, { name: 'Transformer', mastery: 92, trend: '上升', practiceCount: 20, avgScore: 90 },
    ], strongPoints: ['Word2Vec', 'Transformer'], weakPoints: [], warnings: [], recommendations: ['保持优秀'] },
    { studentId: '2024002', name: '李四', className: '1班', scores: [
      { exam: '期中', score: 78, total: 100, date: '2026-04-01' }, { exam: '期末', score: 80, total: 100, date: '2026-06-30' },
    ], knowledgeMastery: [
      { name: 'Word2Vec', mastery: 82, trend: '上升', practiceCount: 16, avgScore: 80 }, { name: 'Transformer', mastery: 74, trend: '稳定', practiceCount: 14, avgScore: 72 },
    ], strongPoints: ['Word2Vec'], weakPoints: ['Transformer'], warnings: [], recommendations: ['加强Transformer练习'] },
  ],
};

const courseClassOptions = [
  { value: '机器学习-1班', label: '机器学习 · 1班' },
  { value: '深度学习-1班', label: '深度学习 · 1班' },
  { value: '自然语言处理-1班', label: '自然语言处理 · 1班' },
  { value: '计算机视觉-1班', label: '计算机视觉 · 1班' },
];

// ── 薄弱程度色阶 ──
const masteryColor = (m: number) => {
  if (m < 30) return { bg: '#FFE8E8', text: '#FF4D4F', label: '重度薄弱' };
  if (m < 60) return { bg: '#FFF3E0', text: '#FF9F43', label: '中度薄弱' };
  if (m < 80) return { bg: '#FFFBE6', text: '#FADB14', label: '轻微薄弱' };
  return { bg: '#F6FFED', text: '#52C41A', label: '良好' };
};

// ═══════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════
const StudentInsight: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const [selectedClass, setSelectedClass] = useState('机器学习-1班');
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [activeTab, setActiveTab] = useState('class');
  const [timeRange, setTimeRange] = useState('all');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [kpView, setKpView] = useState<'bar' | 'heatmap'>('bar');

  // API Key 守卫
  const guard = useApiKeyGuard();
  const canGenerate = guard.hasKey;

  const currentStudents = classStudents[selectedClass] || [];

  // ── 班级统计 ──
  const classStats = useMemo(() => {
    const s = currentStudents;
    if (s.length === 0) return null;
    const latestScores = s.map(st => {
      const latest = st.scores[st.scores.length - 1];
      return latest ? latest.score / latest.total * 100 : 0;
    });
    const avgScore = latestScores.reduce((a, b) => a + b, 0) / latestScores.length;
    const passCount = latestScores.filter(pct => pct >= 60).length;
    const excellentCount = latestScores.filter(pct => pct >= 85).length;
    const warnCount = s.filter(st => st.warnings.length > 0).length;
    return { total: s.length, avgScore, passRate: passCount / s.length * 100, excellentRate: excellentCount / s.length * 100, warnCount };
  }, [currentStudents]);

  const prevStats = useMemo(() => classStats ? {
    avgScore: classStats.avgScore - 0.5, passRate: classStats.passRate - 0.3, excellentRate: classStats.excellentRate - 0.4, warnCount: classStats.warnCount + 1
  } : null, [classStats]);

  // ── 薄弱知识点 ──
  const classWeakPoints = useMemo(() => {
    const count: Record<string, number> = {};
    for (const s of currentStudents) {
      for (const wp of s.weakPoints) count[wp] = (count[wp] || 0) + 1;
    }
    return Object.entries(count).sort((a, b) => b[1] - a[1]);
  }, [currentStudents]);

  // ── 预警汇总 ──
  const allWarnings = useMemo(() => {
    const list: { name: string; warnings: string[]; type: string }[] = [];
    for (const s of currentStudents) {
      const latest = s.scores[s.scores.length - 1];
      const pct = latest ? latest.score / latest.total * 100 : 0;
      if (pct >= 55 && pct < 65) list.push({ name: s.name, warnings: [`最新成绩 ${latest?.score} 分，处于及格边缘`], type: 'score' });
      if (s.warnings.some(w => w.includes('持续下降'))) list.push({ name: s.name, warnings: s.warnings.filter(w => w.includes('持续下降')), type: 'drop' });
      if (s.weakPoints.length >= 2) list.push({ name: s.name, warnings: [`${s.weakPoints.length} 个核心知识点薄弱`], type: 'weakness' });
    }
    return list;
  }, [currentStudents]);

  const warningStats = useMemo(() => ({
    score: allWarnings.filter(w => w.type === 'score').length,
    drop: allWarnings.filter(w => w.type === 'drop').length,
    weakness: allWarnings.filter(w => w.type === 'weakness').length,
  }), [allWarnings]);

  // ── AI 分析 ──
  const handleAnalyze = async (values: any) => {
    if (!canGenerate) { guard.showGuard(); return; }
    setLoading(true); setError(''); setResult(null);
    const records = (values.records || '').split('\n').filter((l: string) => l.trim())
      .map((line: string) => {
        const parts = line.split(/[,，\s]+/);
        return { date: parts[0] || '', exam_name: parts[1] || '考试', score: parseFloat(parts[2]) || 0, total_score: parseFloat(parts[3]) || 100, category: parts[4] || '考试' };
      });
    try {
      const res = await insightApi.analyzeStudent({ student_id: values.student_id, course_name: values.course_name, records });
      if (res.data.success) { setResult(res.data.data); message.success('AI 学情诊断完成！'); }
      else { setError(res.data.message || '分析失败'); }
    } catch (e: any) { setError(e.response?.data?.detail || '请求失败'); }
    finally { setLoading(false); }
  };

  // 从学生列表快速填充 AI 分析
  const fillStudentAnalysis = (s: StudentRecord) => {
    setActiveTab('ai');
    form.setFieldsValue({
      student_id: s.studentId,
      student_name: s.name,
      course_name: selectedClass.split('-')[0],
      records: s.scores.map(sc => `${sc.date},${sc.exam},${sc.score},${sc.total}`).join('\n'),
    });
  };

  const getTrendIcon = (trend: string) => {
    if (trend === '上升') return <ArrowUpOutlined style={{ color: BRAND.colors.green }} />;
    if (trend === '下降') return <ArrowDownOutlined style={{ color: BRAND.colors.error }} />;
    return <MinusOutlined style={{ color: BRAND.colors.orange }} />;
  };

  // ── 薄弱点击弹窗 ──
  const [kpModal, setKpModal] = useState<{ name: string; count: number } | null>(null);

  // ── 预警详情弹窗 ──
  const [warningModalOpen, setWarningModalOpen] = useState(false);

  return (
    <div className="page-enter" style={{ position: 'relative' }}>
      {/* API Key 横幅 */}
      {!canGenerate && <ApiKeyBanner onGoSettings={guard.goToSettings} />}

      {/* 页面头部 */}
      <div style={{ marginBottom: 16 }}>
        <Space align="center" size={10}>
          <span
            dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }}
            style={{ width: 32, height: 32, display: 'inline-flex', animation: 'logoPulse 0.8s ease-out' }}
          />
          <div>
            <Title level={4} style={{ margin: 0, fontSize: 17, fontWeight: 700, color: BRAND.colors.textPrimary }}>
              智教星 · 班级学情分析
            </Title>
            <Text type="secondary" style={{ fontSize: 11 }}>AI 驱动学情诊断 · 数据可追溯归档</Text>
          </div>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ background: '#fff', borderRadius: 12, padding: '4px 16px 16px', boxShadow: CARD_SPECS.shadow }}
        items={[
          // ═══════════════════════════════════════════════════
          // Tab 1: 班级学情概览
          // ═══════════════════════════════════════════════════
          {
            key: 'class',
            label: <span><TeamOutlined style={{ color: BRAND.colors.primary }} />班级学情概览</span>,
            children: (
              <div>
                {/* ── 筛选控制区 ── */}
                <Row gutter={12} align="middle" style={{ marginBottom: 16, padding: 12, background: `${BRAND.colors.primary}06`, borderRadius: 8, border: `1px solid ${BRAND.colors.border}` }}>
                  <Col>
                    <Space size={12}>
                      <Select value={selectedClass} onChange={v => { setSelectedClass(v); setSelectedStudents([]); }} style={{ width: 180 }} options={courseClassOptions} />
                      <Select value={timeRange} onChange={setTimeRange} style={{ width: 160 }}
                        options={[
                          { value: 'all', label: '全部历史成绩' },
                          { value: 'homework', label: '本次作业' },
                          { value: 'midterm', label: '期中考试' },
                          { value: 'final', label: '期末考试' },
                        ]}
                      />
                      <Button icon={<DownloadOutlined />} style={{ borderRadius: 8, border: 'none', background: BRAND.colors.primaryGradient, color: '#fff' }}>导出 Excel</Button>
                    </Space>
                  </Col>
                </Row>

                {/* ── KPI 指标卡 ── */}
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                  {[
                    { label: '学生总数', value: classStats?.total || 0, suffix: '人', icon: <TeamOutlined />, color: BRAND.colors.primary, tip: '当前班级总人数' },
                    { label: '平均分', value: classStats?.avgScore.toFixed(1) || '—', suffix: '分', icon: <TrophyOutlined />, color: BRAND.colors.green, tip: '优秀≥85 · 及格60 · 预警<70', prev: prevStats?.avgScore },
                    { label: '通过率', value: classStats?.passRate.toFixed(1) || '—', suffix: '%', icon: <RiseOutlined />, color: BRAND.colors.primary, tip: '成绩≥60分占比', prev: prevStats?.passRate },
                    { label: '优秀率', value: classStats?.excellentRate.toFixed(1) || '—', suffix: '%', icon: <StarOutlined />, color: BRAND.colors.purple, tip: '成绩≥85分占比', prev: prevStats?.excellentRate },
                    { label: '预警人数', value: classStats?.warnCount || 0, suffix: '人', icon: <WarningOutlined />, color: BRAND.colors.orange, tip: '存在薄弱知识点/成绩下滑学生', prev: prevStats?.warnCount, invertTrend: true },
                  ].map((item, idx) => {
                    const diff = item.prev != null && typeof item.value === 'number'
                      ? ((item.value - item.prev) / (item.prev || 1) * 100).toFixed(1)
                      : null;
                    const isUp = diff && parseFloat(diff) >= 0;
                    return (
                      <Col span={4} key={idx}>
                        <Tooltip title={item.tip}>
                          <Card className="brand-card" bodyStyle={{ padding: '14px 16px', position: 'relative' }}>
                            <span style={{ position: 'absolute', top: 6, right: 8, color: item.color, opacity: 0.35 }}><BrandBadge size={12} /></span>
                            <Statistic
                              title={<Text style={{ fontSize: 12, color: BRAND.colors.textSecondary }}>{item.label}</Text>}
                              value={item.value}
                              suffix={<Text style={{ fontSize: 12, color: BRAND.colors.textTertiary }}>{item.suffix}</Text>}
                              prefix={<span style={{ color: item.color, fontSize: 16, marginRight: 4 }}>{item.icon}</span>}
                              valueStyle={{ fontSize: 22, fontWeight: 700, color: BRAND.colors.textPrimary }}
                            />
                            {diff && (
                              <div style={{ marginTop: 2 }}>
                                <Text style={{ fontSize: 11, color: (item.invertTrend ? !isUp : isUp) ? BRAND.colors.green : BRAND.colors.orange }}>
                                  {(item.invertTrend ? !isUp : isUp) ? '↑' : '↓'} {Math.abs(parseFloat(diff))}%
                                </Text>
                                <Text type="secondary" style={{ fontSize: 10, marginLeft: 2 }}>较上期</Text>
                              </div>
                            )}
                          </Card>
                        </Tooltip>
                      </Col>
                    );
                  })}
                </Row>

                {/* ── 学生列表 + 薄弱/预警 ── */}
                <Row gutter={12}>
                  {/* 学生列表 */}
                  <Col span={12}>
                    <Card
                      className="brand-card"
                      title={
                        <Space>
                          <BrandBadge /><TeamOutlined style={{ color: BRAND.colors.primary }} />
                          <Text strong>{selectedClass.split('-')[0]} · 学生列表</Text>
                          <Tag style={{ borderRadius: 8, fontSize: 10 }}>{currentStudents.length} 人</Tag>
                        </Space>
                      }
                      bodyStyle={{ padding: '8px 16px', maxHeight: 480, overflow: 'auto' }}
                    >
                      <List
                        dataSource={currentStudents}
                        renderItem={s => {
                          const latestScore = s.scores[s.scores.length - 1];
                          const scorePct = latestScore ? Math.round(latestScore.score / latestScore.total * 100) : 0;
                          const isWarn = scorePct >= 55 && scorePct <= 65;
                          const isExcellent = scorePct >= 85;
                          const isFail = scorePct < 60;
                          return (
                            <List.Item
                              style={{
                                padding: '10px 8px', borderRadius: 8, marginBottom: 2, cursor: 'pointer',
                                background: selectedStudents.includes(s.studentId) ? `${BRAND.colors.primary}10` : 'transparent',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={e => { if (!selectedStudents.includes(s.studentId)) e.currentTarget.style.background = `${BRAND.colors.primary}06`; }}
                              onMouseLeave={e => { if (!selectedStudents.includes(s.studentId)) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <Checkbox
                                checked={selectedStudents.includes(s.studentId)}
                                onChange={e => {
                                  if (e.target.checked) setSelectedStudents([...selectedStudents, s.studentId]);
                                  else setSelectedStudents(selectedStudents.filter(id => id !== s.studentId));
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                              <div style={{ flex: 1, marginLeft: 8 }} onClick={() => setSelectedStudent(s)}>
                                <Space>
                                  <Text strong style={{ fontSize: 13 }}>{s.name}</Text>
                                  <Tag color={isFail ? 'red' : isWarn ? 'orange' : isExcellent ? 'green' : 'default'}
                                    style={{ borderRadius: 8, fontSize: 10, lineHeight: '18px' }}>
                                    {isFail ? '不及格' : isWarn ? '临界' : isExcellent ? '优秀' : '正常'}
                                  </Tag>
                                  {s.weakPoints.length >= 2 && (
                                    <Tag style={{ borderRadius: 8, fontSize: 9, background: `${BRAND.colors.orange}15`, color: BRAND.colors.orange, border: 'none' }}>
                                      🧩 薄弱{s.weakPoints.length}
                                    </Tag>
                                  )}
                                </Space>
                                <div>
                                  <Text type="secondary" style={{ fontSize: 11 }}>{s.studentId}</Text>
                                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>最新 {latestScore?.exam}: {latestScore?.score}/{latestScore?.total} ({scorePct}分)</Text>
                                  {s.weakPoints.length > 0 && (
                                    <Text type="secondary" style={{ fontSize: 10, marginLeft: 8, color: BRAND.colors.orange }}>
                                      薄弱: {s.weakPoints.slice(0, 2).join(', ')}
                                    </Text>
                                  )}
                                </div>
                              </div>
                              <Space size={4} onClick={e => e.stopPropagation()}>
                                <Tooltip title="AI 个体分析">
                                  <Button type="link" size="small" icon={<RobotOutlined />} style={{ color: BRAND.colors.primary }}
                                    onClick={() => fillStudentAnalysis(s)} />
                                </Tooltip>
                                <Tooltip title={canGenerate ? '生成补差习题' : '请先配置API密钥'}>
                                  <Button type="link" size="small" icon={<ExperimentOutlined />}
                                    disabled={!canGenerate} style={{ color: BRAND.colors.green }} />
                                </Tooltip>
                                <Tooltip title="归档至台账">
                                  <Button type="link" size="small" icon={<HistoryOutlined />}
                                    style={{ color: BRAND.colors.purple }} />
                                </Tooltip>
                              </Space>
                            </List.Item>
                          );
                        }}
                      />
                      {selectedStudents.length > 0 && (
                        <div style={{ padding: '8px 4px 0', borderTop: `1px solid ${BRAND.colors.border}`, marginTop: 4 }}>
                          <Space>
                            <Text type="secondary" style={{ fontSize: 12 }}>已选 {selectedStudents.length} 人</Text>
                            <Button size="small" icon={<ExperimentOutlined />} disabled={!canGenerate}
                              style={{ borderRadius: 6, fontSize: 11, height: 24, borderColor: BRAND.colors.green, color: BRAND.colors.green }}>
                              批量补差
                            </Button>
                            <Button size="small" icon={<HistoryOutlined />}
                              style={{ borderRadius: 6, fontSize: 11, height: 24, borderColor: BRAND.colors.purple, color: BRAND.colors.purple }}>
                              批量归档
                            </Button>
                          </Space>
                        </div>
                      )}
                    </Card>
                  </Col>

                  {/* 薄弱知识点 + 预警 */}
                  <Col span={12}>
                    {/* 薄弱知识点 */}
                    <Card
                      className="brand-card"
                      title={<Space><BrandBadge /><BarChartOutlined style={{ color: BRAND.colors.error }} /><Text strong>班级薄弱知识点</Text></Space>}
                      bodyStyle={{ padding: '8px 16px', marginBottom: 12 }}
                      extra={
                        <Radio.Group value={kpView} onChange={e => setKpView(e.target.value)} size="small">
                          <Radio.Button value="bar" style={{ fontSize: 11 }}>条形图</Radio.Button>
                          <Radio.Button value="heatmap" style={{ fontSize: 11 }}>热力图</Radio.Button>
                        </Radio.Group>
                      }
                    >
                      {classWeakPoints.length > 0 ? (
                        kpView === 'bar' ? (
                          <List size="small" dataSource={classWeakPoints}
                            renderItem={([name, count]) => {
                              const pct = Math.round(count / currentStudents.length * 100);
                              const color = masteryColor(pct);
                              return (
                                <List.Item style={{ cursor: 'pointer', padding: '6px 4px' }} onClick={() => setKpModal({ name, count })}>
                                  <Space style={{ width: '100%' }}>
                                    <Tag style={{ borderRadius: 6, minWidth: 80, textAlign: 'center' }} color={pct < 30 ? 'red' : pct < 60 ? 'orange' : 'gold'}>{name}</Tag>
                                    <Progress percent={pct} size="small" style={{ flex: 1, margin: 0 }}
                                      strokeColor={pct < 30 ? '#FF4D4F' : pct < 60 ? '#FF9F43' : '#FADB14'}
                                      format={() => `${count}/${currentStudents.length}`}
                                    />
                                    <Tag style={{ fontSize: 10, borderRadius: 6, background: color.bg, color: color.text, border: 'none' }}>{color.label}</Tag>
                                  </Space>
                                </List.Item>
                              );
                            }}
                          />
                        ) : (
                          <Row gutter={[4, 4]}>
                            {classWeakPoints.map(([name, count]) => {
                              const pct = Math.round(count / currentStudents.length * 100);
                              const color = masteryColor(pct);
                              return (
                                <Col span={8} key={name}>
                                  <div style={{ background: color.bg, borderRadius: 8, padding: '8px', textAlign: 'center', cursor: 'pointer' }}
                                    onClick={() => setKpModal({ name, count })}>
                                    <Text style={{ fontSize: 11, color: color.text, fontWeight: 600 }}>{name}</Text>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: color.text, margin: '2px 0' }}>{count}/{currentStudents.length}</div>
                                    <Text style={{ fontSize: 10, color: color.text }}>{color.label}</Text>
                                  </div>
                                </Col>
                              );
                            })}
                          </Row>
                        )
                      ) : <Text type="secondary">无薄弱知识点</Text>}
                    </Card>

                    {/* 预警信息 */}
                    <Card
                      className="brand-card"
                      title={<Space><BrandBadge color={BRAND.colors.orange} /><WarningOutlined style={{ color: BRAND.colors.orange }} /><Text strong>预警信息</Text></Space>}
                      bodyStyle={{ padding: '8px 16px' }}
                      extra={
                        <Space size={8}>
                          <Tag style={{ borderRadius: 8, fontSize: 10 }}>成绩临界 {warningStats.score}</Tag>
                          <Tag style={{ borderRadius: 8, fontSize: 10 }}>持续下滑 {warningStats.drop}</Tag>
                          <Tag style={{ borderRadius: 8, fontSize: 10 }}>知识薄弱 {warningStats.weakness}</Tag>
                          <Button type="link" size="small" onClick={() => setWarningModalOpen(true)} style={{ fontSize: 11 }}>查看全部</Button>
                        </Space>
                      }
                    >
                      {allWarnings.length > 0 ? (
                        <List size="small" dataSource={allWarnings.slice(0, 4)}
                          renderItem={item => (
                            <List.Item style={{ padding: '6px 4px' }}
                              actions={[
                                <Button type="link" size="small" icon={<RobotOutlined />}
                                  disabled={!canGenerate}
                                  style={{ fontSize: 11, color: BRAND.colors.purple }}
                                  onClick={() => { guard.showGuard(); }}>帮扶方案</Button>,
                              ]}
                            >
                              <Space>
                                <Tag color={item.type === 'score' ? 'orange' : item.type === 'drop' ? 'red' : 'warning'}
                                  style={{ borderRadius: 6, fontSize: 11 }}>
                                  {item.name}
                                </Tag>
                                <Text style={{ fontSize: 12 }}>{item.warnings[0]}</Text>
                              </Space>
                            </List.Item>
                          )}
                        />
                      ) : <Text type="secondary">暂无预警</Text>}
                    </Card>
                  </Col>
                </Row>

                {/* 薄弱知识弹窗 */}
                <Modal
                  title={<Space><BrandBadge />{kpModal?.name}</Space>}
                  open={!!kpModal} onCancel={() => setKpModal(null)} footer={null} width={500}
                >
                  {kpModal && (
                    <div>
                      <Paragraph>该知识点薄弱学生：共 {kpModal.count} 人</Paragraph>
                      <List size="small" dataSource={currentStudents.filter(s => s.weakPoints.includes(kpModal.name))}
                        renderItem={s => <List.Item><Tag color="error">{s.name}</Tag>掌握度 {s.knowledgeMastery.find(k => k.name === kpModal.name)?.mastery || '?'}%</List.Item>}
                      />
                      <Divider />
                      <Space>
                        <Button type="primary" icon={<RobotOutlined />} disabled={!canGenerate}
                          style={{ borderRadius: 8, border: 'none', background: BRAND.colors.primaryGradient }}
                          onClick={() => { if (!canGenerate) guard.showGuard(); else message.info('生成补差方案...'); }}>
                          AI 生成补差教学方案
                        </Button>
                        <Button icon={<BookOutlined />} style={{ borderRadius: 8, borderColor: BRAND.colors.border }}>
                          查看知识库原文
                        </Button>
                      </Space>
                    </div>
                  )}
                </Modal>

                {/* 预警详情弹窗 */}
                <Modal title="全部预警信息" open={warningModalOpen} onCancel={() => setWarningModalOpen(false)} footer={null} width={600}>
                  <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                    <Col span={8}><Card size="small"><Statistic title="成绩临界预警" value={warningStats.score} suffix="人" valueStyle={{ color: BRAND.colors.orange }} /></Card></Col>
                    <Col span={8}><Card size="small"><Statistic title="持续下滑预警" value={warningStats.drop} suffix="人" valueStyle={{ color: BRAND.colors.error }} /></Card></Col>
                    <Col span={8}><Card size="small"><Statistic title="知识点薄弱预警" value={warningStats.weakness} suffix="人" valueStyle={{ color: BRAND.colors.orange }} /></Card></Col>
                  </Row>
                  <List dataSource={allWarnings} renderItem={item => (
                    <List.Item actions={[
                      <Button type="link" size="small" icon={<RobotOutlined />} disabled={!canGenerate} onClick={() => guard.showGuard()}>帮扶方案</Button>,
                    ]}>
                      <List.Item.Meta
                        avatar={<Tag color={item.type === 'score' ? 'orange' : item.type === 'drop' ? 'red' : 'warning'} style={{ borderRadius: 6 }}>{item.name}</Tag>}
                        title={item.warnings[0]}
                        description={item.warnings.slice(1).join('；')}
                      />
                    </List.Item>
                  )} />
                </Modal>

                {/* 学生详情弹窗 */}
                <Modal
                  title={<Space><BrandBadge /><UserOutlined />{selectedStudent?.name} — 学情详情</Space>}
                  open={!!selectedStudent} onCancel={() => setSelectedStudent(null)} footer={null} width={700}
                >
                  {selectedStudent && (
                    <div>
                      <Row gutter={12} style={{ marginBottom: 12 }}>
                        <Col span={6}><Statistic title="学号" value={selectedStudent.studentId} /></Col>
                        <Col span={6}><Statistic title="班级" value={selectedStudent.className} /></Col>
                        <Col span={6}>
                          <Statistic title="均分" value={(selectedStudent.scores.reduce((a, s) => a + s.score / s.total * 100, 0) / selectedStudent.scores.length).toFixed(1)} suffix="分" />
                        </Col>
                        <Col span={6}><Statistic title="练习次数" value={selectedStudent.scores.length} suffix="次" /></Col>
                      </Row>
                      <Divider style={{ margin: '4px 0' }} />
                      <Text strong style={{ fontSize: 13 }}>成绩记录</Text>
                      <Row gutter={[4, 4]} style={{ marginTop: 4, marginBottom: 12 }}>
                        {selectedStudent.scores.map((sc, i) => (
                          <Col span={12} key={i}>
                            <Space><Tag style={{ borderRadius: 6 }}>{sc.date}</Tag><Tag style={{ borderRadius: 6 }}>{sc.exam}</Tag>
                              <Progress percent={Math.round(sc.score / sc.total * 100)} size="small" style={{ width: 120 }}
                                format={() => `${sc.score}/${sc.total}`} />
                            </Space>
                          </Col>
                        ))}
                      </Row>
                      <Text strong style={{ fontSize: 13 }}>知识掌握度</Text>
                      <Row gutter={[6, 6]} style={{ marginTop: 4, marginBottom: 12 }}>
                        {selectedStudent.knowledgeMastery.map((km, i) => (
                          <Col span={8} key={i}>
                            <Card size="small" bodyStyle={{ padding: '8px 12px' }} className="brand-card">
                              <Space>{getTrendIcon(km.trend)}<Text strong style={{ fontSize: 12 }}>{km.name}</Text></Space>
                              <Progress percent={Math.round(km.mastery)} size="small" status={km.mastery < 60 ? 'exception' : 'active'} />
                            </Card>
                          </Col>
                        ))}
                      </Row>
                      {selectedStudent.warnings.length > 0 && <Alert type="warning" message={selectedStudent.warnings.join('；')} style={{ marginBottom: 12, borderRadius: 8 }} />}
                      <Space style={{ marginTop: 8 }}>
                        <Button type="primary" icon={<RobotOutlined />} disabled={!canGenerate}
                          style={{ borderRadius: 8, border: 'none', background: BRAND.colors.primaryGradient }}
                          onClick={() => { fillStudentAnalysis(selectedStudent); }}>
                          查看 AI 诊断报告
                        </Button>
                        <Button icon={<HistoryOutlined />} style={{ borderRadius: 8, borderColor: BRAND.colors.border }}>
                          归档至教学台账
                        </Button>
                      </Space>
                    </div>
                  )}
                </Modal>
              </div>
            ),
          },

          // ═══════════════════════════════════════════════════
          // Tab 2: AI 个体分析
          // ═══════════════════════════════════════════════════
          {
            key: 'ai',
            label: <span><RobotOutlined style={{ color: BRAND.colors.purple }} />AI 个体分析</span>,
            children: (
              <Row gutter={20}>
                <Col xs={24} lg={7}>
                  {/* 表单区 */}
                  <Card
                    className="brand-card"
                    title={<Space><BrandBadge /><UserOutlined style={{ color: BRAND.colors.primary }} /><Text strong>学情分析</Text></Space>}
                    bodyStyle={{ padding: '16px 20px' }}
                  >
                    <Paragraph style={{ color: BRAND.colors.textSecondary, fontSize: 12, marginBottom: 12 }}>
                      输入学生信息和成绩数据，AI 生成完整学情诊断报告。
                    </Paragraph>

                    {!canGenerate && (
                      <Alert
                        type="warning"
                        message="配置 API Key 后解锁 AI 诊断"
                        description="AI 学情诊断需要有效的大模型 API Key"
                        showIcon
                        style={{ borderRadius: 8, marginBottom: 12 }}
                        action={<Button size="small" icon={<KeyOutlined />} onClick={guard.goToSettings} style={{ borderRadius: 6 }}>去配置</Button>}
                      />
                    )}

                    <Form form={form} layout="vertical" onFinish={handleAnalyze} size="small">
                      <Form.Item name="student_id" label="学号" rules={[{ required: true }]}><Input placeholder="2024001" style={{ borderRadius: 6 }} /></Form.Item>
                      <Form.Item name="student_name" label="姓名"><Input placeholder="张三" style={{ borderRadius: 6 }} /></Form.Item>
                      <Form.Item name="course_name" label="课程" rules={[{ required: true }]}><Input placeholder="机器学习" style={{ borderRadius: 6 }} /></Form.Item>
                      <Form.Item name="records" label="成绩记录" help={<span style={{ fontSize: 11 }}>每行：日期,考试,得分,满分</span>}>
                        <TextArea rows={4} placeholder="2026-03-15,期中,85,100" style={{ borderRadius: 6, resize: 'none' }} />
                      </Form.Item>
                      <Form.Item>
                        {canGenerate ? (
                          <Button type="primary" htmlType="submit" loading={loading}
                            icon={<ThunderboltOutlined />} block
                            style={{ borderRadius: 8, border: 'none', background: BRAND.colors.primaryGradient, height: 40 }}>
                            {loading ? 'AI 诊断中...' : '开始 AI 诊断'}
                          </Button>
                        ) : (
                          <DisabledAIButton label="AI 诊断已锁定" icon={<KeyOutlined />} />
                        )}
                      </Form.Item>
                    </Form>
                    {error && <Alert message={error} type="error" showIcon style={{ borderRadius: 8 }} />}
                  </Card>
                </Col>

                <Col xs={24} lg={17}>
                  {/* 加载态 */}
                  {loading && (
                    <Card className="brand-card" bodyStyle={{ padding: 40, textAlign: 'center' }}>
                      <div style={{ animation: 'logoGlow 1.5s ease-in-out infinite' }}>
                        <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 48, height: 48, display: 'inline-block' }} />
                      </div>
                      <Spin style={{ marginTop: 12 }} />
                      <Paragraph style={{ marginTop: 8, color: BRAND.colors.textSecondary, fontSize: 12 }}>
                        AI 正在分析学情数据，生成诊断报告...
                      </Paragraph>
                    </Card>
                  )}

                  {/* 结果 */}
                  {result && !loading && (
                    <div>
                      {/* 概览卡片 */}
                      <Card className="brand-card" style={{ marginBottom: 12 }}
                        bodyStyle={{ padding: '16px 20px', position: 'relative' }}>
                        <span style={{ position: 'absolute', top: 8, right: 10, color: BRAND.colors.primary, opacity: 0.3 }}><BrandBadge size={16} /></span>
                        <Space style={{ marginBottom: 8 }}>
                          <RobotOutlined style={{ color: BRAND.colors.primary, fontSize: 18 }} />
                          <Text strong style={{ fontSize: 14 }}>AI 学情诊断报告</Text>
                          <Tag style={{ borderRadius: 6, background: `${BRAND.colors.green}15`, color: BRAND.colors.green, border: 'none', fontSize: 10 }}>
                            AI 生成 · 来源可追溯
                          </Tag>
                        </Space>
                        <Row gutter={12}>
                          <Col span={6}>
                            <Statistic title="综合评分" value={result.overall_score} suffix="分"
                              valueStyle={{ color: result.overall_score >= 80 ? BRAND.colors.green : result.overall_score >= 60 ? BRAND.colors.orange : BRAND.colors.error, fontWeight: 700 }} />
                          </Col>
                          <Col span={4}><Statistic title="完成率" value={result.completion_rate} suffix="%" /></Col>
                          <Col span={4}><Statistic title="排名" value={result.ranking || '-'} /></Col>
                          <Col span={4}>
                            <Statistic title="需关注" value={result.attention_needed ? '是' : '否'}
                              valueStyle={{ color: result.attention_needed ? BRAND.colors.error : BRAND.colors.green, fontWeight: 600 }} />
                          </Col>
                          <Col span={6}>
                            <Space>
                              <Button icon={<RobotOutlined />} size="small" disabled={!canGenerate}
                                style={{ borderRadius: 6, borderColor: BRAND.colors.primary, color: BRAND.colors.primary }}>
                                重新生成
                              </Button>
                              <Button icon={<DownloadOutlined />} size="small"
                                style={{ borderRadius: 6, borderColor: BRAND.colors.green, color: BRAND.colors.green }}>
                                导出 Word
                              </Button>
                              <Button icon={<HistoryOutlined />} size="small"
                                style={{ borderRadius: 6, borderColor: BRAND.colors.purple, color: BRAND.colors.purple }}>
                                归档台账
                              </Button>
                            </Space>
                          </Col>
                        </Row>
                      </Card>

                      {/* 知识掌握度 */}
                      {result.knowledge_mastery?.length > 0 && (
                        <Card className="brand-card" style={{ marginBottom: 12 }}
                          title={<Space><BrandBadge /><BarChartOutlined style={{ color: BRAND.colors.primary }} /><Text strong>知识掌握度</Text></Space>}
                          bodyStyle={{ padding: '12px 16px' }}>
                          <Row gutter={[8, 8]}>
                            {result.knowledge_mastery.map((km: any, i: number) => (
                              <Col span={8} key={i}>
                                <Card size="small" className="brand-card" bodyStyle={{ padding: '10px 14px' }}>
                                  <Space>{getTrendIcon(km.trend)}<Text strong style={{ fontSize: 12 }}>{km.name}</Text>
                                    <Tag style={{ fontSize: 10, borderRadius: 6, border: 'none' }} color={km.category === '重点' ? 'red' : km.category === '基础' ? 'blue' : 'default'}>
                                      {km.category || '基础'}
                                    </Tag>
                                  </Space>
                                  <Progress percent={Math.round(km.mastery)} size="small"
                                    status={km.mastery < 60 ? 'exception' : km.mastery < 80 ? 'active' : 'success'} />
                                </Card>
                              </Col>
                            ))}
                          </Row>
                        </Card>
                      )}

                      {/* 优势与薄弱 */}
                      <Row gutter={12} style={{ marginBottom: 12 }}>
                        <Col span={12}>
                          <Card className="brand-card" size="small"
                            title={<Space><CheckCircleOutlined style={{ color: BRAND.colors.green }} /><Text strong>优势知识点</Text></Space>}
                            bodyStyle={{ padding: '10px 16px' }}>
                            {result.strong_points?.length > 0
                              ? result.strong_points.map((p: string, i: number) => (
                                <Tag key={i} style={{ borderRadius: 6, background: `${BRAND.colors.green}10`, color: BRAND.colors.green, border: `1px solid ${BRAND.colors.green}20`, marginBottom: 4 }}>{p}</Tag>
                              ))
                              : <Text type="secondary">暂无数据</Text>}
                          </Card>
                        </Col>
                        <Col span={12}>
                          <Card className="brand-card" size="small"
                            title={<Space><WarningOutlined style={{ color: BRAND.colors.error }} /><Text strong>薄弱知识点</Text></Space>}
                            bodyStyle={{ padding: '10px 16px' }}>
                            {result.weak_points?.length > 0
                              ? result.weak_points.map((p: string, i: number) => (
                                <Tag key={i} color="error" style={{ borderRadius: 6, marginBottom: 4 }}>{p}</Tag>
                              ))
                              : <Text type="secondary">暂无数据</Text>}
                          </Card>
                        </Col>
                      </Row>

                      {/* 建议 */}
                      {result.recommendations?.length > 0 && (
                        <Card className="brand-card" style={{ marginBottom: 12 }}
                          title={<Space><BulbOutlined style={{ color: BRAND.colors.orange }} /><Text strong>个性化提升建议</Text></Space>}
                          bodyStyle={{ padding: '10px 16px' }}>
                          <List size="small" dataSource={result.recommendations}
                            renderItem={(r: string, i: number) => (
                              <List.Item style={{ padding: '4px 0' }}>
                                <Tag style={{ borderRadius: '50%', width: 20, height: 20, textAlign: 'center', padding: 0, lineHeight: '20px', background: BRAND.colors.primaryGradient, color: '#fff', border: 'none' }}>
                                  {i + 1}
                                </Tag>
                                <Text style={{ marginLeft: 8, fontSize: 13 }}>{r}</Text>
                              </List.Item>
                            )}
                          />
                          <Divider style={{ margin: '8px 0' }} />
                          <Text type="secondary" style={{ fontSize: 10 }}>【本内容由学科垂类AI助教生成】</Text>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* 空状态 */}
                  {!result && !loading && (
                    <Card className="brand-card" bodyStyle={{ padding: 60, textAlign: 'center' }}>
                      <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 60, height: 60, display: 'inline-block', opacity: 0.3 }} />
                      <Paragraph style={{ marginTop: 12, color: BRAND.colors.textTertiary, fontSize: 13 }}>
                        选择学生或输入成绩数据，开始 AI 学情诊断
                      </Paragraph>
                    </Card>
                  )}
                </Col>
              </Row>
            ),
          },
        ]}
      />

      {/* 品牌水印 */}
      <div className="brand-watermark">Edu-TA 教学台账 · 学情可追溯</div>

      {/* API Key 弹窗 */}
      <ApiKeyGuardModal visible={guard.modalVisible} onClose={guard.hideGuard} onGoSettings={guard.goToSettings} />
      <SettingsModal open={guard.settingsVisible} onClose={() => guard.setSettingsVisible(false)} />
    </div>
  );
};

export default StudentInsight;
