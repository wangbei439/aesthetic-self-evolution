// ---------------------------------------------------------------------------
// Crawler Module — barrel exports
// Re-exports from sub-modules for convenient importing:
//   import { discoverImagesForFamily, runPipeline, getPipelineStatus, DEFAULT_CRAWL_SOURCES } from '@/lib/crawler'
// ---------------------------------------------------------------------------

export { discoverImagesForFamily, searchWeb, readPageAndExtractImages } from './discover';
export type { SearchResult, DiscoveredItem } from './discover';

export { runPipeline, getPipelineStatus } from './pipeline';
export type { PipelineStatus, PipelineResult } from './pipeline';

export { evaluateImageInternal } from './evaluate-internal';
export type { InternalEvalResult } from './evaluate-internal';

export { evolveFamilyInternal } from './evolve-internal';
export type { InternalEvolveResult } from './evolve-internal';

export { DEFAULT_CRAWL_SOURCES } from './default-sources';
