'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Sparkles, Eye, Layers, Scale, Dna, Brain, TrendingUp, GitBranch, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-react'

// ---------------------------------------------------------------------------
// Nav item definition
// ---------------------------------------------------------------------------

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { label: '审美家族', href: '#families', icon: Sparkles },
  { label: '评估器', href: '#evaluator', icon: Eye },
  { label: '评分趋势', href: '#score-trend', icon: TrendingUp },
  { label: '进化', href: '#evolution', icon: Layers },
  { label: '谱系', href: '#lineage', icon: GitBranch },
  { label: '法则库', href: '#rules', icon: Scale },
  { label: '自动进化', href: '#auto-evolve', icon: Zap },
  { label: '架构', href: '#architecture', icon: Dna },
]

// ---------------------------------------------------------------------------
// IntersectionObserver hook for active section tracking
// ---------------------------------------------------------------------------

function useActiveSection(ids: string[]): string {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    // We track which sections are currently intersecting and pick the topmost one
    const visibleSections = new Map<string, number>()

    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (!el) return

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              visibleSections.set(id, entry.boundingClientRect.top)
            } else {
              visibleSections.delete(id)
            }
          })

          // Pick the section closest to the top of the viewport (smallest positive top)
          let best: string | null = null
          let bestTop = Infinity
          visibleSections.forEach((top, sectionId) => {
            if (top < bestTop) {
              bestTop = top
              best = sectionId
            }
          })
          if (best) {
            setActiveId(best)
          }
        },
        {
          // Trigger when the section enters the top 40% of the viewport
          rootMargin: '-10% 0px -60% 0px',
          threshold: 0,
        }
      )

      observer.observe(el)
      observers.push(observer)
    })

    return () => {
      observers.forEach((o) => o.disconnect())
    }
  }, [ids])

  return activeId
}

// ---------------------------------------------------------------------------
// Scroll visibility hook — nav appears after hero
// ---------------------------------------------------------------------------

function useNavVisible(): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Show nav after scrolling past ~80% of the first viewport
      setVisible(window.scrollY > window.innerHeight * 0.7)
    }

    // Check initial position
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return visible
}

// ---------------------------------------------------------------------------
// StickyNav component
// ---------------------------------------------------------------------------

export function StickyNav() {
  const navVisible = useNavVisible()
  const activeSection = useActiveSection(NAV_ITEMS.map((n) => n.href.replace('#', '')))
  const [mobileOpen, setMobileOpen] = useState(false)
  const isScrolling = useRef(false)

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const handleNavClick = useCallback((href: string) => {
    setMobileOpen(false)
    isScrolling.current = true

    const el = document.querySelector(href)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    // Reset scrolling flag after animation completes
    setTimeout(() => {
      isScrolling.current = false
    }, 1000)
  }, [])

  return (
    <>
      {/* Sentinel / placeholder to prevent content jump */}
      {navVisible && <div className="h-16" />}

      <AnimatePresence>
        {navVisible && (
          <motion.nav
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800/50"
          >
            <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
              {/* Brand / Logo */}
              <motion.button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-2 group"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="p-1.5 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                  <Brain className="w-5 h-5 text-amber-400" />
                </div>
                <span className="text-sm font-semibold text-slate-200 hidden sm:inline">
                  审美自进化
                </span>
              </motion.button>

              {/* Desktop nav items */}
              <div className="hidden md:flex items-center gap-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = activeSection === item.href.replace('#', '')
                  const Icon = item.icon

                  return (
                    <motion.button
                      key={item.href}
                      onClick={() => handleNavClick(item.href)}
                      className={`
                        relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200
                        ${
                          isActive
                            ? 'text-amber-400'
                            : 'text-slate-400 hover:text-slate-200'
                        }
                      `}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>

                      {/* Active indicator pill */}
                      {isActive && (
                        <motion.div
                          layoutId="nav-active-pill"
                          className="absolute inset-0 rounded-lg bg-amber-500/10 border border-amber-500/20"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}

                      {/* Active bottom dot */}
                      {isActive && (
                        <motion.div
                          layoutId="nav-active-dot"
                          className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                    </motion.button>
                  )
                })}
              </div>

              {/* Mobile hamburger */}
              <div className="flex md:hidden items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  aria-label={mobileOpen ? '关闭菜单' : '打开菜单'}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {mobileOpen ? (
                      <motion.div
                        key="close"
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <X className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="menu"
                        initial={{ rotate: 90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: -90, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Menu className="w-5 h-5" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && navVisible && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />

            {/* Menu panel */}
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-16 left-3 right-3 z-50 md:hidden bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
            >
              <div className="p-3 space-y-1">
                {NAV_ITEMS.map((item, idx) => {
                  const isActive = activeSection === item.href.replace('#', '')
                  const Icon = item.icon

                  return (
                    <motion.button
                      key={item.href}
                      onClick={() => handleNavClick(item.href)}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.2 }}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all duration-200
                        ${
                          isActive
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }
                      `}
                    >
                      <div
                        className={`p-1.5 rounded-lg ${
                          isActive ? 'bg-amber-500/20' : 'bg-slate-800/60'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span>{item.label}</span>
                      {isActive && (
                        <div className="ml-auto w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      )}
                    </motion.button>
                  )
                })}
              </div>

              {/* Bottom branding */}
              <div className="px-4 py-3 border-t border-slate-800/50 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400/60" />
                <span className="text-xs text-slate-500">Aesthetic Self-Evolution</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
