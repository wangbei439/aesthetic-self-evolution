// ---------------------------------------------------------------------------
// Default Crawl Sources — predefined source configurations for seeding
// ---------------------------------------------------------------------------

export const DEFAULT_CRAWL_SOURCES = [
  {
    name: '叙事视觉·电影摄影',
    type: 'search',
    familyKey: 'narrative_visual',
    query: 'cinematic photography aesthetic film still',
    maxItems: 10,
  },
  {
    name: '交互界面·UI设计',
    type: 'search',
    familyKey: 'interactive_ui',
    query: 'best UI web interface design inspiration',
    maxItems: 10,
  },
  {
    name: '空间营造·建筑摄影',
    type: 'search',
    familyKey: 'spatial',
    query: 'architectural interior photography aesthetic',
    maxItems: 10,
  },
  {
    name: '人物造型·概念设计',
    type: 'search',
    familyKey: 'character',
    query: 'character concept art design illustration',
    maxItems: 10,
  },
  {
    name: '平面构成·海报设计',
    type: 'search',
    familyKey: 'graphic_composition',
    query: 'graphic poster layout design typography',
    maxItems: 10,
  },
  {
    name: '动态韵律·动效设计',
    type: 'search',
    familyKey: 'dynamic_rhythm',
    query: 'motion graphics animation design aesthetic',
    maxItems: 10,
  },
  {
    name: '全领域·综合审美',
    type: 'search',
    familyKey: null as string | null, // all families
    query: 'aesthetic design art visual best works',
    maxItems: 15,
  },
];
