'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  Brain,
  Dna,
  Layers,
  TrendingUp,
  RefreshCw,
  Clock,
  BarChart3,
  Hash,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface GlobalStats {
  totalFamilies: number
  totalEvaluations: number
  totalRules: number
  totalEvolutionEvents: number
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

interface EvaluationRecord {
  id: string
  family: {
    key: string
    name: string
    color: string
  }
  overallScore: number
  evolutionGeneration: number
  createdAt: string
}

const FAMILY_COLORS: Record<string, string> = {
  narrative_visual: 'text-orange-400',
  interactive_ui: 'text-emerald-400',
  spatial: 'text-violet-400',
  character: 'text-rose-400',
  graphic_composition: 'text-cyan-400',
  dynamic_rhythm: 'text-amber-400',
}

const FAMILY_BG: Record<string, string> = {
  narrative_visual: 'bg-orange-500/10',
  interactive_ui: 'bg-emerald-500/10',
  spatial: 'bg-violet-500/10',
  character: 'bg-rose-500/10',
  graphic_composition: 'bg-cyan-500/10',
  dynamic_rhythm: 'bg-amber-500/10',
}

const FAMILY_DOT: Record<string, string> = {
  narrative_visual: 'bg-orange-400',
  interactive_ui: 'bg-emerald-400',
  spatial: 'bg-violet-400',
  character: 'bg-rose-400',
  graphic_composition: 'bg-cyan-400',
  dynamic_rhythm: 'bg-amber-400',
}

export function EvolutionDashboard() {
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [familyEvolutions, setFamilyEvolutions] = useState<FamilyEvolutionStats[]>([])
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [evolving, setEvolving] = useState(false)
  const [selectedFamily, setSelectedFamily] = useState<string>('narrative_visual')

  const fetchData = useCallback(async () => {
    try {
      const [evoRes, evalRes] = await Promise.all([
        fetch('/api/evolution'),
        fetch('/api/evaluations?limit=20'),
      ])

      if (evoRes.ok) {
        const evoData = await evoRes.json()
        setGlobalStats(evoData.globalStats || {
          totalFamilies: 0,
          totalEvaluations: 0,
          totalRules: 0,
          totalEvolutionEvents: 0,
        })
        setFamilyEvolutions(evoData.families || [])
      }

      if (evalRes.ok) {
        const evalData = await evalRes.json()
        setEvaluations(evalData.evaluations || [])
      }
    } catch {
      setGlobalStats({
        totalFamilies: 0,
        totalEvaluations: 0,
        totalRules: 0,
        totalEvolutionEvents: 0,
      })
      setFamilyEvolutions([])
      setEvaluations([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const triggerEvolution = async () => {
    setEvolving(true)
    try {
      const res = await fetch('/api/evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyKey: selectedFamily }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '进化触发失败')
      }
      const data = await res.json()
      toast.success(`进化周期完成! ${data.familyName} 已进化至 Gen-${data.generation}`)
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '进化失败，请重试')
    } finally {
      setEvolving(false)
    }
  }

  const statCards = [
    {
      label: '总评估数',
      value: globalStats?.totalEvaluations ?? 0,
      icon: BarChart3,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: '活跃规则',
      value: globalStats?.totalRules ?? 0,
      icon: Hash,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: '进化事件',
      value: globalStats?.totalEvolutionEvents ?? 0,
      icon: Zap,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
    },
    {
      label: '覆盖家族',
      value: globalStats?.totalFamilies ?? 0,
      icon: Layers,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
  ]

  // Merge all recent events from all families, sorted by date
  const allEvents = familyEvolutions
    .flatMap((f) =>
      (f.recentEvents || []).map((e) => ({
        ...e,
        familyKey: f.familyKey,
        familyName: f.familyName,
      }))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)

  return (
    <section className="relative py-24 px-4" id="evolution">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4">
            进化仪表盘
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            监控审美智能的进化轨迹，追踪规则生长与世代演进
          </p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl bg-slate-800/50" />
              ))
            : statCards.map((stat) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                >
                  <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${stat.bg}`}>
                          <stat.icon className={`w-5 h-5 ${stat.color}`} />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-50">
                            {stat.value}
                          </p>
                          <p className="text-xs text-slate-400">{stat.label}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
        </div>

        {/* Trigger Evolution */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <Select value={selectedFamily} onValueChange={setSelectedFamily}>
            <SelectTrigger className="w-64 bg-slate-800/50 border-slate-600 text-slate-200">
              <SelectValue placeholder="选择家族" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {familyEvolutions.map((f) => (
                <SelectItem key={f.familyKey} value={f.familyKey}>
                  {f.familyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={triggerEvolution}
            disabled={evolving || familyEvolutions.length === 0}
            className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-8 py-5 rounded-xl shadow-lg shadow-violet-500/20 transition-all duration-300 hover:shadow-violet-500/30"
          >
            {evolving ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                进化中...
              </>
            ) : (
              <>
                <Dna className="w-5 h-5 mr-2" />
                触发进化周期
              </>
            )}
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Per-family evolution stats */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                  家族进化状态
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 rounded-lg bg-slate-800/50" />
                    ))}
                  </div>
                ) : familyEvolutions.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                    {familyEvolutions.map((fam) => (
                      <div
                        key={fam.familyKey}
                        className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30"
                      >
                        <div className={`p-2 rounded-lg ${FAMILY_BG[fam.familyKey] || 'bg-slate-700/30'}`}>
                          <TrendingUp className={`w-4 h-4 ${FAMILY_COLORS[fam.familyKey] || 'text-slate-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-medium ${FAMILY_COLORS[fam.familyKey] || 'text-slate-300'}`}>
                              {fam.familyName}
                            </span>
                            <span className="text-xs text-slate-500">
                              Gen {fam.stats.latestGeneration}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mb-1.5">
                            <span>评估: {fam.stats.totalEvaluations}</span>
                            <span>规则: {fam.stats.totalRules}</span>
                            {fam.stats.avgScore > 0 && (
                              <span>均分: {fam.stats.avgScore.toFixed(1)}</span>
                            )}
                          </div>
                          <Progress
                            value={Math.min(fam.stats.totalEvaluations * 5, 100)}
                            className="h-1 bg-slate-700/50 [&>div]:bg-amber-500"
                          />
                          {fam.stats.rulesByType && (
                            <div className="flex items-center gap-2 mt-1.5">
                              {fam.stats.rulesByType.positive > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-500/20 text-emerald-400 bg-emerald-500/5">
                                  +{fam.stats.rulesByType.positive}
                                </Badge>
                              )}
                              {fam.stats.rulesByType.negative > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-rose-500/20 text-rose-400 bg-rose-500/5">
                                  -{fam.stats.rulesByType.negative}
                                </Badge>
                              )}
                              {fam.stats.rulesByType.conditional > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-violet-500/20 text-violet-400 bg-violet-500/5">
                                  ?{fam.stats.rulesByType.conditional}
                                </Badge>
                              )}
                              {fam.stats.avgRuleConfidence > 0 && (
                                <span className="text-[10px] text-slate-500 ml-auto">
                                  置信度 {fam.stats.avgRuleConfidence.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    暂无进化数据，请先进行审美评估
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Evolution Events Timeline */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
                  <Activity className="w-5 h-5 text-amber-400" />
                  进化事件
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 rounded-lg bg-slate-800/50" />
                    ))}
                  </div>
                ) : allEvents.length > 0 ? (
                  <div className="space-y-1 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    {allEvents.map((event, idx) => (
                      <div key={event.id || idx} className="flex gap-3 p-3 rounded-lg hover:bg-slate-800/30 transition-colors">
                        <div className="flex flex-col items-center">
                          <div className={`w-2.5 h-2.5 rounded-full ${FAMILY_DOT[event.familyKey] || 'bg-amber-500'} mt-1.5 shrink-0`} />
                          {idx < allEvents.length - 1 && (
                            <div className="w-px flex-1 bg-slate-700/50 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant="outline" className="text-xs px-1.5 py-0 border-amber-500/20 text-amber-300 bg-amber-500/5">
                              {event.eventType}
                            </Badge>
                            <Badge variant="outline" className="text-xs px-1.5 py-0 border-slate-600 text-slate-400">
                              {event.familyName}
                            </Badge>
                            {event.generation > 0 && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0 border-violet-500/20 text-violet-300 bg-violet-500/5">
                                Gen {event.generation}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 line-clamp-2">{event.description}</p>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(event.createdAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    暂无进化事件
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Evaluation History Table */}
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
                <Brain className="w-5 h-5 text-amber-400" />
                评估历史
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-lg bg-slate-800/50" />
                  ))}
                </div>
              ) : evaluations.length > 0 ? (
                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700/50 hover:bg-transparent">
                        <TableHead className="text-slate-400">时间</TableHead>
                        <TableHead className="text-slate-400">家族</TableHead>
                        <TableHead className="text-slate-400">评分</TableHead>
                        <TableHead className="text-slate-400">世代</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evaluations.map((evalRecord) => (
                        <TableRow key={evalRecord.id} className="border-slate-700/30 hover:bg-slate-800/30">
                          <TableCell className="text-slate-400 text-xs">
                            {new Date(evalRecord.createdAt).toLocaleString('zh-CN')}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-xs ${FAMILY_COLORS[evalRecord.family?.key] || 'text-slate-300'} border-slate-600`}
                            >
                              {evalRecord.family?.name || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`font-semibold ${
                                evalRecord.overallScore >= 7
                                  ? 'text-emerald-400'
                                  : evalRecord.overallScore >= 4
                                    ? 'text-amber-400'
                                    : 'text-rose-400'
                              }`}
                            >
                              {evalRecord.overallScore?.toFixed(1)}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs">
                            Gen-{evalRecord.evolutionGeneration || 0}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  暂无评估记录
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
