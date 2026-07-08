/**
 * 成绩管理 — Edu-TA 智教星 全维度成绩汇总与趋势分析
 *
 * 功能：筛选/统计/列表/搜索/批量操作/AI诊断/可视化/成绩趋势
 * 联动：同步作业批改得分、联动学情分析、归档至台账
 * AI功能受API Key守卫保护
 */

import React, { useState, useMemo } from 'react';
import {
  Card, Typography, Space, Table, Tag, Row, Col, Statistic, Select, Modal, Divider,
  Input, Button, Tooltip, Progress, Tabs, message, Popconfirm, Alert, Empty,
} from 'antd';
import {
  TrophyOutlined, RiseOutlined, ArrowUpOutlined, ArrowDownOutlined,
  UserOutlined, TeamOutlined, SearchOutlined, DownloadOutlined,
  UploadOutlined, ThunderboltOutlined, HistoryOutlined, KeyOutlined,
  BarChartOutlined, WarningOutlined, EyeOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { BRAND, CARD_SPECS } from '../utils/brand';
import { useApiKeyGuard, ApiKeyGuardModal, ApiKeyBanner, DisabledAIButton } from '../utils/apiKeyGuard';
import SettingsModal from '../components/SettingsModal';
import './../styles/brand.css';

const { Text } = Typography;

const BrandBadge: React.FC<{ size?: number; color?: string }> = ({ size = 14, color }) => (
  <span dangerouslySetInnerHTML={{ __html: BRAND.badgeSvg.replace('currentColor', color || BRAND.colors.primary) }}
    style={{ width: size, height: size, display: 'inline-flex', verticalAlign: 'middle' }} />
);

interface GradeRecord { name: string; studentId: string; course: string; className: string; score: number; rank: number; trend: string; status: string; scores?: { exam: string; score: number }[]; }

const historyScores = [
  { exam: '作业1', score: 85 }, { exam: '期中', score: 78 }, { exam: '月考', score: 82 }, { exam: '期末', score: 92 },
];

const allGradeData: GradeRecord[] = [
  { name: '张三', studentId: '2024001', course: '机器学习', className: '1班', score: 92, rank: 3, trend: 'up', status: '优秀', scores: historyScores },
  { name: '李四', studentId: '2024002', course: '机器学习', className: '1班', score: 78, rank: 12, trend: 'down', status: '中等' },
  { name: '王五', studentId: '2024003', course: '机器学习', className: '1班', score: 88, rank: 7, trend: 'up', status: '良好' },
  { name: '赵六', studentId: '2024004', course: '机器学习', className: '1班', score: 65, rank: 20, trend: 'down', status: '及格' },
  { name: '孙七', studentId: '2024005', course: '机器学习', className: '2班', score: 45, rank: 28, trend: 'stable', status: '不及格' },
  { name: '周八', studentId: '2024006', course: '机器学习', className: '2班', score: 83, rank: 9, trend: 'up', status: '良好' },
  { name: '吴九', studentId: '2024007', course: '机器学习', className: '2班', score: 71, rank: 16, trend: 'stable', status: '中等' },
  { name: '张三', studentId: '2024001', course: '深度学习', className: '1班', score: 85, rank: 6, trend: 'up', status: '良好' },
  { name: '李四', studentId: '2024002', course: '深度学习', className: '1班', score: 72, rank: 15, trend: 'stable', status: '中等' },
  { name: '赵六', studentId: '2024004', course: '深度学习', className: '2班', score: 58, rank: 22, trend: 'down', status: '不及格' },
  { name: '孙七', studentId: '2024005', course: '深度学习', className: '2班', score: 60, rank: 20, trend: 'stable', status: '及格' },
  { name: '张三', studentId: '2024001', course: '自然语言处理', className: '1班', score: 96, rank: 1, trend: 'up', status: '优秀' },
  { name: '李四', studentId: '2024002', course: '自然语言处理', className: '1班', score: 80, rank: 8, trend: 'up', status: '良好' },
  { name: '赵六', studentId: '2024004', course: '自然语言处理', className: '2班', score: 82, rank: 7, trend: 'up', status: '良好' },
  { name: '孙七', studentId: '2024005', course: '自然语言处理', className: '2班', score: 50, rank: 25, trend: 'down', status: '不及格' },
  { name: '吴九', studentId: '2024007', course: '自然语言处理', className: '2班', score: 68, rank: 18, trend: 'up', status: '及格' },
];

const courseOptions = [
  { value: '机器学习', label: '机器学习' }, { value: '深度学习', label: '深度学习' },
  { value: '自然语言处理', label: '自然语言处理' }, { value: '计算机视觉', label: '计算机视觉' },
];

const gradeColors = (v: number) => v >= 85 ? BRAND.colors.green : v >= 75 ? BRAND.colors.primary : v >= 60 ? BRAND.colors.orange : BRAND.colors.error;
const gradeTagColor = (v: string) => v === '优秀' ? 'success' : v === '良好' ? 'processing' : v === '中等' ? 'warning' : v === '及格' ? 'default' : 'error';

const GradeManagement: React.FC = () => {
  const guard = useApiKeyGuard();
  const canGenerate = guard.hasKey;

  const [selectedCourse, setSelectedCourse] = useState('机器学习');
  const [selectedClass, setSelectedClass] = useState('');
  const [searchText, setSearchText] = useState('');
  const [scoreRange, setScoreRange] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [trendModal, setTrendModal] = useState<{ name: string; studentId: string } | null>(null);
  const [tabView, setTabView] = useState('list');

  const classOptions = useMemo(() => {
    const cls = [...new Set(allGradeData.filter(r => r.course === selectedCourse).map(r => r.className))].sort();
    return [{ value: '', label: '全部班级' }, ...cls.map(c => ({ value: c, label: c }))];
  }, [selectedCourse]);

  const gradeData = useMemo(() => {
    let data = allGradeData.filter(r => r.course === selectedCourse);
    if (selectedClass) data = data.filter(r => r.className === selectedClass);
    if (searchText) data = data.filter(r => r.name.includes(searchText) || r.studentId.includes(searchText));
    if (scoreRange) {
      const [min, max] = scoreRange.split('-').map(Number);
      data = data.filter(r => r.score >= min && (max ? r.score <= max : true));
    }
    if (gradeFilter) data = data.filter(r => r.status === gradeFilter);
    return [...data].sort((a, b) => b.score - a.score);
  }, [selectedCourse, selectedClass, searchText, scoreRange, gradeFilter]);

  const classSummaries = useMemo(() => {
    const cls = [...new Set(allGradeData.filter(r => r.course === selectedCourse).map(r => r.className))].sort();
    return cls.map(c => {
      const s = allGradeData.filter(r => r.course === selectedCourse && r.className === c);
      const avg = s.reduce((a, r) => a + r.score, 0) / s.length;
      return { className: c, count: s.length, avgScore: avg, passRate: Math.round(s.filter(x => x.score >= 60).length / s.length * 100), excellentRate: Math.round(s.filter(x => x.score >= 85).length / s.length * 100) };
    });
  }, [selectedCourse]);

  const studentAllGrades = useMemo(() => trendModal ? allGradeData.filter(r => r.studentId === trendModal.studentId) : [], [trendModal]);
  const studentScores = useMemo(() => trendModal ? allGradeData.find(r => r.studentId === trendModal.studentId)?.scores || [] : [], [trendModal]);

  const avgScore = gradeData.length > 0 ? +(gradeData.reduce((s, r) => s + r.score, 0) / gradeData.length).toFixed(1) : 0;
  const passRate = gradeData.length > 0 ? Math.round(gradeData.filter(r => r.score >= 60).length / gradeData.length * 100) : 0;
  const excellentRate = gradeData.length > 0 ? Math.round(gradeData.filter(r => r.score >= 85).length / gradeData.length * 100) : 0;

  // 分数分布
  const dist = { '≥85': gradeData.filter(r => r.score >= 85).length, '75-84': gradeData.filter(r => r.score >= 75 && r.score < 85).length, '60-74': gradeData.filter(r => r.score >= 60 && r.score < 75).length, '<60': gradeData.filter(r => r.score < 60).length };

  // 预警学生
  const warnings = useMemo(() => gradeData.filter(r => {
    const prev = r.rank + (r.trend === 'down' ? 5 : 0);
    return r.score < 60 || (r.trend === 'down' && prev > r.rank + 3);
  }), [gradeData]);

  return (
    <div className="page-enter">
      {!canGenerate && <ApiKeyBanner onGoSettings={guard.goToSettings} />}

      <div style={{ marginBottom: 16 }}>
        <Space align="center" size={10}>
          <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 32, height: 32, display: 'inline-flex', animation: 'logoPulse 0.8s ease-out' }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: BRAND.colors.textPrimary }}>智教星 · 成绩管理</div>
            <Text type="secondary" style={{ fontSize: 11 }}>全维度成绩汇总 · 趋势分析 · AI诊断</Text>
          </div>
        </Space>
      </div>

      {/* 筛选 + 指标 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Tooltip title={`平均分 ${avgScore} · 分布: ≥85:${dist['≥85']} 75-84:${dist['75-84']} 60-74:${dist['60-74']} <60:${dist['<60']}`}>
            <Card className="brand-card" bodyStyle={{ padding: '14px 18px', position: 'relative' }}>
              <span style={{ position: 'absolute', top: 6, right: 8, color: BRAND.colors.green, opacity: 0.3 }}><BrandBadge /></span>
              <Statistic title={<Text style={{ fontSize: 12, color: BRAND.colors.textSecondary }}>平均分</Text>}
                value={avgScore} suffix={<Text style={{ fontSize: 12, color: BRAND.colors.textTertiary }}>分</Text>}
                prefix={<TrophyOutlined style={{ color: BRAND.colors.green, fontSize: 18 }} />}
                valueStyle={{ fontSize: 24, fontWeight: 700, color: gradeColors(avgScore) }} />
              <Text style={{ fontSize: 11, color: avgScore >= 75 ? BRAND.colors.green : BRAND.colors.orange }}>↑ 较上期 +2.3%</Text>
            </Card>
          </Tooltip>
        </Col>
        <Col span={6}>
          <Card className="brand-card" bodyStyle={{ padding: '14px 18px', position: 'relative' }}>
            <span style={{ position: 'absolute', top: 6, right: 8, color: BRAND.colors.primary, opacity: 0.3 }}><BrandBadge /></span>
            <Statistic title={<Text style={{ fontSize: 12, color: BRAND.colors.textSecondary }}>通过率</Text>}
              value={passRate} suffix={<Text style={{ fontSize: 12, color: BRAND.colors.textTertiary }}>%</Text>}
              prefix={<RiseOutlined style={{ color: BRAND.colors.primary, fontSize: 18 }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: BRAND.colors.primary }} />
            <Text style={{ fontSize: 11, color: BRAND.colors.green }}>及格 {gradeData.filter(r => r.score >= 60).length}/{gradeData.length} 人</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="brand-card" bodyStyle={{ padding: '14px 18px', position: 'relative' }}>
            <span style={{ position: 'absolute', top: 6, right: 8, color: BRAND.colors.purple, opacity: 0.3 }}><BrandBadge /></span>
            <Statistic title={<Text style={{ fontSize: 12, color: BRAND.colors.textSecondary }}>优秀率</Text>}
              value={excellentRate} suffix={<Text style={{ fontSize: 12, color: BRAND.colors.textTertiary }}>%</Text>}
              prefix={<TrophyOutlined style={{ color: BRAND.colors.purple, fontSize: 18 }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: BRAND.colors.purple }} />
            <Text style={{ fontSize: 11, color: BRAND.colors.textSecondary }}>优秀 ≥85 分</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="brand-card" bodyStyle={{ padding: '14px 18px' }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Select value={selectedCourse} onChange={v => { setSelectedCourse(v); setSelectedClass(''); }} style={{ width: '100%', borderRadius: 8 }} options={courseOptions} />
              <Select value={selectedClass} onChange={setSelectedClass} style={{ width: '100%', borderRadius: 8 }} options={classOptions} placeholder="全部班级" allowClear />
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 班级概览 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {classSummaries.map(cs => (
          <Col xs={12} sm={6} key={cs.className}>
            <Card hoverable size="small" className="brand-card"
              onClick={() => setSelectedClass(cs.className === selectedClass ? '' : cs.className)}
              style={{ border: selectedClass === cs.className ? `2px solid ${BRAND.colors.primary}` : undefined, background: selectedClass === cs.className ? `${BRAND.colors.primary}08` : undefined, borderRadius: 8 }}>
              <Statistic title={<Space><TeamOutlined style={{ color: BRAND.colors.primary }} />{cs.className}</Space>} value={cs.count} suffix="人" valueStyle={{ fontSize: 20, fontWeight: 700 }} />
              <Text type="secondary" style={{ fontSize: 11 }}>平均 {cs.avgScore.toFixed(1)} · 通过 {cs.passRate}% · 优秀 {cs.excellentRate}%</Text>
            </Card>
          </Col>
        ))}
        <Col xs={12} sm={6}>
          <Card size="small" className="brand-card" bodyStyle={{ padding: '10px 14px', background: `${BRAND.colors.orange}08` }}>
            <Space><WarningOutlined style={{ color: BRAND.colors.orange }} /><Text style={{ fontSize: 12, color: BRAND.colors.orange }}>预警：{warnings.length} 名学生需关注</Text></Space>
            <div style={{ fontSize: 11, color: BRAND.colors.textTertiary, marginTop: 2 }}>{warnings.map(w => w.name).join('、')}</div>
          </Card>
        </Col>
      </Row>

      {/* Tab 切换 */}
      <Tabs activeKey={tabView} onChange={setTabView} style={{ background: '#fff', borderRadius: 12, padding: '4px 16px 16px', boxShadow: CARD_SPECS.shadow }}
        tabBarExtraContent={
          <Space>
            <Input placeholder="姓名/学号" prefix={<SearchOutlined />} style={{ width: 160, borderRadius: 8 }} value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
            <Select style={{ width: 110, borderRadius: 8 }} placeholder="分数段" allowClear value={scoreRange || undefined} onChange={v => setScoreRange(v || '')}
              options={[{ value: '90-100', label: '90-100' }, { value: '75-89', label: '75-89' }, { value: '60-74', label: '60-74' }, { value: '0-59', label: '<60' }]} />
            <Select style={{ width: 100, borderRadius: 8 }} placeholder="等级" allowClear value={gradeFilter || undefined} onChange={v => setGradeFilter(v || '')}
              options={[{ value: '优秀', label: '优秀' }, { value: '良好', label: '良好' }, { value: '中等', label: '中等' }, { value: '及格', label: '及格' }, { value: '不及格', label: '不及格' }]} />
          </Space>
        }
        items={[
          // ═══ 成绩列表 ═══
          { key: 'list', label: <span><BarChartOutlined style={{ color: BRAND.colors.primary }} />成绩列表</span>,
            children: (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <Space>
                    <Button icon={<DownloadOutlined />} style={{ borderRadius: 6, borderColor: BRAND.colors.primary, color: BRAND.colors.primary }}>导出成绩单</Button>
                    <Popconfirm title="从 Excel 导入成绩？"><Button icon={<UploadOutlined />} style={{ borderRadius: 6, borderColor: BRAND.colors.green, color: BRAND.colors.green }}>导入成绩</Button></Popconfirm>
                    {canGenerate ? (
                      <Button icon={<RobotOutlined />} style={{ borderRadius: 6, border: 'none', background: BRAND.colors.primaryGradient, color: '#fff' }}
                        onClick={() => message.success('AI 成绩诊断报告生成中...')}>AI 班级诊断</Button>
                    ) : (
                      <Button disabled icon={<KeyOutlined />} style={{ borderRadius: 6 }}>AI 诊断已锁定</Button>
                    )}
                  </Space>
                </div>
                <Table dataSource={gradeData} pagination={{ pageSize: 10 }} rowKey={r => `${r.studentId}_${r.course}`} className="table-header-brand"
                  columns={[
                    { title: '姓名', dataIndex: 'name', render: (v: string) => <Text strong style={{ color: BRAND.colors.textPrimary }}>{v}</Text> },
                    { title: '学号', dataIndex: 'studentId' },
                    { title: '班级', dataIndex: 'className', render: (v: string) => <Tag style={{ borderRadius: 6 }}>{v}</Tag> },
                    { title: '分数', dataIndex: 'score', render: (v: number) => <Text strong style={{ fontSize: 15, color: gradeColors(v) }}>{v}</Text> },
                    { title: '排名', dataIndex: 'rank' },
                    { title: '趋势', dataIndex: 'trend', render: (t: string) => t === 'up' ? <Tag color="success" icon={<ArrowUpOutlined />} style={{ borderRadius: 6 }}>上升</Tag> : t === 'down' ? <Tag color="error" icon={<ArrowDownOutlined />} style={{ borderRadius: 6, animation: 'blinkWarning 1.2s ease-in-out infinite' }}>下降</Tag> : <Tag style={{ borderRadius: 6 }}>稳定</Tag> },
                    { title: '等级', dataIndex: 'status', render: (v: string) => <Tag color={gradeTagColor(v)} style={{ borderRadius: 6 }}>{v}</Tag> },
                    { title: '操作', width: 200, render: (_: any, r: GradeRecord) => (
                      <Space size={0}>
                        <Button type="link" size="small" icon={<EyeOutlined />} style={{ fontSize: 11, color: BRAND.colors.primary }} onClick={() => setTrendModal({ name: r.name, studentId: r.studentId })}>趋势</Button>
                        <Tooltip title={canGenerate ? 'AI 生成提分方案' : '请先配置API密钥'}>
                          <Button type="link" size="small" icon={<RobotOutlined />} disabled={!canGenerate} style={{ fontSize: 11, color: BRAND.colors.purple }}
                            onClick={() => { if (!canGenerate) guard.showGuard(); }}>提分方案</Button>
                        </Tooltip>
                        <Button type="link" size="small" icon={<HistoryOutlined />} style={{ fontSize: 11, color: BRAND.colors.green }}>归档台账</Button>
                      </Space>
                    )},
                  ]} />
              </div>
            ) },
          // ═══ 分析面板 ═══
          { key: 'analytics', label: <span><BarChartOutlined style={{ color: BRAND.colors.purple }} />分析面板</span>,
            children: (
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <Card size="small" className="brand-card" title={<Space><BrandBadge color={BRAND.colors.primary} /><Text strong>分数区间分布</Text></Space>}>
                    {Object.entries(dist).map(([k, v]) => (
                      <div key={k} style={{ marginBottom: 6 }}>
                        <Row align="middle">
                          <Col span={4}><Text style={{ fontSize: 11 }}>{k}</Text></Col>
                          <Col span={16}><Progress percent={gradeData.length > 0 ? Math.round(v / gradeData.length * 100) : 0} size="small" strokeColor={k === '≥85' ? BRAND.colors.green : k === '<60' ? BRAND.colors.error : BRAND.colors.primary} format={() => ''} /></Col>
                          <Col span={4}><Tag style={{ borderRadius: 6, fontSize: 10 }}>{v}人</Tag></Col>
                        </Row>
                      </div>
                    ))}
                    <Divider style={{ margin: '6px 0' }} />
                    <Text type="secondary" style={{ fontSize: 11 }}>薄弱分段：{dist['<60'] > 0 ? `${dist['<60']} 名学生低于及格线` : '暂无'}</Text>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" className="brand-card" title={<Space><BrandBadge color={BRAND.colors.purple} /><Text strong>班级对比</Text></Space>}>
                    {classSummaries.map(cs => (
                      <div key={cs.className} style={{ marginBottom: 6 }}>
                        <Text style={{ fontSize: 11 }}>{cs.className}</Text>
                        <Progress percent={Math.round(cs.avgScore)} size="small" strokeColor={BRAND.colors.primary} format={() => `${cs.avgScore.toFixed(1)}分`} />
                        <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>通过 {cs.passRate}%</Text>
                      </div>
                    ))}
                    {classSummaries.length === 0 && <Empty description="暂无对比数据" />}
                  </Card>
                </Col>
                <Col span={24}>
                  <Card size="small" className="brand-card" title={<Space><BrandBadge color={BRAND.colors.orange} /><Text strong>预警学生名单</Text></Space>}>
                    {warnings.length > 0 ? (
                      <Table dataSource={warnings} rowKey={r => `${r.studentId}_${r.course}`} size="small" pagination={false}
                        columns={[
                          { title: '姓名', dataIndex: 'name' },
                          { title: '分数', dataIndex: 'score', render: (v: number) => <Text style={{ color: BRAND.colors.error }}>{v}</Text> },
                          { title: '趋势', dataIndex: 'trend', render: (t: string) => t === 'down' ? <Tag color="error" style={{ borderRadius: 6 }}>下降</Tag> : <Tag style={{ borderRadius: 6 }}>稳定</Tag> },
                          { title: '建议', render: () => <Button type="link" size="small" icon={<RobotOutlined />} disabled={!canGenerate} style={{ fontSize: 11 }} onClick={() => { if (!canGenerate) guard.showGuard(); }}>AI帮扶方案</Button> },
                        ]} />
                    ) : <Text type="secondary">无预警学生</Text>}
                  </Card>
                </Col>
              </Row>
            ) },
        ]} />

      {/* 个人成绩趋势弹窗 */}
      <Modal title={<Space><BrandBadge />{trendModal?.name}（{trendModal?.studentId}）— 成绩趋势</Space>}
        open={!!trendModal} onCancel={() => setTrendModal(null)} footer={null} width={650}>
        {studentAllGrades.length > 0 && (
          <div>
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={6}><Card size="small" className="brand-card"><Statistic title="课程数" value={studentAllGrades.length} suffix="门" valueStyle={{ fontSize: 18 }} /></Card></Col>
              <Col span={6}><Card size="small" className="brand-card"><Statistic title="均分" value={(studentAllGrades.reduce((s, r) => s + r.score, 0) / studentAllGrades.length).toFixed(1)} suffix="分" valueStyle={{ fontSize: 18 }} /></Card></Col>
              <Col span={6}><Card size="small" className="brand-card"><Statistic title="最高" value={Math.max(...studentAllGrades.map(r => r.score))} suffix="分" valueStyle={{ fontSize: 18, color: BRAND.colors.green }} /></Card></Col>
              <Col span={6}><Card size="small" className="brand-card"><Statistic title="最低" value={Math.min(...studentAllGrades.map(r => r.score))} suffix="分" valueStyle={{ fontSize: 18, color: BRAND.colors.error }} /></Card></Col>
            </Row>
            <Table dataSource={studentAllGrades} rowKey="course" pagination={false} size="small" className="table-header-brand"
              columns={[
                { title: '课程', dataIndex: 'course', render: (v: string) => <Tag color="blue" style={{ borderRadius: 6 }}>{v}</Tag> },
                { title: '班级', dataIndex: 'className' },
                { title: '分数', dataIndex: 'score', render: (v: number) => <Text strong style={{ fontSize: 14, color: gradeColors(v) }}>{v}</Text> },
                { title: '排名', dataIndex: 'rank' },
                { title: '趋势', dataIndex: 'trend', render: (t: string) => t === 'up' ? <Tag color="success" icon={<ArrowUpOutlined />} style={{ borderRadius: 6 }}>↑</Tag> : t === 'down' ? <Tag color="error" icon={<ArrowDownOutlined />} style={{ borderRadius: 6 }}>↓</Tag> : <Tag style={{ borderRadius: 6 }}>→</Tag> },
                { title: '等级', dataIndex: 'status', render: (v: string) => <Tag color={gradeTagColor(v)} style={{ borderRadius: 6 }}>{v}</Tag> },
              ]} />
            {studentScores.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Text strong style={{ fontSize: 13 }}>历次成绩趋势</Text>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {studentScores.map((s, i) => (
                    <Card key={i} size="small" className="brand-card" bodyStyle={{ padding: '8px 12px', textAlign: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 10 }}>{s.exam}</Text>
                      <div style={{ fontSize: 20, fontWeight: 700, color: gradeColors(s.score) }}>{s.score}</div>
                      {i > 0 && <Text style={{ fontSize: 10, color: s.score >= studentScores[i - 1].score ? BRAND.colors.green : BRAND.colors.error }}>
                        {s.score >= studentScores[i - 1].score ? '↑' : '↓'}{Math.abs(s.score - studentScores[i - 1].score)}
                      </Text>}
                    </Card>
                  ))}
                </div>
              </div>
            )}
            <Divider style={{ margin: '12px 0' }} />
            <Space>
              {canGenerate ? (
                <Button type="primary" icon={<RobotOutlined />} style={{ borderRadius: 6, border: 'none', background: BRAND.colors.primaryGradient }}>AI 提分方案</Button>
              ) : (
                <Button disabled icon={<KeyOutlined />} style={{ borderRadius: 6 }}>AI 提分方案</Button>
              )}
              <Button icon={<HistoryOutlined />} style={{ borderRadius: 6, borderColor: BRAND.colors.purple, color: BRAND.colors.purple }}>归档台账</Button>
            </Space>
          </div>
        )}
      </Modal>

      <div className="brand-watermark">Edu-TA 成绩管理 · 数据可追溯</div>

      <ApiKeyGuardModal visible={guard.modalVisible} onClose={guard.hideGuard} onGoSettings={guard.goToSettings} />
      <SettingsModal open={guard.settingsVisible} onClose={() => guard.setSettingsVisible(false)} />
    </div>
  );
};

export default GradeManagement;
