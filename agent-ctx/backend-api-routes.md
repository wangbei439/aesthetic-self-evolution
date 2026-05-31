# Task: Backend API Routes for Aesthetic Self-Evolution System

## Summary
Created 4 production-quality API route files for the Aesthetic Self-Evolution system in Next.js 16.

## Files Created

### 1. `/src/app/api/families/route.ts` - GET all aesthetic families
- Auto-seeds 6 aesthetic families on first request (or updates if changed)
- Returns families with parsed JSON criteria/domains, plus evaluation and rule counts
- 6 families: narrative_visual, interactive_ui, spatial, character, graphic_composition, dynamic_rhythm

### 2. `/src/app/api/evaluate/route.ts` - POST evaluate an image
- Accepts FormData with `image` (File) and optional `familyKey` (string)
- File validation: type (png/jpeg/webp/gif/bmp), size (max 10MB), form-data check
- Step 1: Auto-classifies image domain using VLM (qwen2.5-vl-72b-instruct) if familyKey not provided
- Step 2: Evaluates using family-specific criteria with active rules as context
- Step 3: Saves evaluation to database with proper generation tracking
- Step 4: Updates rule support/contradict counts based on evaluation scores
- Robust VLM JSON parsing (handles markdown code blocks, raw JSON, embedded JSON)
- Proper error handling at every step

### 3. `/src/app/api/evolution/route.ts` - GET stats + POST trigger evolution
- GET: Returns per-family evolution stats (evaluations, rules, generations, events, score distributions)
- POST: Triggers evolution cycle for a specific family:
  1. Reflection phase: VLM analyzes patterns in high/low-scoring evaluations
  2. Rule deprecation: Deprecates low-confidence rules
  3. Rule creation: Creates new positive/negative/conditional rules from patterns
  4. Cross-family knowledge transfer: Attempts to adapt high-confidence rules from other families
  5. All steps recorded as EvolutionEvent records

### 4. `/src/app/api/evaluations/route.ts` - GET paginated evaluation history
- Supports query params: familyId, familyKey, limit (1-100, default 20), offset
- Returns formatted evaluation records with parsed JSON fields and family info
- Pagination metadata (total, hasMore)

## Testing Results
- All 4 endpoints compile successfully
- `/api/families` returns 6 families with correct data
- `/api/evolution` returns global stats and per-family stats
- `/api/evaluations` returns paginated results
- `/api/evaluate` properly validates input and returns appropriate error codes (400, 422)
- Lint passes clean (0 errors, 0 warnings)

## Key Design Decisions
- VLM model: `qwen2.5-vl-72b-instruct` for vision, `qwen2.5-72b-instruct` for text-only
- Image stored as truncated reference (first 100 chars) to avoid bloating the DB
- Transferred rules start as "candidate" status with lower initial confidence (0.3)
- Rule confidence dynamically updated based on evaluation agreement/disagreement
- Robust JSON parsing from VLM responses with 3 fallback strategies
