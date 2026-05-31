'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Clapperboard, Layout, Building2, User, Palette, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { LucideIcon } from 'lucide-react'

const FAMILY_ICON_MAP: Record<string, LucideIcon> = {
  narrative_visual: Clapperboard,
  interactive_ui: Layout,
  spatial: Building2,
  character: User,
  graphic_composition: Palette,
  dynamic_rhythm: Zap,
}

const FAMILY_COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string; badge: string }> = {
  narrative_visual: {
    bg: 'bg-orange-500/5',
    border: 'border-orange-500/20 hover:border-orange-500/40',
    text: 'text-orange-400',
    glow: 'group-hover:shadow-orange-500/10',
    badge: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  },
  interactive_ui: {
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    text: 'text-emerald-400',
    glow: 'group-hover:shadow-emerald-500/10',
    badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  },
  spatial: {
    bg: 'bg-violet-500/5',
    border: 'border-violet-500/20 hover:border-violet-500/40',
    text: 'text-violet-400',
    glow: 'group-hover:shadow-violet-500/10',
    badge: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  },
  character: {
    bg: 'bg-rose-500/5',
    border: 'border-rose-500/20 hover:border-rose-500/40',
    text: 'text-rose-400',
    glow: 'group-hover:shadow-rose-500/10',
    badge: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  },
  graphic_composition: {
    bg: 'bg-cyan-500/5',
    border: 'border-cyan-500/20 hover:border-cyan-500/40',
    text: 'text-cyan-400',
    glow: 'group-hover:shadow-cyan-500/10',
    badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  },
  dynamic_rhythm: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    text: 'text-amber-400',
    glow: 'group-hover:shadow-amber-500/10',
    badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  },
}

export interface AestheticFamily {
  key: string
  name: string
  description: string
  criteria: {
    dimensions: { key: string; name: string; desc: string }[]
  }
  domains: string[]
  icon?: string
  color?: string
}

const FALLBACK_FAMILIES: AestheticFamily[] = [
  {
    key: 'narrative_visual',
    name: '叙事视觉',
    description: '通过镜头语言和视觉叙事传递情感与故事。包括影视摄影、游戏过场、动画分镜、MV等。',
    criteria: {
      dimensions: [
        { key: 'composition', name: '构图', desc: '画面构图的平衡与引导力' },
        { key: 'light_shadow', name: '光影', desc: '光线的戏剧性与氛围营造' },
        { key: 'color_tone', name: '色调', desc: '色彩的情绪表达与统一性' },
        { key: 'narrative_tension', name: '叙事张力', desc: '画面传递的故事感与情绪强度' },
        { key: 'rhythm', name: '节奏感', desc: '视觉元素的流动与韵律' },
      ],
    },
    domains: ['影视摄影', '游戏过场动画', '动画分镜', 'MV/音乐视频', '广告短片'],
  },
  {
    key: 'interactive_ui',
    name: '交互界面',
    description: '以功能可用性为核心的美学。包括UI设计、游戏HUD、Web/App界面等。',
    criteria: {
      dimensions: [
        { key: 'visual_hierarchy', name: '视觉层次', desc: '信息的主次关系与阅读动线' },
        { key: 'spacing_rhythm', name: '间距节奏', desc: '元素间距的一致性与韵律感' },
        { key: 'color_system', name: '色彩体系', desc: '配色的功能性与美观性' },
        { key: 'typography', name: '字体排版', desc: '字体的选择与排布品质' },
        { key: 'usability_beauty', name: '可用性之美', desc: '功能与美感的统一' },
      ],
    },
    domains: ['UI设计', '游戏HUD', 'Web界面', 'App界面', '仪表盘/数据可视化', '后台管理系统'],
  },
  {
    key: 'spatial',
    name: '空间营造',
    description: '通过空间比例与氛围营造沉浸体验。包括游戏场景、建筑可视化、VR环境等。',
    criteria: {
      dimensions: [
        { key: 'spatial_proportion', name: '空间比例', desc: '空间尺度的协调与壮观感' },
        { key: 'atmosphere', name: '氛围渲染', desc: '环境氛围的营造能力' },
        { key: 'depth_layering', name: '纵深层次', desc: '前景/中景/远景的层次感' },
        { key: 'immersion', name: '沉浸感', desc: '空间的代入感与真实感' },
        { key: 'detail_richness', name: '细节丰富度', desc: '环境细节的精致与可信度' },
      ],
    },
    domains: ['游戏场景', '建筑可视化', '室内设计', 'VR环境', '舞台设计', '主题乐园设计'],
  },
  {
    key: 'character',
    name: '人物造型',
    description: '以人体为载体的造型美学。包括角色设计、服装设计、时尚摄影、数字人等。',
    criteria: {
      dimensions: [
        { key: 'proportion', name: '比例', desc: '人体比例的准确与风格化' },
        { key: 'silhouette', name: '轮廓线', desc: '剪影的辨识度与美感' },
        { key: 'material', name: '材质表现', desc: '面料/皮肤/金属等材质的质感' },
        { key: 'styling', name: '风格化', desc: '造型风格的统一与独特性' },
        { key: 'expression', name: '表现力', desc: '角色气质与情感传达' },
      ],
    },
    domains: ['角色设计', '服装设计', '时尚摄影', '数字人', 'Cosplay造型', '特效化妆'],
  },
  {
    key: 'graphic_composition',
    name: '平面构成',
    description: '静态画面的构成完整性。包括海报设计、品牌视觉、插画、包装等。',
    criteria: {
      dimensions: [
        { key: 'layout', name: '排版', desc: '元素排布的秩序与张力' },
        { key: 'negative_space', name: '负空间', desc: '留白的呼吸感与功能' },
        { key: 'color_harmony', name: '色彩和谐', desc: '色彩搭配的协调与冲击力' },
        { key: 'visual_weight', name: '视觉重心', desc: '画面的稳定与动感平衡' },
        { key: 'completeness', name: '构成完整', desc: '整体画面的完整与自洽' },
      ],
    },
    domains: ['海报设计', '品牌视觉', '插画', '包装设计', '书籍封面', 'Logo设计'],
  },
  {
    key: 'dynamic_rhythm',
    name: '动态韵律',
    description: '时间维度上的韵律之美。包括动效设计、特效动画、舞蹈编排、运动图形等。',
    criteria: {
      dimensions: [
        { key: 'tempo', name: '节奏', desc: '运动速度的变化与节奏感' },
        { key: 'transition', name: '过渡', desc: '帧间过渡的流畅与质感' },
        { key: 'energy_flow', name: '能量流动', desc: '运动方向的引导与能量感' },
        { key: 'musicality', name: '律动感', desc: '与音乐/节拍的呼应' },
        { key: 'impact', name: '冲击力', desc: '关键时刻的视觉冲击' },
      ],
    },
    domains: ['动效设计', '特效动画', '舞蹈编排', '运动图形', '转场动画', 'Loading动画'],
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

interface FamiliesSectionProps {
  onSelectFamily: (familyKey: string) => void
}

export function FamiliesSection({ onSelectFamily }: FamiliesSectionProps) {
  const [families, setFamilies] = useState<AestheticFamily[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchFamilies() {
      try {
        const res = await fetch('/api/families')
        if (res.ok) {
          const data = await res.json()
          if (data.families && Array.isArray(data.families) && data.families.length > 0) {
            setFamilies(data.families)
          } else {
            setFamilies(FALLBACK_FAMILIES)
          }
        } else {
          setFamilies(FALLBACK_FAMILIES)
        }
      } catch {
        setFamilies(FALLBACK_FAMILIES)
      } finally {
        setLoading(false)
      }
    }
    fetchFamilies()
  }, [])

  return (
    <section className="relative py-24 px-4" id="families">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4">
            六大审美家族
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            每个审美家族拥有独立的评估维度、进化规则与记忆体系，实现域感知的精准审美判断
          </p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl bg-slate-800/50" />
            ))}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {families.map((family) => {
              const Icon = FAMILY_ICON_MAP[family.key] || Palette
              const colors = FAMILY_COLOR_MAP[family.key] || FAMILY_COLOR_MAP.dynamic_rhythm
              const dimensions = family.criteria?.dimensions || []

              return (
                <motion.div key={family.key} variants={cardVariants}>
                  <Card
                    className={`group cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-xl ${colors.glow} ${colors.bg} ${colors.border} bg-slate-900/80 backdrop-blur-sm`}
                    onClick={() => onSelectFamily(family.key)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2.5 rounded-lg ${colors.bg} ${colors.text}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-50 text-lg">
                            {family.name}
                          </h3>
                          <p className={`text-xs font-mono ${colors.text} opacity-70`}>
                            {family.key}
                          </p>
                        </div>
                      </div>

                      <p className="text-slate-400 text-sm leading-relaxed mb-5 line-clamp-2">
                        {family.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5">
                        {dimensions.map((dim) => (
                          <Badge
                            key={dim.key}
                            variant="outline"
                            className={`text-xs px-2 py-0.5 ${colors.badge} border`}
                          >
                            {dim.name}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>
    </section>
  )
}
