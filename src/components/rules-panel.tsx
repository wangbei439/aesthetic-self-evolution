'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Scale,
  Shield,
  ArrowUp,
  RotateCcw,
  Trash2,
  Filter,
  BookOpen,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Search,
  Link2,
  ChevronDown,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

// Shared constants — single source of truth
import {
  FAMILY_COLORS,
  FAMILY_DOT,
  FAMILY_BG,
  RULE_TYPE_CONFIG,
  STATUS_CONFIG,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_COLORS,
} from '@/lib/family-constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RuleFamily {
  id: string
  key: string
  name: string
  icon: string
  color: string
}

interface Rule {
  id: string
  familyId: string
  ruleContent: string
  ruleType: 'positive' | 'negative' | 'conditional'
  dimension: string | null
  priority: number
  generation: number
  parentId: string | null
  sourceType: 'seed' | 'evolved' | 'human' | 'transferred'
  sourceFamilyId: string | null
  supportCount: number
  contradictCount: number
  confidence: number
  status: 'active' | 'candidate' | 'deprecated'
  createdAt: string
  updatedAt: string
  family: RuleFamily
}

interface RulesResponse {
  rules: Rule[]
  pagination: { total: number; limit: number; offset: number; hasMore: boolean }
}

interface FamilyOption {
  key: string
  name: string
  color: string
}

// ---------------------------------------------------------------------------
// Fallback families
// ---------------------------------------------------------------------------

const FALLBACK_FAMILIES: FamilyOption[] = [
  { key: 'narrative_visual', name: '叙事视觉', color: 'orange' },
  { key: 'interactive_ui', name: '交互界面', color: 'emerald' },
  { key: 'spatial', name: '空间营造', color: 'violet' },
  { key: 'character', name: '人物造型', color: 'rose' },
  { key: 'graphic_composition', name: '平面构成', color: 'cyan' },
  { key: 'dynamic_rhythm', name: '动态韵律', color: 'amber' },
]

// ---------------------------------------------------------------------------
// Page size for "Load More" pagination
// ---------------------------------------------------------------------------
const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RulesPanel() {
  const [rules, setRules] = useState<Rule[]>([])
  const [families, setFamilies] = useState<FamilyOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [actingRuleId, setActingRuleId] = useState<string | null>(null)
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null)

  // Filters
  const [familyFilter, setFamilyFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [ruleTypeFilter, setRuleTypeFilter] = useState<string>('all')
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchInput, setSearchInput] = useState<string>('')

  // Pagination
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  // Stats
  const [activeCount, setActiveCount] = useState(0)
  const [candidateCount, setCandidateCount] = useState(0)
  const [deprecatedCount, setDeprecatedCount] = useState(0)

  // ---------------------------------------------------------------------------
  // Fetch families for filter dropdown
  // ---------------------------------------------------------------------------
  const fetchFamilies = useCallback(async () => {
    try {
      const res = await fetch('/api/families')
      if (res.ok) {
        const data = await res.json()
        if (data.families && Array.isArray(data.families) && data.families.length > 0) {
          setFamilies(
            data.families.map((f: { key: string; name: string; color: string }) => ({
              key: f.key,
              name: f.name,
              color: f.color,
            }))
          )
        } else {
          setFamilies(FALLBACK_FAMILIES)
        }
      } else {
        setFamilies(FALLBACK_FAMILIES)
      }
    } catch {
      setFamilies(FALLBACK_FAMILIES)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Build query params helper
  // ---------------------------------------------------------------------------
  const buildQueryParams = useCallback(
    (limit: number, currentOffset: number, includeSearch = true) => {
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      params.set('offset', String(currentOffset))
      if (familyFilter !== 'all') params.set('familyKey', familyFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (ruleTypeFilter !== 'all') params.set('ruleType', ruleTypeFilter)
      if (sourceTypeFilter !== 'all') params.set('sourceType', sourceTypeFilter)
      if (includeSearch && searchQuery) params.set('search', searchQuery)
      return params
    },
    [familyFilter, statusFilter, ruleTypeFilter, sourceTypeFilter, searchQuery]
  )

  // ---------------------------------------------------------------------------
  // Fetch rules (initial / filter change) — resets list
  // ---------------------------------------------------------------------------
  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const params = buildQueryParams(PAGE_SIZE, 0)
      const res = await fetch(`/api/rules?${params.toString()}`)
      if (res.ok) {
        const data: RulesResponse = await res.json()
        setRules(data.rules || [])
        setOffset(PAGE_SIZE)
        setHasMore(data.pagination?.hasMore ?? false)
      } else {
        setRules([])
        setOffset(0)
        setHasMore(false)
      }

      // Fetch counts for stats (all statuses, same family filter)
      const [activeRes, candidateRes, deprecatedRes] = await Promise.all([
        fetch(`/api/rules?limit=1&status=active${familyFilter !== 'all' ? '&familyKey=' + familyFilter : ''}`),
        fetch(`/api/rules?limit=1&status=candidate${familyFilter !== 'all' ? '&familyKey=' + familyFilter : ''}`),
        fetch(`/api/rules?limit=1&status=deprecated${familyFilter !== 'all' ? '&familyKey=' + familyFilter : ''}`),
      ])

      if (activeRes.ok) {
        const d = await activeRes.json()
        setActiveCount(d.pagination?.total ?? 0)
      }
      if (candidateRes.ok) {
        const d = await candidateRes.json()
        setCandidateCount(d.pagination?.total ?? 0)
      }
      if (deprecatedRes.ok) {
        const d = await deprecatedRes.json()
        setDeprecatedCount(d.pagination?.total ?? 0)
      }
    } catch {
      setRules([])
      setOffset(0)
      setHasMore(false)
      setActiveCount(0)
      setCandidateCount(0)
      setDeprecatedCount(0)
    } finally {
      setLoading(false)
    }
  }, [buildQueryParams, familyFilter])

  // ---------------------------------------------------------------------------
  // Load more rules — appends to existing list
  // ---------------------------------------------------------------------------
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const params = buildQueryParams(PAGE_SIZE, offset)
      const res = await fetch(`/api/rules?${params.toString()}`)
      if (res.ok) {
        const data: RulesResponse = await res.json()
        setRules((prev) => [...prev, ...(data.rules || [])])
        setOffset((prev) => prev + PAGE_SIZE)
        setHasMore(data.pagination?.hasMore ?? false)
      }
    } catch {
      toast.error('加载更多规则失败')
    } finally {
      setLoadingMore(false)
    }
  }, [buildQueryParams, offset, hasMore, loadingMore])

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetchFamilies()
  }, [fetchFamilies])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  // Handle search on Enter key
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setSearchQuery(searchInput)
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const [confirmAction, setConfirmAction] = useState<{ ruleId: string; action: 'deprecate' | 'delete' } | null>(null)

  const executeAction = async (ruleId: string, action: 'promote' | 'deprecate' | 'delete' | 'restore') => {
    setActingRuleId(ruleId)
    try {
      const res = await fetch('/api/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, action }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '操作失败')
      }

      const actionLabels: Record<string, string> = {
        promote: '晋升成功',
        deprecate: '已废弃',
        delete: '已删除',
        restore: '已恢复',
      }
      toast.success(actionLabels[action] || '操作成功')
      await fetchRules()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败，请重试')
    } finally {
      setActingRuleId(null)
    }
  }

  const handleAction = (ruleId: string, action: 'promote' | 'deprecate' | 'delete' | 'restore') => {
    if (action === 'deprecate' || action === 'delete') {
      setConfirmAction({ ruleId, action })
    } else {
      executeAction(ruleId, action)
    }
  }

  // ---------------------------------------------------------------------------
  // Resolve source family name for transferred rules
  // ---------------------------------------------------------------------------
  const getSourceFamilyNameFromRule = (rule: Rule): string => {
    if (rule.sourceType !== 'transferred' || !rule.sourceFamilyId) return ''
    // sourceFamilyId is a database CUID, so match against family.id, not family.key
    const byId = families.find((f) => f.id === rule.sourceFamilyId)
    if (byId) return byId.name
    // Fallback: try matching by key (in case older data stored keys)
    const byKey = families.find((f) => f.key === rule.sourceFamilyId)
    if (byKey) return byKey.name
    // Last resort: try finding a rule in the source family
    const sourceRule = rules.find((r) => r.familyId === rule.sourceFamilyId)
    if (sourceRule) return sourceRule.family.name
    return rule.sourceFamilyId
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const statCards = [
    {
      label: '活跃规则',
      value: activeCount,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      icon: CheckCircle2,
    },
    {
      label: '候选规则',
      value: candidateCount,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      icon: AlertCircle,
    },
    {
      label: '已废弃',
      value: deprecatedCount,
      color: 'text-slate-400',
      bg: 'bg-slate-500/10',
      icon: XCircle,
    },
  ]

  return (
    <section className="relative py-24 px-4" id="rules">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <Scale className="w-7 h-7 text-amber-400" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-50">
              审美法则库
            </h2>
          </div>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            管理各家族的审美规则，追踪规则进化与验证状态
          </p>
        </motion.div>

        {/* Filter Bar */}
        <motion.div
          className="flex flex-col gap-3 mb-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {/* Row 1: Family, Status, Rule Type, Source Type */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={familyFilter} onValueChange={setFamilyFilter}>
                <SelectTrigger className="w-44 bg-slate-800/50 border-slate-600 text-slate-200">
                  <SelectValue placeholder="选择家族" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                    全部家族
                  </SelectItem>
                  {families.map((f) => (
                    <SelectItem key={f.key} value={f.key} className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-slate-800/50 border-slate-600 text-slate-200">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                  全部状态
                </SelectItem>
                <SelectItem value="active" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                  活跃
                </SelectItem>
                <SelectItem value="candidate" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                  候选
                </SelectItem>
                <SelectItem value="deprecated" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                  已废弃
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={ruleTypeFilter} onValueChange={setRuleTypeFilter}>
              <SelectTrigger className="w-36 bg-slate-800/50 border-slate-600 text-slate-200">
                <SelectValue placeholder="规则类型" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                  全部类型
                </SelectItem>
                <SelectItem value="positive" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                  正面
                </SelectItem>
                <SelectItem value="negative" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                  负面
                </SelectItem>
                <SelectItem value="conditional" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                  条件
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
              <SelectTrigger className="w-36 bg-slate-800/50 border-slate-600 text-slate-200">
                <SelectValue placeholder="来源类型" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                  全部来源
                </SelectItem>
                <SelectItem value="seed" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                  种子规则
                </SelectItem>
                <SelectItem value="evolved" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                  进化规则
                </SelectItem>
                <SelectItem value="human" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                  人工规则
                </SelectItem>
                <SelectItem value="transferred" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                  迁移规则
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Row 2: Search + Refresh */}
          <div className="flex items-center justify-center gap-3">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="搜索规则内容，按 Enter 搜索..."
                className="pl-9 bg-slate-800/50 border-slate-600 text-slate-200 placeholder:text-slate-500 focus-visible:ring-amber-500/30"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSearchQuery(searchInput)
              }}
              className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              <Search className="w-4 h-4 mr-1.5" />
              搜索
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchRules()}
              disabled={loading}
              className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {statCards.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
            >
              <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${stat.bg}`}>
                      <stat.icon className={`w-4 h-4 ${stat.color}`} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-50">
                        {loading ? (
                          <Skeleton className="h-7 w-8 bg-slate-700/50 inline-block" />
                        ) : (
                          stat.value
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Rules List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
            <CardContent className="p-6">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-lg bg-slate-800/50" />
                  ))}
                </div>
              ) : rules.length > 0 ? (
                <div className="max-h-[600px] overflow-y-auto custom-scrollbar pr-1 space-y-3">
                  <AnimatePresence mode="popLayout">
                    {rules.map((rule, idx) => {
                      const typeConfig = RULE_TYPE_CONFIG[rule.ruleType] || RULE_TYPE_CONFIG.positive
                      const statusCfg = STATUS_CONFIG[rule.status] || STATUS_CONFIG.active
                      const sourceConfig = SOURCE_TYPE_COLORS[rule.sourceType] || SOURCE_TYPE_COLORS.seed
                      const familyDot = FAMILY_DOT[rule.family.key] || 'bg-slate-400'
                      const familyColor = FAMILY_COLORS[rule.family.key] || 'text-slate-400'
                      const familyBg = FAMILY_BG[rule.family.key] || 'bg-slate-500/10'

                      return (
                        <motion.div
                          key={rule.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.3, delay: idx * 0.03 }}
                          className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 hover:bg-slate-800/50 hover:border-slate-600/40 transition-colors"
                        >
                          {/* Family dot */}
                          <div className="mt-1.5 shrink-0">
                            <div className={`w-3 h-3 rounded-full ${familyDot}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {/* Rule text - clickable to expand/collapse */}
                            <button
                              className="w-full text-left"
                              onClick={() => setExpandedRuleId(expandedRuleId === rule.id ? null : rule.id)}
                            >
                              <p className={`font-semibold text-slate-100 text-sm leading-relaxed mb-2 ${expandedRuleId !== rule.id ? 'line-clamp-2' : ''}`}>
                                {rule.ruleContent}
                              </p>
                            </button>

                            {/* Badges row */}
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {/* Rule type badge */}
                              <Badge
                                variant="outline"
                                className={`text-xs px-2 py-0.5 ${typeConfig.color} ${typeConfig.bg} ${typeConfig.border} border`}
                              >
                                {typeConfig.symbol} {typeConfig.label}
                              </Badge>

                              {/* Status badge */}
                              <Badge
                                variant="outline"
                                className={`text-xs px-2 py-0.5 ${statusCfg.color} ${statusCfg.bg} ${statusCfg.border} border`}
                              >
                                {statusCfg.label}
                              </Badge>

                              {/* Source type badge */}
                              <Badge
                                variant="outline"
                                className={`text-xs px-2 py-0.5 ${sourceConfig.color} ${sourceConfig.bg} ${sourceConfig.border} border`}
                              >
                                {SOURCE_TYPE_LABELS[rule.sourceType] || rule.sourceType}
                              </Badge>

                              {/* Transferred badge */}
                              {rule.sourceType === 'transferred' && rule.sourceFamilyId && (
                                <Badge
                                  variant="outline"
                                  className="text-xs px-2 py-0.5 text-orange-400 bg-orange-500/10 border-orange-500/20 border"
                                >
                                  跨域迁移: {getSourceFamilyNameFromRule(rule)}
                                </Badge>
                              )}

                              {/* Family badge (when viewing all families) */}
                              {familyFilter === 'all' && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs px-2 py-0.5 ${familyColor} ${familyBg} border-slate-600/30 border`}
                                >
                                  {rule.family.name}
                                </Badge>
                              )}
                            </div>

                            {/* Metadata row */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                              {rule.dimension && (
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-3 h-3" />
                                  {rule.dimension}
                                </span>
                              )}
                              <span>Gen {rule.generation}</span>
                              <span>优先级 {(rule.priority * 100).toFixed(0)}%</span>
                              <span>置信度 {(rule.confidence * 100).toFixed(0)}%</span>
                              <span className="flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                支持 {rule.supportCount} / 反对 {rule.contradictCount}
                              </span>
                            </div>

                            {/* Expanded details */}
                            <AnimatePresence>
                              {expandedRuleId === rule.id && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/30 space-y-2">
                                    <div className="flex items-center gap-3 text-xs">
                                      <span className="text-slate-500">来源</span>
                                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sourceConfig.color} ${sourceConfig.bg} ${sourceConfig.border} border`}>
                                        {SOURCE_TYPE_LABELS[rule.sourceType] || rule.sourceType}
                                      </Badge>
                                      <span className="text-slate-500">创建</span>
                                      <span className="text-slate-400">{new Date(rule.createdAt).toLocaleString('zh-CN')}</span>
                                    </div>

                                    {/* Parent rule link */}
                                    {rule.parentId && (
                                      <div className="flex items-center gap-2 text-xs">
                                        <Link2 className="w-3 h-3 text-slate-500" />
                                        <span className="text-slate-500">父规则:</span>
                                        <span className="text-amber-400 font-mono text-[11px]">
                                          {rule.parentId.slice(0, 8)}...
                                        </span>
                                      </div>
                                    )}

                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-500 shrink-0">置信度</span>
                                      <Progress
                                        value={rule.confidence * 100}
                                        className="h-1.5 flex-1 bg-slate-700/50 [&>div]:bg-amber-500"
                                      />
                                      <span className="text-xs text-amber-400 font-medium">{(rule.confidence * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-500 shrink-0">优先级</span>
                                      <Progress
                                        value={rule.priority * 100}
                                        className="h-1.5 flex-1 bg-slate-700/50 [&>div]:bg-violet-500"
                                      />
                                      <span className="text-xs text-violet-400 font-medium">{(rule.priority * 100).toFixed(0)}%</span>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Action buttons */}
                          <div className="shrink-0 flex items-center gap-2 ml-2">
                            {rule.status === 'candidate' && (
                              <Button
                                size="sm"
                                onClick={() => handleAction(rule.id, 'promote')}
                                disabled={actingRuleId === rule.id}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-3 shadow-sm"
                              >
                                {actingRuleId === rule.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <ArrowUp className="w-3.5 h-3.5 mr-1" />
                                    晋升
                                  </>
                                )}
                              </Button>
                            )}

                            {rule.status === 'active' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAction(rule.id, 'deprecate')}
                                disabled={actingRuleId === rule.id}
                                className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs h-8 px-3"
                              >
                                {actingRuleId === rule.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <XCircle className="w-3.5 h-3.5 mr-1" />
                                    废弃
                                  </>
                                )}
                              </Button>
                            )}

                            {rule.status === 'deprecated' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleAction(rule.id, 'restore')}
                                  disabled={actingRuleId === rule.id}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-3 shadow-sm"
                                >
                                  {actingRuleId === rule.id ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                      恢复
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAction(rule.id, 'delete')}
                                  disabled={actingRuleId === rule.id}
                                  className="border-rose-600/40 text-rose-500 hover:bg-rose-600/10 hover:text-rose-400 text-xs h-8 px-3"
                                >
                                  {actingRuleId === rule.id ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                                      删除
                                    </>
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>

                  {/* Load More button */}
                  {hasMore && (
                    <div className="flex justify-center pt-4 pb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                      >
                        {loadingMore ? (
                          <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                        ) : (
                          <ChevronDown className="w-4 h-4 mr-1.5" />
                        )}
                        加载更多
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16">
                  <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg font-medium mb-1">暂无匹配的规则</p>
                  <p className="text-slate-500 text-sm">
                    尝试调整筛选条件，或先进行审美评估以生成规则
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Confirmation Dialog for destructive actions */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null)
        }}
      >
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">
              {confirmAction?.action === 'deprecate' ? '确认废弃规则' : '确认删除规则'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {confirmAction?.action === 'deprecate'
                ? '废弃后该规则将不再参与评估，但仍保留在历史记录中。你可以之后恢复它。'
                : '删除后该规则将永久移除，无法恢复。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) {
                  executeAction(confirmAction.ruleId, confirmAction.action)
                  setConfirmAction(null)
                }
              }}
              className={confirmAction?.action === 'delete' ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'}
            >
              确认{confirmAction?.action === 'deprecate' ? '废弃' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
