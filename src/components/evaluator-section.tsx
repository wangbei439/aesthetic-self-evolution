'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Sparkles,
  FileImage,
  MessageSquare,
  ChevronDown,
  Send,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

interface EvaluationResult {
  id: string
  family: {
    key: string
    name: string
    description: string
    criteria: {
      dimensions: { key: string; name: string; desc: string }[]
    }
    domains: string[]
  }
  classification: {
    familyKey: string
    detectedDomain: string | null
    confidence: number
  }
  evaluation: {
    dimensionScores: Record<string, number>
    dimensionNotes: Record<string, string>
    overallScore: number
    strengths: string[]
    weaknesses: string[]
    suggestions: string[]
    assessment: string
  }
  evolutionGeneration: number
  ruleVersionUsed: string | null
  createdAt: string
}

const FAMILY_OPTIONS = [
  { value: 'auto', label: '自动检测 (Auto-detect)' },
  { value: 'narrative_visual', label: '叙事视觉 (Narrative Visual)' },
  { value: 'interactive_ui', label: '交互界面 (Interactive UI)' },
  { value: 'spatial', label: '空间营造 (Spatial)' },
  { value: 'character', label: '人物造型 (Character)' },
  { value: 'graphic_composition', label: '平面构成 (Graphic Composition)' },
  { value: 'dynamic_rhythm', label: '动态韵律 (Dynamic Rhythm)' },
]

function getScoreColor(score: number): string {
  if (score >= 7) return 'text-emerald-400'
  if (score >= 4) return 'text-amber-400'
  return 'text-rose-400'
}

function getProgressBg(score: number): string {
  if (score >= 7) return '[&>div]:bg-emerald-500'
  if (score >= 4) return '[&>div]:bg-amber-500'
  return '[&>div]:bg-rose-500'
}

const FAMILY_DISPLAY_NAMES: Record<string, string> = {
  narrative_visual: '叙事视觉',
  interactive_ui: '交互界面',
  spatial: '空间营造',
  character: '人物造型',
  graphic_composition: '平面构成',
  dynamic_rhythm: '动态韵律',
}

interface EvaluatorSectionProps {
  preselectedFamily: string | null
}

export function EvaluatorSection({ preselectedFamily }: EvaluatorSectionProps) {
  const [image, setImage] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [familyKey, setFamilyKey] = useState<string>('auto')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [humanScore, setHumanScore] = useState<string>('')
  const [humanFeedbackText, setHumanFeedbackText] = useState('')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

  useEffect(() => {
    if (preselectedFamily) {
      setFamilyKey(preselectedFamily)
    }
  }, [preselectedFamily])

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过10MB')
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setImage(e.target?.result as string)
    }
    reader.readAsDataURL(file)
    setResult(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleEvaluate = async () => {
    if (!imageFile) {
      toast.error('请先上传一张图片')
      return
    }

    setLoading(true)
    setResult(null)
    setFeedbackOpen(false)
    setHumanScore('')
    setHumanFeedbackText('')
    setFeedbackSubmitted(false)

    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      if (familyKey && familyKey !== 'auto') {
        formData.append('familyKey', familyKey)
      }

      const res = await fetch('/api/evaluate', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || '评估请求失败')
      }

      const data = await res.json()
      setResult(data)
      toast.success('审美评估完成！')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '评估失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const clearImage = () => {
    setImage(null)
    setImageFile(null)
    setResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Build dimension display from the result
  const getDimensionsFromResult = () => {
    if (!result) return []
    const dimensions = result.family?.criteria?.dimensions || []
    const scores = result.evaluation?.dimensionScores || {}
    const notes = result.evaluation?.dimensionNotes || {}
    return dimensions.map((dim) => ({
      name: dim.name,
      key: dim.key,
      desc: dim.desc,
      score: scores[dim.key] ?? 0,
      note: notes[dim.key] || '',
    }))
  }

  return (
    <section className="relative py-24 px-4" id="evaluator">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4">
            审美评估器
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            上传图片，选择审美家族，获取域感知的精准审美评估
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Upload & Controls */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-slate-200 flex items-center gap-2">
                  <FileImage className="w-5 h-5 text-amber-400" />
                  图片上传
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Upload area */}
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
                    dragOver
                      ? 'border-amber-400 bg-amber-500/5'
                      : image
                        ? 'border-slate-600 bg-slate-800/50'
                        : 'border-slate-600 hover:border-amber-400/50 hover:bg-slate-800/30'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => !image && fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileSelect(file)
                    }}
                  />

                  {image ? (
                    <div className="relative">
                      <img
                        src={image}
                        alt="上传的图片"
                        className="max-h-64 mx-auto rounded-lg object-contain"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 h-8 w-8 p-0 rounded-full"
                        onClick={(e) => {
                          e.stopPropagation()
                          clearImage()
                        }}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="py-6">
                      <Upload className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                      <p className="text-slate-400 mb-2">
                        拖拽图片到这里，或点击选择
                      </p>
                      <p className="text-slate-500 text-sm">
                        支持 JPG、PNG、WebP，最大 10MB
                      </p>
                    </div>
                  )}
                </div>

                {/* Family selector */}
                <div className="mt-6">
                  <label className="text-sm text-slate-400 mb-2 block">
                    审美家族选择
                  </label>
                  <Select value={familyKey} onValueChange={setFamilyKey}>
                    <SelectTrigger className="w-full bg-slate-800/50 border-slate-600 text-slate-200">
                      <SelectValue placeholder="选择审美家族" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {FAMILY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Evaluate button */}
                <Button
                  onClick={handleEvaluate}
                  disabled={loading || !imageFile}
                  className="w-full mt-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold py-5 text-base rounded-xl shadow-lg shadow-amber-500/20 transition-all duration-300 hover:shadow-amber-500/30 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      评估中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      开始评估
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Right: Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            {loading ? (
              <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center justify-center py-16">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <Sparkles className="w-12 h-12 text-amber-400" />
                    </motion.div>
                    <p className="text-slate-400 mt-4 text-sm">
                      正在进行审美评估...
                    </p>
                    <div className="w-48 mt-4 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-amber-500 rounded-full"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        style={{ width: "40%" }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : result ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                  <CardContent className="p-6 space-y-6">
                    {/* Overall Score */}
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-slate-700 mb-3">
                        <span className={`text-4xl font-bold ${getScoreColor(result.evaluation.overallScore)}`}>
                          {result.evaluation.overallScore?.toFixed(1) ?? '-'}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm">综合评分</p>
                      {result.classification && (
                        <Badge variant="outline" className="mt-2 border-amber-500/30 text-amber-300 bg-amber-500/5">
                          {FAMILY_DISPLAY_NAMES[result.classification.familyKey] || result.classification.familyKey}
                          {result.classification.confidence > 0 && (
                            <span className="ml-1 opacity-70">
                              (置信度: {(result.classification.confidence * 100).toFixed(0)}%)
                            </span>
                          )}
                        </Badge>
                      )}
                      {result.evolutionGeneration > 0 && (
                        <p className="text-xs text-slate-500 mt-1.5">
                          世代 Gen-{result.evolutionGeneration}
                          {result.ruleVersionUsed && ` · 规则 ${result.ruleVersionUsed}`}
                        </p>
                      )}
                    </div>

                    <Separator className="bg-slate-700/50" />

                    {/* Dimension Scores */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-300 mb-4">
                        维度评分
                      </h4>
                      <div className="space-y-3">
                        {getDimensionsFromResult().map((dim) => (
                          <div key={dim.key}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-slate-400">{dim.name}</span>
                              <span className={`font-medium ${getScoreColor(dim.score)}`}>
                                {dim.score?.toFixed(1)}
                              </span>
                            </div>
                            <Progress
                              value={dim.score * 10}
                              className={`h-2 bg-slate-700/50 ${getProgressBg(dim.score)}`}
                            />
                            {dim.note && (
                              <p className="text-xs text-slate-500 mt-1">{dim.note}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator className="bg-slate-700/50" />

                    {/* Strengths */}
                    {result.evaluation.strengths && result.evaluation.strengths.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          优势
                        </h4>
                        <ul className="space-y-1.5">
                          {result.evaluation.strengths.map((s, i) => (
                            <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Weaknesses */}
                    {result.evaluation.weaknesses && result.evaluation.weaknesses.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-rose-400" />
                          不足
                        </h4>
                        <ul className="space-y-1.5">
                          {result.evaluation.weaknesses.map((w, i) => (
                            <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                              <XCircle className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggestions */}
                    {result.evaluation.suggestions && result.evaluation.suggestions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-400" />
                          改进建议
                        </h4>
                        <ul className="space-y-1.5">
                          {result.evaluation.suggestions.map((s, i) => (
                            <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                              <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Separator className="bg-slate-700/50" />

                    {/* Full evaluation text */}
                    {result.evaluation.assessment && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-3">
                          完整评估
                        </h4>
                        <div className="prose prose-invert prose-sm max-w-none text-slate-400 bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
                          <ReactMarkdown>{result.evaluation.assessment}</ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Human Feedback Section */}
                    <Separator className="bg-slate-700/50" />
                    <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
                      <button
                        className="flex items-center gap-2 text-sm font-medium text-slate-300 w-full text-left"
                        onClick={() => setFeedbackOpen(!feedbackOpen)}
                      >
                        <MessageSquare className="w-4 h-4 text-amber-400" />
                        人工反馈
                        <ChevronDown
                          className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${feedbackOpen ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {feedbackOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 space-y-4"
                        >
                          {/* Score input */}
                          <div>
                            <label className="text-xs text-slate-400 mb-1.5 block">
                              你的评分 (0-10)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={10}
                              step={0.5}
                              value={humanScore}
                              onChange={(e) => setHumanScore(e.target.value)}
                              className="w-24 rounded-md border border-slate-600 bg-slate-900/50 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                              placeholder="0-10"
                              disabled={feedbackSubmitted}
                            />
                          </div>

                          {/* Feedback text */}
                          <div>
                            <label className="text-xs text-slate-400 mb-1.5 block">
                              反馈意见
                            </label>
                            <Textarea
                              value={humanFeedbackText}
                              onChange={(e) => setHumanFeedbackText(e.target.value)}
                              placeholder="请输入你对这次评估的反馈意见..."
                              className="bg-slate-900/50 border-slate-600 text-slate-200 placeholder:text-slate-600 min-h-[80px] resize-none"
                              disabled={feedbackSubmitted}
                            />
                          </div>

                          {/* Submit button */}
                          {feedbackSubmitted ? (
                            <div className="flex items-center gap-2 text-emerald-400 text-sm">
                              <CheckCircle2 className="w-4 h-4" />
                              已提交
                            </div>
                          ) : (
                            <Button
                              onClick={async () => {
                                const score = parseFloat(humanScore)
                                if (humanScore && (isNaN(score) || score < 0 || score > 10)) {
                                  toast.error('评分需在0-10之间')
                                  return
                                }
                                if (!humanScore && !humanFeedbackText.trim()) {
                                  toast.error('请填写评分或反馈意见')
                                  return
                                }
                                setFeedbackSubmitting(true)
                                try {
                                  const body: { humanScoreOverride?: number; humanFeedback?: string } = {}
                                  if (humanScore) body.humanScoreOverride = score
                                  if (humanFeedbackText.trim()) body.humanFeedback = humanFeedbackText.trim()
                                  const res = await fetch(`/api/evaluations/${result.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(body),
                                  })
                                  if (!res.ok) {
                                    const err = await res.json().catch(() => ({}))
                                    throw new Error(err.error || '提交失败')
                                  }
                                  setFeedbackSubmitted(true)
                                  toast.success('反馈提交成功！')
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : '提交失败，请重试')
                                } finally {
                                  setFeedbackSubmitting(false)
                                }
                              }}
                              disabled={feedbackSubmitting}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
                            >
                              {feedbackSubmitting ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4 mr-2" />
                              )}
                              提交反馈
                            </Button>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <ImageIcon className="w-16 h-16 text-slate-600 mb-4" />
                    <h3 className="text-slate-400 text-lg mb-2">等待评估</h3>
                    <p className="text-slate-500 text-sm max-w-xs">
                      上传图片并点击评估按钮，即可获取域感知的审美分析结果
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
