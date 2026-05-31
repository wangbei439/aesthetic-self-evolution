'use client'

import { useState, useRef, useCallback } from 'react'
import { HeroSection } from '@/components/hero-section'
import { FamiliesSection } from '@/components/families-section'
import { EvaluatorSection } from '@/components/evaluator-section'
import { EvolutionDashboard } from '@/components/evolution-dashboard'
import { ArchitectureSection } from '@/components/architecture-section'
import { Footer } from '@/components/footer'

export default function Home() {
  const [preselectedFamily, setPreselectedFamily] = useState<string | null>(null)
  const evaluatorRef = useRef<HTMLDivElement>(null)

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
      <HeroSection onScrollToEvaluator={scrollToEvaluator} />
      <FamiliesSection onSelectFamily={handleSelectFamily} />
      <div ref={evaluatorRef}>
        <EvaluatorSection preselectedFamily={preselectedFamily} />
      </div>
      <EvolutionDashboard />
      <ArchitectureSection />
      <Footer />
    </div>
  )
}
