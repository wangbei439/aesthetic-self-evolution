'use client'

import { motion } from 'framer-motion'
import {
  Globe,
  Layers,
  Sparkles,
  ArrowRight,
  Eye,
  Scale,
  RotateCcw,
  Dna,
  Brain,
  BookOpen,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const LAYERS = [
  {
    level: 0,
    name: '通用审美层',
    nameEn: 'Universal Aesthetic Layer',
    icon: Globe,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    description: '跨域共享的审美基础：平衡、对比、和谐、节奏等通用审美原则',
    reference: 'Kant — 自由美 (Free Beauty)',
  },
  {
    level: 1,
    name: '家族审美层',
    nameEn: 'Family Aesthetic Layer',
    icon: Layers,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    description: '6大审美家族（叙事视觉、交互界面、空间营造、人物造型、平面构成、动态韵律）各具独立评估维度与规则体系',
    reference: 'Chatterjee — 审美三重模型 (Aesthetic Triad)',
  },
  {
    level: 2,
    name: '主题审美层',
    nameEn: 'Theme Aesthetic Layer',
    icon: Sparkles,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    description: '基于具体主题与情境的精细化审美判断，融合上下文与情感因素',
    reference: 'Leder — 信息处理模型 (Information Processing Model)',
  },
]

const EVOLUTION_LOOP = [
  {
    name: '感知',
    nameEn: 'Perceive',
    icon: Eye,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    description: '接收视觉输入，提取审美特征',
  },
  {
    name: '判断',
    nameEn: 'Judge',
    icon: Scale,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    description: '基于规则与记忆进行审美评分',
  },
  {
    name: '反思',
    nameEn: 'Reflect',
    icon: RotateCcw,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    description: '比较预测与反馈，识别偏差',
  },
  {
    name: '进化',
    nameEn: 'Evolve',
    icon: Dna,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    description: '调整规则权重，生成新规则',
  },
  {
    name: '记忆',
    nameEn: 'Memory',
    icon: Brain,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    description: '存储进化成果，形成审美记忆',
  },
]

export function ArchitectureSection() {
  return (
    <section className="relative py-24 px-4" id="architecture">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4">
            架构与理论
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            三层审美架构与闭环进化机制，融合经典美学理论与计算智能
          </p>
        </motion.div>

        {/* Three-Layer Architecture */}
        <div className="mb-20">
          <motion.h3
            className="text-xl font-semibold text-slate-200 mb-8 text-center flex items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Layers className="w-5 h-5 text-amber-400" />
            三层审美架构
          </motion.h3>

          <div className="space-y-4 max-w-3xl mx-auto">
            {LAYERS.map((layer, idx) => (
              <motion.div
                key={layer.level}
                initial={{ opacity: 0, x: idx % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
              >
                <Card className={`bg-slate-900/80 border ${layer.border} backdrop-blur-sm overflow-hidden`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${layer.bg} shrink-0`}>
                        <layer.icon className={`w-7 h-7 ${layer.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="outline" className="text-xs px-1.5 border-slate-600 text-slate-400">
                            Layer {layer.level}
                          </Badge>
                          <span className={`font-semibold text-lg ${layer.color}`}>
                            {layer.name}
                          </span>
                          <span className="text-slate-500 text-sm">
                            {layer.nameEn}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm leading-relaxed mb-3">
                          {layer.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <BookOpen className="w-3.5 h-3.5" />
                          {layer.reference}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Evolution Loop */}
        <div>
          <motion.h3
            className="text-xl font-semibold text-slate-200 mb-8 text-center flex items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <RotateCcw className="w-5 h-5 text-amber-400" />
            闭环进化循环
          </motion.h3>

          <div className="max-w-4xl mx-auto">
            {/* Desktop: Horizontal loop */}
            <div className="hidden md:flex items-start justify-between gap-2">
              {EVOLUTION_LOOP.map((step, idx) => (
                <motion.div
                  key={step.name}
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                >
                  <div className="flex flex-col items-center">
                    <motion.div
                      className={`p-4 rounded-2xl ${step.bg} border border-slate-700/30 shadow-lg`}
                      whileHover={{ scale: 1.05 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <step.icon className={`w-8 h-8 ${step.color}`} />
                    </motion.div>
                    <span className={`font-semibold text-sm mt-2 ${step.color}`}>
                      {step.name}
                    </span>
                    <span className="text-xs text-slate-500">{step.nameEn}</span>
                    <p className="text-xs text-slate-500 mt-1 text-center max-w-[120px]">
                      {step.description}
                    </p>
                  </div>
                  {idx < EVOLUTION_LOOP.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-slate-600 shrink-0 mt-8" />
                  )}
                </motion.div>
              ))}
            </div>

            {/* Loop indicator */}
            <motion.div
              className="hidden md:flex justify-center mt-6"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="text-amber-500/40 text-sm">↻ 持续循环迭代</span>
            </motion.div>

            {/* Mobile: Vertical loop */}
            <div className="md:hidden space-y-3">
              {EVOLUTION_LOOP.map((step, idx) => (
                <motion.div
                  key={step.name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                >
                  <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${step.bg} shrink-0`}>
                        <step.icon className={`w-6 h-6 ${step.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${step.color}`}>
                            {step.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {step.nameEn}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {step.description}
                        </p>
                      </div>
                      {idx < EVOLUTION_LOOP.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-slate-600 rotate-90 shrink-0" />
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              <motion.div
                className="text-center"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span className="text-amber-500/40 text-xs">↻ 持续循环迭代</span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Theory References */}
        <motion.div
          className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {[
            {
              name: 'Kant',
              work: '判断力批判',
              contribution: '自由美与依存美的区分，奠定了域感知审美的哲学基础',
            },
            {
              name: 'Chatterjee',
              work: 'The Aesthetic Brain',
              contribution: '审美三重模型：感觉-运动-知识系统的交互产生审美体验',
            },
            {
              name: 'Leder',
              work: '信息处理模型',
              contribution: '审美体验的多阶段加工过程：感知→显性分类→隐式整合→评估',
            },
          ].map((ref) => (
            <Card key={ref.name} className="bg-slate-900/60 border-slate-700/30 backdrop-blur-sm">
              <CardContent className="p-5">
                <h4 className="font-semibold text-amber-400 text-sm mb-1">
                  {ref.name}
                </h4>
                <p className="text-xs text-slate-500 mb-2 italic">
                  {ref.work}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {ref.contribution}
                </p>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
