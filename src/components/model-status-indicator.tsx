'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Eye,
  Cpu,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

// ---------------------------------------------------------------------------
// Exported TypeScript interfaces
// ---------------------------------------------------------------------------
export interface ModelInfo {
  id: string
  name: string
  type: 'vlm' | 'llm'
  description: string
  usageContext: string
  status: 'online' | 'offline' | 'unknown'
}

export interface ProviderData {
  name: string
  provider: string
  isSandbox: boolean
  baseUrl?: string
}

export interface ModelsData {
  configured: boolean
  models: ModelInfo[]
  defaultModels: Record<string, string>
  provider: ProviderData
  systemCapabilities: {
    imageEvaluation: boolean
    textReasoning: boolean
    evolutionCycle: boolean
    crossFamilyTransfer: boolean
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getStatusDotColor(status: ModelInfo['status']): string {
  switch (status) {
    case 'online':
      return 'bg-emerald-400'
    case 'offline':
      return 'bg-rose-400'
    case 'unknown':
      return 'bg-slate-400'
  }
}

function getStatusDotShadow(status: ModelInfo['status']): string {
  switch (status) {
    case 'online':
      return 'shadow-[0_0_6px_rgba(52,211,153,0.6)]'
    case 'offline':
      return 'shadow-[0_0_6px_rgba(251,113,133,0.5)]'
    case 'unknown':
      return ''
  }
}

function getStatusLabel(status: ModelInfo['status']): string {
  switch (status) {
    case 'online':
      return '在线'
    case 'offline':
      return '离线'
    case 'unknown':
      return '未知'
  }
}

function getStatusBadgeClass(status: ModelInfo['status']): string {
  switch (status) {
    case 'online':
      return 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
    case 'offline':
      return 'border-rose-500/30 text-rose-300 bg-rose-500/10'
    case 'unknown':
      return 'border-slate-500/30 text-slate-400 bg-slate-500/10'
  }
}

const TASK_LABELS: Record<string, string> = {
  classification: '域分类',
  evaluation: '审美评估',
  reflection: '进化反思',
  transfer: '跨家族迁移',
}

const CAPABILITY_LABELS: Record<string, string> = {
  imageEvaluation: '图片评估',
  textReasoning: '文本推理',
  evolutionCycle: '进化循环',
  crossFamilyTransfer: '跨家族迁移',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Pulsing status dot */
function StatusDot({ status }: { status: ModelInfo['status'] }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === 'online' && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full ${getStatusDotColor(status)} opacity-75 animate-ping`}
        />
      )}
      <span
        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${getStatusDotColor(status)} ${getStatusDotShadow(status)}`}
      />
    </span>
  )
}

/** Compact single-line status indicator for one model */
function ModelCompactStatus({ model }: { model: ModelInfo }) {
  return (
    <div className="flex items-center gap-2">
      <StatusDot status={model.status} />
      {model.type === 'vlm' ? (
        <Eye className="w-3.5 h-3.5 text-slate-400" />
      ) : (
        <Brain className="w-3.5 h-3.5 text-slate-400" />
      )}
      <span className="text-xs text-slate-300 font-medium">{model.name}</span>
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0 h-4 ${getStatusBadgeClass(model.status)}`}
      >
        {getStatusLabel(model.status)}
      </Badge>
    </div>
  )
}

/** Expanded detail card for a single model */
function ModelDetailCard({ model }: { model: ModelInfo }) {
  return (
    <div className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-3.5 space-y-2.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-amber-500/10 border border-amber-500/20">
            {model.type === 'vlm' ? (
              <Eye className="w-4 h-4 text-amber-400" />
            ) : (
              <Brain className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">{model.name}</p>
            <p className="text-[11px] text-slate-500 font-mono">{model.id}</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`text-[11px] ${getStatusBadgeClass(model.status)}`}
        >
          {model.status === 'online' ? (
            <Wifi className="w-3 h-3 mr-1" />
          ) : model.status === 'offline' ? (
            <WifiOff className="w-3 h-3 mr-1" />
          ) : null}
          {getStatusLabel(model.status)}
        </Badge>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 leading-relaxed">
        {model.description}
      </p>

      {/* Usage context */}
      <div className="flex items-start gap-1.5">
        <Cpu className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          {model.usageContext}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
function LoadingSkeleton() {
  return (
    <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-3.5 w-3.5 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-3.5 w-3.5 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
          </div>
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-400">
            <WifiOff className="w-4 h-4" />
            <span className="text-xs">模型状态获取失败</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-amber-400"
            onClick={onRetry}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ModelStatusIndicator() {
  const [data, setData] = useState<ModelsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchModels = useCallback(async () => {
    setError(false)
    if (!loading) setRefreshing(true)

    try {
      const res = await fetch('/api/models')
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json as ModelsData)
    } catch (err) {
      console.error('[ModelStatusIndicator] fetch error:', err)
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  // --- Render: Loading ---
  if (loading) {
    return <LoadingSkeleton />
  }

  // --- Render: Error ---
  if (error) {
    return <ErrorState onRetry={fetchModels} />
  }

  // --- Render: No data (shouldn't happen, but guard) ---
  if (!data) {
    return <ErrorState onRetry={fetchModels} />
  }

  const vlmModel = data.models?.find((m) => m.type === 'vlm')
  const llmModel = data.models?.find((m) => m.type === 'llm')
  const allOnline = data.models?.every((m) => m.status === 'online') ?? false
  const anyOffline = data.models?.some((m) => m.status === 'offline') ?? false

  // Resolve model names for the default-mapping table
  const getModelNameById = (id: string) =>
    data.models?.find((m) => m.id === id)?.name ?? id

  return (
    <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm overflow-hidden">
      <CardContent className="p-0">
        {/* Compact status bar — always visible */}
        <div
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors duration-200 cursor-pointer"
          onClick={() => setExpanded((prev) => !prev)}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label="切换模型状态详情"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setExpanded((prev) => !prev)
            }
          }}
        >
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Overall system status badge */}
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-slate-300 hidden sm:inline">
                AI 模型
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-4 ${
                  !data.configured
                    ? 'border-amber-500/30 text-amber-300 bg-amber-500/10'
                    : allOnline
                      ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
                      : anyOffline
                        ? 'border-rose-500/30 text-rose-300 bg-rose-500/10'
                        : 'border-slate-500/30 text-slate-400 bg-slate-500/10'
                }`}
              >
                {!data.configured ? '未配置' : allOnline ? '全部在线' : anyOffline ? '部分离线' : '状态未知'}
              </Badge>
            </div>

            {/* VLM compact */}
            {vlmModel && <ModelCompactStatus model={vlmModel} />}
            {/* LLM compact */}
            {llmModel && <ModelCompactStatus model={llmModel} />}
          </div>

          <div className="flex items-center gap-1">
            {/* Refresh button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-amber-400"
              onClick={(e) => {
                e.stopPropagation()
                fetchModels()
              }}
              disabled={refreshing}
              aria-label="刷新模型状态"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
              />
            </Button>

            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </motion.div>
          </div>
        </div>

        {/* Expanded details */}
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
                {/* Provider info */}
                {data.provider && (
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="w-3 h-3 text-amber-400" />
                      AI 提供商
                    </h4>
                    <div className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-200">{data.provider.name}</span>
                        {data.provider.isSandbox && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            沙箱环境
                          </Badge>
                        )}
                      </div>
                      {data.provider.baseUrl && (
                        <p className="text-[11px] text-slate-500 font-mono truncate">{data.provider.baseUrl}</p>
                      )}
                    </div>
                  </div>
                )}

                <Separator className="bg-slate-700/50" />

                {/* Model detail cards */}
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-3 h-3 text-amber-400" />
                    模型详情
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.models?.map((model) => (
                      <ModelDetailCard key={model.id} model={model} />
                    )) ?? (
                      <p className="text-xs text-slate-500 col-span-2">未配置 AI 模型，请在 .env 中设置 AI_PROVIDER 和 AI_API_KEY</p>
                    )}
                  </div>
                </div>

                <Separator className="bg-slate-700/50" />

                {/* Default model mapping */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Brain className="w-3 h-3 text-amber-400" />
                    任务-模型映射
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(data.defaultModels).map(([task, modelId]) => (
                      <div
                        key={task}
                        className="flex items-center justify-between rounded-md bg-slate-800/30 border border-slate-700/20 px-3 py-2"
                      >
                        <span className="text-[11px] text-slate-500">
                          {TASK_LABELS[task] ?? task}
                        </span>
                        <span className="text-[11px] text-amber-300 font-medium truncate ml-2">
                          {getModelNameById(modelId)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-slate-700/50" />

                {/* System capabilities */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3 h-3 text-amber-400" />
                    系统能力
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(data.systemCapabilities).map(
                      ([key, enabled]) => (
                        <div
                          key={key}
                          className={`flex items-center gap-2 rounded-md border px-3 py-2 transition-colors duration-200 ${
                            enabled
                              ? 'bg-emerald-500/5 border-emerald-500/20'
                              : 'bg-slate-800/30 border-slate-700/20'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              enabled ? 'bg-emerald-400' : 'bg-slate-600'
                            }`}
                          />
                          <span
                            className={`text-[11px] ${
                              enabled ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {CAPABILITY_LABELS[key] ?? key}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
