/**
 * 智能工作台 — Edu-TA 智教星 品牌化首页
 *
 * 品牌视觉特色：
 * - 专属 Logo + 品牌色（深海科技蓝 #0F52BA / 教研紫 #7B61FF）
 * - 代码流暗纹背景、二进制粒子动效
 * - 卡片悬浮发光、数字滚动动画、趋势波纹
 * - 胶囊渐变标签、浮动 AI 机器人
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Row, Col, Card, Statistic, Typography, Space, List, Tag,
  Table, Progress, Avatar, Button, Tooltip,
} from 'antd';
import {
  FileTextOutlined, CheckCircleOutlined, TeamOutlined, ClockCircleOutlined,
  ArrowUpOutlined, ArrowDownOutlined, WarningOutlined, BarChartOutlined,
  BookOutlined, MessageOutlined, RobotOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { knowledgeApi } from '../api/client';
import { BRAND, CARD_SPECS } from '../utils/brand';
import '../styles/brand.css';

const { Title, Paragraph, Text } = Typography;

// ── 品牌角标组件 ─────────────────────────────────────
const BrandBadge: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <span
    dangerouslySetInnerHTML={{ __html: BRAND.badgeSvg.replace('currentColor', BRAND.colors.primary) }}
    style={{ width: size, height: size, display: 'inline-flex', verticalAlign: 'middle' }}
  />
);

// ── 二进制飘落粒子 ────────────────────────────────────
const BinaryParticles: React.FC = () => {
  const particles = useRef(
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 4,
      duration: 3 + Math.random() * 3,
      text: Math.random() > 0.5 ? '01' : '101',
    }))
  );
  return (
    <>
      {particles.current.map(p => (
        <div
          key={p.id}
          className="binary-particle"
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }}
        >
          {p.text}
        </div>
      ))}
    </>
  );
};

// ── 数字滚动组件 ─────────────────────────────────────
const CountUp: React.FC<{ value: number; duration?: number }> = ({ value, duration = 800 }) => {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const counted = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || counted.current) return;
    counted.current = true;

    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, duration]);

  return <span ref={ref} className="count-animate">{display.toLocaleString()}</span>;
};

// ── 主组件 ─────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [kbStatus, setKbStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    knowledgeApi.status()
      .then(res => setKbStatus(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 9) return '早上好';
    if (h >= 9 && h < 12) return '上午好';
    if (h >= 12 && h < 18) return '下午好';
    return '晚上好';
  };

  // ── 快捷功能（带品牌分色） ──
  const quickActions = [
    {
      key: '/homework', title: '作业批改', desc: 'AI 智能批改，一键完成',
      icon: <FileTextOutlined />, gradient: 'linear-gradient(135deg, #0F52BA, #1A6BE0)',
    },
    {
      key: '/insight', title: '学情分析', desc: '多维度数据洞察',
      icon: <BarChartOutlined />, gradient: 'linear-gradient(135deg, #36D399, #5EE8B0)',
    },
    {
      key: '/knowledge', title: '答疑管理', desc: '智能问答台账',
      icon: <MessageOutlined />, gradient: 'linear-gradient(135deg, #7B61FF, #A394FF)',
    },
    {
      key: '/lesson', title: '教学台账', desc: '数据沉淀可追溯',
      icon: <BookOutlined />, gradient: 'linear-gradient(135deg, #FF9F43, #FFB976)',
    },
  ];

  // ── 近期待办 ──
  const pendingItems = [
    { title: '机器学习 · KNN算法作业', submissions: 42, deadline: '今日 18:00', urgent: true },
    { title: '深度学习 · CNN实验报告批改', submissions: 28, deadline: '明日 12:00', urgent: false },
    { title: 'NLP · Transformer模型期中试卷', submissions: 56, deadline: '3天后', urgent: false },
    { title: '计算机视觉 · 课堂练习', submissions: 15, deadline: '已完成80%', urgent: false },
  ];

  // ── 班级成绩 ──
  const classStats = [
    { course: '机器学习', avgScore: 82.5, passRate: 91.2, excellentRate: 28.3, trend: 'up' as const, attention: false },
    { course: '深度学习', avgScore: 78.3, passRate: 85.7, excellentRate: 22.1, trend: 'down' as const, attention: true },
    { course: '自然语言处理', avgScore: 85.1, passRate: 94.5, excellentRate: 35.6, trend: 'up' as const, attention: false },
  ];

  return (
    <div className="page-enter" style={{ position: 'relative' }}>
      <BinaryParticles />

      {/* ════════════════════════════════════════════ */}
      {/* 顶部欢迎横幅 — 蓝紫渐变流体 + 浮动机器人  */}
      {/* ════════════════════════════════════════════ */}
      <Card className="banner-fluid" style={{ marginBottom: 24, borderRadius: CARD_SPECS.borderRadius, border: 'none' }} bodyStyle={{ padding: '24px 28px' }}>
        <Row align="middle" gutter={24}>
          <Col flex="auto">
            <Space align="center" size={12}>
              <span
                dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }}
                style={{ width: 42, height: 42, display: 'inline-flex', flexShrink: 0 }}
              />
              <div>
                <Title level={3} style={{ color: '#fff', margin: 0, fontSize: 22, fontWeight: 700 }}>
                  👋 {getGreeting()}，欢迎使用 <span style={{ background: 'rgba(255,255,255,0.15)', padding: '0 8px', borderRadius: 4 }}>Edu-TA 智教星</span>
                </Title>
                <Paragraph style={{ color: 'rgba(255,255,255,0.85)', marginTop: 6, marginBottom: 10, fontSize: 14, maxWidth: 580 }}>
                  今日有 <Text strong style={{ color: '#fff' }}>3 项待办任务</Text> 需要处理，
                  共 <Text strong style={{ color: '#fff' }}>126 份</Text> 作业待批改。
                  AI 智能批改可为您节省约 80% 的时间。
                </Paragraph>
                <Space>
                  <Tag color="volcano" style={{ borderRadius: 12, padding: '0 12px', lineHeight: '22px' }} className="tag-glow">
                    🔥 高峰期：3门课程作业待批
                  </Tag>
                  <Tag color="lime" style={{ borderRadius: 12, padding: '0 12px', lineHeight: '22px' }}>
                    📊 学情报告已更新
                  </Tag>
                </Space>
              </div>
            </Space>
          </Col>
          <Col>
            <div className="float-bot">
              <RobotOutlined style={{ fontSize: 72, color: 'rgba(255,255,255,0.2)' }} />
            </div>
          </Col>
        </Row>
      </Card>

      {/* ════════════════════════════════════════════ */}
      {/* 核心指标行 — 4张数据卡片（带品牌角标）    */}
      {/* ════════════════════════════════════════════ */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { value: 126, title: '待批改作业', icon: <FileTextOutlined />, color: BRAND.colors.primary, suffix: '↑ 12%', suffixColor: BRAND.colors.green, trend: 'up' as const, path: '/homework' },
          { value: 6, title: '覆盖班级', icon: <TeamOutlined />, color: BRAND.colors.green, suffix: '个', suffixColor: BRAND.colors.textSecondary, trend: 'up' as const, path: '/insight' },
          { value: 1856, title: 'AI 批改次数', icon: <ThunderboltOutlined />, color: BRAND.colors.orange, suffix: '↑ 23%', suffixColor: BRAND.colors.green, trend: 'up' as const, path: '/homework' },
          { value: 89, title: '答疑问题数', icon: <MessageOutlined />, color: BRAND.colors.purple, suffix: '↑ 56', suffixColor: BRAND.colors.orange, trend: 'down' as const, path: '/knowledge' },
        ].map((item, idx) => (
          <Col xs={12} sm={6} key={idx}>
            <Card
              hoverable
              className="brand-card"
              bodyStyle={{ padding: '18px 22px', position: 'relative' }}
              onClick={() => navigate(item.path)}
            >
              {/* 品牌角标 */}
              <span style={{ position: 'absolute', top: 8, right: 10, color: item.color, opacity: 0.5 }}>
                <BrandBadge />
              </span>

              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>{item.title}</Text>}
                valueRender={() => (
                  <Space align="baseline" size={6}>
                    <span style={{ color: item.color, fontSize: 22, verticalAlign: 'middle' }}>
                      {item.icon}
                    </span>
                    <Text style={{ fontSize: 28, fontWeight: 700, color: BRAND.colors.textPrimary }}>
                      <CountUp value={item.value} />
                    </Text>
                    <span className={item.trend === 'up' ? 'ripple-up' : 'ripple-down'} style={{ display: 'inline-flex' }}>
                      <Text style={{ fontSize: 13, color: item.suffixColor, fontWeight: 500 }}>
                        {item.suffix}
                      </Text>
                    </span>
                  </Space>
                )}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* ════════════════════════════════════════════ */}
      {/* 快捷功能 + 近期待办 + 成绩概览            */}
      {/* ════════════════════════════════════════════ */}
      <Row gutter={[16, 16]}>
        {/* ── 快捷功能（渐变分色卡片） ── */}
        <Col xs={24} lg={6}>
          <Card
            className="brand-card"
            title={
              <Space>
                <ThunderboltOutlined style={{ color: BRAND.colors.primary }} />
                <Text strong>快捷功能</Text>
              </Space>
            }
            bodyStyle={{ padding: '16px 20px' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {quickActions.map(item => (
                <Card
                  key={item.key}
                  hoverable
                  size="small"
                  bodyStyle={{ padding: '12px 16px' }}
                  style={{
                    border: 'none',
                    borderRadius: 10,
                    background: item.gradient,
                    cursor: 'pointer',
                    transition: CARD_SPECS.transition,
                  }}
                  className="brand-card"
                  onClick={() => navigate(item.key)}
                >
                  <Space>
                    <Avatar icon={item.icon} style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
                    <div>
                      <Text strong style={{ fontSize: 13, color: '#fff' }}>{item.title}</Text>
                      <br />
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{item.desc}</Text>
                    </div>
                  </Space>
                </Card>
              ))}
            </Space>

            {/* 系统状态 */}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid ' + BRAND.colors.border }}>
              <Text strong style={{ fontSize: 13, color: BRAND.colors.textPrimary }}>系统状态</Text>
              <Row gutter={8} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>知识库文档</Text>
                  <br />
                  <Text strong style={{ color: BRAND.colors.primary }}>{kbStatus?.total_documents || 0}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>知识库切片</Text>
                  <br />
                  <Text strong style={{ color: BRAND.colors.primary }}>{kbStatus?.total_chunks || 0}</Text>
                </Col>
              </Row>
              <Tag color="success" style={{ marginTop: 8, borderRadius: 8 }}>LLM 服务已连接</Tag>
            </div>
          </Card>
        </Col>

        {/* ── 近期待办 ── */}
        <Col xs={24} lg={9}>
          <Card
            className="brand-card"
            title={
              <Space>
                <ClockCircleOutlined style={{ color: BRAND.colors.orange }} />
                <Text strong>近期待办</Text>
              </Space>
            }
            bodyStyle={{ padding: '12px 20px' }}
          >
            <List
              dataSource={pendingItems}
              renderItem={item => (
                <List.Item
                  style={{ cursor: 'pointer', padding: '12px 0', borderBottom: '1px solid ' + BRAND.colors.border }}
                  onClick={() => navigate('/homework')}
                  extra={
                    <Tag
                      color={item.urgent ? 'error' : 'default'}
                      style={{ borderRadius: 10, fontSize: 11 }}
                    >
                      {item.deadline}
                    </Tag>
                  }
                >
                  <div style={{ display: 'flex', alignItems: 'stretch', gap: 12, width: '100%' }}>
                    {/* 紧急标记竖条 */}
                    {item.urgent && <div className="urgent-bar" style={{ minHeight: 40 }} />}

                    <List.Item.Meta
                      avatar={
                        <Avatar
                          icon={<FileTextOutlined />}
                          style={{
                            backgroundColor: item.urgent ? BRAND.colors.error : BRAND.colors.primary,
                            boxShadow: item.urgent ? `0 0 8px ${BRAND.colors.error}40` : 'none',
                          }}
                        />
                      }
                      title={
                        <Space>
                          <Text strong style={{ fontSize: 13, color: BRAND.colors.textPrimary }}>
                            {item.title}
                          </Text>
                          {item.urgent && (
                            <Tag color="error" style={{ borderRadius: 8, fontSize: 10, lineHeight: '18px' }}>
                              紧急
                            </Tag>
                          )}
                        </Space>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.submissions} 份提交
                        </Text>
                      }
                    />
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* ── 班级成绩概览 ── */}
        <Col xs={24} lg={9}>
          <Card
            className="brand-card"
            title={
              <Space>
                <BarChartOutlined style={{ color: BRAND.colors.green }} />
                <Text strong>班级成绩概览</Text>
              </Space>
            }
            bodyStyle={{ padding: '12px 20px' }}
          >
            <Table
              dataSource={classStats}
              pagination={false}
              size="small"
              className="table-header-brand"
              columns={[
                {
                  title: '课程',
                  dataIndex: 'course',
                  key: 'course',
                  render: (v: string) => (
                    <Space>
                      <BookOutlined style={{ color: BRAND.colors.primary }} />
                      <Text strong style={{ color: BRAND.colors.textPrimary }}>{v}</Text>
                    </Space>
                  ),
                },
                {
                  title: '平均分',
                  dataIndex: 'avgScore',
                  key: 'avgScore',
                  render: (v: number) => (
                    <Text strong style={{
                      color: v >= 80 ? BRAND.colors.green : BRAND.colors.orange,
                      fontSize: 15,
                    }}>
                      {v}
                    </Text>
                  ),
                },
                {
                  title: '通过率',
                  dataIndex: 'passRate',
                  key: 'passRate',
                  render: (v: number) => (
                    <Progress
                      percent={v}
                      size="small"
                      strokeColor={v >= 90 ? BRAND.colors.green : BRAND.colors.orange}
                      trailColor="#E8EEF8"
                      style={{ width: 80 }}
                    />
                  ),
                },
                {
                  title: '趋势',
                  dataIndex: 'trend',
                  key: 'trend',
                  render: (t: string) => t === 'up'
                    ? (
                      <Tag color="success" icon={<ArrowUpOutlined />} className="ripple-up" style={{ borderRadius: 8 }}>
                        上升
                      </Tag>
                    )
                    : (
                      <Tag color="error" icon={<ArrowDownOutlined />} className="blink-warning" style={{ borderRadius: 8 }}>
                        下降
                      </Tag>
                    ),
                },
              ]}
            />
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid ' + BRAND.colors.border }}>
              <Space>
                <WarningOutlined style={{ color: BRAND.colors.orange }} />
                <Text type="secondary" style={{ fontSize: 12 }}>需要重点关注：</Text>
                <Tag color="error" style={{ borderRadius: 8 }}>
                  <Space size={4}>
                    <BrandBadge />
                    <span>数据结构 · 2班</span>
                  </Space>
                </Tag>
                <Tag color="warning" style={{ borderRadius: 8 }}>
                  <Space size={4}>
                    <BrandBadge />
                    <span>操作系统 · 1班</span>
                  </Space>
                </Tag>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ════════════════════════════════════════════ */}
      {/* 底部：技术架构 + 品牌水印              */}
      {/* ════════════════════════════════════════════ */}
      <Card
        className="brand-card"
        style={{ marginTop: 24, background: '#FAFBFF' }}
        bodyStyle={{ padding: '14px 22px' }}
      >
        <Row justify="space-between" align="middle">
          <Col>
            <Space wrap>
              <Text type="secondary" style={{ fontSize: 12 }}>技术架构：</Text>
              <Tag style={{ borderRadius: 6 }}>FastAPI</Tag>
              <Tag style={{ borderRadius: 6 }}>React 18</Tag>
              <Tag style={{ borderRadius: 6 }}>Ant Design</Tag>
              <Tag style={{ borderRadius: 6 }}>RAG</Tag>
              <Tag style={{ borderRadius: 6 }}>PyTorch</Tag>
              <Tag style={{ borderRadius: 6, borderColor: BRAND.colors.primary }} color="blue">LLM</Tag>
              <Tag style={{ borderRadius: 6, borderColor: BRAND.colors.purple }} color="purple">AI 课程教学</Tag>
            </Space>
          </Col>
          <Col>
            <Space>
              <BrandBadge />
              <Text type="secondary" style={{ fontSize: 11, color: BRAND.colors.textTertiary }}>
                AI 赋能 AI 教学 · 垂类大模型赛道
              </Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 品牌水印 */}
      <div className="brand-watermark">{BRAND.watermark}</div>
    </div>
  );
};

export default Dashboard;
