'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, Radar as RadarIcon } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FamilyInfo {
  key: string
  name: string
  color: string
}

interface EvaluationRecord {
  id: string
  family: FamilyInfo
  overallScore: number
  dimensionScores: Record<string, number>
  evolutionGeneration: number
  humanScoreOverride: number | null
  humanFeedback: string | { text: string; timestamp: string } | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FAMILY_LINE_COLORS: Record<string, string> = {
  narrative_visual: '#fb923c',    // orange-400
  interactive_ui: '#34d399',      // emerald-400
  spatial: '#a78bfa',             // violet-400
  character: '#fb7185',           // rose-400
  graphic_composition: '#22d3ee', // cyan-400
  dynamic_rhythm: '#fbbf24',      // amber-400
}

const FAMILY_NAMES: Record<string, string> = {
  narrative_visual: '叙事视觉',
  interactive_ui: '交互界面',
  spatial: '空间营造',
  character: '人物造型',
  graphic_composition: '平面构成',
  dynamic_rhythm: '动态韵律',
}

const ALL_FAMILY_KEYS = Object.keys(FAMILY_LINE_COLORS)

// Dark theme constants
const GRID_STROKE = '#334155'    // slate-700
const TEXT_FILL = '#94a3b8'      // slate-400
const TOOLTIP_BG = '#1e293b'     // slate-800
const TOOLTIP_BORDER = '#475569' // slate-600

// ---------------------------------------------------------------------------
// Custom Tooltip for Line Chart
// ---------------------------------------------------------------------------

function LineChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-xl text-xs"
      style={{
        backgroundColor: TOOLTIP_BG,
        borderColor: TOOLTIP_BORDER,
      }}
    >
      <p className="text-slate-300 mb-1.5 font-medium">
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-400">{FAMILY_NAMES[entry.dataKey] || entry.dataKey}</span>
            <span className="text-slate-100 font-semibold ml-auto">{entry.value.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom Legend
// ---------------------------------------------------------------------------

interface CustomLegendProps {
  payload?: Array<{ value: string; color: string; dataKey: string }>
  hiddenFamilies: Set<string>
  onToggleFamily: (key: string) => void
}

function CustomLegend({ payload, hiddenFamilies, onToggleFamily }: CustomLegendProps) {
  if (!payload) return null

  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
      {payload.map((entry) => {
        const isHidden = hiddenFamilies.has(entry.dataKey)
        return (
          <button
            key={entry.dataKey}
            onClick={() => onToggleFamily(entry.dataKey)}
            className="flex items-center gap-1.5 text-xs cursor-pointer transition-opacity hover:opacity-80"
            style={{ opacity: isHidden ? 0.35 : 1 }}
          >
            <span
              className="inline-block w-3 h-0.5 rounded-full"
              style={{
                backgroundColor: isHidden ? '#475569' : entry.color,
              }}
            />
            <span
              className="font-medium"
              style={{ color: isHidden ? '#64748b' : entry.color }}
            >
              {FAMILY_NAMES[entry.dataKey] || entry.dataKey}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom Tooltip for Radar Chart
// ---------------------------------------------------------------------------

function RadarTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { dimension: string; score: number; fullMark: number } }>
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-xl text-xs"
      style={{
        backgroundColor: TOOLTIP_BG,
        borderColor: TOOLTIP_BORDER,
      }}
    >
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-slate-400">{entry.payload.dimension}</span>
          <span className="text-slate-100 font-semibold ml-auto">{entry.value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ScoreTrendChart() {
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFamily, setSelectedFamily] = useState<string>('narrative_visual')
  const [hiddenFamilies, setHiddenFamilies] = useState<Set<string>>(new Set())

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/evaluations?limit=100')
      if (res.ok) {
        const data = await res.json()
        setEvaluations(data.evaluations || [])
      } else {
        setEvaluations([])
      }
    } catch {
      setEvaluations([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Toggle family visibility
  const toggleFamily = useCallback((key: string) => {
    setHiddenFamilies((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  // ----- Line chart data -----
  // Group evaluations by time (date), each point has one score per family (latest that day)
  const lineChartData = useMemo(() => {
    if (evaluations.length === 0) return []

    // Sort by createdAt ascending
    const sorted = [...evaluations].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    // Group by date
    const grouped = new Map<string, Record<string, number>>()

    for (const evalItem of sorted) {
      const date = new Date(evalItem.createdAt)
      const key = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

      if (!grouped.has(key)) {
        grouped.set(key, {})
      }
      const entry = grouped.get(key)!
      // Keep the latest score per family per time slot (they overwrite)
      entry[evalItem.family.key] = evalItem.humanScoreOverride ?? evalItem.overallScore
    }

    return Array.from(grouped.entries()).map(([time, scores]) => ({
      time,
      ...scores,
    }))
  }, [evaluations])

  // ----- Radar chart data -----
  // Average dimension scores for the selected family
  const radarData = useMemo(() => {
    const familyEvals = evaluations.filter((e) => e.family.key === selectedFamily)

    if (familyEvals.length === 0) return []

    // Accumulate dimension scores
    const dimAccum = new Map<string, { sum: number; count: number }>()

    for (const evalItem of familyEvals) {
      const dims = evalItem.dimensionScores || {}
      for (const [dimKey, score] of Object.entries(dims)) {
        if (typeof score === 'number') {
          if (!dimAccum.has(dimKey)) {
            dimAccum.set(dimKey, { sum: 0, count: 0 })
          }
          const acc = dimAccum.get(dimKey)!
          acc.sum += score
          acc.count += 1
        }
      }
    }

    return Array.from(dimAccum.entries()).map(([dim, { sum, count }]) => ({
      dimension: dim,
      score: Number((sum / count).toFixed(1)),
      fullMark: 10,
    }))
  }, [evaluations, selectedFamily])

  // Available families that have at least one evaluation
  const availableFamilies = useMemo(() => {
    const keys = new Set(evaluations.map((e) => e.family.key))
    return ALL_FAMILY_KEYS.filter((k) => keys.has(k))
  }, [evaluations])

  return (
    <section className="relative py-24 px-4" id="score-trend">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4">
            评分趋势
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            追踪各审美家族的评分变化趋势，洞察维度得分分布
          </p>
        </motion.div>

        {/* Line Chart Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm mb-8">
            <CardHeader>
              <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                评分趋势总览
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-80 w-full rounded-lg bg-slate-800/50" />
              ) : lineChartData.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  暂无评估数据，请先进行审美评估
                </div>
              ) : (
                <div className="w-full" style={{ height: 360 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={lineChartData}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={GRID_STROKE}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: TEXT_FILL, fontSize: 11 }}
                        tickLine={{ stroke: GRID_STROKE }}
                        axisLine={{ stroke: GRID_STROKE }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={[0, 10]}
                        tick={{ fill: TEXT_FILL, fontSize: 11 }}
                        tickLine={{ stroke: GRID_STROKE }}
                        axisLine={{ stroke: GRID_STROKE }}
                        width={35}
                      />
                      <Tooltip
                        content={<LineChartTooltip />}
                        cursor={{ stroke: '#475569', strokeDasharray: '4 4' }}
                      />
                      <Legend
                        content={(props) => (
                          <CustomLegend
                            payload={props.payload as CustomLegendProps['payload']}
                            hiddenFamilies={hiddenFamilies}
                            onToggleFamily={toggleFamily}
                          />
                        )}
                      />
                      {ALL_FAMILY_KEYS.map((key) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          name={FAMILY_NAMES[key] || key}
                          stroke={FAMILY_LINE_COLORS[key]}
                          strokeWidth={2}
                          dot={{ r: 3, fill: FAMILY_LINE_COLORS[key], stroke: FAMILY_LINE_COLORS[key] }}
                          activeDot={{ r: 5, fill: FAMILY_LINE_COLORS[key], stroke: '#0f172a', strokeWidth: 2 }}
                          hide={hiddenFamilies.has(key)}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Radar Chart Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
                  <RadarIcon className="w-5 h-5 text-amber-400" />
                  维度评分雷达图
                </CardTitle>
                <Select value={selectedFamily} onValueChange={setSelectedFamily}>
                  <SelectTrigger className="w-48 bg-slate-800/50 border-slate-600 text-slate-200">
                    <SelectValue placeholder="选择家族" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {availableFamilies.length > 0
                      ? availableFamilies.map((key) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ backgroundColor: FAMILY_LINE_COLORS[key] }}
                              />
                              {FAMILY_NAMES[key]}
                            </span>
                          </SelectItem>
                        ))
                      : ALL_FAMILY_KEYS.map((key) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ backgroundColor: FAMILY_LINE_COLORS[key] }}
                              />
                              {FAMILY_NAMES[key]}
                            </span>
                          </SelectItem>
                        ))
                    }
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center">
                  <Skeleton className="h-72 w-72 rounded-full bg-slate-800/50" />
                </div>
              ) : radarData.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  该家族暂无维度评分数据
                </div>
              ) : (
                <div className="flex justify-center">
                  <div style={{ width: '100%', maxWidth: 480, height: 360 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                        <PolarGrid stroke={GRID_STROKE} />
                        <PolarAngleAxis
                          dataKey="dimension"
                          tick={{ fill: TEXT_FILL, fontSize: 11 }}
                        />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, 10]}
                          tick={{ fill: TEXT_FILL, fontSize: 10 }}
                          tickCount={6}
                        />
                        <Tooltip content={<RadarTooltip />} />
                        <Radar
                          name={FAMILY_NAMES[selectedFamily] || selectedFamily}
                          dataKey="score"
                          stroke={FAMILY_LINE_COLORS[selectedFamily] || '#94a3b8'}
                          fill={FAMILY_LINE_COLORS[selectedFamily] || '#94a3b8'}
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
