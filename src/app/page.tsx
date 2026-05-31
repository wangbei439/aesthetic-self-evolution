'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { HeroSection } from '@/components/hero-section'
import { StickyNav } from '@/components/sticky-nav'
import { FamiliesSection } from '@/components/families-section'
import { EvaluatorSection } from '@/components/evaluator-section'
import { EvolutionDashboard } from '@/components/evolution-dashboard'
import { EvolutionLineage } from '@/components/evolution-lineage'
import { RulesPanel } from '@/components/rules-panel'
import { AutoEvolutionPanel } from '@/components/auto-evolution-panel'
import { ScoreTrendChart } from '@/components/score-trend-chart'
import { ArchitectureSection } from '@/components/architecture-section'
import { Footer } from '@/components/footer'

export default function Home() {
  const [preselectedFamily, setPreselectedFamily] = useState<string | null>(null)
  const evaluatorRef = useRef<HTMLDivElement>(null)
  const seededRef = useRef(false)

  useEffect(() => {
    // Only seed once per session
    if (!seededRef.current) {
      seededRef.current = true
      fetch('/api/seed').catch(() => {})
    }
  }, [])

  const scrollToEvaluator = useCallback(() => {
    evaluatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleSelectFamily = useCallback((familyKey: string) => {
    setPreselectedFamily(familyKey)
    // Small delay to let state update before scrolling
    setTimeout(() => {
      evaluatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-950 via-neutral-900 to-slate-950 text-slate-50">
      <StickyNav />
      <HeroSection onScrollToEvaluator={scrollToEvaluator} />
      <FamiliesSection onSelectFamily={handleSelectFamily} />
      <div ref={evaluatorRef}>
        <EvaluatorSection preselectedFamily={preselectedFamily} />
      </div>
      <ScoreTrendChart />
      <EvolutionDashboard />
      <section className="relative py-24 px-4" id="lineage">
        <div className="max-w-6xl mx-auto">
          <EvolutionLineage />
        </div>
      </section>
      <RulesPanel />
      <section className="relative py-24 px-4" id="auto-evolve">
        <div className="max-w-6xl mx-auto">
          <AutoEvolutionPanel />
        </div>
      </section>
      <ArchitectureSection />
      <Footer />
    </div>
  )
}
