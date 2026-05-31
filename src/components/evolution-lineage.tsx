'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Sparkles,
  Wrench,
  XCircle,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  ArrowUp,
  Clock,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Dna,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FAMILY_COLORS,
  FAMILY_BG,
  FAMILY_BORDER,
  FAMILY_DOT,
  FAMILY_RING,
  FAMILY_GLOW,
  FAMILY_NAMES,
  EVENT_TYPE_CONFIG,
} from '@/lib/family-constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvolutionEvent {
  id: string
  eventType: string
  description: string
  generation: number
  metadata: Record<string, unknown> | null
  createdAt: string
  familyKey: string
  familyName: string
}

interface FamilyEvolutionStats {
  familyId: string
  familyKey: string
  familyName: string
  icon: string
  color: string
  stats: {
    totalEvaluations: number
    totalRules: number
    latestGeneration: number
    maxRuleGeneration: number
    latestScore: number
    avgScore: number
    avgRuleConfidence: number
    rulesByType: {
      positive: number
      negative: number
      conditional: number
    }
  }
  recentEvents: {
    id: string
    eventType: string
    description: string
    generation: number
    metadata: Record<string, unknown> | null
    createdAt: string
  }[]
}

// ---------------------------------------------------------------------------
// Local icon mapping (not in shared constants since icons are React components)
// ---------------------------------------------------------------------------

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  reflection: Brain,
  rule_created: Sparkles,
  rule_modified: Wrench,
  rule_deprecated: XCircle,
  transfer_attempt: ArrowRight,
  transfer_success: CheckCircle,
  transfer_failed: AlertTriangle,
  rule_promoted: ArrowUp,
}

// ---------------------------------------------------------------------------
// Metadata key Chinese labels
// ---------------------------------------------------------------------------

const METADATA_KEY_LABELS: Record<string, string> = {
  ruleId: '规则ID',
  action: '操作',
  previousStatus: '原状态',
  previousConfidence: '原置信度',
  newConfidence: '新置信度',
  supportCount: '支持次数',
  contradictCount: '反对次数',
  confidence: '置信度',
  ruleContent: '规则内容',
  ruleType: '规则类型',
  evaluationCount: '评估数量',
  highScoringCount: '高分数量',
  lowScoringCount: '低分数量',
  parentId: '父规则',
  dimension: '维度',
  priority: '优先级',
  originalRule: '原始规则',
  adaptedRule: '适配规则',
  sourceFamilyId: '来源家族',
  count: '数量',
  sources: '来源',
  rawResponse: '原始响应',
}

// ---------------------------------------------------------------------------
// Helper: group events by generation
// ---------------------------------------------------------------------------

function groupByGeneration(events: EvolutionEvent[]): Map<number, EvolutionEvent[]> {
  const map = new Map<number, EvolutionEvent[]>()
  for (const event of events) {
    const gen = event.generation || 0
    if (!map.has(gen)) {
      map.set(gen, [])
    }
    map.get(gen)!.push(event)
  }
  // Sort each group by createdAt descending
  for (const [, list] of map) {
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
  // Return generations sorted descending
  return new Map([...map.entries()].sort((a, b) => b[0] - a[0]))
}

// ---------------------------------------------------------------------------
// Metadata Renderer
// ---------------------------------------------------------------------------

function MetadataViewer({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata) return null

  const entries = Object.entries(metadata)

  return (
    <div className="mt-2 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-xs space-y-1.5">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <span className="text-slate-400 shrink-0 min-w-[80px]">
            {METADATA_KEY_LABELS[key] || key}
          </span>
          <span className="text-slate-300 font-mono break-all">
            {typeof value === 'object' && value !== null
              ? JSON.stringify(value, null, 0)
              : String(value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timeline Event Item
// ---------------------------------------------------------------------------

function TimelineEventItem({
  event,
  index,
}: {
  event: EvolutionEvent
  index: number
}) {
  const [expanded, setExpanded] = useState(false)
  const config = EVENT_TYPE_CONFIG[event.eventType] || EVENT_TYPE_CONFIG.reflection
  const Icon = EVENT_ICONS[event.eventType] || Brain
  const familyColor = FAMILY_COLORS[event.familyKey] || 'text-slate-400'
  const familyBg = FAMILY_BG[event.familyKey] || 'bg-slate-700/30'
  const familyDot = FAMILY_DOT[event.familyKey] || 'bg-slate-500'
  const familyBorder = FAMILY_BORDER[event.familyKey] || 'border-slate-600/30'
  const familyRing = FAMILY_RING[event.familyKey] || 'ring-slate-500/30'
  const familyGlow = FAMILY_GLOW[event.familyKey] || 'shadow-slate-500/10'

  const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -16, filter: 'blur(4px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: 'easeOut' }}
      className="flex gap-4 group"
    >
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center shrink-0">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: index * 0.06 + 0.1, type: 'spring', stiffness: 300 }}
          className={`
            w-9 h-9 rounded-full flex items-center justify-center
            ring-2 ${familyRing} shadow-lg ${familyGlow}
            ${familyBg} border ${familyBorder}
            transition-transform duration-200 group-hover:scale-110
          `}
        >
          <Icon className={`w-4 h-4 ${config.color}`} />
        </motion.div>
        <div className={`w-0.5 flex-1 ${familyDot} opacity-20 min-h-[24px]`} />
      </div>

      {/* Event content */}
      <div className="flex-1 min-w-0 pb-5">
        <div
          className={`
            p-3.5 rounded-xl border transition-all duration-200 cursor-pointer
            bg-slate-800/40 border-slate-700/30
            hover:bg-slate-800/60 hover:border-slate-600/40
            ${expanded ? 'ring-1 ring-amber-500/20' : ''}
          `}
          onClick={() => hasMetadata && setExpanded(!expanded)}
        >
          {/* Top row: badges */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge
              variant="outline"
              className={`text-[11px] px-2 py-0.5 ${config.color} ${config.border} ${config.bg} border font-medium`}
            >
              <Icon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[11px] px-2 py-0.5 ${familyColor} ${familyBorder} ${familyBg} border`}
            >
              {event.familyName}
            </Badge>
            {hasMetadata && (
              <motion.div
                animate={{ rotate: expanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </motion.div>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">
            {event.description}
          </p>

          {/* Timestamp */}
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(event.createdAt).toLocaleString('zh-CN')}
          </p>

          {/* Expandable metadata */}
          <AnimatePresence>
            {expanded && hasMetadata && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                <MetadataViewer metadata={event.metadata} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Generation Group
// ---------------------------------------------------------------------------

function GenerationGroup({
  generation,
  events,
  groupIndex,
}: {
  generation: number
  events: EvolutionEvent[]
  groupIndex: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: groupIndex * 0.12, ease: 'easeOut' }}
    >
      {/* Generation header */}
      <div className="flex items-center gap-3 mb-4 sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm py-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-amber-400" />
          </div>
          <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20 font-semibold px-3 py-1 text-xs">
            Gen-{generation}
          </Badge>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-amber-500/30 via-slate-700/40 to-transparent" />
        <span className="text-[11px] text-slate-500 shrink-0">
          {events.length} 个事件
        </span>
      </div>

      {/* Events */}
      <div className="pl-2">
        {events.map((event, idx) => (
          <TimelineEventItem
            key={event.id}
            event={event}
            index={idx}
          />
        ))}
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Main Component: EvolutionLineage
// ---------------------------------------------------------------------------

export function EvolutionLineage() {
  const [events, setEvents] = useState<EvolutionEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [familyFilter, setFamilyFilter] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/evolution')
      if (!res.ok) {
        throw new Error('获取进化数据失败')
      }
      const data = await res.json()
      const families: FamilyEvolutionStats[] = data.families || []

      // Flatten all events with family info
      const allEvents: EvolutionEvent[] = families.flatMap((fam) =>
        (fam.recentEvents || []).map((ev) => ({
          ...ev,
          familyKey: fam.familyKey,
          familyName: fam.familyName,
        }))
      )

      // Sort by createdAt descending
      allEvents.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      setEvents(allEvents)
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchEvents()
    setRefreshing(false)
  }, [fetchEvents])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Filter events by family
  const filteredEvents = familyFilter === 'all'
    ? events
    : events.filter((e) => e.familyKey === familyFilter)

  const generationGroups = groupByGeneration(filteredEvents)

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
            <Dna className="w-5 h-5 text-amber-400" />
            进化谱系
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="w-9 h-9 rounded-full shrink-0 bg-slate-800/50" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded bg-slate-800/50" />
                  <Skeleton className="h-3 w-1/2 rounded bg-slate-800/50" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
            <Dna className="w-5 h-5 text-amber-400" />
            进化谱系
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <AlertTriangle className="w-10 h-10 mb-3 text-rose-400/60" />
            <p className="text-sm">{error}</p>
            <button
              onClick={fetchEvents}
              className="mt-3 text-xs text-amber-400 hover:text-amber-300 transition-colors underline underline-offset-2"
            >
              重试
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  if (events.length === 0) {
    return (
      <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
            <Dna className="w-5 h-5 text-amber-400" />
            进化谱系
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, type: 'spring' }}
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/40 flex items-center justify-center mb-4">
                <GitBranch className="w-8 h-8 text-slate-600" />
              </div>
            </motion.div>
            <p className="text-sm font-medium text-slate-400 mb-1">暂无进化事件</p>
            <p className="text-xs text-slate-500">触发进化周期后将在此显示谱系时间线</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ---------------------------------------------------------------------------
  // Main timeline
  // ---------------------------------------------------------------------------
  return (
    <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
          <Dna className="w-5 h-5 text-amber-400" />
          进化谱系
          <Badge variant="outline" className="ml-2 text-[11px] px-2 py-0.5 border-slate-600 text-slate-400">
            {filteredEvents.length} 个事件
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 h-6 w-6 text-slate-500 hover:text-amber-400"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        {/* Family filter */}
        <div className="mt-2">
          <Select value={familyFilter} onValueChange={setFamilyFilter}>
            <SelectTrigger className="w-48 h-8 text-xs bg-slate-800/50 border-slate-700/50 text-slate-300">
              <SelectValue placeholder="筛选家族" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all" className="text-slate-300 text-xs">全部家族</SelectItem>
              {Object.entries(FAMILY_NAMES).map(([key, name]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  <span className={FAMILY_COLORS[key]}>{name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <p className="text-sm">该家族暂无进化事件</p>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar pr-1 space-y-6">
            {Array.from(generationGroups.entries()).map(([generation, genEvents], groupIndex) => (
              <GenerationGroup
                key={generation}
                generation={generation}
                events={genEvents}
                groupIndex={groupIndex}
              />
            ))}
          </div>
        )}

        {/* Family legend */}
        <div className="mt-4 pt-4 border-t border-slate-700/30">
          <div className="flex items-center gap-1 mb-2">
            <ChevronDown className="w-3 h-3 text-slate-500" />
            <span className="text-[11px] text-slate-500 font-medium">家族图例</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(FAMILY_COLORS).map(([key, color]) => {
              const dot = FAMILY_DOT[key]
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                  <span className={`text-[11px] ${color}`}>
                    {FAMILY_NAMES[key] || key}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
