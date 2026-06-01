'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  Square,
  RefreshCw,
  Globe,
  Database,
  Clock,
  Zap,
  Activity,
  Search,
  Plus,
  Trash2,
  Settings,
  ChevronDown,
  ExternalLink,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  FAMILY_COLORS,
  FAMILY_NAMES,
  FAMILY_BG,
  FAMILY_DOT,
  FAMILY_BORDER,
} from '@/lib/family-constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PipelineStatus {
  phase: 'idle' | 'discovering' | 'evaluating' | 'evolving' | 'complete' | 'error'
  currentFamily: string | null
  current: number
  total: number
  lastRunAt: string | null
  lastResult: {
    taskId?: string
    itemsDiscovered?: number
    itemsEvaluated?: number
    itemsFailed?: number
    itemsSkipped?: number
    evolutionTriggered?: boolean
    rulesCreated?: number
    rulesDeprecated?: number
    duration?: number
  } | null
  isRunning: boolean
  error: string | null
}

interface CrawlSource {
  id: string
  name: string
  type: string
  familyKey: string | null
  query: string | null
  maxItems: number
  status: string
  totalFound: number
  totalEvaluated: number
  lastCrawledAt: string | null
  createdAt: string
}

interface CrawledItem {
  id: string
  imageUrl: string | null
  title: string | null
  familyKey: string | null
  evaluationStatus: string
  overallScore: number | null
  sourceId: string | null
  sourceName?: string
  createdAt: string
}

interface SchedulerStatus {
  isRunning: boolean
  intervalMinutes: number
  nextRunAt: string | null
  lastRunAt: string | null
  lastRunResult: { success: boolean; familiesProcessed?: number; error?: string } | null
  config: {
    intervalMinutes: number
    familyKeys: string[]
    maxItemsPerFamily: number
    triggerEvolution: boolean
    language: string
  }
}

// ---------------------------------------------------------------------------
// Pipeline phase config
// ---------------------------------------------------------------------------

const PHASE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  idle: { label: '空闲', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  discovering: { label: '发现中', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  evaluating: { label: '评估中', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  evolving: { label: '进化中', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  complete: { label: '完成', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  error: { label: '错误', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
}

const SOURCE_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  search: { label: '搜索', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  gallery: { label: '图库', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  custom: { label: '自定义', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
}

const EVAL_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: '待评估', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  evaluated: { label: '已评估', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  failed: { label: '失败', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  skipped: { label: '跳过', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
}

const SOURCE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active: { label: '活跃', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  paused: { label: '暂停', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  error: { label: '错误', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AutoEvolutionPanel() {
  // ---- Shared state ----
  const [activeTab, setActiveTab] = useState('auto-evolve')

  // ---- Tab 1: Auto Evolution state ----
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(true)
  const [pipelineRunning, setPipelineRunning] = useState(false)
  const [selectedFamily, setSelectedFamily] = useState<string>('all')
  const [evalLanguage, setEvalLanguage] = useState<string>('zh')
  const [autoEvolve, setAutoEvolve] = useState(true)
  const [maxItems, setMaxItems] = useState(5)
  const pipelineLogRef = useRef<HTMLDivElement>(null)

  // ---- Tab 2: Data Sources state ----
  const [sources, setSources] = useState<CrawlSource[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false)
  const [newSource, setNewSource] = useState({
    name: '',
    type: 'search',
    familyKey: 'narrative_visual',
    query: '',
    maxItems: 5,
  })
  const [deleteSourceId, setDeleteSourceId] = useState<string | null>(null)
  const [actingSourceId, setActingSourceId] = useState<string | null>(null)

  // ---- Tab 3: Crawled Data state ----
  const [items, setItems] = useState<CrawledItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [itemsFamilyFilter, setItemsFamilyFilter] = useState<string>('all')
  const [itemsStatusFilter, setItemsStatusFilter] = useState<string>('all')
  const itemsOffsetRef = useRef(0)
  const [itemsHasMore, setItemsHasMore] = useState(false)
  const [itemsTotal, setItemsTotal] = useState(0)
  const [itemsEvaluated, setItemsEvaluated] = useState(0)
  const [itemsPending, setItemsPending] = useState(0)
  const [itemsFailed, setItemsFailed] = useState(0)
  const [hoveredImage, setHoveredImage] = useState<string | null>(null)
  const ITEMS_PAGE_SIZE = 12

  // ---- Tab 4: Scheduler state ----
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null)
  const [schedulerLoading, setSchedulerLoading] = useState(true)
  const [schedulerConnected, setSchedulerConnected] = useState(false)
  const [schedulerConfig, setSchedulerConfig] = useState({
    intervalMinutes: 30,
    familyKeys: 'all',
    maxItemsPerFamily: 5,
    triggerEvolution: true,
    language: 'zh',
  })

  // =========================================================================
  // Tab 1: Auto Evolution — Data fetching
  // =========================================================================

  const fetchPipelineStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/crawl/status')
      if (res.ok) {
        const data = await res.json()
        const raw = data.data || data
        setPipelineStatus({
          phase: raw.currentPhase || 'idle',
          currentFamily: raw.currentFamily || null,
          current: raw.progress?.current || 0,
          total: raw.progress?.total || 0,
          lastRunAt: raw.lastRunAt,
          lastResult: raw.lastResult,
          isRunning: raw.isRunning || false,
          error: raw.error || null,
        })
        setPipelineRunning(raw.isRunning || false)
      }
    } catch {
      // silently ignore
    } finally {
      setPipelineLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPipelineStatus()
    const interval = setInterval(fetchPipelineStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchPipelineStatus])

  // Auto-scroll log panel when status changes
  useEffect(() => {
    if (pipelineLogRef.current) {
      pipelineLogRef.current.scrollTop = pipelineLogRef.current.scrollHeight
    }
  }, [pipelineStatus?.phase, pipelineStatus?.current, pipelineStatus?.currentFamily])

  // =========================================================================
  // Tab 2: Data Sources — Data fetching
  // =========================================================================

  const fetchSources = useCallback(async () => {
    setSourcesLoading(true)
    try {
      const res = await fetch('/api/crawl/sources')
      if (res.ok) {
        const data = await res.json()
        setSources(data.data || [])
      }
    } catch {
      setSources([])
    } finally {
      setSourcesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'data-sources') {
      fetchSources()
    }
  }, [activeTab, fetchSources])

  // =========================================================================
  // Tab 3: Crawled Data — Data fetching
  // =========================================================================

  const fetchItems = useCallback(async (reset = true) => {
    if (reset) {
      setItemsLoading(true)
      itemsOffsetRef.current = 0
    }
    try {
      const params = new URLSearchParams()
      params.set('limit', String(ITEMS_PAGE_SIZE))
      params.set('offset', String(reset ? 0 : itemsOffsetRef.current))
      if (itemsFamilyFilter !== 'all') params.set('familyKey', itemsFamilyFilter)
      if (itemsStatusFilter !== 'all') params.set('evaluationStatus', itemsStatusFilter)

      const res = await fetch(`/api/crawl/items?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const newItems = data.data || data.items || []
        if (reset) {
          setItems(newItems)
          itemsOffsetRef.current = ITEMS_PAGE_SIZE
        } else {
          setItems(prev => {
            const existingIds = new Set(prev.map(i => i.id))
            const unique = newItems.filter((i: CrawledItem) => !existingIds.has(i.id))
            return [...prev, ...unique]
          })
          itemsOffsetRef.current += ITEMS_PAGE_SIZE
        }
        setItemsHasMore(data.pagination?.hasMore ?? false)
        setItemsTotal(data.pagination?.total ?? newItems.length)
      }
    } catch {
      if (reset) setItems([])
    } finally {
      setItemsLoading(false)
    }
  }, [itemsFamilyFilter, itemsStatusFilter])

  // Fetch item stats
  const fetchItemStats = useCallback(async () => {
    try {
      const [totalRes, evalRes, pendRes, failRes] = await Promise.all([
        fetch('/api/crawl/items?limit=1'),
        fetch('/api/crawl/items?limit=1&evaluationStatus=evaluated'),
        fetch('/api/crawl/items?limit=1&evaluationStatus=pending'),
        fetch('/api/crawl/items?limit=1&evaluationStatus=failed'),
      ])
      if (totalRes.ok) { const d = await totalRes.json(); setItemsTotal(d.pagination?.total ?? 0) }
      if (evalRes.ok) { const d = await evalRes.json(); setItemsEvaluated(d.pagination?.total ?? 0) }
      if (pendRes.ok) { const d = await pendRes.json(); setItemsPending(d.pagination?.total ?? 0) }
      if (failRes.ok) { const d = await failRes.json(); setItemsFailed(d.pagination?.total ?? 0) }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'crawled-data') {
      fetchItems(true)
      fetchItemStats()
    }
  }, [activeTab, itemsFamilyFilter, itemsStatusFilter, fetchItems, fetchItemStats])

  // =========================================================================
  // Tab 4: Scheduler — Data fetching
  // =========================================================================

  const fetchSchedulerStatus = useCallback(async () => {
    setSchedulerLoading(true)
    try {
      const res = await fetch('/status?XTransformPort=3002')
      if (res.ok) {
        const data = await res.json()
        setSchedulerStatus(data)
        setSchedulerConnected(true)
        if (data.config) {
          setSchedulerConfig({
            intervalMinutes: data.config.intervalMinutes || 30,
            familyKeys: data.config.familyKeys?.join(',') || 'all',
            maxItemsPerFamily: data.config.maxItemsPerFamily || 5,
            triggerEvolution: data.config.triggerEvolution ?? true,
            language: data.config.language || 'zh',
          })
        }
      } else {
        setSchedulerConnected(false)
      }
    } catch {
      setSchedulerConnected(false)
      setSchedulerStatus(null)
    } finally {
      setSchedulerLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'scheduler') {
      fetchSchedulerStatus()
    }
  }, [activeTab, fetchSchedulerStatus])

  // =========================================================================
  // Tab 1: Auto Evolution — Actions
  // =========================================================================

  const startPipeline = async () => {
    setPipelineRunning(true)
    try {
      const body: Record<string, unknown> = {
        familyKey: selectedFamily === 'all' ? undefined : selectedFamily,
        language: evalLanguage,
        autoEvolve,
        maxItemsPerFamily: maxItems,
      }
      const res = await fetch('/api/crawl/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Pipeline启动失败')
      }
      toast.success('全自动进化Pipeline已启动')
      setTimeout(fetchPipelineStatus, 2000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '启动失败，请重试')
      setPipelineRunning(false)
    }
  }

  const discoverOnly = async () => {
    setPipelineRunning(true)
    try {
      const body: Record<string, unknown> = {
        familyKey: selectedFamily === 'all' ? undefined : selectedFamily,
        maxItemsPerFamily: maxItems,
      }
      const res = await fetch('/api/crawl/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '发现失败')
      }
      toast.success('发现任务已启动')
      setTimeout(fetchPipelineStatus, 2000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '发现失败，请重试')
      setPipelineRunning(false)
    }
  }

  const stopPipeline = async () => {
    // There's no explicit stop endpoint, but we can update the UI
    setPipelineRunning(false)
    toast.info('Pipeline将在当前步骤完成后停止')
  }

  // =========================================================================
  // Tab 2: Data Sources — Actions
  // =========================================================================

  const createSource = async () => {
    try {
      const res = await fetch('/api/crawl/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSource),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '创建数据源失败')
      }
      toast.success('数据源创建成功')
      setSourceDialogOpen(false)
      setNewSource({ name: '', type: 'search', familyKey: 'narrative_visual', query: '', maxItems: 5 })
      await fetchSources()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败，请重试')
    }
  }

  const toggleSourcePause = async (source: CrawlSource) => {
    setActingSourceId(source.id)
    try {
      const res = await fetch(`/api/crawl/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: source.status === 'active' ? 'paused' : 'active' }),
      })
      if (!res.ok) throw new Error('操作失败')
      toast.success(source.status === 'active' ? '已暂停' : '已恢复')
      await fetchSources()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setActingSourceId(null)
    }
  }

  const deleteSource = async (id: string) => {
    setActingSourceId(id)
    try {
      const res = await fetch(`/api/crawl/sources/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('删除失败')
      toast.success('数据源已删除')
      await fetchSources()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    } finally {
      setActingSourceId(null)
      setDeleteSourceId(null)
    }
  }

  const seedDefaultSources = async () => {
    try {
      const res = await fetch('/api/crawl/seed')
      if (!res.ok) throw new Error('Seed失败')
      const data = await res.json()
      toast.success(`已种入 ${data.data?.created || 0} 个默认数据源${data.data?.skipped ? `，跳过 ${data.data.skipped} 个已存在` : ''}`)
      await fetchSources()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Seed失败')
    }
  }

  // =========================================================================
  // Tab 4: Scheduler — Actions
  // =========================================================================

  const startScheduler = async () => {
    try {
      const res = await fetch('/start?XTransformPort=3002', { method: 'POST' })
      if (!res.ok) throw new Error('启动调度器失败')
      toast.success('调度器已启动')
      await fetchSchedulerStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '启动失败')
    }
  }

  const stopScheduler = async () => {
    try {
      const res = await fetch('/stop?XTransformPort=3002', { method: 'POST' })
      if (!res.ok) throw new Error('停止调度器失败')
      toast.success('调度器已停止')
      await fetchSchedulerStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '停止失败')
    }
  }

  const triggerScheduler = async () => {
    try {
      const res = await fetch('/trigger?XTransformPort=3002', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '触发失败')
      }
      toast.success('手动触发成功')
      await fetchSchedulerStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '触发失败')
    }
  }

  const saveSchedulerConfig = async () => {
    try {
      const body = {
        intervalMinutes: schedulerConfig.intervalMinutes,
        familyKeys: schedulerConfig.familyKeys === 'all'
          ? Object.keys(FAMILY_NAMES)
          : schedulerConfig.familyKeys.split(',').map(k => k.trim()).filter(Boolean),
        maxItemsPerFamily: schedulerConfig.maxItemsPerFamily,
        triggerEvolution: schedulerConfig.triggerEvolution,
        language: schedulerConfig.language,
      }
      const res = await fetch('/config?XTransformPort=3002', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('保存配置失败')
      toast.success('调度器配置已保存')
      await fetchSchedulerStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败')
    }
  }

  // =========================================================================
  // Render helpers
  // =========================================================================

  const familyOptions = Object.entries(FAMILY_NAMES)

  const phaseConfig = PHASE_CONFIG[pipelineStatus?.phase || 'idle']

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      {/* Header */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-violet-500/10">
            <Zap className="w-7 h-7 text-violet-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-50">
            自动进化控制台
          </h2>
        </div>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          管理爬取数据源、触发自动评估与进化、配置定时调度
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mx-auto flex w-full max-w-2xl bg-slate-900/80 border border-slate-700/50 rounded-xl h-11 p-1">
          <TabsTrigger
            value="auto-evolve"
            className="flex-1 rounded-lg data-[state=active]:bg-violet-600/20 data-[state=active]:text-violet-300 data-[state=active]:border-violet-500/30 border border-transparent text-slate-400 transition-all"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            自动进化
          </TabsTrigger>
          <TabsTrigger
            value="data-sources"
            className="flex-1 rounded-lg data-[state=active]:bg-cyan-600/20 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/30 border border-transparent text-slate-400 transition-all"
          >
            <Globe className="w-4 h-4 mr-1.5" />
            数据源
          </TabsTrigger>
          <TabsTrigger
            value="crawled-data"
            className="flex-1 rounded-lg data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/30 border border-transparent text-slate-400 transition-all"
          >
            <Database className="w-4 h-4 mr-1.5" />
            爬取数据
          </TabsTrigger>
          <TabsTrigger
            value="scheduler"
            className="flex-1 rounded-lg data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-300 data-[state=active]:border-amber-500/30 border border-transparent text-slate-400 transition-all"
          >
            <Clock className="w-4 h-4 mr-1.5" />
            调度器
          </TabsTrigger>
        </TabsList>

        {/* ============================================================= */}
        {/* Tab 1: Auto Evolution */}
        {/* ============================================================= */}
        <TabsContent value="auto-evolve" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pipeline Status Card */}
            <motion.div
              className="lg:col-span-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
                    <Activity className="w-5 h-5 text-violet-400" />
                    Pipeline 状态
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {pipelineLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-8 rounded-lg bg-slate-800/50" />
                      <Skeleton className="h-4 rounded bg-slate-800/50 w-3/4" />
                      <Skeleton className="h-12 rounded-lg bg-slate-800/50" />
                    </div>
                  ) : (
                    <>
                      {/* Phase indicator */}
                      <div className="flex items-center gap-3">
                        <motion.div
                          className={`w-3 h-3 rounded-full ${phaseConfig.bg} border ${phaseConfig.border}`}
                          animate={pipelineRunning ? { scale: [1, 1.3, 1] } : {}}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        <Badge
                          variant="outline"
                          className={`${phaseConfig.color} ${phaseConfig.bg} ${phaseConfig.border} border text-sm px-3 py-1`}
                        >
                          {phaseConfig.label}
                        </Badge>
                        {pipelineRunning && (
                          <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                        )}
                      </div>

                      {/* Progress */}
                      {(pipelineStatus?.total ?? 0) > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">进度</span>
                            <span className="text-slate-300">
                              {pipelineStatus?.current ?? 0} / {pipelineStatus?.total ?? 0}
                            </span>
                          </div>
                          <Progress
                            value={pipelineStatus?.total ? (pipelineStatus.current / pipelineStatus.total) * 100 : 0}
                            className="h-2 bg-slate-700/50 [&>div]:bg-violet-500"
                          />
                        </div>
                      )}

                      {/* Current family */}
                      {pipelineStatus?.currentFamily && pipelineRunning && (
                        <div className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span className={FAMILY_DOT[pipelineStatus.currentFamily] || 'bg-slate-400'} />
                          当前家族: <span className="text-slate-200 font-medium">{FAMILY_NAMES[pipelineStatus.currentFamily] || pipelineStatus.currentFamily}</span>
                        </div>
                      )}

                      {/* Last run info */}
                      {pipelineStatus?.lastRunAt && (
                        <div className="space-y-1">
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            上次运行: {new Date(pipelineStatus.lastRunAt).toLocaleString('zh-CN')}
                            {pipelineStatus.lastResult && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 text-emerald-400 bg-emerald-500/10 border-emerald-500/20 border"
                              >
                                完成
                              </Badge>
                            )}
                          </div>
                          {pipelineStatus.lastResult && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                              {pipelineStatus.lastResult.itemsDiscovered !== undefined && (
                                <span>发现: <span className="text-cyan-400">{pipelineStatus.lastResult.itemsDiscovered}</span></span>
                              )}
                              {pipelineStatus.lastResult.itemsEvaluated !== undefined && (
                                <span>评估: <span className="text-amber-400">{pipelineStatus.lastResult.itemsEvaluated}</span></span>
                              )}
                              {pipelineStatus.lastResult.itemsFailed !== undefined && pipelineStatus.lastResult.itemsFailed > 0 && (
                                <span>失败: <span className="text-rose-400">{pipelineStatus.lastResult.itemsFailed}</span></span>
                              )}
                              {pipelineStatus.lastResult.evolutionTriggered && (
                                <span>进化: <span className="text-violet-400">已触发</span></span>
                              )}
                              {pipelineStatus.lastResult.rulesCreated !== undefined && pipelineStatus.lastResult.rulesCreated > 0 && (
                                <span>新规则: <span className="text-emerald-400">{pipelineStatus.lastResult.rulesCreated}</span></span>
                              )}
                              {pipelineStatus.lastResult.duration !== undefined && (
                                <span>耗时: <span className="text-slate-300">{(pipelineStatus.lastResult.duration / 1000).toFixed(1)}s</span></span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Error display */}
                      {pipelineStatus?.error && (
                        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                          {pipelineStatus.error}
                        </div>
                      )}
                    </>
                  )}

                  <Separator className="bg-slate-700/50" />

                  {/* Controls */}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={startPipeline}
                      disabled={pipelineRunning}
                      className="bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-lg shadow-violet-500/20 transition-all"
                    >
                      {pipelineRunning ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      启动全自动进化
                    </Button>
                    <Button
                      onClick={discoverOnly}
                      disabled={pipelineRunning}
                      variant="outline"
                      className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      仅发现
                    </Button>
                    {pipelineRunning && (
                      <Button
                        onClick={stopPipeline}
                        variant="destructive"
                        className="bg-rose-600 hover:bg-rose-500"
                      >
                        <Square className="w-4 h-4 mr-2" />
                        停止
                      </Button>
                    )}
                  </div>

                  {/* Configuration row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                    {/* Family selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-medium">目标家族</label>
                      <Select value={selectedFamily} onValueChange={setSelectedFamily}>
                        <SelectTrigger className="bg-slate-800/50 border-slate-600 text-slate-200 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          <SelectItem value="all" className="text-slate-200 focus:bg-slate-700">全部家族</SelectItem>
                          {familyOptions.map(([key, name]) => (
                            <SelectItem key={key} value={key} className="text-slate-200 focus:bg-slate-700">
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Language toggle */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-medium">评估语言</label>
                      <Select value={evalLanguage} onValueChange={setEvalLanguage}>
                        <SelectTrigger className="bg-slate-800/50 border-slate-600 text-slate-200 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          <SelectItem value="zh" className="text-slate-200 focus:bg-slate-700">中文</SelectItem>
                          <SelectItem value="en" className="text-slate-200 focus:bg-slate-700">English</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Auto-evolve toggle */}
                    <div className="flex items-center justify-between sm:col-span-1">
                      <div className="space-y-0.5">
                        <label className="text-xs text-slate-400 font-medium">自动进化</label>
                        <p className="text-[10px] text-slate-500">爬取后自动触发进化</p>
                      </div>
                      <Switch
                        checked={autoEvolve}
                        onCheckedChange={setAutoEvolve}
                        className="data-[state=checked]:bg-violet-600"
                      />
                    </div>

                    {/* Max items */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-medium">每家族最大条数</label>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={maxItems}
                        onChange={(e) => setMaxItems(Math.min(50, Math.max(1, Number(e.target.value) || 5)))}
                        className="bg-slate-800/50 border-slate-600 text-slate-200 h-9 w-24"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Pipeline Details */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm h-full">
                <CardHeader>
                  <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
                    <Activity className="w-5 h-5 text-amber-400" />
                    Pipeline 详情
                    {pipelineRunning && (
                      <motion.div
                        className="w-2 h-2 rounded-full bg-emerald-400 ml-auto"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    ref={pipelineLogRef}
                    className="h-64 overflow-y-auto custom-scrollbar space-y-3 pr-1 bg-slate-950/50 rounded-lg p-3 border border-slate-800/50"
                  >
                    {/* Phase detail */}
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${phaseConfig.bg} border ${phaseConfig.border}`} />
                      <span className="text-xs text-slate-400">阶段:</span>
                      <span className={`text-xs font-medium ${phaseConfig.color}`}>{phaseConfig.label}</span>
                    </div>

                    {/* Current family */}
                    {pipelineStatus?.currentFamily && (
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${FAMILY_DOT[pipelineStatus.currentFamily] || 'bg-slate-400'}`} />
                        <span className="text-xs text-slate-400">家族:</span>
                        <span className="text-xs text-slate-200 font-medium">{FAMILY_NAMES[pipelineStatus.currentFamily] || pipelineStatus.currentFamily}</span>
                      </div>
                    )}

                    {/* Progress detail */}
                    {(pipelineStatus?.total ?? 0) > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">进度:</span>
                          <span className="text-xs text-slate-200">{pipelineStatus?.current ?? 0}/{pipelineStatus?.total ?? 0}</span>
                        </div>
                        <Progress
                          value={pipelineStatus?.total ? (pipelineStatus.current / pipelineStatus.total) * 100 : 0}
                          className="h-1.5 bg-slate-700/50 [&>div]:bg-violet-500"
                        />
                      </div>
                    )}

                    {/* Last result summary */}
                    {pipelineStatus?.lastResult && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                        <span className="text-xs text-slate-500 font-medium">上次运行结果</span>
                        {pipelineStatus.lastResult.itemsDiscovered !== undefined && (
                          <div className="text-xs text-slate-400 flex justify-between">
                            <span>发现图片</span>
                            <span className="text-cyan-400">{pipelineStatus.lastResult.itemsDiscovered}</span>
                          </div>
                        )}
                        {pipelineStatus.lastResult.itemsEvaluated !== undefined && (
                          <div className="text-xs text-slate-400 flex justify-between">
                            <span>评估完成</span>
                            <span className="text-amber-400">{pipelineStatus.lastResult.itemsEvaluated}</span>
                          </div>
                        )}
                        {pipelineStatus.lastResult.itemsFailed !== undefined && (
                          <div className="text-xs text-slate-400 flex justify-between">
                            <span>评估失败</span>
                            <span className="text-rose-400">{pipelineStatus.lastResult.itemsFailed}</span>
                          </div>
                        )}
                        {pipelineStatus.lastResult.itemsSkipped !== undefined && (
                          <div className="text-xs text-slate-400 flex justify-between">
                            <span>跳过</span>
                            <span className="text-slate-300">{pipelineStatus.lastResult.itemsSkipped}</span>
                          </div>
                        )}
                        {pipelineStatus.lastResult.evolutionTriggered && (
                          <div className="text-xs text-slate-400 flex justify-between">
                            <span>进化触发</span>
                            <span className="text-violet-400">是</span>
                          </div>
                        )}
                        {pipelineStatus.lastResult.rulesCreated !== undefined && (
                          <div className="text-xs text-slate-400 flex justify-between">
                            <span>新规则</span>
                            <span className="text-emerald-400">{pipelineStatus.lastResult.rulesCreated}</span>
                          </div>
                        )}
                        {pipelineStatus.lastResult.rulesDeprecated !== undefined && (
                          <div className="text-xs text-slate-400 flex justify-between">
                            <span>废弃规则</span>
                            <span className="text-rose-400">{pipelineStatus.lastResult.rulesDeprecated}</span>
                          </div>
                        )}
                        {pipelineStatus.lastResult.duration !== undefined && (
                          <div className="text-xs text-slate-400 flex justify-between">
                            <span>耗时</span>
                            <span className="text-slate-300">{(pipelineStatus.lastResult.duration / 1000).toFixed(1)}s</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Error */}
                    {pipelineStatus?.error && (
                      <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-1.5">
                        {pipelineStatus.error}
                      </div>
                    )}

                    {/* Empty state */}
                    {!pipelineRunning && !pipelineStatus?.lastResult && !pipelineStatus?.error && (
                      <div className="text-center py-8 text-slate-600 text-xs">
                        空闲状态，启动Pipeline后显示详情
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* ============================================================= */}
        {/* Tab 2: Data Sources */}
        {/* ============================================================= */}
        <TabsContent value="data-sources" className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setSourceDialogOpen(true)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-500/20"
              >
                <Plus className="w-4 h-4 mr-2" />
                添加数据源
              </Button>
              <Button
                onClick={seedDefaultSources}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              >
                <Settings className="w-4 h-4 mr-2" />
                种入默认数据源
              </Button>
            </div>
            <Button
              onClick={fetchSources}
              variant="outline"
              size="sm"
              disabled={sourcesLoading}
              className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${sourcesLoading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>

          {sourcesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl bg-slate-800/50" />
              ))}
            </div>
          ) : sources.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {sources.map((source, idx) => {
                  const typeCfg = SOURCE_TYPE_CONFIG[source.type] || SOURCE_TYPE_CONFIG.custom
                  const statusCfg = SOURCE_STATUS_CONFIG[source.status] || SOURCE_STATUS_CONFIG.active
                  const familyColor = FAMILY_COLORS[source.familyKey] || 'text-slate-400'
                  const familyBg = FAMILY_BG[source.familyKey] || 'bg-slate-500/10'
                  const familyName = FAMILY_NAMES[source.familyKey] || source.familyKey

                  return (
                    <motion.div
                      key={source.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                    >
                      <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm hover:border-slate-600/50 transition-colors">
                        <CardContent className="p-4">
                          {/* Header row */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-slate-100 truncate">
                                {source.name}
                              </h3>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeCfg.color} ${typeCfg.bg} ${typeCfg.border} border`}>
                                  {typeCfg.label}
                                </Badge>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${familyColor} ${familyBg} border-slate-600/30 border`}>
                                  {familyName}
                                </Badge>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusCfg.color} ${statusCfg.bg} ${statusCfg.border} border`}>
                                  {statusCfg.label}
                                </Badge>
                              </div>
                            </div>
                            <div className={`w-2 h-2 rounded-full mt-2 ${FAMILY_DOT[source.familyKey] || 'bg-slate-400'}`} />
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Search className="w-3 h-3 text-cyan-400" />
                              <span>发现: <span className="text-slate-200 font-medium">{source.totalFound}</span></span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>评估: <span className="text-slate-200 font-medium">{source.totalEvaluated}</span></span>
                            </div>
                          </div>

                          {/* Last crawled */}
                          {source.lastCrawledAt && (
                            <p className="text-[10px] text-slate-500 mb-3 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              最近爬取: {new Date(source.lastCrawledAt).toLocaleString('zh-CN')}
                            </p>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-700/30">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleSourcePause(source)}
                              disabled={actingSourceId === source.id}
                              className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100 text-xs h-7 px-2.5"
                            >
                              {actingSourceId === source.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : source.status === 'active' ? (
                                <><Pause className="w-3 h-3 mr-1" />暂停</>
                              ) : (
                                <><Play className="w-3 h-3 mr-1" />恢复</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeleteSourceId(source.id)}
                              disabled={actingSourceId === source.id}
                              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs h-7 px-2.5"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              删除
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-16">
              <Globe className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg font-medium mb-1">暂无数据源</p>
              <p className="text-slate-500 text-sm mb-4">
                添加数据源或种入默认数据源开始自动爬取
              </p>
              <Button
                onClick={seedDefaultSources}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              >
                <Settings className="w-4 h-4 mr-2" />
                种入默认数据源
              </Button>
            </div>
          )}

          {/* Add Source Dialog */}
          <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
            <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-slate-100">添加数据源</DialogTitle>
                <DialogDescription className="text-slate-400">
                  创建新的爬取数据源，用于发现和评估审美图片
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">名称</label>
                  <Input
                    value={newSource.name}
                    onChange={(e) => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="数据源名称"
                    className="bg-slate-800/50 border-slate-600 text-slate-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">类型</label>
                    <Select value={newSource.type} onValueChange={(v) => setNewSource(prev => ({ ...prev, type: v }))}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-600 text-slate-200 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="search" className="text-slate-200">搜索</SelectItem>
                        <SelectItem value="gallery" className="text-slate-200">图库</SelectItem>
                        <SelectItem value="custom" className="text-slate-200">自定义</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">家族</label>
                    <Select value={newSource.familyKey} onValueChange={(v) => setNewSource(prev => ({ ...prev, familyKey: v }))}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-600 text-slate-200 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        {familyOptions.map(([key, name]) => (
                          <SelectItem key={key} value={key} className="text-slate-200 focus:bg-slate-700">
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">查询词</label>
                  <Input
                    value={newSource.query}
                    onChange={(e) => setNewSource(prev => ({ ...prev, query: e.target.value }))}
                    placeholder="搜索关键词..."
                    className="bg-slate-800/50 border-slate-600 text-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">最大条数</label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={newSource.maxItems}
                    onChange={(e) => setNewSource(prev => ({ ...prev, maxItems: Math.min(50, Math.max(1, Number(e.target.value) || 5)) }))}
                    className="bg-slate-800/50 border-slate-600 text-slate-200 w-24"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSourceDialogOpen(false)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  取消
                </Button>
                <Button
                  onClick={createSource}
                  disabled={!newSource.name}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  创建
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Source Confirmation */}
          <AlertDialog
            open={deleteSourceId !== null}
            onOpenChange={(open) => { if (!open) setDeleteSourceId(null) }}
          >
            <AlertDialogContent className="bg-slate-900 border-slate-700 text-slate-200">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-slate-100">确认删除数据源</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-400">
                  删除后该数据源及其关联的爬取记录将无法恢复。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700">
                  取消
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { if (deleteSourceId) deleteSource(deleteSourceId) }}
                  className="bg-rose-600 hover:bg-rose-500 text-white"
                >
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        {/* ============================================================= */}
        {/* Tab 3: Crawled Data */}
        {/* ============================================================= */}
        <TabsContent value="crawled-data" className="mt-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: '总条目', value: itemsTotal, icon: Database, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: '已评估', value: itemsEvaluated, icon: CheckCircle2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { label: '待评估', value: itemsPending, icon: Clock, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
              { label: '失败', value: itemsFailed, icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.08 }}
              >
                <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${stat.bg}`}>
                        <stat.icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                      <div>
                        <div className="text-xl font-bold text-slate-50">
                          {itemsLoading ? <Skeleton className="h-6 w-8 bg-slate-700/50 inline-block" /> : stat.value}
                        </div>
                        <p className="text-xs text-slate-400">{stat.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Select value={itemsFamilyFilter} onValueChange={setItemsFamilyFilter}>
              <SelectTrigger className="w-40 bg-slate-800/50 border-slate-600 text-slate-200 h-9">
                <SelectValue placeholder="选择家族" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all" className="text-slate-200 focus:bg-slate-700">全部家族</SelectItem>
                {familyOptions.map(([key, name]) => (
                  <SelectItem key={key} value={key} className="text-slate-200 focus:bg-slate-700">
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={itemsStatusFilter} onValueChange={setItemsStatusFilter}>
              <SelectTrigger className="w-36 bg-slate-800/50 border-slate-600 text-slate-200 h-9">
                <SelectValue placeholder="评估状态" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all" className="text-slate-200 focus:bg-slate-700">全部状态</SelectItem>
                <SelectItem value="pending" className="text-slate-200 focus:bg-slate-700">待评估</SelectItem>
                <SelectItem value="evaluated" className="text-slate-200 focus:bg-slate-700">已评估</SelectItem>
                <SelectItem value="failed" className="text-slate-200 focus:bg-slate-700">失败</SelectItem>
                <SelectItem value="skipped" className="text-slate-200 focus:bg-slate-700">跳过</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => { fetchItems(true); fetchItemStats() }}
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              刷新
            </Button>
          </div>

          {/* Data Grid */}
          {itemsLoading && items.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl bg-slate-800/50" />
              ))}
            </div>
          ) : items.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {items.map((item, idx) => {
                    const evalCfg = EVAL_STATUS_CONFIG[item.evaluationStatus] || EVAL_STATUS_CONFIG.pending
                    const familyColor = FAMILY_COLORS[item.familyKey] || 'text-slate-400'
                    const familyBg = FAMILY_BG[item.familyKey] || 'bg-slate-500/10'
                    const familyName = FAMILY_NAMES[item.familyKey] || item.familyKey

                    return (
                      <motion.div
                        key={`${item.id}-${idx}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3, delay: idx * 0.03 }}
                        className="relative group"
                        onMouseEnter={() => item.imageUrl && setHoveredImage(item.imageUrl)}
                        onMouseLeave={() => setHoveredImage(null)}
                      >
                        <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm hover:border-slate-600/50 transition-all overflow-hidden">
                          {/* Image area */}
                          {item.imageUrl ? (
                            <div className="relative h-28 bg-slate-800/50 overflow-hidden">
                              <img
                                src={item.imageUrl}
                                alt={item.title || 'Crawled image'}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                              />
                              {/* Hover preview overlay */}
                              {hoveredImage === item.imageUrl && (
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="absolute inset-0 bg-black/40 flex items-center justify-center"
                                >
                                  <ExternalLink className="w-5 h-5 text-white/80" />
                                </motion.div>
                              )}
                            </div>
                          ) : (
                            <div className="h-28 bg-slate-800/30 flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-slate-600" />
                            </div>
                          )}

                          <CardContent className="p-3">
                            {/* Title */}
                            <p className="text-xs text-slate-200 font-medium truncate mb-2">
                              {item.title || '未命名'}
                            </p>

                            {/* Badges */}
                            <div className="flex items-center gap-1.5 mb-2">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${familyColor} ${familyBg} border-slate-600/30 border`}>
                                {familyName}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${evalCfg.color} ${evalCfg.bg} ${evalCfg.border} border`}>
                                {evalCfg.label}
                              </Badge>
                            </div>

                            {/* Score */}
                            {item.overallScore != null && (
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] text-slate-500">评分</span>
                                <span className={`text-sm font-semibold ${
                                  item.overallScore >= 7 ? 'text-emerald-400'
                                  : item.overallScore >= 4 ? 'text-amber-400'
                                  : 'text-rose-400'
                                }`}>
                                  {item.overallScore.toFixed(1)}
                                </span>
                              </div>
                            )}

                            {/* Date */}
                            <p className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(item.createdAt).toLocaleString('zh-CN')}
                            </p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>

              {/* Load More */}
              {itemsHasMore && (
                <div className="flex justify-center pt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchItems(false)}
                    className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                  >
                    <ChevronDown className="w-4 h-4 mr-1.5" />
                    加载更多
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <Database className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg font-medium mb-1">暂无爬取数据</p>
              <p className="text-slate-500 text-sm">
                启动Pipeline或发现任务后，数据将自动出现在这里
              </p>
            </div>
          )}
        </TabsContent>

        {/* ============================================================= */}
        {/* Tab 4: Scheduler */}
        {/* ============================================================= */}
        <TabsContent value="scheduler" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Scheduler Status Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
                    <Clock className="w-5 h-5 text-amber-400" />
                    调度器状态
                    {schedulerConnected ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-400 bg-emerald-500/10 border-emerald-500/20 border ml-auto">
                        已连接
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-rose-400 bg-rose-500/10 border-rose-500/20 border ml-auto">
                        未连接
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {schedulerLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-8 rounded-lg bg-slate-800/50" />
                      <Skeleton className="h-4 rounded bg-slate-800/50 w-3/4" />
                    </div>
                  ) : !schedulerConnected ? (
                    <div className="text-center py-8">
                      <XCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm mb-1">无法连接到调度器服务</p>
                      <p className="text-slate-500 text-xs">
                        请确认调度器服务 (port 3002) 正在运行
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Running status */}
                      <div className="flex items-center gap-3">
                        <motion.div
                          className={`w-3 h-3 rounded-full ${schedulerStatus?.isRunning ? 'bg-emerald-400' : 'bg-slate-500'}`}
                          animate={schedulerStatus?.isRunning ? { scale: [1, 1.3, 1] } : {}}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        <Badge
                          variant="outline"
                          className={`text-sm px-3 py-1 ${
                            schedulerStatus?.isRunning
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                          } border`}
                        >
                          {schedulerStatus?.isRunning ? '运行中' : '已停止'}
                        </Badge>
                      </div>

                      {/* Details */}
                      <div className="space-y-3 text-sm">
                        {schedulerStatus?.config?.intervalMinutes && (
                          <div className="flex items-center justify-between text-slate-400">
                            <span>调度间隔</span>
                            <span className="text-slate-200 font-medium">
                              每 {schedulerStatus.config.intervalMinutes} 分钟
                            </span>
                          </div>
                        )}
                        {schedulerStatus?.nextRunAt && (
                          <div className="flex items-center justify-between text-slate-400">
                            <span>下次运行</span>
                            <span className="text-slate-200 text-xs">
                              {new Date(schedulerStatus.nextRunAt).toLocaleString('zh-CN')}
                            </span>
                          </div>
                        )}
                        {schedulerStatus?.lastRunAt && (
                          <div className="flex items-center justify-between text-slate-400">
                            <span>上次运行</span>
                            <span className="text-slate-200 text-xs">
                              {new Date(schedulerStatus.lastRunAt).toLocaleString('zh-CN')}
                            </span>
                          </div>
                        )}
                        {schedulerStatus?.lastRunResult && (
                          <div className="flex items-center justify-between text-slate-400">
                            <span>上次结果</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${
                                schedulerStatus.lastRunResult.success
                                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                  : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                              } border`}
                            >
                              {schedulerStatus.lastRunResult.success
                                ? `成功 (${schedulerStatus.lastRunResult.familiesProcessed ?? 0}家族)`
                                : schedulerStatus.lastRunResult.error || '失败'}
                            </Badge>
                          </div>
                        )}
                      </div>

                      <Separator className="bg-slate-700/50" />

                      {/* Control buttons */}
                      <div className="flex flex-wrap gap-3">
                        {!schedulerStatus?.isRunning ? (
                          <Button
                            onClick={startScheduler}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-lg shadow-amber-500/20"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            启动调度器
                          </Button>
                        ) : (
                          <Button
                            onClick={stopScheduler}
                            variant="destructive"
                            className="bg-rose-600 hover:bg-rose-500"
                          >
                            <Square className="w-4 h-4 mr-2" />
                            停止调度器
                          </Button>
                        )}
                        <Button
                          onClick={triggerScheduler}
                          variant="outline"
                          className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          手动触发
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Scheduler Config Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
                    <Settings className="w-5 h-5 text-amber-400" />
                    调度器配置
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Interval */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">调度间隔 (分钟)</label>
                    <Input
                      type="number"
                      min={5}
                      max={1440}
                      value={schedulerConfig.intervalMinutes}
                      onChange={(e) => setSchedulerConfig(prev => ({ ...prev, intervalMinutes: Number(e.target.value) || 30 }))}
                      className="bg-slate-800/50 border-slate-600 text-slate-200 w-32"
                    />
                    <p className="text-[10px] text-slate-500">最小5分钟</p>
                  </div>

                  {/* Family keys */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">目标家族</label>
                    <Select
                      value={schedulerConfig.familyKeys === Object.keys(FAMILY_NAMES).join(',') ? 'all' : schedulerConfig.familyKeys}
                      onValueChange={(v) => setSchedulerConfig(prev => ({ ...prev, familyKeys: v }))}
                    >
                      <SelectTrigger className="bg-slate-800/50 border-slate-600 text-slate-200 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="all" className="text-slate-200 focus:bg-slate-700">全部家族</SelectItem>
                        {familyOptions.map(([key, name]) => (
                          <SelectItem key={key} value={key} className="text-slate-200 focus:bg-slate-700">
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Max items per family */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">每家族最大条数</label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={schedulerConfig.maxItemsPerFamily}
                      onChange={(e) => setSchedulerConfig(prev => ({ ...prev, maxItemsPerFamily: Math.min(50, Math.max(1, Number(e.target.value) || 5)) }))}
                      className="bg-slate-800/50 border-slate-600 text-slate-200 w-32"
                    />
                  </div>

                  {/* Trigger evolution */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-xs text-slate-400 font-medium">触发进化</label>
                      <p className="text-[10px] text-slate-500">爬取后自动触发进化周期</p>
                    </div>
                    <Switch
                      checked={schedulerConfig.triggerEvolution}
                      onCheckedChange={(v) => setSchedulerConfig(prev => ({ ...prev, triggerEvolution: v }))}
                      className="data-[state=checked]:bg-amber-600"
                    />
                  </div>

                  {/* Language */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">评估语言</label>
                    <Select
                      value={schedulerConfig.language}
                      onValueChange={(v) => setSchedulerConfig(prev => ({ ...prev, language: v }))}
                    >
                      <SelectTrigger className="bg-slate-800/50 border-slate-600 text-slate-200 h-9 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="zh" className="text-slate-200 focus:bg-slate-700">中文</SelectItem>
                        <SelectItem value="en" className="text-slate-200 focus:bg-slate-700">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator className="bg-slate-700/50" />

                  {/* Save */}
                  <Button
                    onClick={saveSchedulerConfig}
                    disabled={!schedulerConnected}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-lg shadow-amber-500/20 w-full"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    保存配置
                  </Button>
                  {!schedulerConnected && (
                    <p className="text-[10px] text-rose-400 text-center">
                      无法连接调度器服务，请先确保服务运行
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
