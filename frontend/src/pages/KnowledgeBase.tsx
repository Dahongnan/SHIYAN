/**
 * 智能答疑管理 — Edu-TA 智教星 RAG 知识库
 *
 * 左侧：知识库状态 + 导入教材 + 检索答疑
 * 右侧：AI答疑对话区 + 检索结果
 * 底部：文档管理列表
 * AI答疑受API Key守卫保护
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Card, Form, Input, Button, Spin, Alert, Typography, Tag, Space, Row, Col,
  List, Upload, Statistic, message, Divider, Empty, Modal, Progress, Select,
  Table, Tooltip, Popconfirm, Collapse,
} from 'antd';
import {
  DatabaseOutlined, SearchOutlined, UploadOutlined, FileTextOutlined,
  DeleteOutlined, ThunderboltOutlined, ReloadOutlined, KeyOutlined,
  RobotOutlined, DownloadOutlined, HistoryOutlined, BookOutlined,
  LinkOutlined, InboxOutlined, FilePdfOutlined, FileWordOutlined,
  ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import { knowledgeApi } from '../api/client';
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

const courseOptions = [
  { value: '机器学习', label: '机器学习' }, { value: '深度学习', label: '深度学习' },
  { value: '自然语言处理', label: '自然语言处理' }, { value: '计算机视觉', label: '计算机视觉' },
];

// ── 模拟文档列表 ──
interface DocItem {
  id: string; name: string; course: string; chapter: string; chunks: number; created_at: string; size: string;
}
const mockDocs: DocItem[] = [
  { id: '1', name: '机器学习_吴恩达_完整笔记.pdf', course: '机器学习', chapter: '全书', chunks: 156, created_at: '2026-06-01', size: '8.6 MB' },
  { id: '2', name: '深度学习_花书_核心章节.pdf', course: '深度学习', chapter: '全书', chunks: 98, created_at: '2026-06-05', size: '15.2 MB' },
  { id: '3', name: 'NLP_实验指导书.docx', course: '自然语言处理', chapter: '实验', chunks: 24, created_at: '2026-06-10', size: '912 KB' },
  { id: '4', name: '计算机视觉_目标检测.pdf', course: '计算机视觉', chapter: '目标检测', chunks: 72, created_at: '2026-06-15', size: '6.8 MB' },
];

const KnowledgeBase: React.FC = () => {
  const [searchForm] = Form.useForm();
  const [uploadForm] = Form.useForm();
  const [qaForm] = Form.useForm();

  const guard = useApiKeyGuard();
  const canGenerate = guard.hasKey;

  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState('');

  const [status, setStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadLog, setUploadLog] = useState<string[]>([]);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaResult, setQaResult] = useState<any>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const loadStatus = () => {
    setStatusLoading(true); setStatusError('');
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => { setStatusLoading(false); setStatusError('后端服务响应超时'); setStatus(null); }, 35000);
    knowledgeApi.status().then(res => {
      clearTimeout(statusTimerRef.current);
      if (res.data?.success) { setStatus(res.data.data); setStatusError(''); }
      else { setStatusError(res.data?.message || '获取状态失败'); setStatus(null); }
    }).catch((e) => {
      clearTimeout(statusTimerRef.current);
      setStatusError(e.response?.data?.detail || e.message || '无法连接后端服务');
      setStatus(null);
    }).finally(() => setStatusLoading(false));
  };

  useEffect(() => { loadStatus(); return () => { if (statusTimerRef.current) clearTimeout(statusTimerRef.current); }; }, []);

  const handleSearch = async (values: any) => {
    if (!values.query?.trim()) { message.warning('请输入搜索内容'); return; }
    setSearching(true); setSearchError('');
    try {
      const res = await knowledgeApi.search(values.query, values.course || '', values.top_k || 5);
      if (res.data.success) setSearchResults(res.data.data.results || []);
      else setSearchError(res.data.message || '搜索失败');
    } catch (e: any) { setSearchError(e.response?.data?.detail || '请求失败'); }
    finally { setSearching(false); }
  };

  const handleUpload = async (file: File) => {
    const course = uploadForm.getFieldValue('course') || 'default';
    const chapter = uploadForm.getFieldValue('chapter') || '';
    setUploading(true); setUploadModal(true); setUploadLog([`开始导入: ${file.name}`]);
    try {
      const res = await knowledgeApi.upload(file, course, chapter);
      if (res.data.success) {
        setUploadLog(prev => [...prev, `✅ 导入成功: ${file.name}`]);
        message.success(res.data.message || '上传成功'); loadStatus();
      } else {
        setUploadLog(prev => [...prev, `❌ 导入失败: ${res.data.message || '未知错误'}`]);
        message.error(res.data.message || '上传失败');
      }
    } catch (e: any) {
      setUploadLog(prev => [...prev, `❌ 导入失败: ${e.response?.data?.detail || e.message}`]);
      message.error(e.response?.data?.detail || '上传失败');
    } finally { setUploading(false); uploadForm.resetFields(); }
    return false;
  };

  // ── AI 答疑 ──
  const handleQA = async (values: any) => {
    if (!canGenerate) { guard.showGuard(); return; }
    if (!values.question?.trim()) { message.warning('请输入问题'); return; }
    setQaLoading(true); setQaResult(null);
    try {
      // 先检索知识库
      const searchRes = await knowledgeApi.search(values.question, values.course || '', 8);
      const contexts = searchRes.data?.data?.results || [];
      setSearchResults(contexts);
      // 模拟AI答疑结果（实际应调用LLM）
      setQaResult({
        definition: `${values.question} 是计算机科学中的重要概念。根据教材定义：...`,
        layered: { basic: '通俗解释...', advanced: '专业推导...' },
        confusion: [{ concept: '概念A', contrast: '区别说明' }],
        teaching_tips: '讲解话术建议...',
        examples: [{ question: '例题', answer: '解答' }],
      });
      message.success('AI 答疑生成完成');
    } catch (e: any) { message.error(e.response?.data?.detail || '请求失败'); }
    finally { setQaLoading(false); }
  };

  const [selectedCourse, setSelectedCourse] = useState<string>('');

  return (
    <div className="page-enter" style={{ position: 'relative' }}>
      {!canGenerate && <ApiKeyBanner onGoSettings={guard.goToSettings} />}

      <div style={{ marginBottom: 16 }}>
        <Space align="center" size={10}>
          <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }}
            style={{ width: 32, height: 32, display: 'inline-flex', animation: 'logoPulse 0.8s ease-out' }} />
          <div>
            <Title level={4} style={{ margin: 0, fontSize: 17, fontWeight: 700, color: BRAND.colors.textPrimary }}>
              智教星 · 智能答疑管理
            </Title>
            <Text type="secondary" style={{ fontSize: 11 }}>RAG 教材知识库 · AI 溯源答疑</Text>
          </div>
        </Space>
      </div>

      <Row gutter={16}>
        {/* ════════════════════════════════════════ */}
        {/* 左侧面板 */}
        {/* ════════════════════════════════════════ */}
        <Col xs={24} lg={9}>
          {/* 知识库状态 */}
          <Card className="brand-card" style={{ marginBottom: 16 }}
            title={<Space><BrandBadge /><DatabaseOutlined style={{ color: BRAND.colors.primary }} /><Text strong>知识库状态</Text></Space>}
            extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadStatus} loading={statusLoading} style={{ borderRadius: 6 }}>刷新</Button>}>
            {statusLoading ? <Spin><div style={{ padding: 24 }} /></Spin> : statusError ? (
              <div style={{ textAlign: 'center', padding: 16 }}><Text type="danger" style={{ fontSize: 12 }}>{statusError}</Text><br /><Button type="link" size="small" onClick={loadStatus} style={{ marginTop: 4 }}>重试</Button></div>
            ) : (
              <div>
                <Row gutter={[8, 8]}>
                  <Col span={12}><Card size="small" className="brand-card" bodyStyle={{ padding: '10px 14px' }}>
                    <Statistic title="文档总数" value={status?.total_documents || 0} suffix="份" valueStyle={{ fontSize: 20, fontWeight: 700, color: BRAND.colors.primary }} /></Card></Col>
                  <Col span={12}><Card size="small" className="brand-card" bodyStyle={{ padding: '10px 14px' }}>
                    <Statistic title="向量切片" value={status?.total_chunks || 0} suffix="段" valueStyle={{ fontSize: 20, fontWeight: 700, color: BRAND.colors.purple }} /></Card></Col>
                  <Col span={12}><Card size="small" className="brand-card" bodyStyle={{ padding: '10px 14px' }}>
                    <Statistic title="关联课程" value={status?.courses?.length || 0} suffix="门" valueStyle={{ fontSize: 20, fontWeight: 700, color: BRAND.colors.green }} /></Card></Col>
                  <Col span={12}><Card size="small" className="brand-card" bodyStyle={{ padding: '10px 14px' }}>
                    <Statistic title="存储占用" value={status?.storage || '—'} valueStyle={{ fontSize: 18, fontWeight: 700, color: BRAND.colors.orange }} /></Card></Col>
                </Row>
                {status?.courses?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 11, color: BRAND.colors.textSecondary }}>已有课程：</Text>
                    <Space wrap style={{ marginTop: 2 }}>{status.courses.map((c: string, i: number) => <Tag key={i} style={{ borderRadius: 6, fontSize: 10 }}>{c}</Tag>)}</Space>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* 导入教材 */}
          <Card className="brand-card" style={{ marginBottom: 16 }}
            title={<Space><BrandBadge color={BRAND.colors.green} /><UploadOutlined style={{ color: BRAND.colors.green }} /><Text strong>导入教材</Text></Space>}>
            <Form form={uploadForm} layout="vertical" size="small">
              <Form.Item name="course" label="所属课程" rules={[{ required: true, message: '请选择课程' }]}>
                <Select style={{ borderRadius: 8 }} placeholder="选择课程" options={courseOptions} />
              </Form.Item>
              <Form.Item name="chapter" label="章节（可选）">
                <Input placeholder="例：第三章 决策树" style={{ borderRadius: 8 }} />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Upload.Dragger accept=".pdf,.txt,.docx,.doc" beforeUpload={handleUpload} showUploadList={false} disabled={uploading} style={{ borderRadius: 8 }}>
                  {uploading ? <Spin tip="导入中..." /> : <div style={{ padding: 16 }}><InboxOutlined style={{ fontSize: 32, color: BRAND.colors.primary }} /><Paragraph style={{ marginTop: 4, marginBottom: 0, fontSize: 12 }}>点击或拖拽文件</Paragraph><Text type="secondary" style={{ fontSize: 11 }}>PDF / Word / TXT</Text></div>}
                </Upload.Dragger>
              </Form.Item>
            </Form>
          </Card>

          {/* 语义检索 */}
          <Card className="brand-card" style={{ marginBottom: 16 }}
            title={<Space><BrandBadge /><SearchOutlined style={{ color: BRAND.colors.primary }} /><Text strong>知识库检索</Text></Space>}>
            <Form form={searchForm} layout="vertical" onFinish={handleSearch} size="small">
              <Form.Item name="course" label="限定课程">
                <Select style={{ borderRadius: 8 }} placeholder="所有课程" allowClear options={courseOptions} onChange={v => setSelectedCourse(v || '')} />
              </Form.Item>
              <Form.Item name="query" label="搜索内容" rules={[{ required: true, message: '请输入搜索内容' }]}>
                <TextArea rows={2} placeholder="输入知识点/关键词..." style={{ borderRadius: 8, resize: 'none' }} />
              </Form.Item>
              <Form.Item name="top_k" label="返回数量" initialValue={5} hidden><Input /></Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={searching} icon={<SearchOutlined />} block
                  style={{ borderRadius: 8, border: 'none', background: BRAND.colors.primaryGradient }}>
                  {searching ? '检索中...' : '语义检索'}
                </Button>
              </Form.Item>
            </Form>
            {searchError && <Alert message={searchError} type="error" showIcon style={{ marginTop: 8, borderRadius: 6, fontSize: 12 }} />}
          </Card>

          {/* AI 答疑 */}
          <Card className="brand-card"
            title={<Space><BrandBadge color={BRAND.colors.purple} /><RobotOutlined style={{ color: BRAND.colors.purple }} /><Text strong>AI 智能答疑</Text></Space>}>
            <Form form={qaForm} layout="vertical" onFinish={handleQA} size="small">
              <Form.Item name="course" label="关联课程">
                <Select style={{ borderRadius: 8 }} placeholder="自动检索全部课程" allowClear options={courseOptions} />
              </Form.Item>
              <Form.Item name="question" label="问题" rules={[{ required: true, message: '请输入问题' }]}>
                <TextArea rows={3} placeholder="输入学生提问、知识点疑问、习题求解..." style={{ borderRadius: 8, resize: 'none' }} />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                {canGenerate ? (
                  <Button type="primary" htmlType="submit" loading={qaLoading} icon={<ThunderboltOutlined />} block
                    style={{ borderRadius: 8, border: 'none', background: BRAND.colors.primaryGradient, height: 38 }}>
                    {qaLoading ? 'AI 生成答疑中...' : 'AI 生成答疑'}
                  </Button>
                ) : (
                  <DisabledAIButton label="AI 答疑已锁定" icon={<KeyOutlined />} />
                )}
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* ════════════════════════════════════════ */}
        {/* 右侧面板 */}
        {/* ════════════════════════════════════════ */}
        <Col xs={24} lg={15}>
          {/* 检索结果 */}
          {searching && (
            <Card className="brand-card" bodyStyle={{ padding: 40, textAlign: 'center' }}>
              <div style={{ animation: 'logoGlow 1.5s ease-in-out infinite' }}>
                <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 40, height: 40, display: 'inline-block' }} /></div>
              <Spin style={{ marginTop: 8 }} /><Paragraph style={{ marginTop: 4, color: BRAND.colors.textSecondary, fontSize: 12 }}>正在检索知识库...</Paragraph>
            </Card>
          )}

          {searchResults.length > 0 && !searching && !qaLoading && (
            <Card className="brand-card" style={{ marginBottom: qaResult ? 16 : 0 }}
              title={<Space><BrandBadge /><SearchOutlined style={{ color: BRAND.colors.primary }} /><Text strong>检索结果（{searchResults.length} 条）</Text></Space>}
              bodyStyle={{ padding: '8px 16px', maxHeight: 400, overflow: 'auto' }}>
              <List size="small" dataSource={searchResults} renderItem={(item: any, idx: number) => (
                <List.Item style={{ padding: '8px 4px', borderBottom: `1px solid ${BRAND.colors.border}` }}
                  extra={<Space size={4}><Tag style={{ borderRadius: 6, fontSize: 10 }}>{(item.score * 100).toFixed(0)}%</Tag><Tag style={{ borderRadius: 6, fontSize: 10 }}>{item.source?.split('/')[0] || '教材'}</Tag></Space>}>
                  <List.Item.Meta title={<Text strong style={{ fontSize: 12 }}>#{idx + 1}</Text>}
                    description={<div><Paragraph ellipsis={{ rows: 2, expandable: true }} style={{ fontSize: 12, marginBottom: 0 }}>{item.content}</Paragraph>
                      {item.metadata?.chapter && <Tag style={{ borderRadius: 6, fontSize: 10, marginTop: 2 }} color="geekblue">{item.metadata.chapter}</Tag>}
                      <Button type="link" size="small" icon={<LinkOutlined />} style={{ fontSize: 10, padding: 0 }}>引用片段</Button>
                    </div>} />
                </List.Item>
              )} />
            </Card>
          )}

          {/* AI 答疑结果 */}
          {qaLoading && (
            <Card className="brand-card" bodyStyle={{ padding: 40, textAlign: 'center' }}>
              <div style={{ animation: 'logoGlow 1.5s ease-in-out infinite' }}>
                <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 48, height: 48, display: 'inline-block' }} /></div>
              <Spin style={{ marginTop: 12 }} /><Paragraph style={{ marginTop: 8, color: BRAND.colors.textSecondary, fontSize: 12 }}>正在检索知识库并生成答疑...</Paragraph>
            </Card>
          )}

          {qaResult && !qaLoading && (
            <Card className="brand-card" bodyStyle={{ padding: '16px 20px', position: 'relative' }}>
              <span style={{ position: 'absolute', top: 8, right: 10, color: BRAND.colors.purple, opacity: 0.3 }}><BrandBadge size={16} color={BRAND.colors.purple} /></span>
              <Space style={{ marginBottom: 12 }}>
                <RobotOutlined style={{ color: BRAND.colors.purple, fontSize: 18 }} />
                <Text strong style={{ fontSize: 14 }}>AI 答疑回答</Text>
                <Tag style={{ borderRadius: 6, background: `${BRAND.colors.green}15`, color: BRAND.colors.green, border: 'none', fontSize: 10 }}>
                  基于教材 RAG 生成
                </Tag>
              </Space>

              {/* 知识点定义 */}
              <Card size="small" title="📖 知识点标准定义" style={{ marginBottom: 8, borderRadius: 8 }} bodyStyle={{ padding: '8px 12px' }}>
                <Paragraph style={{ fontSize: 13 }}>{qaResult.definition}</Paragraph>
                <Tag color="blue" style={{ borderRadius: 6, fontSize: 10 }}>来源：教材 第3章 第2节</Tag>
              </Card>

              {/* 分层讲解 */}
              <Card size="small" title="📚 分层讲解" style={{ marginBottom: 8, borderRadius: 8 }} bodyStyle={{ padding: '8px 12px' }}>
                <Collapse items={[
                  { key: 'basic', label: '🌱 基础通俗解释', children: <Paragraph style={{ margin: 0, fontSize: 13 }}>{qaResult.layered?.basic}</Paragraph> },
                  { key: 'advanced', label: '🔬 专业严谨推导', children: <Paragraph style={{ margin: 0, fontSize: 13, fontFamily: 'monospace' }}>{qaResult.layered?.advanced}</Paragraph> },
                ]} style={{ borderRadius: 8 }} size="small" />
              </Card>

              {/* 易混淆对比 */}
              {qaResult.confusion?.length > 0 && (
                <Card size="small" title="⚖️ 易混淆概念对比" style={{ marginBottom: 8, borderRadius: 8 }} bodyStyle={{ padding: '8px 12px' }}>
                  <List size="small" dataSource={qaResult.confusion} renderItem={(c: any) => (
                    <List.Item><Tag color="volcano" style={{ borderRadius: 6 }}>{c.concept}</Tag><Text style={{ fontSize: 12 }}>{c.contrast}</Text></List.Item>
                  )} />
                </Card>
              )}

              {/* 巩固例题 */}
              {qaResult.examples?.length > 0 && (
                <Card size="small" title="📝 同类巩固例题" style={{ marginBottom: 8, borderRadius: 8 }} bodyStyle={{ padding: '8px 12px' }}>
                  <List size="small" dataSource={qaResult.examples} renderItem={(ex: any, i: number) => (
                    <List.Item><Text style={{ fontSize: 12 }}><Text strong>例题 {i + 1}：</Text>{ex.question}</Text><Tag color="green" style={{ borderRadius: 6, fontSize: 10 }}>答案：{ex.answer}</Tag></List.Item>
                  )} />
                </Card>
              )}

              <Divider style={{ margin: '8px 0' }} />
              <Space>
                <Button icon={<DownloadOutlined />} size="small" style={{ borderRadius: 6, borderColor: BRAND.colors.primary, color: BRAND.colors.primary }}>导出 Word</Button>
                <Button icon={<HistoryOutlined />} size="small" style={{ borderRadius: 6, borderColor: BRAND.colors.purple, color: BRAND.colors.purple }}>归档至台账</Button>
                {canGenerate ? (
                  <Button icon={<ReloadOutlined />} size="small" style={{ borderRadius: 6 }} onClick={() => qaForm.submit()}>重新生成</Button>
                ) : (
                  <Button disabled size="small" style={{ borderRadius: 6 }}>重新生成</Button>
                )}
              </Space>
              <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 10 }}>【本内容由学科垂类AI助教生成，基于教材知识库检索增强】</Text>
            </Card>
          )}

          {/* 空状态 */}
          {!searching && searchResults.length === 0 && !qaResult && !qaLoading && (
            <Card className="brand-card" bodyStyle={{ padding: 60, textAlign: 'center' }}>
              <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 56, height: 56, display: 'inline-block', opacity: 0.3 }} />
              <Paragraph style={{ marginTop: 8, color: BRAND.colors.textTertiary, fontSize: 13 }}>检索知识库或输入问题开始 AI 答疑</Paragraph>
            </Card>
          )}
        </Col>
      </Row>

      {/* ════════════════════════════════════════ */}
      {/* 文档管理列表 */}
      {/* ════════════════════════════════════════ */}
      <Card className="brand-card" style={{ marginTop: 16 }}
        title={<Space><BrandBadge /><FileTextOutlined style={{ color: BRAND.colors.primary }} /><Text strong>知识库文档管理</Text></Space>}
        bodyStyle={{ padding: '12px 16px' }}
        extra={
          <Space>
            <Select style={{ width: 140, borderRadius: 6 }} placeholder="按课程筛选" allowClear options={courseOptions} />
            <Button size="small" icon={<DeleteOutlined />} danger style={{ borderRadius: 6 }}>批量删除</Button>
          </Space>
        }>
        <Table dataSource={mockDocs} rowKey="id" size="small" pagination={{ pageSize: 5 }}
          columns={[
            { title: '文档名称', dataIndex: 'name', key: 'name', ellipsis: true,
              render: (v: string) => <Space><FileTextOutlined style={{ color: BRAND.colors.primary }} /><Text style={{ fontSize: 12 }}>{v}</Text></Space> },
            { title: '课程', dataIndex: 'course', key: 'course', width: 100,
              render: (v: string) => <Tag style={{ borderRadius: 6, fontSize: 10 }}>{v}</Tag> },
            { title: '章节', dataIndex: 'chapter', key: 'chapter', width: 80 },
            { title: '切片数', dataIndex: 'chunks', key: 'chunks', width: 70 },
            { title: '大小', dataIndex: 'size', key: 'size', width: 80 },
            { title: '上传时间', dataIndex: 'created_at', key: 'created_at', width: 100 },
            { title: '操作', key: 'action', width: 180,
              render: () => (
                <Space size={0}>
                  <Button type="link" size="small" style={{ fontSize: 11 }}>预览</Button>
                  <Button type="link" size="small" style={{ fontSize: 11, color: BRAND.colors.green }}>重新切片</Button>
                  <Popconfirm title="确认删除？"><Button type="link" size="small" danger style={{ fontSize: 11 }}>删除</Button></Popconfirm>
                </Space>
              ) },
          ]} />
      </Card>

      {/* 导入进度弹窗 */}
      <Modal title="导入进度" open={uploadModal} onCancel={() => { if (!uploading) setUploadModal(false); }} footer={null} closable={!uploading} width={450}>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {uploading && <Progress percent={50} status="active" />}
          <div style={{ maxHeight: 200, overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 6 }}>
            {uploadLog.map((log, i) => (
              <Text key={i} style={{ display: 'block', fontSize: 11, fontFamily: 'monospace', color: log.includes('✅') ? BRAND.colors.green : log.includes('❌') ? BRAND.colors.error : '#333' }}>
                {log}
              </Text>
            ))}
          </div>
          {!uploading && <Button type="primary" onClick={() => setUploadModal(false)} style={{ borderRadius: 6, background: BRAND.colors.primaryGradient, border: 'none' }}>完成</Button>}
        </Space>
      </Modal>

      {/* 水印 */}
      <div className="brand-watermark">Edu-TA 知识库 · 教材可溯源</div>

      <ApiKeyGuardModal visible={guard.modalVisible} onClose={guard.hideGuard} onGoSettings={guard.goToSettings} />
      <SettingsModal open={guard.settingsVisible} onClose={() => guard.setSettingsVisible(false)} />
    </div>
  );
};

export default KnowledgeBase;
