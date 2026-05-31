# Frontend Development - Aesthetic Self-Evolution System

## Task ID: frontend-build
## Agent: frontend-developer

## Summary
Built the complete frontend application for the Aesthetic Self-Evolution (审美自进化) system. The app is a single-page scrollable application with 5 major sections, all built with dark mode, amber/warm accents, and framer-motion animations.

## Files Created/Modified

### New Files
1. **`src/components/hero-section.tsx`** - Hero section with animated gradient background, floating orbs, title "审美自进化", subtitle, and CTA button to scroll to evaluator
2. **`src/components/families-section.tsx`** - 6 aesthetic family cards in responsive grid (2x3 desktop, 1 col mobile) with icons, colors, descriptions, dimension badges, and click-to-select functionality. Fetches from `/api/families` with fallback data.
3. **`src/components/evaluator-section.tsx`** - Image upload (drag & drop + click), family selector dropdown, evaluate button, loading animation, and comprehensive results display (overall score, dimension bars, strengths/weaknesses/suggestions, full assessment markdown rendering). Calls `/api/evaluate`.
4. **`src/components/evolution-dashboard.tsx`** - Stats cards, per-family evolution stats, evolution trigger (with family selector), timeline events, evaluation history table. Calls `/api/evolution` and `/api/evaluations`.
5. **`src/components/architecture-section.tsx`** - Three-layer architecture visualization (Universal/Family/Theme), evolution loop diagram (Perceive→Judge→Reflect→Evolve→Memory), and theory reference cards (Kant, Chatterjee, Leder).
6. **`src/components/footer.tsx`** - Sticky footer with project info.

### Modified Files
7. **`src/app/page.tsx`** - Main page composing all sections with scroll-to-evaluator functionality
8. **`src/app/layout.tsx`** - Added ThemeProvider (default dark), Sonner toaster, updated metadata to Chinese
9. **`src/app/globals.css`** - Added custom scrollbar styling, smooth scroll, prose overrides

## Key Design Decisions
- Dark mode by default with `className="dark"` on `<html>`
- Amber/warm accent color palette (not blue/indigo)
- Family keys match the actual backend API: `narrative_visual`, `interactive_ui`, `spatial`, `character`, `graphic_composition`, `dynamic_rhythm`
- Family colors: orange, emerald, violet, rose, cyan, amber respectively
- Evaluation result parsing adapted to actual API response structure (`evaluation.dimensionScores`, `evaluation.assessment`, etc.)
- Evolution POST requires `familyKey` in JSON body
- All components are `'use client'` for interactivity
- Framer Motion animations for scroll reveal and hover effects
- Skeleton loading states for all data-fetching sections
- Toast notifications (sonner) for success/error feedback

## Technical Notes
- All shadcn/ui components used from existing `src/components/ui/`
- `react-markdown` used for rendering assessment text
- `sonner` for toast notifications
- `framer-motion` for animations
- Responsive: mobile-first with `sm:`, `md:`, `lg:` breakpoints
- Custom scrollbar styling via `.custom-scrollbar` class
