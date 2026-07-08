/**
 * 教学台账中心 — Edu-TA 智教星 品牌化页面
 *
 * 核心功能保留：AI 智能备课生成（表单+结果展示）
 * 品牌特色：智教星 LOGO、品牌色系、二进制暗纹、卡片角标、轻量动效
 * 台账特色：历史教案列表、筛选、归档状态、导出入口
 */

import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, InputNumber, Button, Spin, Alert, Typography,
  Descriptions, Tag, Divider, Timeline, Space, Steps, Empty, message,
  Row, Col, Select, Table, Popconfirm, Tooltip, Radio, Pagination,
} from 'antd';
import {
  RobotOutlined, BookOutlined, AimOutlined, ToolOutlined,
  FileTextOutlined, ThunderboltOutlined, DownloadOutlined,
  DeleteOutlined, HistoryOutlined, FilterOutlined, ReloadOutlined,
  PlusOutlined, EyeOutlined, CheckCircleOutlined, ClockCircleOutlined,
  SearchOutlined, KeyOutlined,
} from '@ant-design/icons';
import { lessonApi, LessonPlanRequest } from '../api/client';
import { BRAND, CARD_SPECS } from '../utils/brand';
import { useApiKeyGuard, ApiKeyGuardModal, ApiKeyBanner, DisabledAIButton } from '../utils/apiKeyGuard';
import SettingsModal from '../components/SettingsModal';
import '../styles/brand.css';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// ── 品牌角标 ────────────────────────────────────────
const BrandBadge: React.FC<{ size?: number; color?: string }> = ({ size = 14, color }) => (
  <span
    dangerouslySetInnerHTML={{
      __html: BRAND.badgeSvg.replace(
        'currentColor',
        color || BRAND.colors.primary
      ),
    }}
    style={{ width: size, height: size, display: 'inline-flex', verticalAlign: 'middle', flexShrink: 0 }}
  />
);

// ── 台账状态标签 ────────────────────────────────────
const LedgerStatusTag: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { color: string; label: string }> = {
    archived: { color: BRAND.colors.green, label: '已归档' },
    review: { color: BRAND.colors.orange, label: '待复核' },
    history: { color: '#9CA3AF', label: '历史存档' },
  };
  const s = map[status] || map.history;
  return (
    <Tag
      style={{
        borderRadius: 10,
        padding: '0 10px',
        lineHeight: '22px',
        border: `1px solid ${s.color}33`,
        background: `${s.color}15`,
        color: s.color,
        fontWeight: 500,
        fontSize: 12,
      }}
      className={status === 'review' ? 'tag-glow' : ''}
    >
      <BrandBadge size={10} color={s.color} />
      <span style={{ marginLeft: 4 }}>{s.label}</span>
    </Tag>
  );
};

// ═══════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════
const LessonPlanning: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [error, setError] = useState('');

  // ── API Key 守卫 ──
  const guard = useApiKeyGuard();
  const canGenerate = guard.hasKey;

  // 台账列表
  const [records, setRecords] = useState<any[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [filterCourse, setFilterCourse] = useState('');
  const [ledgerTab, setLedgerTab] = useState('all');
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const pageSize = 8;

  // ── 生成教案（API Key 拦截 + 原始逻辑保留） ──
  const handleGenerate = async (values: LessonPlanRequest) => {
    // 拦截：无有效 API Key 则拒绝生成
    if (!guard.hasKey) {
      guard.showGuard();
      return;
    }
    setLoading(true);
    setError('');
    setPlan(null);
    try {
      const res = await lessonApi.generate(values);
      if (res.data.success) {
        setPlan(res.data.data);
        message.success('教案生成成功！已自动保存至教学台账');
        loadRecords();
      } else {
        setError(res.data.message || '生成失败');
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || '请求失败，请检查后端服务是否运行');
    } finally {
      setLoading(false);
    }
  };

  // ── 加载历史台账 ──
  const loadRecords = async () => {
    setRecordsLoading(true);
    try {
      const res = await lessonApi.list(filterCourse || undefined);
      const list = res.data?.plans || res.data?.data?.plans || [];
      setTotalRecords(list.length);
      setRecords(list);
    } catch {
      // ignore
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  // ── 台账列表 ──
  const filteredRecords = records.filter(r => {
    if (ledgerTab === 'archived') return true; // 简化：暂时全部
    return true;
  });

  const pagedRecords = filteredRecords.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const columns = [
    {
      title: '教案名称',
      key: 'name',
      render: (_: any, r: any) => (
        <Space>
          <BookOutlined style={{ color: BRAND.colors.primary }} />
          <div>
            <Text strong style={{ fontSize: 14, color: BRAND.colors.textPrimary }}>
              {r.course_name} — {r.chapter}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>
              共 {(r.sessions?.length || 0) + (r.teaching_flow?.length || 0)} 个教学环节 · {r.total_hours} 课时
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'id',
      key: 'status',
      width: 110,
      render: (id: string) => <LedgerStatusTag status={id ? 'archived' : 'history'} />,
    },
    {
      title: '生成时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v?.slice(0, 19)?.replace('T', ' ') || '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, r: any) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="link"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => setPlan(r)}
              style={{ color: BRAND.colors.primary }}
            >
              查看
            </Button>
          </Tooltip>
          <Tooltip title="台账溯源">
            <Button
              type="link"
              icon={<HistoryOutlined />}
              size="small"
              style={{
                background: `linear-gradient(135deg, ${BRAND.colors.primary}, ${BRAND.colors.purple})`,
                color: '#fff',
                borderRadius: 6,
                padding: '2px 10px',
                fontSize: 12,
                height: 26,
                border: 'none',
              }}
              className="brand-card"
            >
              台账溯源
            </Button>
          </Tooltip>
          <Popconfirm title="确认删除此台账记录？">
            <Button type="link" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-enter" style={{ position: 'relative', minHeight: '100vh' }}>
      {/* 二进制暗纹背景 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: `url(${BRAND.binaryPattern})`,
          backgroundRepeat: 'repeat',
          opacity: 0.6,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ════════════════════════════════════════════ */}
        {/* 页面头部                           */}
        {/* ════════════════════════════════════════════ */}
        <div style={{ marginBottom: 20 }}>
          {/* 面包屑 */}
          <Space size={6} style={{ marginBottom: 8, fontSize: 12, color: BRAND.colors.textTertiary }}>
            <span>首页</span>
            <span style={{ color: '#d9d9d9' }}>/</span>
            <Space size={4}>
              <BrandBadge size={12} />
              <span style={{ color: BRAND.colors.primary, fontWeight: 500 }}>教学台账中心</span>
            </Space>
          </Space>

          {/* 标题区 */}
          <Space align="center" size={12}>
            <span
              dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }}
              style={{
                width: 38, height: 38, display: 'inline-flex', flexShrink: 0,
                animation: 'logoPulse 0.8s ease-out',
              }}
            />
            <div>
              <Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: BRAND.colors.textPrimary }}>
                智教星 · 教学台账中心
              </Title>
              <Text type="secondary" style={{ fontSize: 12, color: BRAND.colors.textTertiary }}>
                全量教学数据沉淀、AI 操作记录可追溯归档
              </Text>
            </div>
          </Space>
        </div>

        {/* ── API Key 警告横幅 ── */}
        {!canGenerate && <ApiKeyBanner onGoSettings={guard.goToSettings} />}

        {/* ════════════════════════════════════════════ */}
        {/* 智能备课生成区（原始业务逻辑完全保留）  */}
        {/* ════════════════════════════════════════════ */}
        <Card
          className="brand-card"
          style={{ marginBottom: 20 }}
          bodyStyle={{ padding: '20px 24px', position: 'relative' }}
        >
          {/* 品牌角标 */}
          <span style={{ position: 'absolute', top: 10, right: 12, color: BRAND.colors.primary, opacity: 0.4 }}>
            <BrandBadge size={16} />
          </span>

          <Space align="center" style={{ marginBottom: 12 }}>
            <div
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: BRAND.colors.primaryGradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <RobotOutlined style={{ fontSize: 16, color: '#fff' }} />
            </div>
            <Title level={5} style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
              AI 智能备课
            </Title>
            <Tag
              style={{
                borderRadius: 8,
                background: `${BRAND.colors.green}15`,
                color: BRAND.colors.green,
                border: `1px solid ${BRAND.colors.green}33`,
                fontSize: 10,
              }}
            >
              RAG 增强
            </Tag>
          </Space>
          <Paragraph style={{ color: BRAND.colors.textSecondary, marginBottom: 16, fontSize: 13 }}>
            输入课程和章节信息，AI 将基于学科知识库自动生成完整教案。
          </Paragraph>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleGenerate}
            initialValues={{ teaching_hours: 2 }}
            size="middle"
          >
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="course_name" label="课程名称" rules={[{ required: true, message: '请输入课程名称' }]}>
                  <Input
                    placeholder="例如：机器学习、深度学习"
                    style={{ borderRadius: 8, borderColor: BRAND.colors.border }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="chapter" label="章节名称" rules={[{ required: true, message: '请输入章节名称' }]}>
                  <Input
                    placeholder="例如：第一章 命题逻辑"
                    style={{ borderRadius: 8, borderColor: BRAND.colors.border }}
                  />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="teaching_hours" label="课时数">
                  <InputNumber min={1} max={8} style={{ width: '100%', borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="additional_requirements" label="附加要求">
                  <Input placeholder="偏重实践/增加互动" style={{ borderRadius: 8, borderColor: BRAND.colors.border }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="textbook_content" label="教材内容（可选，RAG 增强备课质量）">
              <TextArea
                rows={3}
                placeholder="粘贴教材内容、讲义要点... 留空则 AI 基于学科常识生成"
                style={{ borderRadius: 8, borderColor: BRAND.colors.border, resize: 'none' }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                {canGenerate ? (
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    icon={<ThunderboltOutlined />}
                    style={{
                      minWidth: 160,
                      height: 40,
                      borderRadius: 8,
                      border: 'none',
                      background: BRAND.colors.primaryGradient,
                      boxShadow: `0 4px 14px ${BRAND.colors.primary}40`,
                    }}
                  >
                    {loading ? 'AI 正在备课...' : '生成教案'}
                  </Button>
                ) : (
                  <DisabledAIButton label="生成教案" icon={<KeyOutlined />} />
                )}
                <Button
                  onClick={() => form.resetFields()}
                  style={{ borderRadius: 8, borderColor: BRAND.colors.border, color: BRAND.colors.textSecondary }}
                >
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Form>

          {error && (
            <Alert
              message="生成失败"
              description={error}
              type="error"
              showIcon
              style={{ marginTop: 16, borderRadius: 8 }}
            />
          )}
        </Card>

        {/* ── 加载状态 ── */}
        {loading && (
          <Card
            className="brand-card"
            bodyStyle={{ padding: '40px', textAlign: 'center' }}
          >
            <div style={{ animation: 'logoGlow 1.5s ease-in-out infinite' }}>
              <span
                dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }}
                style={{ width: 56, height: 56, display: 'inline-block' }}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Spin />
            </div>
            <Paragraph style={{ marginTop: 12, color: BRAND.colors.textSecondary }}>
              正在检索知识库 → 构建教案结构 → 生成教学内容...
            </Paragraph>
          </Card>
        )}

        {/* ── 生成结果展示（原始逻辑保留） ── */}
        {plan && !loading && (
          <Card
            className="brand-card"
            style={{ marginBottom: 20 }}
            bodyStyle={{ padding: '20px 24px', position: 'relative' }}
          >
            <span style={{ position: 'absolute', top: 10, right: 12, color: BRAND.colors.primary, opacity: 0.4 }}>
              <BrandBadge size={16} />
            </span>

            <Space style={{ marginBottom: 16 }}>
              <BookOutlined style={{ fontSize: 20, color: BRAND.colors.primary }} />
              <Title level={5} style={{ margin: 0, fontSize: 15 }}>
                {plan.course_name} — {plan.chapter}
              </Title>
              <LedgerStatusTag status="archived" />
              <Tag style={{ borderRadius: 6, borderColor: BRAND.colors.primary, color: BRAND.colors.primary }}>
                {plan.total_hours} 课时
              </Tag>
              <Tag style={{ borderRadius: 6, background: `${BRAND.colors.green}15`, color: BRAND.colors.green, border: 'none' }}>
                {plan.sessions?.length || 0} 个教学环节
              </Tag>
            </Space>

            {/* 教学目标 */}
            <Card
              size="small"
              title={<Space><AimOutlined style={{ color: BRAND.colors.primary }} />教学目标</Space>}
              style={{ marginBottom: 12, borderRadius: 8, borderColor: BRAND.colors.border }}
            >
              <Descriptions column={1} size="small">
                {plan.objectives?.map((obj: any, i: number) => (
                  <Descriptions.Item
                    label={<Tag style={{ borderRadius: 6, color: BRAND.colors.primary, borderColor: BRAND.colors.primary }}>{obj.dimension}</Tag>}
                    key={i}
                  >
                    {obj.content}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>

            {/* 方法与资源 */}
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={12}>
                <Card
                  size="small"
                  title={<Space><ToolOutlined style={{ color: BRAND.colors.purple }} />教学方法</Space>}
                  style={{ borderRadius: 8, borderColor: BRAND.colors.border }}
                >
                  <Space wrap>
                    {plan.methods?.map((m: string, i: number) => (
                      <Tag key={i} style={{ borderRadius: 6, background: `${BRAND.colors.purple}10`, color: BRAND.colors.purple, border: `1px solid ${BRAND.colors.purple}20` }}>
                        {m}
                      </Tag>
                    )) || <Text type="secondary">暂无</Text>}
                  </Space>
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  size="small"
                  title={<Space><FileTextOutlined style={{ color: BRAND.colors.green }} />教学资源</Space>}
                  style={{ borderRadius: 8, borderColor: BRAND.colors.border }}
                >
                  <Space wrap>
                    {plan.resources?.map((r: string, i: number) => (
                      <Tag key={i} style={{ borderRadius: 6, background: `${BRAND.colors.green}10`, color: BRAND.colors.green, border: `1px solid ${BRAND.colors.green}20` }}>
                        {r}
                      </Tag>
                    )) || <Text type="secondary">暂无</Text>}
                  </Space>
                </Card>
              </Col>
            </Row>

            {/* 教学流程 */}
            <Title level={5} style={{ fontSize: 14, marginBottom: 12, color: BRAND.colors.textPrimary }}>
              📋 教学流程
            </Title>
            {plan.sessions?.map((session: any, idx: number) => (
              <Card
                key={idx}
                size="small"
                title={
                  <Space>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: BRAND.colors.primaryGradient,
                      color: '#fff', fontSize: 11, fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {session.session_order}
                    </span>
                    <Text strong style={{ fontSize: 13 }}>{session.session_topic}</Text>
                  </Space>
                }
                style={{ marginBottom: 10, borderRadius: 8, borderColor: BRAND.colors.border }}
              >
                {/* 重点难点 */}
                <Row gutter={12} style={{ marginBottom: 8 }}>
                  {session.key_points?.length > 0 && (
                    <Col span={12}>
                      <Text strong style={{ fontSize: 12, color: BRAND.colors.orange }}>教学重点：</Text>
                      <Space wrap style={{ marginTop: 4 }}>
                        {session.key_points.map((kp: string, i: number) => (
                          <Tag key={i} color="orange" style={{ borderRadius: 6, fontSize: 11 }}>{kp}</Tag>
                        ))}
                      </Space>
                    </Col>
                  )}
                  {session.difficult_points?.length > 0 && (
                    <Col span={12}>
                      <Text strong style={{ fontSize: 12, color: BRAND.colors.error }}>教学难点：</Text>
                      <Space wrap style={{ marginTop: 4 }}>
                        {session.difficult_points.map((dp: string, i: number) => (
                          <Tag key={i} color="red" style={{ borderRadius: 6, fontSize: 11 }}>{dp}</Tag>
                        ))}
                      </Space>
                    </Col>
                  )}
                </Row>

                <Timeline
                  items={session.activities?.map((act: any, i: number) => ({
                    color: i === 0 ? BRAND.colors.primary : i === session.activities.length - 1 ? BRAND.colors.green : BRAND.colors.textTertiary,
                    children: (
                      <div>
                        <Space>
                          <Tag style={{ borderRadius: 6, background: `${BRAND.colors.primary}10`, color: BRAND.colors.primary, border: 'none', fontSize: 11 }}>
                            {act.duration} min
                          </Tag>
                          <Tag style={{ borderRadius: 6, background: `${BRAND.colors.purple}10`, color: BRAND.colors.purple, border: 'none', fontSize: 11 }}>
                            {act.activity_type}
                          </Tag>
                        </Space>
                        <Paragraph style={{ margin: '4px 0', fontSize: 13 }}>{act.content}</Paragraph>
                        {act.teacher_activity && (
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                            👨‍🏫 教师：{act.teacher_activity}
                          </Text>
                        )}
                        {act.student_activity && (
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                            👩‍🎓 学生：{act.student_activity}
                          </Text>
                        )}
                      </div>
                    ),
                  })) || []}
                />

                {session.homework && (
                  <Alert
                    message="课后作业"
                    description={session.homework}
                    type="info"
                    showIcon
                    style={{ marginTop: 8, borderRadius: 8 }}
                  />
                )}
              </Card>
            )) || <Empty description="暂无教学流程数据" />}

            <Divider style={{ margin: '12px 0' }} />
            <Space>
              <BrandBadge size={12} />
              <Text type="secondary" style={{ fontSize: 11 }}>
                台账 ID：{plan.id} · 归档时间：{plan.created_at?.slice(0, 19)?.replace('T', ' ') || '-'}
              </Text>
            </Space>
          </Card>
        )}

        {/* ════════════════════════════════════════════ */}
        {/* 台账记录区（历史教案列表+筛选）       */}
        {/* ════════════════════════════════════════════ */}
        <Card
          className="brand-card"
          bodyStyle={{ padding: '20px 24px', position: 'relative' }}
        >
          <span style={{ position: 'absolute', top: 10, right: 12, color: BRAND.colors.purple, opacity: 0.4 }}>
            <BrandBadge size={16} />
          </span>

          {/* 台账标题 */}
          <Space align="center" size={8} style={{ marginBottom: 16 }}>
            <HistoryOutlined style={{ fontSize: 18, color: BRAND.colors.primary }} />
            <Title level={5} style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
              历史台账记录
            </Title>
            <Tag style={{ borderRadius: 8, background: `${BRAND.colors.primary}10`, color: BRAND.colors.primary, border: 'none' }}>
              共 {totalRecords} 条
            </Tag>
          </Space>

          {/* 筛选区域 */}
          <div
            style={{
              background: `${BRAND.colors.primary}06`,
              borderRadius: 8,
              padding: '14px 18px',
              marginBottom: 16,
              border: `1px solid ${BRAND.colors.border}`,
            }}
          >
            <Row gutter={12} align="middle">
              <Col flex="auto">
                <Space size={12}>
                  <Select
                    placeholder="按课程筛选"
                    style={{ width: 160, borderRadius: 8 }}
                    value={filterCourse || undefined}
                    onChange={v => { setFilterCourse(v || ''); setPage(1); }}
                    allowClear
                  >
                    <Option value="">全部课程</Option>
                    <Option value="机器学习">机器学习</Option>
                    <Option value="深度学习">深度学习</Option>
                    <Option value="自然语言处理">自然语言处理</Option>
                    <Option value="计算机视觉">计算机视觉</Option>
                  </Select>

                  <Select placeholder="台账类型" style={{ width: 140, borderRadius: 8 }} defaultValue="">
                    <Option value="">全部类型</Option>
                    <Option value="lesson">备课教案</Option>
                    <Option value="homework">作业批改</Option>
                    <Option value="insight">学情诊断</Option>
                  </Select>
                </Space>
              </Col>
              <Col>
                <Space>
                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    onClick={loadRecords}
                    style={{
                      borderRadius: 8, border: 'none',
                      background: BRAND.colors.primaryGradient,
                    }}
                  >
                    查询
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => { setFilterCourse(''); loadRecords(); }}
                    style={{ borderRadius: 8, color: BRAND.colors.textSecondary }}
                  >
                    重置
                  </Button>
                </Space>
              </Col>
            </Row>
          </div>

          {/* 台账分类 Tab */}
          <div style={{ marginBottom: 16, borderBottom: `1px solid ${BRAND.colors.border}` }}>
            <Space size={0}>
              {[
                { key: 'all', label: '全部台账' },
                { key: 'lesson', label: '作业批改台账' },
                { key: 'insight', label: '学情诊断台账' },
                { key: 'classroom', label: '课堂记录台账' },
                { key: 'qa', label: '答疑台账' },
              ].map(tab => (
                <div
                  key={tab.key}
                  onClick={() => setLedgerTab(tab.key)}
                  style={{
                    padding: '8px 18px',
                    cursor: 'pointer',
                    borderRadius: '8px 8px 0 0',
                    background: ledgerTab === tab.key ? BRAND.colors.primaryGradient : 'transparent',
                    color: ledgerTab === tab.key ? '#fff' : BRAND.colors.textSecondary,
                    fontWeight: ledgerTab === tab.key ? 600 : 400,
                    fontSize: 13,
                    transition: 'all 0.3s',
                    border: 'none',
                    position: 'relative',
                  }}
                >
                  <Space size={6}>
                    <BrandBadge size={10} color={ledgerTab === tab.key ? '#fff' : BRAND.colors.textSecondary} />
                    <span>{tab.label}</span>
                  </Space>
                </div>
              ))}
            </Space>
          </div>

          {/* 操作按钮区 */}
          <Space style={{ marginBottom: 12 }}>
            <Button
              icon={<DownloadOutlined />}
              style={{
                borderRadius: 8, border: 'none',
                background: BRAND.colors.primaryGradient,
                color: '#fff',
                boxShadow: `0 2px 8px ${BRAND.colors.primary}30`,
              }}
              className="brand-card"
            >
              批量导出
            </Button>
            <Button
              icon={<CheckCircleOutlined />}
              style={{ borderRadius: 8, borderColor: BRAND.colors.green, color: BRAND.colors.green }}
            >
              批量归档
            </Button>
            <Button
              icon={<FileTextOutlined />}
              style={{ borderRadius: 8, borderColor: BRAND.colors.border, color: BRAND.colors.textSecondary }}
            >
              打印台账
            </Button>
          </Space>

          {/* 台账表格 */}
          {recordsLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>加载台账记录...</Text>
            </div>
          ) : pagedRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <span
                dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }}
                style={{ width: 60, height: 60, display: 'inline-block', opacity: 0.4 }}
              />
              <Paragraph style={{ marginTop: 12, color: BRAND.colors.textTertiary, fontSize: 13 }}>
                暂无教学台账记录，完成作业批改/学情分析自动生成台账
              </Paragraph>
              {canGenerate ? (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  style={{
                    borderRadius: 8, border: 'none',
                    background: BRAND.colors.primaryGradient,
                  }}
                  onClick={() => document.querySelector('.ant-form')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  去生成第一条教案
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<KeyOutlined />}
                  style={{
                    borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #FF9F43, #FF6B6B)',
                  }}
                  onClick={guard.goToSettings}
                >
                  先配置 API Key
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table
                dataSource={pagedRecords}
                columns={columns}
                rowKey="id"
                pagination={false}
                size="middle"
                className="table-header-brand"
                style={{ borderRadius: 8, overflow: 'hidden' }}
                rowClassName={() => 'brand-table-row'}
                onRow={record => ({
                  style: { cursor: 'pointer', transition: 'all 0.2s' },
                  onClick: () => setPlan(record),
                })}
              />
              <div style={{ textAlign: 'right', marginTop: 16 }}>
                <Pagination
                  current={page}
                  total={totalRecords}
                  pageSize={pageSize}
                  onChange={setPage}
                  showSizeChanger={false}
                  showTotal={total => `共 ${total} 条记录`}
                  style={{ fontSize: 12 }}
                />
              </div>
            </>
          )}
        </Card>

        {/* 品牌水印 */}
        <div className="brand-watermark" style={{ position: 'fixed', bottom: 8, right: 12 }}>
          Edu-TA 教学数据台账 · 可追溯存档
        </div>

        {/* ── API Key 拦截弹窗 ── */}
        <ApiKeyGuardModal
          visible={guard.modalVisible}
          onClose={guard.hideGuard}
          onGoSettings={guard.goToSettings}
        />

        {/* ── 设置弹窗（配置 API Key） ── */}
        <SettingsModal
          open={guard.settingsVisible}
          onClose={() => guard.setSettingsVisible(false)}
        />
      </div>
    </div>
  );
};

export default LessonPlanning;
