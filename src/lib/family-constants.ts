// ---------------------------------------------------------------------------
// Shared Family Constants — single source of truth
// Used by: families-section, evaluator-section, evolution-dashboard,
//          evolution-lineage, rules-panel, score-trend-chart
// ---------------------------------------------------------------------------

/** 家族中文名 — 与数据库 seed 数据保持一致 */
export const FAMILY_NAMES: Record<string, string> = {
  narrative_visual: '叙事视觉',
  interactive_ui: '交互界面',
  spatial: '空间营造',
  character: '人物造型',
  graphic_composition: '平面构成',
  dynamic_rhythm: '动态韵律',
}

/** 家族文本颜色 */
export const FAMILY_COLORS: Record<string, string> = {
  narrative_visual: 'text-orange-400',
  interactive_ui: 'text-emerald-400',
  spatial: 'text-violet-400',
  character: 'text-rose-400',
  graphic_composition: 'text-cyan-400',
  dynamic_rhythm: 'text-amber-400',
}

/** 家族背景色 (淡) */
export const FAMILY_BG: Record<string, string> = {
  narrative_visual: 'bg-orange-500/10',
  interactive_ui: 'bg-emerald-500/10',
  spatial: 'bg-violet-500/10',
  character: 'bg-rose-500/10',
  graphic_composition: 'bg-cyan-500/10',
  dynamic_rhythm: 'bg-amber-500/10',
}

/** 家族圆点颜色 */
export const FAMILY_DOT: Record<string, string> = {
  narrative_visual: 'bg-orange-400',
  interactive_ui: 'bg-emerald-400',
  spatial: 'bg-violet-400',
  character: 'bg-rose-400',
  graphic_composition: 'bg-cyan-400',
  dynamic_rhythm: 'bg-amber-400',
}

/** 家族边框颜色 */
export const FAMILY_BORDER: Record<string, string> = {
  narrative_visual: 'border-orange-500/30',
  interactive_ui: 'border-emerald-500/30',
  spatial: 'border-violet-500/30',
  character: 'border-rose-500/30',
  graphic_composition: 'border-cyan-500/30',
  dynamic_rhythm: 'border-amber-500/30',
}

/** 家族 ring 颜色 */
export const FAMILY_RING: Record<string, string> = {
  narrative_visual: 'ring-orange-400/30',
  interactive_ui: 'ring-emerald-400/30',
  spatial: 'ring-violet-400/30',
  character: 'ring-rose-400/30',
  graphic_composition: 'ring-cyan-400/30',
  dynamic_rhythm: 'ring-amber-400/30',
}

/** 家族阴影/发光颜色 */
export const FAMILY_GLOW: Record<string, string> = {
  narrative_visual: 'shadow-orange-500/20',
  interactive_ui: 'shadow-emerald-500/20',
  spatial: 'shadow-violet-500/20',
  character: 'shadow-rose-500/20',
  graphic_composition: 'shadow-cyan-500/20',
  dynamic_rhythm: 'shadow-amber-500/20',
}

/** 进化事件类型配置 */
export const EVENT_TYPE_CONFIG: Record<string, {
  label: string
  color: string
  bg: string
  border: string
}> = {
  reflection: {
    label: '反思',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  rule_created: {
    label: '规则创建',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  rule_modified: {
    label: '规则修改',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
  },
  rule_deprecated: {
    label: '规则废弃',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
  rule_promoted: {
    label: '规则晋升',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  transfer_attempt: {
    label: '迁移尝试',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
  },
  transfer_success: {
    label: '迁移成功',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  transfer_failed: {
    label: '迁移失败',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
}

/** 规则类型配置 */
export const RULE_TYPE_CONFIG: Record<string, {
  label: string
  symbol: string
  color: string
  bg: string
  border: string
}> = {
  positive: { label: '正面', symbol: '+', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  negative: { label: '负面', symbol: '-', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  conditional: { label: '条件', symbol: '?', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
}

/** 规则来源类型标签 */
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  seed: '种子规则',
  evolved: '进化规则',
  human: '人工规则',
  transferred: '迁移规则',
}

/** 规则来源类型颜色 */
export const SOURCE_TYPE_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  seed: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  evolved: { color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  human: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  transferred: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
}

/** 规则状态配置 */
export const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bg: string
  border: string
}> = {
  active: { label: '活跃', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  candidate: { label: '候选', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  deprecated: { label: '已废弃', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
}
