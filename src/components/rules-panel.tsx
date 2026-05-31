'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Scale,
  Shield,
  ArrowUp,
  Trash2,
  Filter,
  BookOpen,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
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
// Constants
// ---------------------------------------------------------------------------

const FAMILY_COLORS: Record<string, string> = {
  narrative_visual: 'text-orange-400',
  interactive_ui: 'text-emerald-400',
  spatial: 'text-violet-400',
  character: 'text-rose-400',
  graphic_composition: 'text-cyan-400',
  dynamic_rhythm: 'text-amber-400',
}

const FAMILY_DOT: Record<string, string> = {
  narrative_visual: 'bg-orange-400',
  interactive_ui: 'bg-emerald-400',
  spatial: 'bg-violet-400',
  character: 'bg-rose-400',
  graphic_composition: 'bg-cyan-400',
  dynamic_rhythm: 'bg-amber-400',
}

const FAMILY_BG: Record<string, string> = {
  narrative_visual: 'bg-orange-500/10',
  interactive_ui: 'bg-emerald-500/10',
  spatial: 'bg-violet-500/10',
  character: 'bg-rose-500/10',
  graphic_composition: 'bg-cyan-500/10',
  dynamic_rhythm: 'bg-amber-500/10',
}

const RULE_TYPE_CONFIG: Record<string, { label: string; symbol: string; color: string; bg: string; border: string }> = {
  positive: { label: '正面', symbol: '+', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  negative: { label: '负面', symbol: '-', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  conditional: { label: '条件', symbol: '?', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  active: { label: '活跃', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
  candidate: { label: '候选', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: AlertCircle },
  deprecated: { label: '已废弃', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: XCircle },
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  seed: '种子规则',
  evolved: '进化规则',
  human: '人工规则',
  transferred: '迁移规则',
}

const SOURCE_TYPE_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  seed: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  evolved: { color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  human: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  transferred: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
}

const FALLBACK_FAMILIES: FamilyOption[] = [
  { key: 'narrative_visual', name: '叙事视觉', color: 'orange' },
  { key: 'interactive_ui', name: '交互界面', color: 'emerald' },
  { key: 'spatial', name: '空间营造', color: 'violet' },
  { key: 'character', name: '人物造型', color: 'rose' },
  { key: 'graphic_composition', name: '平面构成', color: 'cyan' },
  { key: 'dynamic_rhythm', name: '动态韵律', color: 'amber' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RulesPanel() {
  const [rules, setRules] = useState<Rule[]>([])
  const [families, setFamilies] = useState<FamilyOption[]>([])
  const [loading, setLoading] = useState(true)
  const [actingRuleId, setActingRuleId] = useState<string | null>(null)
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null)

  // Filters
  const [familyFilter, setFamilyFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

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
  // Fetch rules + stats
  // ---------------------------------------------------------------------------
  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch rules for current filter
      const params = new URLSearchParams()
      params.set('limit', '50')
      params.set('offset', '0')
      if (familyFilter !== 'all') params.set('familyKey', familyFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/rules?${params.toString()}`)
      if (res.ok) {
        const data: RulesResponse = await res.json()
        setRules(data.rules || [])
      } else {
        setRules([])
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
      setActiveCount(0)
      setCandidateCount(0)
      setDeprecatedCount(0)
    } finally {
      setLoading(false)
    }
  }, [familyFilter, statusFilter])

  useEffect(() => {
    fetchFamilies()
  }, [fetchFamilies])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  // Confirm destructive action
  const [confirmAction, setConfirmAction] = useState<{ ruleId: string; action: 'deprecate' | 'delete' } | null>(null)

  const executeAction = async (ruleId: string, action: 'promote' | 'deprecate' | 'delete') => {
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
      }
      toast.success(actionLabels[action] || '操作成功')
      await fetchRules()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败，请重试')
    } finally {
      setActingRuleId(null)
    }
  }

  const handleAction = (ruleId: string, action: 'promote' | 'deprecate' | 'delete') => {
    if (action === 'deprecate' || action === 'delete') {
      setConfirmAction({ ruleId, action })
    } else {
      executeAction(ruleId, action)
    }
  }

  // ---------------------------------------------------------------------------
  // Resolve source family name for transferred rules
  // ---------------------------------------------------------------------------
  const getSourceFamilyName = (sourceFamilyId: string | null): string => {
    if (!sourceFamilyId) return ''
    const found = families.find((f) => f.key === sourceFamilyId)
    return found ? found.name : sourceFamilyId
  }

  // For transferred rules, the API returns sourceFamilyId as the family ID (cuid),
  // but we need to match by family key. Let's also check by matching family.id from rules.
  const getSourceFamilyNameFromRule = (rule: Rule): string => {
    if (rule.sourceType !== 'transferred' || !rule.sourceFamilyId) return ''
    // Try to find by key first
    const byKey = families.find((f) => f.key === rule.sourceFamilyId)
    if (byKey) return byKey.name
    // Try to find by matching other rules' familyId
    const sourceRule = rules.find(
      (r) => r.familyId === rule.sourceFamilyId
    )
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
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select value={familyFilter} onValueChange={setFamilyFilter}>
              <SelectTrigger className="w-48 bg-slate-800/50 border-slate-600 text-slate-200">
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
            <SelectTrigger className="w-44 bg-slate-800/50 border-slate-600 text-slate-200">
              <SelectValue placeholder="选择状态" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              <SelectItem value="all" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                全部状态
              </SelectItem>
              <SelectItem value="active" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                活跃 (Active)
              </SelectItem>
              <SelectItem value="candidate" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                候选 (Candidate)
              </SelectItem>
              <SelectItem value="deprecated" className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                已废弃 (Deprecated)
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRules()}
            disabled={loading}
            className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
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
                      const statusConfig = STATUS_CONFIG[rule.status] || STATUS_CONFIG.active
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
                                className={`text-xs px-2 py-0.5 ${statusConfig.color} ${statusConfig.bg} ${statusConfig.border} border`}
                              >
                                {statusConfig.label}
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
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
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
