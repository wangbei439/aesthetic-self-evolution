'use client'

import { Sparkles, Github } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800/50 bg-slate-950/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-slate-300">
              审美自进化
            </span>
            <span className="text-xs text-slate-500">
              Aesthetic Self-Evolution
            </span>
          </div>

          <p className="text-xs text-slate-500 text-center">
            Powered by VLM + Domain-Specific Aesthetic Intelligence
          </p>

          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-600">
              © 2024 Aesthetic Self-Evolution
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
