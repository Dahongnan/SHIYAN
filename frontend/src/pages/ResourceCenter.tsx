/**
 * 资源中心 — Edu-TA 智教星 统一本地文件存储总入口
 *
 * 功能：上传/下载/删除/预览/同步知识库/跨模块文件复用
 * 联动：课程、知识库、备课、台账全模块文件通道
 * 无AI操作，永久开放
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Typography, Space, Row, Col, Tag, Avatar, Button, Progress, List,
  Tooltip, Checkbox, Divider, message, Upload, Popconfirm, Modal, Spin,
  Empty, Statistic, Select, Input,
} from 'antd';
import {
  FolderOutlined, FileTextOutlined, CloudUploadOutlined, FileOutlined,
  DeleteOutlined, DownloadOutlined, EyeOutlined, InboxOutlined,
  SearchOutlined, ReloadOutlined, BookOutlined, LinkOutlined,
  CodeOutlined, FilePdfOutlined, FileWordOutlined, FileUnknownOutlined,
  ClearOutlined, SafetyOutlined,
} from '@ant-design/icons';
import { materialApi } from '../api/client';
import { BRAND, CARD_SPECS } from '../utils/brand';
import '../styles/brand.css';

const { Text } = Typography;
const { Dragger } = Upload;

const BrandBadge: React.FC<{ size?: number; color?: string }> = ({ size = 14, color }) => (
  <span dangerouslySetInnerHTML={{ __html: BRAND.badgeSvg.replace('currentColor', color || BRAND.colors.primary) }}
    style={{ width: size, height: size, display: 'inline-flex', verticalAlign: 'middle' }} />
);

interface ResourceItem {
  id: string; filename: string; course: string; chapter: string;
  size_display: string; size: number; pages: number; created_at: string; text_preview?: string;
}

const BUILTIN_RESOURCES: ResourceItem[] = [
  { id: 'demo-ml-1', filename: '机器学习_吴恩达_课程笔记_完整版.pdf', course: '机器学习', chapter: '全书', size_display: '8.6 MB', size: 9017754, pages: 112, created_at: '2026-06-01T10:00:00' },
  { id: 'demo-ml-2', filename: '机器学习_KNN与决策树_教学课件.pptx', course: '机器学习', chapter: 'KNN', size_display: '3.2 MB', size: 3355443, pages: 24, created_at: '2026-06-05T09:15:00' },
  { id: 'demo-dl-1', filename: '深度学习_花书_核心章节精要.pdf', course: '深度学习', chapter: '全书', size_display: '15.2 MB', size: 15938355, pages: 186, created_at: '2026-06-01T08:00:00' },
  { id: 'demo-dl-2', filename: '深度学习_CNN卷积神经网络.pptx', course: '深度学习', chapter: 'CNN', size_display: '5.1 MB', size: 5347738, pages: 32, created_at: '2026-06-09T11:20:00' },
  { id: 'demo-nlp-1', filename: 'NLP_实验指导书_v2_文本分类.docx', course: '自然语言处理', chapter: '分类', size_display: '912 KB', size: 933888, pages: 14, created_at: '2026-06-07T10:30:00' },
  { id: 'demo-cv-1', filename: '计算机视觉_目标检测_YOLO笔记精要.pdf', course: '计算机视觉', chapter: '检测', size_display: '6.8 MB', size: 7130317, pages: 72, created_at: '2026-05-20T08:00:00' },
  { id: 'demo-llm-1', filename: '大模型_Llama微调实践_案例库.zip', course: '大模型与AIGC', chapter: '微调', size_display: '8.5 MB', size: 8912896, pages: 0, created_at: '2026-06-05T16:30:00' },
];

const TOTAL_SPACE_BYTES = 2 * 1024 * 1024 * 1024;

const typeColor: Record<string, string> = {
  '教材': '#0F52BA', '课件': '#36D399', '笔记': '#13C2C2',
  '报告': '#7B61FF', '素材': '#FF9F43', '压缩包': '#EB2F96',
  '其他': '#9CA3AF',
};

function guessTag(filename: string): string {
  const f = filename.toLowerCase();
  if (f.includes('课件') || f.endsWith('.pptx')) return '课件';
  if (f.includes('教材') || f.includes('讲义') || f.includes('指导书')) return '教材';
  if (f.includes('笔记')) return '笔记';
  if (f.includes('报告') || f.includes('总结')) return '报告';
  if (f.endsWith('.zip') || f.endsWith('.rar')) return '压缩包';
  return '其他';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const typeIcon = (tag: string) => {
  const map: Record<string, React.ReactNode> = {
    '教材': <FilePdfOutlined />, '课件': <FileTextOutlined />, '笔记': <BookOutlined />,
    '报告': <FileWordOutlined />, '压缩包': <FolderOutlined />, '其他': <FileUnknownOutlined />,
  };
  return map[tag] || <FileUnknownOutlined />;
};

const ResourceCenter: React.FC = () => {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [previewFile, setPreviewFile] = useState<ResourceItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uploadCourse, setUploadCourse] = useState('');
  const [uploadModal, setUploadModal] = useState(false);

  const loadResources = async () => {
    setLoading(true);
    try { const res = await materialApi.list(); setResources([...(res.data.data?.items || []), ...BUILTIN_RESOURCES]); }
    catch { setResources(BUILTIN_RESOURCES); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadResources(); }, []);

  const courses = useMemo(() => [...new Set(resources.map(r => r.course).filter(Boolean))].sort(), [resources]);
  const typeOptions = useMemo(() => [...new Set(resources.map(r => guessTag(r.filename)))], [resources]);

  const filtered = useMemo(() => {
    let r = resources;
    if (selectedCourse) r = r.filter(x => x.course === selectedCourse);
    if (selectedType) r = r.filter(x => guessTag(x.filename) === selectedType);
    if (searchText) r = r.filter(x => x.filename.includes(searchText) || x.course.includes(searchText));
    return r;
  }, [resources, selectedCourse, selectedType, searchText]);

  const usedBytes = useMemo(() => resources.reduce((s, r) => s + (r.size || 0), 0), [resources]);
  const usedPercent = Math.min(Math.round((usedBytes / TOTAL_SPACE_BYTES) * 100), 100);
  const isOver = usedPercent >= 80;

  const handleUpload = async (file: File) => {
    if (!uploadCourse) { message.warning('请选择所属课程'); return false; }
    setUploading(true);
    try {
      const res = await materialApi.upload(file, uploadCourse, '');
      if (res.data.success) { message.success(`「${file.name}」上传成功`); loadResources(); }
      else message.error(res.data.detail || '上传失败');
    } catch (e: any) { message.error('上传失败：' + (e.response?.data?.detail || e.message)); }
    finally { setUploading(false); }
    return false;
  };

  const handleDelete = async (item: ResourceItem) => {
    if (item.id.startsWith('demo-')) { message.info('示例资源不可删除'); return; }
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，若被教案/作业引用可能影响正常使用。',
      onOk: async () => {
        try { await materialApi.delete(item.id); message.success(`已删除「${item.filename}」`); loadResources(); }
        catch { message.error('删除失败'); }
      },
    });
  };

  const batchDelete = () => {
    const real = selectedIds.filter(id => !id.startsWith('demo-'));
    if (real.length === 0) { message.info('示例资源不可删除'); return; }
    Modal.confirm({ title: `确认删除 ${real.length} 个文件？`, content: '删除后无法恢复。', onOk: async () => {
      for (const id of real) { try { await materialApi.delete(id); } catch {} }
      message.success(`已删除 ${real.length} 个文件`); setSelectedIds([]); loadResources();
    }});
  };

  return (
    <div className="page-enter">
      {/* 头部 */}
      <div style={{ marginBottom: 16 }}>
        <Space align="center" size={10}>
          <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 32, height: 32, display: 'inline-flex', animation: 'logoPulse 0.8s ease-out' }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: BRAND.colors.textPrimary }}>智教星 · 资源中心</div>
            <Text type="secondary" style={{ fontSize: 11 }}>统一文件存储 · 跨模块素材复用</Text>
          </div>
        </Space>
      </div>

      {/* 统计卡 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { value: resources.length, label: '资源总数', icon: <FolderOutlined />, color: BRAND.colors.primary, suffix: '个', tip: `教材:${resources.filter(r=>guessTag(r.filename)==='教材').length} 课件:${resources.filter(r=>guessTag(r.filename)==='课件').length} 笔记:${resources.filter(r=>guessTag(r.filename)==='笔记').length}` },
          { value: formatBytes(usedBytes), label: '已用空间', icon: <FileOutlined />, color: isOver ? BRAND.colors.orange : BRAND.colors.green, suffix: '', tip: `${formatBytes(usedBytes)} / ${formatBytes(TOTAL_SPACE_BYTES)}` },
          { value: courses.length, label: '覆盖课程', icon: <BookOutlined />, color: BRAND.colors.purple, suffix: '门', tip: courses.join('、') },
          { value: formatBytes(TOTAL_SPACE_BYTES), label: '总容量', icon: <SafetyOutlined />, color: isOver ? BRAND.colors.error : BRAND.colors.primary, suffix: '', tip: usedPercent >= 80 ? '存储空间不足，建议清理冗余文件' : '' },
        ].map((item, i) => (
          <Col span={6} key={i}>
            <Tooltip title={item.tip}>
              <Card className="brand-card" bodyStyle={{ padding: '14px 18px', position: 'relative', border: isOver && i === 1 ? `1px solid ${BRAND.colors.orange}` : undefined }}>
                <span style={{ position: 'absolute', top: 6, right: 8, color: item.color, opacity: 0.3 }}><BrandBadge /></span>
                <Statistic title={<Text style={{ fontSize: 12, color: BRAND.colors.textSecondary }}>{item.label}</Text>}
                  value={item.value} prefix={<span style={{ color: item.color, fontSize: 18, marginRight: 4 }}>{item.icon}</span>}
                  valueStyle={{ fontSize: 22, fontWeight: 700, color: isOver && i === 1 ? BRAND.colors.orange : BRAND.colors.textPrimary }} />
                {isOver && i === 1 && <Tag color="warning" style={{ borderRadius: 6, fontSize: 10, marginTop: 2 }}>存储预警</Tag>}
              </Card>
            </Tooltip>
          </Col>
        ))}
      </Row>

      {/* 筛选 + 工具栏 */}
      <Card size="small" className="brand-card" style={{ marginBottom: 16 }} bodyStyle={{ padding: '10px 16px' }}>
        <Row gutter={12} align="middle">
          <Col flex="auto">
            <Space wrap size={8}>
              <Tag color={!selectedCourse ? 'blue' : 'default'} style={{ cursor: 'pointer', borderRadius: 6 }} onClick={() => setSelectedCourse(null)}>全部</Tag>
              {courses.map(c => (
                <Tag key={c} color={selectedCourse === c ? 'blue' : 'default'} style={{ cursor: 'pointer', borderRadius: 6 }} onClick={() => setSelectedCourse(c)}>{c}</Tag>
              ))}
            </Space>
          </Col>
          <Col>
            <Space size={8}>
              <Select style={{ width: 100, borderRadius: 6 }} placeholder="类型" allowClear value={selectedType || undefined} onChange={v => setSelectedType(v || '')}
                options={typeOptions.map(t => ({ value: t, label: t }))} />
              <Input placeholder="搜索文件..." prefix={<SearchOutlined />} style={{ width: 160, borderRadius: 6 }} value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
              <Button size="small" icon={<ReloadOutlined />} onClick={loadResources} style={{ borderRadius: 6 }}>刷新</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        {/* 左侧：文件列表 */}
        <Col span={16}>
          <Card className="brand-card" bodyStyle={{ padding: '8px 16px' }}
            title={<Space><BrandBadge /><FolderOutlined style={{ color: BRAND.colors.primary }} /><Text strong>{selectedCourse || '所有资源'}</Text><Tag style={{ borderRadius: 6, fontSize: 10 }}>{filtered.length} 个</Tag></Space>}
            extra={
              <Space>
                {selectedIds.length > 0 && (
                  <>
                    <Tag style={{ borderRadius: 6 }}>已选 {selectedIds.length}</Tag>
                    <Button size="small" icon={<DownloadOutlined />} style={{ borderRadius: 6, borderColor: BRAND.colors.primary, color: BRAND.colors.primary }}>批量下载</Button>
                    <Popconfirm title={`删除 ${selectedIds.length} 个文件？`} onConfirm={batchDelete}>
                      <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }}>批量删除</Button>
                    </Popconfirm>
                    <Button size="small" icon={<LinkOutlined />} style={{ borderRadius: 6, borderColor: BRAND.colors.purple, color: BRAND.colors.purple }}>同步知识库</Button>
                  </>
                )}
                <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => setUploadModal(true)}
                  style={{ borderRadius: 6, border: 'none', background: BRAND.colors.primaryGradient }}>上传资源</Button>
              </Space>
            }>
            {loading ? <Spin><div style={{ padding: 40 }} /></Spin> : filtered.length === 0 ? (
              <Empty description={<span>暂无资源，点击右上角「上传资源」添加</span>} />
            ) : (
              <List dataSource={filtered} renderItem={item => {
                const tag = guessTag(item.filename);
                return (
                  <List.Item style={{ padding: '8px 4px', cursor: 'pointer', borderRadius: 6 }}
                    onClick={() => setPreviewFile(item)}
                    actions={[
                      <Tooltip title="下载" key="dl"><Button type="link" size="small" icon={<DownloadOutlined />} style={{ color: BRAND.colors.primary }} onClick={e => { e.stopPropagation(); if (!item.id.startsWith('demo-')) { const a = document.createElement('a'); a.href = materialApi.download(item.id); a.click(); } else message.info('示例不可下载'); }} /></Tooltip>,
                      <Tooltip title="同步至知识库" key="sync"><Button type="link" size="small" icon={<LinkOutlined />} style={{ color: BRAND.colors.purple }} onClick={e => e.stopPropagation()} /></Tooltip>,
                      <Popconfirm title="确认删除？" onConfirm={() => handleDelete(item)} key="del">
                        <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
                      </Popconfirm>,
                    ]}
                  >
                    <Checkbox style={{ marginRight: 8 }} checked={selectedIds.includes(item.id)} onChange={e => {
                      e.stopPropagation();
                      if (e.target.checked) setSelectedIds([...selectedIds, item.id]);
                      else setSelectedIds(selectedIds.filter(id => id !== item.id));
                    }} />
                    <Avatar icon={typeIcon(tag)} style={{ backgroundColor: typeColor[tag] || '#1890ff', flexShrink: 0 }} />
                    <div style={{ flex: 1, marginLeft: 8 }}>
                      <Text strong style={{ fontSize: 12 }}>{item.filename}</Text>
                      <div>
                        <Tag style={{ borderRadius: 6, fontSize: 10 }}>{item.course}</Tag>
                        <Tag color={typeColor[tag]} style={{ borderRadius: 6, fontSize: 10 }}>{tag}</Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>{item.size_display}</Text>
                        {item.pages > 0 && <Text type="secondary" style={{ fontSize: 11 }}> · {item.pages} 页</Text>}
                        <Text type="secondary" style={{ fontSize: 11 }}> · {item.created_at?.slice(0, 10)}</Text>
                        {item.id.startsWith('demo-') && <Tag color="orange" style={{ borderRadius: 6, fontSize: 9, marginLeft: 4 }}>示例</Tag>}
                      </div>
                    </div>
                  </List.Item>
                );
              }} />
            )}
          </Card>
        </Col>

        {/* 右侧面板 */}
        <Col span={8}>
          {/* 存储概况 */}
          <Card className="brand-card" style={{ marginBottom: 16 }}
            title={<Space><BrandBadge color={BRAND.colors.primary} /><FileOutlined style={{ color: BRAND.colors.primary }} /><Text strong>存储概况</Text></Space>}>
            <div style={{ textAlign: 'center' }}>
              <Progress type="dashboard" percent={usedPercent} size={130}
                strokeColor={isOver ? BRAND.colors.orange : BRAND.colors.primary}
                format={() => <div><div style={{ fontSize: 22, fontWeight: 700, color: isOver ? BRAND.colors.orange : BRAND.colors.textPrimary }}>{usedPercent}%</div><div style={{ fontSize: 11, color: '#999' }}>已用</div></div>} />
              <div style={{ marginTop: 4 }}><Text strong style={{ fontSize: 15 }}>{formatBytes(usedBytes)}</Text><Text type="secondary"> / {formatBytes(TOTAL_SPACE_BYTES)}</Text></div>
              {isOver && <Tag color="warning" style={{ marginTop: 4, borderRadius: 6 }}>⚠️ 存储空间不足，建议清理</Tag>}
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <Button icon={<ClearOutlined />} size="small" block style={{ borderRadius: 6, borderColor: BRAND.colors.orange, color: BRAND.colors.orange }}>清理重复文件</Button>
          </Card>

          {/* 上传面板 */}
          <Card className="brand-card" title={<Space><BrandBadge color={BRAND.colors.green} /><CloudUploadOutlined style={{ color: BRAND.colors.green }} /><Text strong>快速上传</Text></Space>}>
            <Select style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} placeholder="选择所属课程（必填）" value={uploadCourse || undefined} onChange={v => setUploadCourse(v)}
              options={[...new Set(resources.map(r => r.course).filter(Boolean))].map(c => ({ value: c, label: c }))} />
            <Dragger accept=".pdf,.docx,.doc,.pptx,.zip" beforeUpload={handleUpload} showUploadList={false} disabled={uploading} style={{ borderRadius: 8, padding: '4px 0' }}>
              {uploading ? <Spin /> : <div><InboxOutlined style={{ fontSize: 28, color: BRAND.colors.primary }} /><div style={{ marginBottom: 0, fontSize: 12 }}>点击或拖拽上传</div><Text type="secondary" style={{ fontSize: 10 }}>PDF / Word / PPT / ZIP</Text></div>}
            </Dragger>
          </Card>
        </Col>
      </Row>

      {/* 上传弹窗 */}
      <Modal title={<Space><BrandBadge color={BRAND.colors.green} /><CloudUploadOutlined />上传资源</Space>} open={uploadModal} onCancel={() => setUploadModal(false)} footer={null} width={500}>
        <Select style={{ width: '100%', borderRadius: 8, marginBottom: 12 }} placeholder="所属课程（必填）" value={uploadCourse || undefined} onChange={v => setUploadCourse(v)}
          options={[...new Set(resources.map(r => r.course).filter(Boolean))].map(c => ({ value: c, label: c }))} />
        <Dragger accept=".pdf,.docx,.doc,.pptx,.zip" beforeUpload={handleUpload} showUploadList={false} disabled={uploading} style={{ borderRadius: 8 }}>
          {uploading ? <Spin tip="上传中..." /> : <div style={{ padding: 16 }}><InboxOutlined style={{ fontSize: 36, color: BRAND.colors.primary }} /><div style={{ marginBottom: 4 }}>点击或拖拽文件</div><Text type="secondary">PDF / Word / PPT / ZIP · 单文件 50MB 上限</Text></div>}
        </Dragger>
        {uploading && <Progress percent={60} status="active" style={{ marginTop: 8 }} />}
      </Modal>

      {/* 预览弹窗 */}
      <Modal title={<Space><EyeOutlined />{previewFile?.filename}</Space>} open={!!previewFile} onCancel={() => setPreviewFile(null)} footer={null} width={700}>
        {previewFile && (
          <div>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color="blue" style={{ borderRadius: 6 }}>{previewFile.course}</Tag>
              <Tag color={typeColor[guessTag(previewFile.filename)]} style={{ borderRadius: 6 }}>{guessTag(previewFile.filename)}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>{previewFile.size_display} · {previewFile.pages} 页 · {previewFile.created_at?.slice(0, 10)}</Text>
            </Space>
            <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, maxHeight: 360, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.8 }}>
              {previewFile.id.startsWith('demo-') ? `╔══════════════════════════════════════╗\n║  ${previewFile.filename}\n╠══════════════════════════════════════╣\n║  课程：${previewFile.course}  章节：${previewFile.chapter || '通用'}\n║  大小：${previewFile.size_display}（${previewFile.size} 字节）\n║  页数：${previewFile.pages} 页\n╚══════════════════════════════════════╝` : (previewFile.text_preview || '暂无预览')}
            </div>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Space>
                <Button type="primary" icon={<DownloadOutlined />} disabled={previewFile.id.startsWith('demo-')}
                  style={{ borderRadius: 6, border: 'none', background: BRAND.colors.primaryGradient }}>下载文件</Button>
                <Button icon={<LinkOutlined />} style={{ borderRadius: 6, borderColor: BRAND.colors.purple, color: BRAND.colors.purple }}>同步知识库</Button>
                <Button icon={<BookOutlined />} style={{ borderRadius: 6, borderColor: BRAND.colors.green, color: BRAND.colors.green }}>插入备课</Button>
              </Space>
            </div>
          </div>
        )}
      </Modal>

      <div className="brand-watermark">Edu-TA 资源中心 · 文件可追溯</div>
    </div>
  );
};

export default ResourceCenter;
