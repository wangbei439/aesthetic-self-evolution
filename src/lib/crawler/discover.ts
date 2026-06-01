// ---------------------------------------------------------------------------
// Web Discovery Engine — search the web and extract image URLs
// ---------------------------------------------------------------------------
// Uses z-ai-web-dev-sdk for web search and page reading.
// All code using z-ai-web-dev-sdk is backend-only.
// Includes global rate limiting and 429 cooldown to prevent rate limit errors.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  rank: number;
  date: string;
  favicon: string;
}

export interface DiscoveredItem {
  imageUrl: string;
  title: string;
  sourceUrl: string;
  description: string;
  familyKey: string;
}

// ---------------------------------------------------------------------------
// ZAI singleton for crawling
// ---------------------------------------------------------------------------

let zaiInstance: any = null;

async function getZAI() {
  if (!zaiInstance) {
    const { default: ZAI } = await import('z-ai-web-dev-sdk');
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ---------------------------------------------------------------------------
// Global Rate Limiting & 429 Cooldown
// ---------------------------------------------------------------------------
// The z-ai-web-dev-sdk has very strict rate limits. We implement:
// 1. Minimum interval between consecutive API calls (5 seconds)
// 2. Global 429 cooldown: after receiving a 429, wait 60s before any new call
// 3. Exponential backoff on retries (30s → 90s → 180s)
// ---------------------------------------------------------------------------

// Minimum interval between consecutive API calls
const MIN_CALL_INTERVAL_MS = 5000; // 5 seconds

// After a 429, how long to wait before trying ANY API call again
const COOLDOWN_AFTER_429_MS = 60000; // 60 seconds

// Global state
let _lastCallTime = 0;
let _last429Time = 0;
let _consecutive429s = 0; // Track consecutive 429s to increase cooldown

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait until enough time has elapsed since the last API call.
 * Also respects 429 cooldown periods.
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();

  // First, respect the 429 cooldown
  const timeSince429 = now - _last429Time;
  if (_last429Time > 0 && timeSince429 < COOLDOWN_AFTER_429_MS) {
    const cooldownRemaining = COOLDOWN_AFTER_429_MS - timeSince429;
    // Scale cooldown with consecutive 429s (max 5 minutes)
    const scaledCooldown = Math.min(
      cooldownRemaining * (1 + _consecutive429s * 0.5),
      300000 // max 5 minutes
    );
    console.log(
      `[discover] 429 cooldown: waiting ${Math.round(scaledCooldown / 1000)}s before next API call (consecutive 429s: ${_consecutive429s})`
    );
    await delay(scaledCooldown);
  }

  // Then, respect the minimum interval
  const timeSinceLastCall = Date.now() - _lastCallTime;
  if (timeSinceLastCall < MIN_CALL_INTERVAL_MS) {
    const waitMs = MIN_CALL_INTERVAL_MS - timeSinceLastCall;
    await delay(waitMs);
  }

  _lastCallTime = Date.now();
}

/**
 * Retry a function with exponential backoff for 429 errors,
 * with aggressive cooldown periods.
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 2, // Reduced from 3 to fail faster
  baseDelayMs = 30000 // Start with 30 seconds instead of 5
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await waitForRateLimit();
      return await fn();
    } catch (error: unknown) {
      const is429 =
        error instanceof Error &&
        (error.message.includes('429') || error.message.includes('Too many requests'));

      if (!is429 || attempt === maxRetries) throw error;

      // Track 429 for global cooldown
      _last429Time = Date.now();
      _consecutive429s++;

      const waitMs = baseDelayMs * Math.pow(2, attempt); // 30s → 60s → 120s
      console.warn(
        `[discover] 429 rate limited, retrying in ${waitMs / 1000}s (attempt ${attempt + 1}/${maxRetries}, consecutive 429s: ${_consecutive429s})`
      );
      _lastCallTime = Date.now();
      await delay(waitMs);
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Reset the 429 counter after a successful call.
 */
function reset429Counter(): void {
  _consecutive429s = 0;
}

// ---------------------------------------------------------------------------
// Predefined family search queries — optimized for finding image-rich pages
// ---------------------------------------------------------------------------

const FAMILY_SEARCH_QUERIES: Record<string, string[]> = {
  narrative_visual: [
    'cinematic photography aesthetic site:unsplash.com OR site:flickr.com',
    'film still composition photography',
    'visual storytelling photography portfolio',
  ],
  interactive_ui: [
    'best UI design inspiration 2024 site:dribbble.com OR site:behance.net',
    'web interface design dashboard',
    'UI design showcase gallery',
  ],
  spatial: [
    'architectural interior photography site:unsplash.com OR site:flickr.com',
    '3D environment design artstation',
    'spatial design aesthetic gallery',
  ],
  character: [
    'character design concept art site:artstation.com OR site:behance.net',
    'digital portrait illustration gallery',
    'character concept sheet portfolio',
  ],
  graphic_composition: [
    'graphic design poster layout site:behance.net OR site:dribbble.com',
    'typography poster design gallery',
    'print design composition showcase',
  ],
  dynamic_rhythm: [
    'motion graphics design site:behance.net OR site:dribbble.com',
    'animation frame aesthetic gallery',
    'dynamic visual design portfolio',
  ],
};

// Image-rich domains that are known to host aesthetic content
const IMAGE_RICH_DOMAINS = [
  'unsplash.com',
  'flickr.com',
  'behance.net',
  'dribbble.com',
  'artstation.com',
  'pinterest.com',
  'deviantart.com',
  '500px.com',
  'pexels.com',
  'pixabay.com',
];

// ---------------------------------------------------------------------------
// Small-image URL filter — skip icons, logos, tracking pixels, etc.
// ---------------------------------------------------------------------------

const SKIP_PATTERNS = [
  'logo',
  'icon',
  'avatar',
  'favicon',
  'button',
  'banner',
  'ad',
  'pixel',
  'tracking',
  'spacer',
  'blank',
  'sprite',
  'placeholder',
  'loading',
  'spinner',
  'thumb',
  'emoji',
  'gravatar',
  'captcha',
];

const SKIP_EXTENSIONS = ['.svg', '.gif'];

function isUnwantedImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (SKIP_PATTERNS.some((p) => lower.includes(p))) return true;
  if (SKIP_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  if (/\d{1,2}x\d{1,2}/.test(lower) && !/\d{3,}x\d{3,}/.test(lower)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Search the web for aesthetic content (with rate limiting + retry)
// ---------------------------------------------------------------------------

export async function searchWeb(
  query: string,
  num: number = 10
): Promise<SearchResult[]> {
  try {
    const result = await retryWithBackoff(async () => {
      const zai = await getZAI();
      return await zai.functions.invoke('web_search', { query, num });
    });

    // Successful call — reset 429 counter
    reset429Counter();

    if (!result || !Array.isArray(result)) {
      console.warn('[discover] web_search returned non-array:', typeof result);
      return [];
    }

    return result.map(
      (item: any, index: number): SearchResult => ({
        url: item.url || '',
        name: item.name || '',
        snippet: item.snippet || '',
        host_name: item.host_name || '',
        rank: item.rank ?? index + 1,
        date: item.date || '',
        favicon: item.favicon || '',
      })
    );
  } catch (error) {
    console.error('[discover] searchWeb error (all retries exhausted):', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Extract image URLs from HTML content (comprehensive patterns)
// ---------------------------------------------------------------------------

function extractImagesFromHTML(html: string): string[] {
  const images: string[] = [];

  const srcRegex = /src=["'](https?:\/\/[^"']+\.(jpg|jpeg|png|webp))["']/gi;
  let match: RegExpExecArray | null;
  while ((match = srcRegex.exec(html)) !== null) {
    if (!isUnwantedImage(match[1])) images.push(match[1]);
  }

  const lazyRegex = /data-(?:src|lazy-src|original|image)=["'](https?:\/\/[^"']+\.(jpg|jpeg|png|webp))["']/gi;
  while ((match = lazyRegex.exec(html)) !== null) {
    if (!isUnwantedImage(match[1]) && !images.includes(match[1])) images.push(match[1]);
  }

  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcset = match[1];
    const candidates = srcset.split(',').map((s: string) => s.trim().split(/\s+/)[0]);
    const bestCandidate = candidates[candidates.length - 1];
    if (bestCandidate && /\.(jpg|jpeg|png|webp)$/i.test(bestCandidate) && !isUnwantedImage(bestCandidate)) {
      if (!images.includes(bestCandidate)) images.push(bestCandidate);
    }
  }

  const ogImageRegex = /property=["']og:image["']\s+content=["'](https?:\/\/[^"']+)["']/gi;
  while ((match = ogImageRegex.exec(html)) !== null) {
    if (!isUnwantedImage(match[1]) && !images.includes(match[1])) images.push(match[1]);
  }
  const ogImageRegex2 = /content=["'](https?:\/\/[^"']+)["']\s+property=["']og:image["']/gi;
  while ((match = ogImageRegex2.exec(html)) !== null) {
    if (!isUnwantedImage(match[1]) && !images.includes(match[1])) images.push(match[1]);
  }

  const linkImageRegex = /href=["'](https?:\/\/[^"']+\.(jpg|jpeg|png|webp))["']/gi;
  while ((match = linkImageRegex.exec(html)) !== null) {
    if (!isUnwantedImage(match[1]) && !images.includes(match[1])) images.push(match[1]);
  }

  const jsonLdRegex = /"image"\s*:\s*"(https?:\/\/[^"]+\.(jpg|jpeg|png|webp))"/gi;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    if (!isUnwantedImage(match[1]) && !images.includes(match[1])) images.push(match[1]);
  }

  const unsplashRegex = /(https?:\/\/images\.unsplash\.com\/photo-[^"'\s]+\.(jpg|jpeg|png|webp)[^"'\s]*)/gi;
  while ((match = unsplashRegex.exec(html)) !== null) {
    if (!images.includes(match[1])) images.push(match[1]);
  }

  const cdnRegex = /(https?:\/\/(?:cdn|img|images|media|static)\.[^"'\s]+\/[^"'\s]+\.(jpg|jpeg|png|webp))/gi;
  while ((match = cdnRegex.exec(html)) !== null) {
    if (!isUnwantedImage(match[1]) && !images.includes(match[1])) images.push(match[1]);
  }

  return [...new Set(images)];
}

// ---------------------------------------------------------------------------
// Read a web page and extract image URLs (with rate limiting + retry)
// ---------------------------------------------------------------------------

export async function readPageAndExtractImages(
  url: string
): Promise<{ title: string; images: string[]; description: string }> {
  try {
    const result = await retryWithBackoff(async () => {
      const zai = await getZAI();

      // Add timeout protection (15 seconds)
      const timeoutPromise = new Promise<{ title: string; images: string[]; description: string }>(
        (resolve) => setTimeout(() => resolve({ title: '', images: [], description: '' }), 15000)
      );

      const readPromise = zai.functions.invoke('page_reader', { url });

      return Promise.race([readPromise, timeoutPromise]);
    });

    // Successful call — reset 429 counter
    reset429Counter();

    if (!result) {
      return { title: '', images: [], description: '' };
    }

    const page = result as any;
    const data = page.data || page;
    const html: string = data.html || data.content || '';
    const title: string = data.title || page.title || '';
    const description: string = data.description || data.snippet || page.snippet || '';

    const images = extractImagesFromHTML(html);

    return { title, images, description };
  } catch (error) {
    console.error('[discover] readPageAndExtractImages error for', url, error);
    return { title: '', images: [], description: '' };
  }
}

// ---------------------------------------------------------------------------
// Extract image URLs directly from search result snippets and URLs
// ---------------------------------------------------------------------------

function extractDirectImageUrls(results: SearchResult[]): string[] {
  const urls: string[] = [];

  for (const result of results) {
    const imageHostPatterns = [
      /unsplash\.com\/photos\//,
      /flickr\.com\/photos\//,
      /behance\.net\/gallery\//,
      /dribbble\.com\/shots\//,
      /artstation\.com\/artwork\//,
      /500px\.com\/photo\//,
      /pexels\.com\/photo\//,
      /pixabay\.com\/(photos|illustrations|vectors)\//,
    ];

    for (const pattern of imageHostPatterns) {
      if (pattern.test(result.url)) {
        urls.push(result.url);
        break;
      }
    }
  }

  return urls;
}

// ---------------------------------------------------------------------------
// Discover images for a specific aesthetic family
// ---------------------------------------------------------------------------

export async function discoverImagesForFamily(
  familyKey: string,
  query?: string,
  maxItems: number = 10
): Promise<DiscoveredItem[]> {
  const items: DiscoveredItem[] = [];
  const seenUrls = new Set<string>();

  // Determine search queries
  const queries =
    query && query.trim()
      ? [query.trim()]
      : FAMILY_SEARCH_QUERIES[familyKey] || [
          `${familyKey} aesthetic design art`,
        ];

  try {
    // ---- Strategy 1: Primary web search ----
    const primaryQuery = queries[0];
    console.log(`[discover] Strategy 1: Web search for "${primaryQuery}"`);
    const searchResults = await searchWeb(primaryQuery, 10);

    // If search failed (likely 429), don't waste more API calls on other strategies
    if (searchResults.length === 0) {
      console.warn(`[discover] Strategy 1 returned 0 results, skipping remaining strategies to avoid 429`);
      console.log(`[discover] Found ${items.length} images for family "${familyKey}"`);
      return items;
    }

    // Identify image-rich pages from search results
    const imagePageUrls = extractDirectImageUrls(searchResults);

    // Read only top 2 image-rich pages
    const pagesToRead = imagePageUrls.slice(0, 2);

    for (const pageUrl of pagesToRead) {
      if (items.length >= maxItems) break;

      console.log(`[discover] Reading page: ${pageUrl}`);
      const pageData = await readPageAndExtractImages(pageUrl);

      // If page_reader returned 0 images after successful search, might be 429
      // Don't waste more calls
      if (pageData.images.length === 0 && searchResults.length > 0) {
        console.warn(`[discover] Page reader returned 0 images, may be rate-limited. Stopping discovery.`);
        break;
      }

      const topImages = pageData.images.slice(0, 3);

      for (const imageUrl of topImages) {
        if (items.length >= maxItems) break;
        if (seenUrls.has(imageUrl)) continue;

        seenUrls.add(imageUrl);
        items.push({
          imageUrl,
          title: pageData.title || searchResults.find(r => r.url === pageUrl)?.name || '',
          sourceUrl: pageUrl,
          description: pageData.description || searchResults.find(r => r.url === pageUrl)?.snippet || '',
          familyKey,
        });
      }
    }

    // If we still need more, try reading non-image pages (max 1)
    if (items.length < maxItems && searchResults.length > 0) {
      const otherPages = searchResults
        .filter(r => !imagePageUrls.includes(r.url))
        .slice(0, 1);

      for (const result of otherPages) {
        if (items.length >= maxItems) break;

        const pageData = await readPageAndExtractImages(result.url);
        const topImages = pageData.images.slice(0, 2);

        for (const imageUrl of topImages) {
          if (items.length >= maxItems) break;
          if (seenUrls.has(imageUrl)) continue;

          seenUrls.add(imageUrl);
          items.push({
            imageUrl,
            title: pageData.title || result.name,
            sourceUrl: result.url,
            description: pageData.description || result.snippet || '',
            familyKey,
          });
        }
      }
    }

    // ---- Strategy 2: Additional queries (only if Strategy 1 found few items) ----
    if (items.length < Math.ceil(maxItems / 2) && queries.length > 1) {
      const secondQuery = queries[1];
      console.log(`[discover] Strategy 2: Additional search for "${secondQuery}"`);

      await delay(5000); // 5s between strategies

      const moreResults = await searchWeb(secondQuery, 5);

      if (moreResults.length === 0) {
        console.warn(`[discover] Strategy 2 returned 0 results, stopping to avoid 429`);
      } else {
        const moreImageUrls = extractDirectImageUrls(moreResults);

        for (const pageUrl of moreImageUrls.slice(0, 1)) {
          if (items.length >= maxItems) break;

          const pageData = await readPageAndExtractImages(pageUrl);
          const topImages = pageData.images.slice(0, 2);

          for (const imageUrl of topImages) {
            if (items.length >= maxItems) break;
            if (seenUrls.has(imageUrl)) continue;

            seenUrls.add(imageUrl);
            items.push({
              imageUrl,
              title: pageData.title || moreResults.find(r => r.url === pageUrl)?.name || '',
              sourceUrl: pageUrl,
              description: pageData.description || moreResults.find(r => r.url === pageUrl)?.snippet || '',
              familyKey,
            });
          }
        }
      }
    }

    // ---- Strategy 3: Unsplash-specific search (only if still below half target) ----
    if (items.length < Math.ceil(maxItems / 2)) {
      const unsplashQuery = query?.trim() || `${familyKey.replace(/_/g, ' ')} aesthetic`;
      console.log(`[discover] Strategy 3: Unsplash search for "${unsplashQuery}"`);

      await delay(5000); // 5s between strategies

      const unsplashResults = await searchWeb(
        `site:unsplash.com ${unsplashQuery}`,
        5
      );

      if (unsplashResults.length === 0) {
        console.warn(`[discover] Strategy 3 returned 0 results, stopping to avoid 429`);
      } else {
        for (const result of unsplashResults) {
          if (items.length >= maxItems) break;

          const unsplashMatch = result.url.match(/unsplash\.com\/photos\/([a-zA-Z0-9_-]+)/);
          if (unsplashMatch) {
            const photoId = unsplashMatch[1];
            const imageUrl = `https://images.unsplash.com/photo-${photoId}?w=1200&q=80`;

            if (!seenUrls.has(imageUrl)) {
              seenUrls.add(imageUrl);
              items.push({
                imageUrl,
                title: result.name,
                sourceUrl: result.url,
                description: result.snippet || '',
                familyKey,
              });
            }
          } else if (items.length < maxItems) {
            // Try reading the Unsplash page (only 1)
            const pageData = await readPageAndExtractImages(result.url);
            const topImages = pageData.images.slice(0, 2);

            for (const imageUrl of topImages) {
              if (items.length >= maxItems) break;
              if (seenUrls.has(imageUrl)) continue;

              seenUrls.add(imageUrl);
              items.push({
                imageUrl,
                title: pageData.title || result.name,
                sourceUrl: result.url,
                description: pageData.description || result.snippet || '',
                familyKey,
              });
            }
          }
        }
      }
    }

    console.log(`[discover] Found ${items.length} images for family "${familyKey}"`);
  } catch (error) {
    console.error(
      `[discover] discoverImagesForFamily error for ${familyKey}:`,
      error
    );
  }

  return items;
}
