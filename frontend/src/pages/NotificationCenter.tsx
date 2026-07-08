/**
 * 消息通知 — Edu-TA 智教星 全系统统一消息中枢
 *
 * 功能：五类消息聚合/未读标记/一键已读/消息溯源/批量操作
 * 联动：作业/批改/学情/系统全模块自动推送
 * 无AI操作，永久开放
 */

import React, { useState, useMemo } from 'react';
import { Card, Typography, Space, List, Tag, Avatar, Row, Col, Statistic, Tabs, Badge, Button, message, Tooltip, Select, Input, Popconfirm, Checkbox, Divider } from 'antd';
import {
  NotificationOutlined, BellOutlined, CheckCircleOutlined, WarningOutlined,
  InfoCircleOutlined, CheckOutlined, DeleteOutlined, SearchOutlined,
  ClockCircleOutlined, EyeOutlined, HomeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { BRAND } from '../utils/brand';
import './../styles/brand.css';

const { Text } = Typography;

const BrandBadge: React.FC<{ size?: number; color?: string }> = ({ size = 14, color }) => (
  <span dangerouslySetInnerHTML={{ __html: BRAND.badgeSvg.replace('currentColor', color || BRAND.colors.primary) }}
    style={{ width: size, height: size, display: 'inline-flex', verticalAlign: 'middle' }} />
);

interface NotificationItem {
  id: string; type: string; title: string; desc: string; time: string;
  timeRaw: string; color: string; icon: React.ReactNode; unread: boolean; route?: string;
}

const typeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  '作业': { label: '作业', color: BRAND.colors.primary, icon: <BellOutlined /> },
  '批改': { label: '批改', color: BRAND.colors.green, icon: <CheckCircleOutlined /> },
  '预警': { label: '预警', color: BRAND.colors.error, icon: <WarningOutlined /> },
  '系统': { label: '系统', color: BRAND.colors.purple, icon: <InfoCircleOutlined /> },
};

const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { id: '1', type: '作业', title: '机器学习 · KNN算法作业提交提醒', desc: '已有 42/62 名学生提交，截止今日 18:00', time: '2 小时前', timeRaw: '2026-07-06T16:00:00', color: BRAND.colors.primary, icon: <BellOutlined />, unread: true, route: '/homework' },
    { id: '2', type: '批改', title: '深度学习 · CNN实验报告批改完成', desc: 'AI 已批改 28 份，请登录查看批改报告', time: '3 小时前', timeRaw: '2026-07-06T15:00:00', color: BRAND.colors.green, icon: <CheckCircleOutlined />, unread: true, route: '/homework' },
    { id: '3', type: '预警', title: '学情预警：NLP 课程成绩下滑', desc: '3 名学生连续两次成绩下降超过 15%', time: '昨天', timeRaw: '2026-07-05T10:00:00', color: BRAND.colors.error, icon: <WarningOutlined />, unread: true, route: '/insight' },
    { id: '4', type: '系统', title: 'LLM 服务配置提醒', desc: '请检查 API Key 是否有效，以免影响批改功能', time: '昨天', timeRaw: '2026-07-05T09:00:00', color: BRAND.colors.orange, icon: <InfoCircleOutlined />, unread: false },
    { id: '5', type: '作业', title: '计算机视觉 · 期末试卷已导入', desc: '56 份试卷已就绪，可开始 AI 批改', time: '2 天前', timeRaw: '2026-07-04T14:00:00', color: BRAND.colors.primary, icon: <BellOutlined />, unread: false, route: '/homework' },
    { id: '6', type: '系统', title: '系统版本更新 v2.0', desc: '新增智教星品牌、API Key 守卫、教学台账', time: '3 天前', timeRaw: '2026-07-03T11:00:00', color: BRAND.colors.purple, icon: <InfoCircleOutlined />, unread: false },
    { id: '7', type: '预警', title: '数据结构 · 2班 成绩临界预警', desc: '赵六、孙七最新成绩处于及格边缘（55-65分）', time: '3 天前', timeRaw: '2026-07-03T09:00:00', color: BRAND.colors.error, icon: <WarningOutlined />, unread: false, route: '/insight' },
    { id: '8', type: '作业', title: '自然语言处理 · 作业截止提醒', desc: 'Transformer模型作业将于明日 18:00 截止提交', time: '5 天前', timeRaw: '2026-07-01T10:00:00', color: BRAND.colors.primary, icon: <BellOutlined />, unread: false, route: '/homework' },
  ]);

  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const unreadCount = notifications.filter(n => n.unread).length;
  const todayCount = notifications.filter(n => n.time.includes('小时前') || n.time.includes('分钟前')).length;
  const typeCounts: Record<string, number> = {};
  notifications.forEach(n => { typeCounts[n.type] = (typeCounts[n.type] || 0) + 1; });

  const markAllAsRead = () => { setNotifications(prev => prev.map(n => ({ ...n, unread: false }))); setSelectedIds([]); message.success('已全部标记为已读'); };
  const markAsRead = (id: string) => { setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n)); };
  const deleteItem = (id: string) => { setNotifications(prev => prev.filter(n => n.id !== id)); message.success('已删除'); };
  const batchMarkRead = () => { setNotifications(prev => prev.map(n => selectedIds.includes(n.id) ? { ...n, unread: false } : n)); setSelectedIds([]); message.success(`已标记 ${selectedIds.length} 条为已读`); };
  const batchDelete = () => { setNotifications(prev => prev.filter(n => !selectedIds.includes(n.id))); setSelectedIds([]); message.success(`已删除 ${selectedIds.length} 条`); };

  const filtered = useMemo(() => {
    let data = notifications;
    if (activeTab === 'unread') data = data.filter(n => n.unread);
    else if (activeTab === 'homework') data = data.filter(n => n.type === '作业' || n.type === '批改');
    else if (activeTab === 'warning') data = data.filter(n => n.type === '预警');
    else if (activeTab === 'system') data = data.filter(n => n.type === '系统');
    if (searchText) data = data.filter(n => n.title.includes(searchText) || n.desc.includes(searchText));
    if (timeFilter === 'today') data = data.filter(n => n.time.includes('小时前') || n.time.includes('分钟前'));
    else if (timeFilter === 'week') data = data.filter(n => n.time.includes('小时前') || n.time.includes('分钟前') || n.time.includes('昨天'));
    else if (timeFilter === 'month') data = data;
    return data;
  }, [notifications, activeTab, searchText, timeFilter]);

  const handleViewDetail = (item: NotificationItem) => {
    if (item.unread) markAsRead(item.id);
    if (item.route) navigate(item.route);
    else message.info(item.desc);
  };

  const typeTagColor = (t: string) => {
    const map: Record<string, string> = { '作业': 'blue', '批改': 'green', '预警': 'red', '系统': 'purple' };
    return map[t] || 'default';
  };

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 16 }}>
        <Space align="center" size={10}>
          <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 32, height: 32, display: 'inline-flex', animation: 'logoPulse 0.8s ease-out' }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: BRAND.colors.textPrimary }}>智教星 · 消息通知</div>
            <Text type="secondary" style={{ fontSize: 11 }}>全系统消息中枢 · 实时推送 · 一键溯源</Text>
          </div>
        </Space>
      </div>

      {/* 统计卡 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { value: unreadCount, label: '未读消息', icon: <BellOutlined />, color: unreadCount > 0 ? BRAND.colors.error : BRAND.colors.primary, tip: `作业:${notifications.filter(n=>n.unread&&(n.type==='作业'||n.type==='批改')).length} 预警:${notifications.filter(n=>n.unread&&n.type==='预警').length} 系统:${notifications.filter(n=>n.unread&&n.type==='系统').length}` },
          { value: todayCount, label: '今日通知', icon: <NotificationOutlined />, color: BRAND.colors.green, tip: `今日共 ${todayCount} 条新通知` },
          { value: notifications.length, label: '总提醒数', icon: <InfoCircleOutlined />, color: BRAND.colors.primary, tip: `终身累计 ${notifications.length} 条消息` },
        ].map((item, i) => (
          <Col span={8} key={i}>
            <Tooltip title={item.tip}>
              <Card hoverable className="brand-card" bodyStyle={{ padding: '14px 18px', position: 'relative' }}
                onClick={() => { setActiveTab('all'); message.info(`共 ${item.value} 条通知`); }}>
                <span style={{ position: 'absolute', top: 6, right: 8, color: item.color, opacity: 0.3 }}><BrandBadge /></span>
                {i === 0 && unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: 4, left: 4, width: 8, height: 8, borderRadius: '50%', background: BRAND.colors.error, boxShadow: `0 0 6px ${BRAND.colors.error}` }} />
                )}
                <Statistic title={<Text style={{ fontSize: 12, color: BRAND.colors.textSecondary }}>{item.label}</Text>}
                  value={item.value} suffix={<Text style={{ fontSize: 12, color: BRAND.colors.textTertiary }}>条</Text>}
                  prefix={React.cloneElement(item.icon as any, { style: { color: item.color, fontSize: 18 } })}
                  valueStyle={{ fontSize: 26, fontWeight: 700, color: item.value > 0 && i === 0 ? BRAND.colors.error : BRAND.colors.textPrimary }} />
              </Card>
            </Tooltip>
          </Col>
        ))}
      </Row>

      {/* 消息列表 */}
      <Card className="brand-card" bodyStyle={{ padding: '12px 16px' }}
        title={<Space><BrandBadge /><NotificationOutlined style={{ color: BRAND.colors.primary }} /><Text strong>消息通知</Text></Space>}
        extra={
          <Space size={8}>
            <Input placeholder="搜索通知..." prefix={<SearchOutlined />} style={{ width: 160, borderRadius: 6 }} value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
            <Select style={{ width: 120, borderRadius: 6 }} value={timeFilter} onChange={setTimeFilter}
              options={[{ value: 'all', label: '全部时间' }, { value: 'today', label: '今日' }, { value: 'week', label: '近7天' }, { value: 'month', label: '近30天' }]} />
            {unreadCount > 0 && <Button type="primary" size="small" icon={<CheckOutlined />} onClick={markAllAsRead}
              style={{ borderRadius: 6, border: 'none', background: BRAND.colors.primaryGradient }}>全部已读</Button>}
          </Space>
        }>
        <Tabs activeKey={activeTab} onChange={v => { setActiveTab(v); setSelectedIds([]); }}
          items={[
            { key: 'all', label: `全部(${notifications.length})` },
            { key: 'unread', label: `未读(${unreadCount})` },
            { key: 'homework', label: '作业' },
            { key: 'warning', label: '预警' },
            { key: 'system', label: '系统' },
          ]} />

        {/* 批量操作栏 */}
        {selectedIds.length > 0 && (
          <div style={{ marginBottom: 8, padding: '6px 12px', background: `${BRAND.colors.primary}08`, borderRadius: 6 }}>
            <Space>
              <Checkbox checked={selectedIds.length === filtered.length} onChange={e => {
                if (e.target.checked) setSelectedIds(filtered.map(n => n.id));
                else setSelectedIds([]);
              }}>全选</Checkbox>
              <Text style={{ fontSize: 12 }}>已选 {selectedIds.length} 条</Text>
              <Button size="small" icon={<CheckOutlined />} onClick={batchMarkRead} style={{ borderRadius: 6, borderColor: BRAND.colors.primary, color: BRAND.colors.primary }}>标记已读</Button>
              <Popconfirm title={`删除 ${selectedIds.length} 条通知？`} onConfirm={batchDelete}>
                <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }}>删除</Button>
              </Popconfirm>
            </Space>
          </div>
        )}

        <List dataSource={filtered} renderItem={item => {
          const tc = typeConfig[item.type] || typeConfig['系统'];
          return (
            <List.Item
              style={{
                padding: '10px 12px', borderRadius: 8, marginBottom: 2,
                background: item.unread ? `${BRAND.colors.primary}04` : 'transparent',
                borderLeft: item.unread ? `3px solid ${BRAND.colors.primary}` : '3px solid transparent',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${BRAND.colors.primary}08`; }}
              onMouseLeave={e => { e.currentTarget.style.background = item.unread ? `${BRAND.colors.primary}04` : 'transparent'; }}
              actions={[
                <Tooltip title="查看详情" key="view">
                  <Button type="link" size="small" icon={<EyeOutlined />} style={{ fontSize: 11, color: BRAND.colors.primary }}
                    onClick={() => handleViewDetail(item)}>详情</Button>
                </Tooltip>,
                <Popconfirm title="删除此通知？" onConfirm={() => deleteItem(item.id)} key="del">
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 11 }} />
                </Popconfirm>,
              ]}
            >
              <Checkbox style={{ marginRight: 8 }}
                checked={selectedIds.includes(item.id)}
                onChange={e => {
                  if (e.target.checked) setSelectedIds([...selectedIds, item.id]);
                  else setSelectedIds(selectedIds.filter(id => id !== item.id));
                }} />
              <Badge dot={item.unread} color={BRAND.colors.primary} offset={[-2, 2]}>
                <Avatar icon={tc.icon} style={{ backgroundColor: tc.color, flexShrink: 0 }} />
              </Badge>
              <div style={{ flex: 1, marginLeft: 10 }}>
                <Space>
                  <Text strong={item.unread} style={{ fontSize: 13, color: BRAND.colors.textPrimary }}>{item.title}</Text>
                  <Tag color={typeTagColor(item.type)} style={{ borderRadius: 6, fontSize: 9, lineHeight: '18px' }}>{item.type}</Tag>
                </Space>
                <div style={{ fontSize: 12, color: BRAND.colors.textSecondary, marginTop: 1 }}>{item.desc}</div>
                <Text type="secondary" style={{ fontSize: 10 }}>{item.time}</Text>
              </div>
            </List.Item>
          );
        }} />
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: BRAND.colors.textTertiary }}>
            <BellOutlined style={{ fontSize: 40, color: BRAND.colors.textTertiary, opacity: 0.3 }} />
            <div style={{ marginTop: 8, fontSize: 13 }}>暂无符合条件的通知</div>
          </div>
        )}
      </Card>

      <div className="brand-watermark">Edu-TA 消息通知 · 实时推送</div>
    </div>
  );
};

export default NotificationCenter;
