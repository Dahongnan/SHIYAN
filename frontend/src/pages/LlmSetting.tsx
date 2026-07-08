/**
 * LLM API 服务配置 — 独立页面
 *
 * 三层状态栏 + 双 Tab（已配置供应商优先 + 添加新供应商）
 * 核心：设为全局激活 → 实时刷新状态
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Space, Tag, Button, Input, message, Popconfirm, Divider,
  Tabs, Radio, Row, Col, Empty, Alert, Spin, Tooltip, Modal,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, CheckCircleOutlined, ThunderboltOutlined,
  KeyOutlined, LinkOutlined, CloudServerOutlined, StarOutlined, StarFilled,
  SettingOutlined, CheckOutlined, CopyOutlined, ReloadOutlined,
  WarningOutlined, GlobalOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import {
  getProviders, saveProvider, deleteProvider, getActiveProviderId,
  setActiveProviderId, genId, ProviderWithModels, ModelItem, getActiveModel,
  getLLMStatus, LLMStatus,
} from '../utils/providerStorage';
import { getStatusInfo } from '../utils/apiKeyGuard';
import { BRAND, CARD_SPECS } from '../utils/brand';
import '../styles/brand.css';
import '../styles/llm-setting.css';

const { Title, Text, Paragraph } = Typography;

const BrandBadge: React.FC<{ size?: number; color?: string }> = ({ size = 14, color }) => (
  <span dangerouslySetInnerHTML={{ __html: BRAND.badgeSvg.replace('currentColor', color || BRAND.colors.primary) }}
    style={{ width: size, height: size, display: 'inline-flex', verticalAlign: 'middle' }} />
);

interface VendorPreset { label: string; color: string; base_url: string; models: { label: string; value: string }[]; }

const VENDORS: VendorPreset[] = [
  { label: 'DeepSeek', color: '#1890ff', base_url: 'https://api.deepseek.com',
    models: [{ label: 'V4 Flash', value: 'deepseek-v4-flash' }, { label: 'V4 Pro', value: 'deepseek-v4-pro' }, { label: 'V4 Pro Max', value: 'deepseek-v4-pro-max' }] },
  { label: '智谱 GLM', color: '#eb2f96', base_url: 'https://open.bigmodel.cn/api/paas/v4/',
    models: [{ label: 'GLM4 Flash', value: 'glm-4-flash' }, { label: 'GLM4 Air', value: 'glm-4-air' }, { label: 'GLM4 Pro', value: 'glm-4-pro' }, { label: 'GLM4 Plus', value: 'glm-4-plus' }] },
  { label: '通义千问', color: '#722ed1', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [{ label: 'Qwen3 Turbo', value: 'qwen3-turbo' }, { label: 'Qwen3 Plus', value: 'qwen3-plus' }, { label: 'Qwen3 Max', value: 'qwen3-max' }] },
  { label: '讯飞星火', color: '#fa8c16', base_url: 'https://spark-api-open.xf-yun.com/v1',
    models: [{ label: 'Spark Lite', value: 'spark-lite' }, { label: 'Spark Pro', value: 'spark-pro' }, { label: 'Spark Max', value: 'spark-max' }] },
  { label: 'SiliconFlow', color: '#13c2c2', base_url: 'https://api.siliconflow.cn/v1',
    models: [{ label: 'DeepSeek V4 Flash', value: 'deepseek-ai/DeepSeek-V4-Flash' }, { label: 'DeepSeek V4 Pro', value: 'deepseek-ai/DeepSeek-V4-Pro' }, { label: 'Qwen3.6-27B', value: 'Qwen/Qwen3.6-27B-Instruct' }, { label: 'Llama3.3-70B', value: 'meta-llama/Llama-3.3-70B-Instruct' }] },
  { label: 'OpenAI', color: '#52c41a', base_url: 'https://api.openai.com/v1',
    models: [{ label: 'GPT-4o Mini', value: 'gpt-4o-mini' }, { label: 'GPT-4o', value: 'gpt-4o' }, { label: 'GPT-4.1', value: 'gpt-4.1' }] },
];

const maskKey = (key: string) => {
  if (!key || key.length <= 8) return '••••••••';
  return key.slice(0, 6) + '••••' + key.slice(-4);
};

const testModel = async (model: ModelItem, baseUrl: string) => {
  try {
    const res = await fetch('/api/settings/test', {
      method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-LLM-Api-Key': model.api_key,
        'X-LLM-Base-Url': baseUrl, 'X-LLM-Model-Name': model.model_name,
      }, body: JSON.stringify({}),
    });
    const data = await res.json();
    return { ok: data.success, msg: data.message || (data.success ? '连接成功' : '连接失败') };
  } catch (e: any) { return { ok: false, msg: '请求失败：' + (e.message || '') }; }
};

const LlmSetting: React.FC = () => {
  const [tab, setTab] = useState('list');    // 默认「已配置供应商」Tab
  const [providers, setProviders] = useState<ProviderWithModels[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProviderWithModels | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorPreset | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  const load = useCallback(() => {
    setProviders(getProviders());
    setActiveId(getActiveProviderId());
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── 三层全局状态 ──
  const llmStatus = getLLMStatus();
  const statusInfo = getStatusInfo(llmStatus);

  const startNew = () => {
    setEditing({ id: genId(), name: '', base_url: '', models: [{ id: genId(), name: '', api_key: '', model_name: '', is_default: true, test_status: 'untested' as const }] });
    setSelectedVendor(null); setTab('add');
  };

  const startEdit = (p: ProviderWithModels) => {
    setEditing(JSON.parse(JSON.stringify(p)));
    setSelectedVendor(VENDORS.find(v => v.base_url === p.base_url || p.name.includes(v.label)) || null);
    setTab('add');
  };

  const selectVendor = (vendor: VendorPreset) => {
    setSelectedVendor(vendor);
    setEditing(prev => prev ? { ...prev, base_url: vendor.base_url, name: vendor.label } : null);
  };

  const applyModelPreset = (val: string) => {
    if (!editing) return;
    const first = editing.models[0];
    if (editing.models.length === 1 && !first.model_name && !first.api_key) {
      setEditing({ ...editing, models: [{ ...first, model_name: val, name: val }] });
    } else {
      addModel(val);
    }
  };

  const addModel = (preset?: string) => {
    if (!editing) return;
    setEditing({ ...editing, models: [...editing.models, { id: genId(), name: preset || '', api_key: '', model_name: preset || '', is_default: false, test_status: 'untested' as const }] });
  };

  const removeModel = (mid: string) => {
    if (!editing || editing.models.length <= 1) { message.warning('至少保留一条模型'); return; }
    const rem = editing.models.filter(m => m.id !== mid);
    const hadDefault = editing.models.find(m => m.id === mid)?.is_default;
    if (hadDefault && rem.length > 0) rem[0].is_default = true;
    setEditing({ ...editing, models: rem });
  };

  const updateModel = (mid: string, field: keyof ModelItem, val: any) => {
    if (!editing) return;
    setEditing({ ...editing, models: editing.models.map(m => m.id === mid ? { ...m, [field]: val } : m) });
  };

  const setDefaultModel = (mid: string) => {
    if (!editing) return;
    setEditing({ ...editing, models: editing.models.map(m => ({ ...m, is_default: m.id === mid })) });
  };

  const handleTestModel = async (mid: string) => {
    if (!editing) return;
    const model = editing.models.find(m => m.id === mid);
    if (!model || !model.api_key || !model.model_name) return; // 空值不操作，按钮已置灰
    updateModel(mid, 'test_status', 'untested');
    const r = await testModel(model, editing.base_url);
    updateModel(mid, 'test_status', r.ok ? 'success' : 'fail');
    updateModel(mid, 'test_message', r.msg);
    if (r.ok) {
      message.success({
        content: '测试连通成功！如需生效请前往【已配置供应商】Tab，将该服务商设为全局激活',
        duration: 6,
        style: { marginTop: '20px' },
      });
    }
  };

  const handleBatchTest = async () => {
    if (!editing) return;
    const toTest = editing.models.filter(m => m.api_key && m.model_name);
    if (toTest.length === 0) return;
    for (const m of toTest) {
      updateModel(m.id, 'test_status', 'untested');
      const r = await testModel(m, editing.base_url);
      updateModel(m.id, 'test_status', r.ok ? 'success' : 'fail');
      updateModel(m.id, 'test_message', r.msg);
    }
    message.success(`批量测试完成，共测试 ${toTest.length} 条模型`);
  };

  // ── 保存前弹窗确认 ──
  const handleSaveWithConfirm = () => {
    if (!editing) return;
    if (!editing.name.trim()) { message.warning('请输入供应商名称'); return; }
    if (!editing.base_url.trim()) { message.warning('请输入接口地址'); return; }
    if (!editing.models.some(m => m.model_name)) { message.warning('请填写模型名称'); return; }
    if (!editing.models.some(m => m.api_key)) { message.warning('请填写 API Key'); return; }
    setSaveModalOpen(true);
  };

  const confirmSave = async () => {
    if (!editing) return;
    if (!editing.models.some(m => m.is_default)) editing.models[0].is_default = true;
    setSaving(true);
    setSaveModalOpen(false);
    try {
      // 保存前对未测试或曾经失败的模型自动重测
      for (const m of editing.models) {
        if (m.api_key && m.test_status !== 'success') {
          const r = await testModel(m, editing.base_url);
          m.test_status = r.ok ? 'success' : 'fail'; m.test_message = r.msg;
        }
      }
      saveProvider(editing);
      message.success(`「${editing.name}」保存成功！保存后仅存入本地，不会自动设为全局激活，请前往【已配置供应商】Tab手动切换生效`);
      load(); setEditing(null);
    } catch { message.error('保存失败'); }
    finally { setSaving(false); }
  };

  // ── 设为全局激活 ──
  const handleSetActive = (providerId: string) => {
    setActiveProviderId(providerId);
    setActiveId(providerId);
    load();
    message.success({ content: '已设为全局激活！顶部状态栏已实时更新', duration: 4 });
  };

  const duplicateProvider = (p: ProviderWithModels) => {
    const copy = { ...JSON.parse(JSON.stringify(p)), id: genId(), name: p.name + ' (副本)' };
    saveProvider(copy); load(); message.success('已复制');
  };

  // 重新测试已保存的模型，并将结果持久化到 localStorage
  const handleRetestModel = async (providerId: string, modelId: string) => {
    const providers = getProviders();
    const provider = providers.find(p => p.id === providerId);
    if (!provider) return;
    const model = provider.models.find(m => m.id === modelId);
    if (!model || !model.api_key || !model.model_name) return;

    // 先更新 UI 为测试中状态
    const updatedModels = provider.models.map(m =>
      m.id === modelId ? { ...m, test_status: 'untested' as const, test_message: '' } : m
    );
    const updatedProvider = { ...provider, models: updatedModels };
    setProviders(prev => prev.map(p => p.id === providerId ? updatedProvider : p));

    const r = await testModel(model, provider.base_url);
    const finalModels = updatedProvider.models.map(m =>
      m.id === modelId ? { ...m, test_status: (r.ok ? 'success' : 'fail') as 'success' | 'fail', test_message: r.msg } : m
    );
    const finalProvider = { ...updatedProvider, models: finalModels };

    // 持久化到 localStorage
    saveProvider(finalProvider);
    load();

    if (r.ok) {
      message.success(`${model.model_name} 连通正常！`);
      // 如果当前已激活，全局状态自动切换
      if (activeId === providerId) {
        message.success({ content: '全局状态已自动更新为可用', duration: 3 });
      }
    } else {
      message.error(`${model.model_name} 连接失败：${r.msg}`);
    }
  };

  return (
    <div className="page-enter llm-page">
      {/* ═════════ 页面头部 ═════════ */}
      <div style={{ marginBottom: 16, paddingTop: 20 }}>
        <Space align="center" size={10}>
          <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 32, height: 32, display: 'inline-flex', animation: 'logoPulse 0.8s ease-out' }} />
          <div>
            <Title level={4} style={{ margin: 0, fontSize: 17, fontWeight: 700, color: BRAND.colors.textPrimary }}>智教星 · LLM API 服务配置</Title>
            <Text type="secondary" style={{ fontSize: 11 }}>多供应商 · 多模型 · 统一全局 AI 配置入口</Text>
          </div>
        </Space>
      </div>

      {/* ═════════ 三层状态栏（加宽醒目） ═════════ */}
      <Card
        className="llm-status-card brand-card"
        style={{
          background: statusInfo.cardBg,
          borderColor: statusInfo.cardBorder,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
          {llmStatus.state === 3 ? (
            <CheckCircleOutlined style={{ color: statusInfo.textColor, fontSize: 26 }} />
          ) : (
            <WarningOutlined style={{ color: statusInfo.textColor, fontSize: 26 }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Tag
                color={statusInfo.tagColor}
                style={{ borderRadius: 6, fontSize: 14, fontWeight: 600, height: 32, lineHeight: '30px', padding: '0 16px' }}
              >
                {statusInfo.tagText}
              </Tag>
              {llmStatus.state === 3 && llmStatus.activeModel && (
                <span style={{ fontSize: 12, color: '#666' }}>
                  {llmStatus.activeModel.provider.base_url}
                </span>
              )}
            </div>
            <div style={{ marginTop: 4 }}>
              <Text style={{ color: statusInfo.textColor, fontSize: 12 }}>
                {llmStatus.providerCount > 0
                  ? `${llmStatus.providerCount} 个供应商 · ${providers.reduce((s, p) => s + p.models.length, 0)} 条模型`
                  : '暂未添加任何供应商'}
              </Text>
              {llmStatus.state === 3 && llmStatus.activeModel?.model.test_status === 'success' && (
                <Tag color="success" style={{ marginLeft: 8, borderRadius: 6, fontSize: 11 }}>
                  ✓ 连通正常
                </Tag>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {llmStatus.state !== 3 && (
            <Button type="primary" icon={<PlusOutlined />} onClick={startNew}
              style={{ height: 38, borderRadius: 8, border: 'none', background: BRAND.colors.primaryGradient }}>
              {llmStatus.state === 1 ? '立即配置' : '新增供应商'}
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={load}
            style={{ height: 38, borderRadius: 8 }}>刷新</Button>
        </div>
      </Card>

      {/* ═════════ 主内容 ═════════ */}
      <Card className="llm-main-card brand-card">
        <Tabs className="llm-tabs" activeKey={tab} onChange={setTab}
          items={[
            // ═══ Tab 1: 已配置供应商（优先）═══════
            {
              key: 'list', label: <span><SettingOutlined /> 已配置供应商（{providers.length}）</span>,
              children: providers.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Space direction="vertical" size={4}>
                      <Text type="secondary">暂无已配置的供应商</Text>
                      <Text style={{ fontSize: 12, color: '#999' }}>添加供应商后请记得在此处设为全局激活</Text>
                    </Space>
                  }
                >
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { setTab('add'); startNew(); }}
                    style={{ borderRadius: 8, border: 'none', background: BRAND.colors.primaryGradient }}>去添加</Button>
                </Empty>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  {providers.map(p => {
                    const isActive = p.id === activeId;
                    return (
                      <Card key={p.id} size="small" hoverable
                        className={`brand-card ${isActive ? 'active-provider-card' : ''}`}
                        style={{
                          borderRadius: 10,
                          border: isActive ? `2px solid ${BRAND.colors.primary}` : '1px solid #f0f0f0',
                          background: isActive ? '#F0F5FF' : '#fff',
                        }}
                        bodyStyle={{ padding: '14px 18px' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          {/* 左侧信息 */}
                          <div style={{ flex: 1 }}>
                            <Space size={10}>
                              {isActive
                                ? <StarFilled style={{ color: '#faad14', fontSize: 18 }} />
                                : <StarOutlined style={{ color: '#d9d9d9', fontSize: 18 }} />}
                              <Text strong style={{ fontSize: 15 }}>{p.name}</Text>
                              {isActive && (
                                <Tag color="blue" style={{ borderRadius: 6, fontSize: 10, fontWeight: 600 }}>全局激活</Tag>
                              )}
                              <Text type="secondary" style={{ fontSize: 11 }}>{p.base_url}</Text>
                            </Space>
                            <div style={{ marginTop: 8, marginLeft: 28 }}>
                              {p.models.map(m => (
                                <Space key={m.id} size={8} style={{ marginBottom: 4 }}>
                                  {m.is_default
                                    ? <CheckCircleOutlined style={{ color: BRAND.colors.green, fontSize: 12 }} />
                                    : <span style={{ width: 12, display: 'inline-block' }} />}
                                  <Tag style={{ borderRadius: 6, fontSize: 11, margin: 0 }}
                                    color={m.test_status === 'success' ? 'success' : m.test_status === 'fail' ? 'error' : 'default'}>
                                    {m.model_name || m.name}
                                  </Tag>
                                  <Text type="secondary" style={{ fontSize: 10, fontFamily: 'monospace' }}>
                                    Key: {maskKey(m.api_key)}
                                  </Text>
                                  {/* 状态文字区分 */}
                                  <Text style={{
                                    fontSize: 10,
                                    color: m.test_status === 'success' ? '#52c41a' : m.test_status === 'fail' ? '#ff4d4f' : '#999',
                                    fontWeight: m.test_status === 'success' ? 600 : 400,
                                  }}>
                                    {m.test_status === 'success' ? '✓ 连通正常' : m.test_status === 'fail' ? '✗ 连接失败' : '未测试'}
                                  </Text>
                                  {m.test_status === 'success' && (
                                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                                  )}
                                  {m.test_message && m.test_status === 'fail' && (
                                    <Tooltip title={m.test_message}>
                                      <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 12, cursor: 'pointer' }} />
                                    </Tooltip>
                                  )}
                                  {/* 重新测试按钮（已保存的模型可一键重测并持久化） */}
                                  <Tooltip title="重新测试连通性">
                                    <ReloadOutlined
                                      style={{ color: '#1890ff', fontSize: 11, cursor: 'pointer', marginLeft: 2 }}
                                      onClick={(e) => { e.stopPropagation(); handleRetestModel(p.id, m.id); }}
                                    />
                                  </Tooltip>
                                </Space>
                              ))}
                            </div>
                          </div>

                          {/* 右侧操作按钮 */}
                          <Space size={6} direction="vertical" align="end">
                            {/* ⭐ 设为全局激活（主按钮，高亮显示） */}
                            {!isActive ? (
                              <Button
                                type="primary"
                                icon={<GlobalOutlined />}
                                size="middle"
                                onClick={() => handleSetActive(p.id)}
                                style={{
                                  height: 36, borderRadius: 8, minWidth: 140,
                                  background: 'linear-gradient(135deg, #0F52BA, #7B61FF)',
                                  border: 'none',
                                  boxShadow: '0 2px 8px rgba(15, 82, 186, 0.25)',
                                  fontWeight: 600,
                                }}
                              >
                                设为全局激活
                              </Button>
                            ) : (
                              <Tag color="blue" style={{ borderRadius: 6, fontSize: 12, height: 32, lineHeight: '30px', padding: '0 16px', fontWeight: 600 }}>
                                <CheckCircleOutlined /> 当前全局激活
                              </Tag>
                            )}
                            <Space size={4}>
                              <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => startEdit(p)}
                                style={{ fontSize: 11 }}>编辑</Button>
                              <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => duplicateProvider(p)}
                                style={{ fontSize: 11, color: BRAND.colors.green }}>复制</Button>
                              <Popconfirm title="删除此供应商？" onConfirm={() => { deleteProvider(p.id); load(); }}>
                                <Button type="link" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 11 }}>删除</Button>
                              </Popconfirm>
                            </Space>
                          </Space>
                        </div>
                      </Card>
                    );
                  })}
                </Space>
              ),
            },

            // ═══ Tab 2: 添加/编辑 ═══
            {
              key: 'add', label: <span><PlusOutlined /> {editing && providers.find(p => p.id === editing.id) ? '编辑供应商' : '添加新供应商'}</span>,
              children: !editing ? (
                <div className="llm-empty-state">
                  <span dangerouslySetInnerHTML={{ __html: BRAND.logoSvg }} style={{ width: 56, height: 56, display: 'inline-block', opacity: 0.25 }} />
                  <Paragraph style={{ marginTop: 8, color: BRAND.colors.textTertiary }}>点击下方按钮添加您的第一个 LLM 供应商</Paragraph>
                  <Paragraph style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>
                    添加完成后请前往「已配置供应商」Tab 设为全局激活
                  </Paragraph>
                  <Button type="primary" icon={<PlusOutlined />} onClick={startNew}
                    style={{ borderRadius: 8, border: 'none', background: BRAND.colors.primaryGradient, height: 40, padding: '0 28px' }}>新建供应商</Button>
                </div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={10}>
                  {/* 供应商名 + 厂商快捷选择 */}
                  <div className="llm-form-row">
                    <Input className="llm-name-input" placeholder="供应商名称（如：我的 DeepSeek）"
                      value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                    <div className="llm-vendor-tags">
                      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>快捷选择：</Text>
                      {VENDORS.map(v => (
                        <span key={v.label} className={`llm-vendor-tag ${selectedVendor?.label === v.label ? 'active' : ''}`}
                          onClick={() => selectVendor(v)}>{v.label}</span>
                      ))}
                    </div>
                  </div>

                  {/* 接口地址 */}
                  <Input className="llm-base-url-input" prefix={<LinkOutlined />} placeholder="https://api.deepseek.com"
                    value={editing.base_url} onChange={e => setEditing({ ...editing, base_url: e.target.value })} />

                  {/* 模型快捷按钮 */}
                  {selectedVendor && (
                    <div className="llm-model-presets">
                      <span className="preset-label">{selectedVendor.label} 2026 最新模型：</span>
                      {selectedVendor.models.map(m => (
                        <button key={m.value} className="preset-btn" onClick={() => applyModelPreset(m.value)}>
                          <CloudServerOutlined style={{ marginRight: 4 }} />{m.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 辅助说明文字 */}
                  <div style={{ background: '#FAFAFA', borderRadius: 8, padding: '10px 16px', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: '#999', lineHeight: 1.6 }}>
                      💡 可先填写 model 标识和 API Key，点击行内 <ThunderboltOutlined style={{ fontSize: 11 }} /> <b>测试</b> 按钮提前校验密钥连通性，无需先保存。<br />
                      确认可用后点击底部 <b>保存供应商</b>，再切换至<b>【已配置供应商】</b>Tab 设为全局激活即可生效。
                    </Text>
                  </div>

                  <div className="llm-section-divider">模型列表（可配置多条 Flash / Pro / Max 模型）</div>

                  {editing.models.map((model, idx) => (
                    <div key={model.id} className="llm-model-row">
                      <span className="model-radio" onClick={() => setDefaultModel(model.id)} style={{ cursor: 'pointer' }}>
                        <Radio checked={model.is_default} onChange={() => {}} />
                        {model.is_default ? <span style={{ color: BRAND.colors.green, fontSize: 11, fontWeight: 500 }}>默认</span> : <span style={{ color: '#999', fontSize: 11 }}>默认</span>}
                      </span>
                      <Input className="model-input" placeholder="别名（如 v4-flash）" style={{ maxWidth: 140 }}
                        value={model.name} onChange={e => updateModel(model.id, 'name', e.target.value)} />
                      <Input className="model-input" placeholder="model 标识" style={{ maxWidth: 160, fontFamily: 'monospace' }}
                        value={model.model_name} onChange={e => updateModel(model.id, 'model_name', e.target.value)}
                        prefix={<CloudServerOutlined style={{ fontSize: 12 }} />} />
                      <Input.Password className="model-input" placeholder="sk-xxx" style={{ maxWidth: 180 }}
                        value={model.api_key} onChange={e => updateModel(model.id, 'api_key', e.target.value)}
                        prefix={<KeyOutlined style={{ fontSize: 12 }} />} />

                      {/* 状态文字：未测试 / 连通正常(绿) / 连接失败(红) */}
                      <span className="llm-model-status">
                        <span style={{
                          fontSize: 11,
                          color: model.test_status === 'success' ? '#52c41a' : model.test_status === 'fail' ? '#ff4d4f' : '#999',
                          fontWeight: model.test_status === 'success' ? 600 : 400,
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}>
                          {model.test_status === 'success' && <CheckCircleOutlined style={{ fontSize: 12 }} />}
                          {model.test_status === 'success' ? '连通正常'
                            : model.test_status === 'fail' ? '连接失败'
                            : '未测试'}
                        </span>
                      </span>

                      {/* 测试按钮：model 标识和 API Key 都填写后才可点击 */}
                      <button className="model-test-btn"
                        onClick={() => handleTestModel(model.id)}
                        disabled={!model.model_name || !model.api_key}
                        style={{
                          borderColor: model.test_status === 'success' ? '#52c41a' : model.test_status === 'fail' ? '#ff4d4f' : '#d9d9d9',
                          color: !model.model_name || !model.api_key ? '#ccc' : model.test_status === 'success' ? '#52c41a' : model.test_status === 'fail' ? '#ff4d4f' : '#666',
                          cursor: !model.model_name || !model.api_key ? 'not-allowed' : 'pointer',
                          opacity: !model.model_name || !model.api_key ? 0.5 : 1,
                        }}>
                        {model.test_status === 'success' ? (
                          <><CheckCircleOutlined style={{ marginRight: 4 }} />已连通</>
                        ) : (
                          <><ThunderboltOutlined style={{ marginRight: 4 }} />测试</>
                        )}
                      </button>
                      <DeleteOutlined className="model-delete-btn" onClick={() => removeModel(model.id)} />
                    </div>
                  ))}
                  {editing.models.length > 0 && editing.models[editing.models.length - 1].test_message && (
                    <Text style={{ fontSize: 10, color: editing.models[editing.models.length - 1].test_status === 'success' ? BRAND.colors.green : BRAND.colors.error, display: 'block', marginBottom: 4 }}>
                      {editing.models[editing.models.length - 1].test_message}
                    </Text>
                  )}

                  <button className="llm-add-model-btn" onClick={() => addModel()}>
                    <PlusOutlined style={{ marginRight: 6 }} />新增模型
                  </button>
                  {editing.models.some(m => m.api_key && m.model_name) && (
                    <Button size="small" icon={<ReloadOutlined />} onClick={handleBatchTest}
                      style={{ borderRadius: 6, borderColor: BRAND.colors.green, color: BRAND.colors.green, fontSize: 12, height: 34, marginRight: 12 }}>批量测试全部</Button>
                  )}

                  <div className="llm-footer-actions">
                    <Button onClick={() => setEditing(null)} className="btn-cancel">取消</Button>
                    <Button type="primary" onClick={handleSaveWithConfirm} loading={saving} icon={<CheckCircleOutlined />} className="btn-save">
                      {saving ? '保存中...' : '保存供应商'}
                    </Button>
                  </div>
                </Space>
              ),
            },
          ]} />
      </Card>

      {/* ═════════ 保存确认弹窗 ═════════ */}
      <Modal
        open={saveModalOpen}
        onCancel={() => setSaveModalOpen(false)}
        onOk={confirmSave}
        okText="确定保存"
        cancelText="取消"
        okButtonProps={{
          style: {
            borderRadius: 8, background: 'linear-gradient(135deg, #0F52BA, #7B61FF)', border: 'none',
          },
        }}
        width={460}
        centered
      >
        <Space direction="vertical" size={12} style={{ padding: '12px 0' }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1890ff, #7B61FF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <CheckCircleOutlined style={{ fontSize: 24, color: '#fff' }} />
          </div>
          <Typography.Title level={5} style={{ margin: 0 }}>确认保存供应商配置？</Typography.Title>
          <Text type="secondary">
            保存后仅存入本地配置，<Text strong style={{ color: '#faad14' }}>不会自动设为全局激活</Text>。
            如需使用该供应商的 AI 功能，请保存后前往「已配置供应商」Tab，点击「设为全局激活」手动切换生效。
          </Text>
        </Space>
      </Modal>

      <div className="brand-watermark">Edu-TA LLM 配置 · 密钥仅本地存储</div>

      {/* 安全提示 */}
      <div style={{
        marginTop: 8, padding: '10px 16px', borderRadius: 8,
        background: '#FFFBE6', border: '1px solid #FFE58F',
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#AD8B00',
      }}>
        <span style={{ fontSize: 16 }}>🔒</span>
        <span>
          <b>密钥安全说明：</b>所有 API Key 仅存储在您当前浏览器的本地存储（localStorage）中，
          不会上传至服务器、不会被提交到代码仓库、不会随项目分发。
          其他电脑或账户克隆本项目后无法获取您的密钥，需各自独立配置。
        </span>
      </div>
    </div>
  );
};

export default LlmSetting;
