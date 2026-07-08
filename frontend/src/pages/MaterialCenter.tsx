/**
 * 资料与题库 — Edu-TA 智教星 教学资料 + AI题库 + 作业发布
 *
 * 功能：PDF上传 → AI出题 → 作业发布 全流程闭环
 * 布局：左（上传+资料列表）右（预览 + 出题 + 发布）
 * AI出题受API Key守卫保护
 */

import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Space, Upload, Button, Select, Input, InputNumber,
  Table, Tag, message, Modal, Tabs, Row, Col, Statistic, List, Avatar, Empty,
  Spin, Alert, Tooltip, Divider, Progress,
} from 'antd';
import {
  UploadOutlined, FilePdfOutlined, RobotOutlined, SendOutlined,
  DeleteOutlined, EyeOutlined, ReloadOutlined, ThunderboltOutlined,
  CheckCircleOutlined, BookOutlined, DownloadOutlined, InboxOutlined,
  PlusOutlined, KeyOutlined, HistoryOutlined,
} from '@ant-design/icons';
import { materialApi } from '../api/client';
import { BRAND, CARD_SPECS } from '../utils/brand';
import { useApiKeyGuard, ApiKeyGuardModal, ApiKeyBanner, DisabledAIButton } from '../utils/apiKeyGuard';
import SettingsModal from '../components/SettingsModal';
import '../styles/brand.css';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const BrandBadge: React.FC<{ size?: number; color?: string }> = ({ size = 14, color }) => (
  <span dangerouslySetInnerHTML={{ __html: BRAND.badgeSvg.replace('currentColor', color || BRAND.colors.primary) }}
    style={{ width: size, height: size, display: 'inline-flex', verticalAlign: 'middle', flexShrink: 0 }} />
);

const courseOptions = [
  { value: '机器学习', label: '机器学习' }, { value: '深度学习', label: '深度学习' },
  { value: '自然语言处理', label: '自然语言处理' }, { value: '计算机视觉', label: '计算机视觉' },
];

const MaterialCenter: React.FC = () => {
  const guard = useApiKeyGuard();
  const canGenerate = guard.hasKey;

  const [materials, setMaterials] = useState<any[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [materialDetail, setMaterialDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [questionCount, setQuestionCount] = useState(5);
  const [questionDifficulty, setQuestionDifficulty] = useState('中等');
  const [questionTypes, setQuestionTypes] = useState<string[]>(['选择题', '填空题', '简答题']);
  const [generating, setGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('generate');

  const [published, setPublished] = useState<any[]>([]);
  const [pubLoading, setPubLoading] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDeadline, setPublishDeadline] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');

  // 上传
  const [uploadCourse, setUploadCourse] = useState('');
  const [uploadChapter, setUploadChapter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadLog, setUploadLog] = useState<string[]>([]);

  const loadMaterials = async () => {
    setMaterialsLoading(true);
    try { const res = await materialApi.list(); if (res.data.success) setMaterials(res.data.data.items || []); }
    catch { /* ignore */ }
    finally { setMaterialsLoading(false); }
  };

  const loadPublished = async () => {
    setPubLoading(true);
    try { const res = await materialApi.listPublished(); if (res.data.success) setPublished(res.data.data.items || []); }
    catch { /* ignore */ }
    finally { setPubLoading(false); }
  };

  useEffect(() => { loadMaterials(); loadPublished(); }, []);

  const handleSelectMaterial = async (item: any) => {
    setSelectedMaterial(item); setDetailLoading(true); setGeneratedQuestions([]);
    try { const res = await materialApi.detail(item.id); if (res.data.success) setMaterialDetail(res.data.data); }
    catch { /* ignore */ }
    finally { setDetailLoading(false); }
  };

  const handleUpload = async (file: File) => {
    if (!uploadCourse) { message.warning('请选择课程'); return false; }
    setUploading(true); setUploadModal(true); setUploadLog([`开始导入: ${file.name}`]);
    try {
      const res = await materialApi.upload(file, uploadCourse, uploadChapter);
      if (res.data.success) { setUploadLog(prev => [...prev, `✅ 导入成功: ${file.name}`]); message.success(res.data.message); loadMaterials(); }
      else setUploadLog(prev => [...prev, `❌ 失败: ${res.data.message}`]);
    } catch (e: any) { setUploadLog(prev => [...prev, `❌ 失败: ${e.response?.data?.detail || e.message}`]); }
    finally { setUploading(false); }
    return false;
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除', content: '删除后资料无法恢复，关联题目保留。',
      onOk: async () => {
        try { const res = await materialApi.delete(id); if (res.data.success) { message.success('已删除'); if (selectedMaterial?.id === id) { setSelectedMaterial(null); setMaterialDetail(null); setGeneratedQuestions([]); } loadMaterials(); } }
        catch { message.error('删除失败'); }
      },
    });
  };

  const handleGenerate = async () => {
    if (!canGenerate) { guard.showGuard(); return; }
    if (!selectedMaterial) { message.warning('请先选择一个教学资料'); return; }
    setGenerating(true); setGeneratedQuestions([]);
    try {
      const res = await materialApi.generateQuestions(selectedMaterial.id, questionCount, questionDifficulty, questionTypes);
      if (res.data.success) { setGeneratedQuestions(res.data.data.questions || []); message.success(res.data.message); }
      else message.error(res.data.message || '出题失败');
    } catch (e: any) { message.error(e.response?.data?.detail || '请求失败'); }
    finally { setGenerating(false); }
  };

  const handlePublish = async () => {
    if (generatedQuestions.length === 0) { message.warning('请先生成题目'); return; }
    const ids = generatedQuestions.map(q => q.id);
    const course = selectedMaterial?.course || '';
    setPublishing(true);
    try {
      const res = await materialApi.publish(ids, course, publishTitle || `${selectedMaterial?.filename}练习题`, publishDeadline);
      if (res.data.success) { message.success(`已发布 ${res.data.data.question_count} 道题`); setPublishModalOpen(false); loadPublished(); }
      else message.error(res.data.message || '发布失败');
    } catch (e: any) { message.error(e.response?.data?.detail || '发布失败'); }
    finally { setPublishing(false); }
  };

  const totalQuestions = published.reduce((s, p) => s + (p.question_count || 0), 0);
  const courseCount = new Set(materials.map(m => m.course)).size;

  return (
    <div className="page-enter" style={{ position: 'relative' }}>
      {!canGenerate && <ApiKeyBanner onGoSettings={guard.goToSettings} />}

      {/* 页面头部 */}
      <div style={{ marginBottom: 16 }}>
        <Space align="center" size={10}>
          <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }}
            style={{ width: 32, height: 32, display: 'inline-flex', animation: 'logoPulse 0.8s ease-out' }} />
          <div>
            <Title level={4} style={{ margin: 0, fontSize: 17, fontWeight: 700, color: BRAND.colors.textPrimary }}>
              智教星 · 资料与题库
            </Title>
            <Text type="secondary" style={{ fontSize: 11 }}>教学资料存储 · AI 习题题库 · 作业发布</Text>
          </div>
        </Space>
      </div>

      {/* 顶部统计 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { value: materials.length, label: '教学资料', icon: <FilePdfOutlined />, color: BRAND.colors.error, suffix: '份', onClick: () => setActiveTab('preview') },
          { value: totalQuestions, label: 'AI 已出题', icon: <RobotOutlined />, color: BRAND.colors.purple, suffix: '道', onClick: () => {} },
          { value: published.length, label: '已发布作业', icon: <SendOutlined />, color: BRAND.colors.primary, suffix: '次', onClick: () => setActiveTab('published') },
          { value: courseCount, label: '覆盖课程', icon: <BookOutlined />, color: BRAND.colors.green, suffix: '门', onClick: () => {} },
        ].map((item, idx) => (
          <Col xs={12} sm={6} key={idx}>
            <Card hoverable className="brand-card" bodyStyle={{ padding: '14px 18px', position: 'relative' }} onClick={item.onClick}>
              <span style={{ position: 'absolute', top: 6, right: 8, color: item.color, opacity: 0.35 }}><BrandBadge size={12} color={item.color} /></span>
              <Statistic title={<Text style={{ fontSize: 12, color: BRAND.colors.textSecondary }}>{item.label}</Text>}
                value={item.value} suffix={<Text style={{ fontSize: 12, color: BRAND.colors.textTertiary }}>{item.suffix}</Text>}
                prefix={<span style={{ color: item.color, fontSize: 18, marginRight: 4 }}>{item.icon}</span>}
                valueStyle={{ fontSize: 24, fontWeight: 700, color: BRAND.colors.textPrimary }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* ── 左侧：资料管理 ── */}
        <Col xs={24} lg={8}>
          {/* 上传 */}
          <Card className="brand-card" style={{ marginBottom: 16 }}
            title={<Space><BrandBadge color={BRAND.colors.green} /><UploadOutlined style={{ color: BRAND.colors.green }} /><Text strong>上传教学资料</Text></Space>}
            bodyStyle={{ padding: '14px 18px' }}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Select style={{ width: '100%', borderRadius: 8 }} placeholder="选择课程（必填）" options={courseOptions} value={uploadCourse || undefined} onChange={v => setUploadCourse(v)} />
              <Input placeholder="章节名称（可选）" style={{ borderRadius: 8 }} value={uploadChapter} onChange={e => setUploadChapter(e.target.value)} />
              <Dragger accept=".pdf,.docx,.doc" beforeUpload={handleUpload} showUploadList={false} style={{ borderRadius: 8, padding: '8px 0' }}>
                {uploading ? <Spin /> : <div><InboxOutlined style={{ fontSize: 28, color: BRAND.colors.primary }} /><Paragraph style={{ marginBottom: 0, fontSize: 12 }}>点击或拖拽 PDF/Word</Paragraph></div>}
              </Dragger>
            </Space>
          </Card>

          {/* 资料列表 */}
          <Card className="brand-card"
            title={<Space><BrandBadge /><FilePdfOutlined style={{ color: BRAND.colors.error }} /><Text strong>教学资料列表</Text></Space>}
            extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadMaterials} style={{ borderRadius: 6 }}>刷新</Button>}>
            {materialsLoading ? <Spin><div style={{ padding: 24 }} /></Spin> : materials.length === 0 ? (
              <Empty description="暂无资料，请上传 PDF" />
            ) : (
              <List size="small" dataSource={materials} renderItem={(item: any) => (
                <List.Item style={{ cursor: 'pointer', background: selectedMaterial?.id === item.id ? `${BRAND.colors.primary}10` : 'transparent', borderRadius: 6, padding: '6px 10px' }}
                  onClick={() => handleSelectMaterial(item)}
                  actions={[<Tooltip title="删除" key="del"><DeleteOutlined style={{ color: BRAND.colors.error }} onClick={e => { e.stopPropagation(); handleDelete(item.id); }} /></Tooltip>]}>
                  <List.Item.Meta avatar={<Avatar icon={<FilePdfOutlined />} style={{ backgroundColor: BRAND.colors.error }} />}
                    title={<Text strong style={{ fontSize: 12 }}>{item.filename}</Text>}
                    description={<Space size={4} style={{ fontSize: 11 }}><Tag style={{ borderRadius: 6, fontSize: 10 }}>{item.course}</Tag><Text type="secondary">{item.size_display}</Text><Text type="secondary">{item.pages || '?'}页</Text></Space>} />
                </List.Item>
              )} />
            )}
          </Card>
        </Col>

        {/* ── 右侧 ── */}
        <Col xs={24} lg={16}>
          {detailLoading ? (
            <Card className="brand-card" bodyStyle={{ padding: 60, textAlign: 'center' }}>
              <div style={{ animation: 'logoGlow 1.5s ease-in-out infinite' }}>
                <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 40, height: 40, display: 'inline-block' }} /></div>
              <Spin style={{ marginTop: 8 }} /><Paragraph style={{ marginTop: 4, color: BRAND.colors.textSecondary, fontSize: 12 }}>加载资料中...</Paragraph>
            </Card>
          ) : selectedMaterial && materialDetail ? (
            <Tabs activeKey={activeTab} onChange={setActiveTab}
              style={{ background: '#fff', borderRadius: 12, padding: '4px 12px', boxShadow: CARD_SPECS.shadow }}
              items={[
                // ═══ 资料预览 ═══
                { key: 'preview', label: <span><EyeOutlined style={{ color: BRAND.colors.primary }} />资料预览</span>,
                  children: (
                    <Card className="brand-card">
                      <Space align="start" style={{ marginBottom: 8 }}>
                        <BrandBadge size={18} /><Title level={5} style={{ margin: 0 }}>{materialDetail.filename}</Title>
                        <Tag color="blue" style={{ borderRadius: 6 }}>{materialDetail.course}</Tag>
                        {materialDetail.chapter && <Tag style={{ borderRadius: 6 }}>{materialDetail.chapter}</Tag>}
                        <Text type="secondary" style={{ fontSize: 11 }}>{materialDetail.size_display} · {materialDetail.pages} 页</Text>
                      </Space>
                      <Divider style={{ margin: '4px 0' }} />
                      <Paragraph style={{ background: '#fafafa', padding: 14, borderRadius: 8, maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.8 }}>
                        {materialDetail.text_preview || '（无可预览文本）'}
                      </Paragraph>
                      {materialDetail.text_content?.length > 500 && (
                        <Button type="link" icon={<EyeOutlined />} onClick={() => { setPreviewContent(materialDetail.text_content); setPreviewModalOpen(true); }}>查看完整内容</Button>
                      )}
                      <Divider style={{ margin: '4px 0' }} />
                      <Space>
                        <Button icon={<DownloadOutlined />} style={{ borderRadius: 6, borderColor: BRAND.colors.primary, color: BRAND.colors.primary }}>下载原文件</Button>
                        <Button icon={<RobotOutlined />} style={{ borderRadius: 6, borderColor: BRAND.colors.purple, color: BRAND.colors.purple }} onClick={() => setActiveTab('generate')}>去出题</Button>
                      </Space>
                    </Card>
                  ) },

                // ═══ AI 出题 ═══
                { key: 'generate', label: <span><RobotOutlined style={{ color: BRAND.colors.purple }} />AI 智能出题</span>,
                  children: (
                    <div>
                      <Card className="brand-card" size="small" style={{ marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
                        <Row gutter={[12, 8]} align="middle">
                          <Col span={6}><Text style={{ fontSize: 11, color: BRAND.colors.textSecondary }}>数量</Text><InputNumber min={1} max={50} value={questionCount} onChange={v => setQuestionCount(v || 5)} style={{ width: '100%', borderRadius: 6 }} /></Col>
                          <Col span={6}><Text style={{ fontSize: 11, color: BRAND.colors.textSecondary }}>难度</Text>
                            <Select value={questionDifficulty} onChange={setQuestionDifficulty} style={{ width: '100%' }} options={[{ value: '基础', label: '基础' }, { value: '提高', label: '提高' }, { value: '综合', label: '综合' }, { value: '前沿', label: '前沿' }]} />
                          </Col>
                          <Col span={12}><Text style={{ fontSize: 11, color: BRAND.colors.textSecondary }}>题型</Text>
                            <Select mode="multiple" value={questionTypes} onChange={setQuestionTypes} style={{ width: '100%' }}
                              options={[{ value: '选择题', label: '选择题' }, { value: '填空题', label: '填空题' }, { value: '简答题', label: '简答题' }, { value: '论述题', label: '论述题' }, { value: '计算题', label: '计算题' }]} />
                          </Col>
                          <Col span={24}>
                            <Space>
                              {canGenerate ? (
                                <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerate} loading={generating}
                                  style={{ borderRadius: 8, border: 'none', background: BRAND.colors.primaryGradient }}>
                                  {generating ? 'AI 出题中...' : '开始生成题目'}
                                </Button>
                              ) : (
                                <DisabledAIButton label="AI 出题已锁定" icon={<KeyOutlined />} />
                              )}
                              <Text type="secondary" style={{ fontSize: 11 }}>基于「{materialDetail.filename}」内容生成</Text>
                            </Space>
                          </Col>
                        </Row>
                      </Card>

                      {generating && (
                        <Card className="brand-card" bodyStyle={{ padding: 40, textAlign: 'center' }}>
                          <div style={{ animation: 'logoGlow 1.5s ease-in-out infinite' }}>
                            <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 48, height: 48, display: 'inline-block' }} /></div>
                          <Spin style={{ marginTop: 12 }} /><Paragraph style={{ marginTop: 8, color: BRAND.colors.textSecondary, fontSize: 12 }}>正在理解教材内容 → 分析知识点 → 生成题目...</Paragraph>
                        </Card>
                      )}

                      {generatedQuestions.length > 0 && !generating && (
                        <Card className="brand-card"
                          title={<Space><CheckCircleOutlined style={{ color: BRAND.colors.green }} /><Text strong>已生成 {generatedQuestions.length} 道题目</Text></Space>}
                          bodyStyle={{ padding: '12px 16px' }}
                          extra={
                            <Space>
                              <Button type="primary" icon={<SendOutlined />} onClick={() => { setPublishTitle(`${selectedMaterial?.filename || ''}练习题`); setPublishDeadline(''); setPublishModalOpen(true); }}
                                style={{ borderRadius: 6, border: 'none', background: BRAND.colors.primaryGradient }}>发布作业</Button>
                              <Button icon={<ReloadOutlined />} onClick={handleGenerate} loading={generating} style={{ borderRadius: 6 }}>重新生成</Button>
                            </Space>
                          }>
                          <Space style={{ marginBottom: 8 }}><Text style={{ fontSize: 11, color: BRAND.colors.textSecondary }}>难度分布：</Text>
                            {['基础', '提高', '综合', '前沿'].map(d => { const c = generatedQuestions.filter(q => q.difficulty === d).length; return c > 0 ? <Tag key={d} style={{ borderRadius: 6, fontSize: 10 }}>{d}: {c}题</Tag> : null; })}</Space>
                          {generatedQuestions.map((q, idx) => (
                            <Card key={q.id || idx} size="small" style={{ marginBottom: 6, borderRadius: 8 }}
                              title={<Space><Text strong style={{ fontSize: 12 }}>#{idx + 1}</Text>
                                <Tag color={q.type === '选择题' ? 'blue' : q.type === '填空题' ? 'green' : q.type === '论述题' ? 'purple' : 'orange'} style={{ borderRadius: 6, fontSize: 10 }}>{q.type}</Tag>
                                <Tag color={q.difficulty === '基础' ? 'green' : q.difficulty === '前沿' ? 'purple' : 'orange'} style={{ borderRadius: 6, fontSize: 10 }}>{q.difficulty}</Tag>
                                {q.knowledge_point && <Tag style={{ borderRadius: 6, fontSize: 10 }}>{q.knowledge_point}</Tag>}
                              </Space>}>
                              <Paragraph style={{ marginBottom: 4, fontSize: 12 }}>{q.question}</Paragraph>
                              {q.options?.length > 0 && <div style={{ marginLeft: 12, marginBottom: 4 }}>{q.options.map((opt: string, oi: number) => <Paragraph key={oi} style={{ margin: 0, fontSize: 11 }}>{opt}</Paragraph>)}</div>}
                              <Alert type="info" showIcon message={<Space><Text strong style={{ fontSize: 11 }}>答案：</Text><Text style={{ fontSize: 11 }}>{q.answer}</Text>{q.estimated_time && <Text type="secondary" style={{ fontSize: 10 }}>预计 {q.estimated_time} 分钟</Text>}</Space>} style={{ marginBottom: 2, borderRadius: 6 }} />
                              {q.explanation && <Paragraph type="secondary" style={{ fontSize: 11, margin: '2px 0 0' }}>📖 {q.explanation}</Paragraph>}
                              {q.source && <Tag style={{ fontSize: 9, marginTop: 2, borderRadius: 6 }} color="geekblue">来源：{q.source}</Tag>}
                            </Card>
                          ))}
                        </Card>
                      )}
                      {generatedQuestions.length === 0 && !generating && (
                        <Card className="brand-card" bodyStyle={{ padding: 60, textAlign: 'center' }}>
                          <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 48, height: 48, display: 'inline-block', opacity: 0.3 }} />
                          <Paragraph style={{ marginTop: 8, color: BRAND.colors.textTertiary, fontSize: 13 }}>选择资料和参数后开始 AI 出题</Paragraph>
                        </Card>
                      )}
                    </div>
                  ) },

                // ═══ 发布记录 ═══
                { key: 'published', label: <span><SendOutlined style={{ color: BRAND.colors.primary }} />发布记录</span>,
                  children: (
                    <Card extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadPublished} style={{ borderRadius: 6 }}>刷新</Button>}>
                      {pubLoading ? <Spin><div style={{ padding: 24 }} /></Spin> : published.length === 0 ? <Empty description="暂无发布记录" /> : (
                        <List dataSource={published} renderItem={(item: any) => (
                          <List.Item>
                            <List.Item.Meta avatar={<Avatar icon={<SendOutlined />} style={{ backgroundColor: BRAND.colors.primary }} />}
                              title={<Text strong>{item.title}</Text>}
                              description={<Space><Tag color="blue" style={{ borderRadius: 6 }}>{item.course}</Tag><Text type="secondary" style={{ fontSize: 11 }}>{item.question_count} 道题</Text><Text type="secondary" style={{ fontSize: 11 }}>{item.created_at}</Text></Space>} />
                          </List.Item>
                        )} />
                      )}
                    </Card>
                  ) },
              ]} />
          ) : (
            <Card className="brand-card" bodyStyle={{ padding: 80, textAlign: 'center' }}>
              <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 64, height: 64, display: 'inline-block', opacity: 0.2 }} />
              <Paragraph style={{ marginTop: 12, color: BRAND.colors.textTertiary, fontSize: 14 }}>从左侧选择一个教学资料开始操作</Paragraph>
            </Card>
          )}
        </Col>
      </Row>

      {/* 上传进度弹窗 */}
      <Modal title="上传进度" open={uploadModal} onCancel={() => { if (!uploading) setUploadModal(false); }} footer={null} closable={!uploading} width={420}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {uploading && <Progress percent={50} status="active" />}
          <div style={{ maxHeight: 160, overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 6 }}>
            {uploadLog.map((log, i) => <Text key={i} style={{ display: 'block', fontSize: 11, fontFamily: 'monospace', color: log.includes('✅') ? BRAND.colors.green : log.includes('❌') ? BRAND.colors.error : '#333' }}>{log}</Text>)}
          </div>
          {!uploading && <Button type="primary" onClick={() => setUploadModal(false)} style={{ borderRadius: 6, background: BRAND.colors.primaryGradient, border: 'none' }}>完成</Button>}
        </Space>
      </Modal>

      {/* 预览弹窗 */}
      <Modal title="完整内容" open={previewModalOpen} onCancel={() => setPreviewModalOpen(false)} footer={null} width={700}>
        <Paragraph style={{ whiteSpace: 'pre-wrap', maxHeight: 500, overflow: 'auto', fontSize: 13, lineHeight: 1.8 }}>{previewContent}</Paragraph>
      </Modal>

      {/* 发布弹窗 */}
      <Modal title={<Space><SendOutlined />发布作业</Space>} open={publishModalOpen} onCancel={() => setPublishModalOpen(false)} onOk={handlePublish} confirmLoading={publishing} okText="确认发布" cancelText="取消">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Alert type="info" showIcon message={`即将发布 ${generatedQuestions.length} 道题目`} description="发布后学生端收到作业通知。" style={{ borderRadius: 8 }} />
          <div><Text style={{ display: 'block', marginBottom: 4 }}>作业标题</Text><Input value={publishTitle} onChange={e => setPublishTitle(e.target.value)} placeholder="第三章 课后练习" style={{ borderRadius: 6 }} /></div>
          <div><Text style={{ display: 'block', marginBottom: 4 }}>截止日期（可选）</Text><Input value={publishDeadline} onChange={e => setPublishDeadline(e.target.value)} placeholder="2026-07-20" style={{ borderRadius: 6 }} /></div>
        </Space>
      </Modal>

      <div className="brand-watermark">Edu-TA 教学资料 · 题库可追溯</div>

      <ApiKeyGuardModal visible={guard.modalVisible} onClose={guard.hideGuard} onGoSettings={guard.goToSettings} />
      <SettingsModal open={guard.settingsVisible} onClose={() => guard.setSettingsVisible(false)} />
    </div>
  );
};

export default MaterialCenter;
