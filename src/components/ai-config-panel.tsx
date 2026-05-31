'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  Key,
  Globe,
  Eye,
  Brain,
  ChevronDown,
  Check,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PresetInfo {
  key: string
  label: string
  baseUrl: string
  vlmModel: string
  llmModel: string
}

interface AIConfigPublic {
  provider: string
  apiKeySet: boolean
  apiKeyPreview: string
  baseUrl: string
  vlmModel: string
  llmModel: string
  providerLabel: string
  isAutoDetected?: boolean
  availablePresets: PresetInfo[]
}

// ---------------------------------------------------------------------------
// Provider icons / colors
// ---------------------------------------------------------------------------
const PROVIDER_COLORS: Record<string, string> = {
  zai: 'from-amber-500 to-orange-500',
  zhipu: 'from-blue-500 to-cyan-500',
  openai: 'from-emerald-500 to-teal-500',
  deepseek: 'from-violet-500 to-purple-500',
  moonshot: 'from-sky-500 to-blue-500',
  siliconflow: 'from-rose-500 to-pink-500',
  custom: 'from-slate-400 to-slate-500',
}

const PROVIDER_ICONS: Record<string, string> = {
  zai: ' sandbox',
  zhipu: 'Z',
  openai: 'GPT',
  deepseek: 'DS',
  moonshot: 'MK',
  siliconflow: 'SF',
  custom: 'URL',
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function AIConfigPanel() {
  const [config, setConfig] = useState<AIConfigPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Form state
  const [selectedProvider, setSelectedProvider] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [vlmModel, setVlmModel] = useState('')
  const [llmModel, setLlmModel] = useState('')
  const [providerLabel, setProviderLabel] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as AIConfigPublic
      setConfig(data)
      setSelectedProvider(data.provider || '')
      setBaseUrl(data.baseUrl || '')
      setVlmModel(data.vlmModel || '')
      setLlmModel(data.llmModel || '')
      setProviderLabel(data.providerLabel || '')
      setApiKey('') // Never prefill API key from server
    } catch (err) {
      console.error('[AIConfigPanel] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // When user selects a preset, fill in defaults
  const handlePresetSelect = (presetKey: string) => {
    setSelectedProvider(presetKey)

    if (presetKey === 'zai') {
      setBaseUrl('')
      setVlmModel('')
      setLlmModel('')
      setProviderLabel('Z.ai Sandbox')
      return
    }

    if (presetKey === 'custom') {
      setBaseUrl('')
      setVlmModel('')
      setLlmModel('')
      setProviderLabel('')
      return
    }

    const preset = config?.availablePresets.find((p) => p.key === presetKey)
    if (preset) {
      setBaseUrl(preset.baseUrl)
      setVlmModel(preset.vlmModel)
      setLlmModel(preset.llmModel)
      setProviderLabel(preset.label)
    }
  }

  const handleSave = async () => {
    if (!selectedProvider) {
      toast.error('请选择一个 AI 提供商')
      return
    }

    if (selectedProvider !== 'zai' && !apiKey && !config?.apiKeySet) {
      toast.error('请输入 API Key')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          // If user didn't type a new key and one already exists, keep it
          apiKey: apiKey || '****keep****',
          baseUrl,
          vlmModel,
          llmModel,
          providerLabel,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || '保存失败')
        return
      }

      toast.success(data.message || 'AI 提供商已切换', {
        description: '新设置即时生效，无需重启',
      })

      // Refresh config
      await fetchConfig()
      setApiKey('') // Clear input after save
    } catch (err) {
      console.error('[AIConfigPanel] save error:', err)
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/ai-config', { method: 'DELETE' })
      if (!res.ok) throw new Error('Reset failed')
      toast.success('已重置为默认配置', {
        description: '将自动检测可用环境',
      })
      await fetchConfig()
      setSelectedProvider('')
      setApiKey('')
      setBaseUrl('')
      setVlmModel('')
      setLlmModel('')
      setProviderLabel('')
    } catch {
      toast.error('重置失败')
    } finally {
      setSaving(false)
    }
  }

  // --- Loading ---
  if (loading) {
    return (
      <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
        <CardContent className="p-4 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          <span className="text-xs text-slate-400">加载 AI 配置...</span>
        </CardContent>
      </Card>
    )
  }

  const isZAI = selectedProvider === 'zai'
  const isCustom = selectedProvider === 'custom'
  const currentGradient = PROVIDER_COLORS[selectedProvider] || PROVIDER_COLORS.custom

  return (
    <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm overflow-hidden">
      <CardContent className="p-0">
        {/* Header — always visible */}
        <div
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors duration-200 cursor-pointer"
          onClick={() => setExpanded((prev) => !prev)}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label="切换 AI 配置面板"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setExpanded((prev) => !prev)
            }
          }}
        >
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br ${currentGradient} text-white text-[10px] font-bold`}>
              {PROVIDER_ICONS[selectedProvider] || '?'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200">
                  AI 设置
                </span>
                {config?.isAutoDetected && (
                  <Badge className="text-[9px] px-1 py-0 h-3.5 bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    自动
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {config?.providerLabel || '未配置'}
              </p>
            </div>
          </div>

          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </motion.div>
        </div>

        {/* Expanded settings */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-4">
                <Separator className="bg-slate-700/50" />

                {/* Provider selection grid */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    选择 AI 提供商
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {/* ZAI option (only show if available) */}
                    {config?.isAutoDetected && (
                      <button
                        onClick={() => handlePresetSelect('zai')}
                        className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition-all duration-200 ${
                          selectedProvider === 'zai'
                            ? 'border-amber-500/50 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                            : 'border-slate-700/30 bg-slate-800/30 hover:border-slate-600/50 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-md bg-gradient-to-br ${PROVIDER_COLORS.zai} flex items-center justify-center text-white text-[10px] font-bold`}>
                          sandbox
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">Z.ai 沙箱</span>
                        {selectedProvider === 'zai' && (
                          <Check className="absolute top-1 right-1 w-3 h-3 text-amber-400" />
                        )}
                      </button>
                    )}

                    {/* Preset providers */}
                    {config?.availablePresets.map((preset) => (
                      <button
                        key={preset.key}
                        onClick={() => handlePresetSelect(preset.key)}
                        className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition-all duration-200 ${
                          selectedProvider === preset.key
                            ? 'border-amber-500/50 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                            : 'border-slate-700/30 bg-slate-800/30 hover:border-slate-600/50 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-md bg-gradient-to-br ${PROVIDER_COLORS[preset.key] || PROVIDER_COLORS.custom} flex items-center justify-center text-white text-[9px] font-bold`}>
                          {PROVIDER_ICONS[preset.key] || '?'}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium truncate max-w-full">
                          {preset.label.split('(')[0].trim().split(' ')[0]}
                        </span>
                        {selectedProvider === preset.key && (
                          <Check className="absolute top-1 right-1 w-3 h-3 text-amber-400" />
                        )}
                      </button>
                    ))}

                    {/* Custom option */}
                    <button
                      onClick={() => handlePresetSelect('custom')}
                      className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition-all duration-200 ${
                        selectedProvider === 'custom'
                          ? 'border-amber-500/50 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                          : 'border-slate-700/30 bg-slate-800/30 hover:border-slate-600/50 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-md bg-gradient-to-br ${PROVIDER_COLORS.custom} flex items-center justify-center text-white text-[10px] font-bold`}>
                        URL
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">自定义</span>
                      {selectedProvider === 'custom' && (
                        <Check className="absolute top-1 right-1 w-3 h-3 text-amber-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* ZAI selected — no config needed */}
                {isZAI && (
                  <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                    <p className="text-xs text-amber-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Z.ai 沙箱环境自动连接，无需配置 API Key
                    </p>
                  </div>
                )}

                {/* Non-ZAI provider — show config form */}
                {!isZAI && selectedProvider && (
                  <div className="space-y-3">
                    {/* API Key */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                        <Key className="w-3 h-3 text-amber-400" />
                        API Key
                        {config?.apiKeySet && (
                          <span className="text-[10px] text-emerald-400">
                            (已设置: {config.apiKeyPreview})
                          </span>
                        )}
                      </label>
                      <Input
                        type="password"
                        placeholder={config?.apiKeySet ? '留空保持现有 Key' : '输入你的 API Key'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="bg-slate-800/50 border-slate-700/50 text-slate-200 text-xs h-8 placeholder:text-slate-600 focus:border-amber-500/50 focus:ring-amber-500/20"
                      />
                    </div>

                    {/* Advanced settings toggle */}
                    <button
                      onClick={() => setShowAdvanced((prev) => !prev)}
                      className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
                    >
                      <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                      高级设置
                    </button>

                    <AnimatePresence>
                      {showAdvanced && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden space-y-3"
                        >
                          {/* Base URL */}
                          <div className="space-y-1.5">
                            <label className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                              <Globe className="w-3 h-3 text-amber-400" />
                              Base URL
                            </label>
                            <Input
                              type="text"
                              placeholder="https://api.example.com/v1"
                              value={baseUrl}
                              onChange={(e) => setBaseUrl(e.target.value)}
                              className="bg-slate-800/50 border-slate-700/50 text-slate-200 text-xs h-8 font-mono placeholder:text-slate-600 focus:border-amber-500/50 focus:ring-amber-500/20"
                            />
                          </div>

                          {/* VLM Model */}
                          <div className="space-y-1.5">
                            <label className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                              <Eye className="w-3 h-3 text-amber-400" />
                              VLM 模型（视觉理解）
                            </label>
                            <Input
                              type="text"
                              placeholder="e.g. glm-4v-plus, gpt-4o"
                              value={vlmModel}
                              onChange={(e) => setVlmModel(e.target.value)}
                              className="bg-slate-800/50 border-slate-700/50 text-slate-200 text-xs h-8 font-mono placeholder:text-slate-600 focus:border-amber-500/50 focus:ring-amber-500/20"
                            />
                          </div>

                          {/* LLM Model */}
                          <div className="space-y-1.5">
                            <label className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                              <Brain className="w-3 h-3 text-amber-400" />
                              LLM 模型（文本推理）
                            </label>
                            <Input
                              type="text"
                              placeholder="e.g. glm-4-plus, gpt-4o"
                              value={llmModel}
                              onChange={(e) => setLlmModel(e.target.value)}
                              className="bg-slate-800/50 border-slate-700/50 text-slate-200 text-xs h-8 font-mono placeholder:text-slate-600 focus:border-amber-500/50 focus:ring-amber-500/20"
                            />
                          </div>

                          {/* Custom: extra warning */}
                          {isCustom && (
                            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5">
                              <p className="text-[11px] text-amber-300 flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                自定义提供商需要填写完整的 Base URL、VLM 和 LLM 模型 ID。确保 API 兼容 OpenAI Chat Completions 格式。
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* No provider selected */}
                {!selectedProvider && (
                  <div className="rounded-lg bg-slate-800/30 border border-slate-700/20 p-3">
                    <p className="text-xs text-slate-500 text-center">
                      👆 选择一个 AI 提供商开始配置
                    </p>
                  </div>
                )}

                <Separator className="bg-slate-700/50" />

                {/* Action buttons */}
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-500 hover:text-slate-300 text-xs h-7"
                    onClick={handleReset}
                    disabled={saving}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    重置
                  </Button>

                  <Button
                    size="sm"
                    className={`bg-gradient-to-r ${currentGradient} text-white text-xs h-7 px-4 hover:opacity-90 transition-opacity`}
                    onClick={handleSave}
                    disabled={saving || !selectedProvider}
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 mr-1" />
                    )}
                    {saving ? '保存中...' : '保存并切换'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
