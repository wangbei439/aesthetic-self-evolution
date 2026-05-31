// ---------------------------------------------------------------------------
// Web Discovery Engine — search the web and extract image URLs
// ---------------------------------------------------------------------------
// Uses z-ai-web-dev-sdk for web search and page reading.
// All code using z-ai-web-dev-sdk is backend-only.
// ---------------------------------------------------------------------------

import ZAI from 'z-ai-web-dev-sdk';

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
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
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
  // Skip known unwanted patterns
  if (SKIP_PATTERNS.some((p) => lower.includes(p))) return true;
  // Skip SVGs and GIFs (usually icons or animations, not suitable for aesthetic eval)
  if (SKIP_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  // Skip very small dimension hints in URL (e.g., 50x50, 32x32)
  if (/\d{1,2}x\d{1,2}/.test(lower) && !/\d{3,}x\d{3,}/.test(lower)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Rate-limiting helper
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Search the web for aesthetic content
// ---------------------------------------------------------------------------

export async function searchWeb(
  query: string,
  num: number = 10
): Promise<SearchResult[]> {
  try {
    const zai = await getZAI();
    const result = await zai.functions.invoke('web_search', { query, num });

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
    console.error('[discover] searchWeb error:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Extract image URLs from HTML content (comprehensive patterns)
// ---------------------------------------------------------------------------

function extractImagesFromHTML(html: string): string[] {
  const images: string[] = [];

  // 1. Standard <img src="...">
  const srcRegex = /src=["'](https?:\/\/[^"']+\.(jpg|jpeg|png|webp))["']/gi;
  let match: RegExpExecArray | null;
  while ((match = srcRegex.exec(html)) !== null) {
    if (!isUnwantedImage(match[1])) images.push(match[1]);
  }

  // 2. data-src, data-lazy-src, data-original (lazy loading)
  const lazyRegex = /data-(?:src|lazy-src|original|image)=["'](https?:\/\/[^"']+\.(jpg|jpeg|png|webp))["']/gi;
  while ((match = lazyRegex.exec(html)) !== null) {
    if (!isUnwantedImage(match[1]) && !images.includes(match[1])) images.push(match[1]);
  }

  // 3. srcset (pick the largest image URL)
  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcset = match[1];
    // Parse srcset: "url1 1x, url2 2x" or "url1 100w, url2 500w"
    const candidates = srcset.split(',').map((s: string) => s.trim().split(/\s+/)[0]);
    // Pick the last (usually largest) candidate
    const bestCandidate = candidates[candidates.length - 1];
    if (bestCandidate && /\.(jpg|jpeg|png|webp)$/i.test(bestCandidate) && !isUnwantedImage(bestCandidate)) {
      if (!images.includes(bestCandidate)) images.push(bestCandidate);
    }
  }

  // 4. og:image meta tag
  const ogImageRegex = /property=["']og:image["']\s+content=["'](https?:\/\/[^"']+)["']/gi;
  while ((match = ogImageRegex.exec(html)) !== null) {
    if (!isUnwantedImage(match[1]) && !images.includes(match[1])) images.push(match[1]);
  }
  // Also: content before property
  const ogImageRegex2 = /content=["'](https?:\/\/[^"']+)["']\s+property=["']og:image["']/gi;
  while ((match = ogImageRegex2.exec(html)) !== null) {
    if (!isUnwantedImage(match[1]) && !images.includes(match[1])) images.push(match[1]);
  }

  // 5. <a href="...jpg"> (links to full-size images)
  const linkImageRegex = /href=["'](https?:\/\/[^"']+\.(jpg|jpeg|png|webp))["']/gi;
  while ((match = linkImageRegex.exec(html)) !== null) {
    if (!isUnwantedImage(match[1]) && !images.includes(match[1])) images.push(match[1]);
  }

  // 6. JSON-LD image URLs (common in gallery sites)
  const jsonLdRegex = /"image"\s*:\s*"(https?:\/\/[^"]+\.(jpg|jpeg|png|webp))"/gi;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    if (!isUnwantedImage(match[1]) && !images.includes(match[1])) images.push(match[1]);
  }

  // 7. Unsplash raw image URLs (common pattern: images.unsplash.com/photo-...)
  const unsplashRegex = /(https?:\/\/images\.unsplash\.com\/photo-[^"'\s]+\.(jpg|jpeg|png|webp)[^"'\s]*)/gi;
  while ((match = unsplashRegex.exec(html)) !== null) {
    if (!images.includes(match[1])) images.push(match[1]);
  }

  // 8. General CDN image URLs with typical patterns
  const cdnRegex = /(https?:\/\/(?:cdn|img|images|media|static)\.[^"'\s]+\/[^"'\s]+\.(jpg|jpeg|png|webp))/gi;
  while ((match = cdnRegex.exec(html)) !== null) {
    if (!isUnwantedImage(match[1]) && !images.includes(match[1])) images.push(match[1]);
  }

  return [...new Set(images)];
}

// ---------------------------------------------------------------------------
// Read a web page and extract image URLs (with timeout)
// ---------------------------------------------------------------------------

export async function readPageAndExtractImages(
  url: string
): Promise<{ title: string; images: string[]; description: string }> {
  try {
    const zai = await getZAI();

    // Add timeout protection (15 seconds)
    const timeoutPromise = new Promise<{ title: string; images: string[]; description: string }>(
      (resolve) => setTimeout(() => resolve({ title: '', images: [], description: '' }), 15000)
    );

    const readPromise = zai.functions.invoke('page_reader', { url });

    const result = await Promise.race([readPromise, timeoutPromise]);

    if (!result) {
      return { title: '', images: [], description: '' };
    }

    // page_reader returns { code, data: { title, html, ... } } or { title, html }
    const page = result as any;
    const data = page.data || page;
    const html: string = data.html || data.content || '';
    const title: string = data.title || page.title || '';
    const description: string = data.description || data.snippet || page.snippet || '';

    // Extract images using comprehensive patterns
    const images = extractImagesFromHTML(html);

    return { title, images, description };
  } catch (error) {
    console.error('[discover] readPageAndExtractImages error for', url, error);
    return { title: '', images: [], description: '' };
  }
}

// ---------------------------------------------------------------------------
// Extract image URLs directly from search result snippets and URLs
// Some search results contain image URLs in their snippets or are image pages
// ---------------------------------------------------------------------------

function extractDirectImageUrls(results: SearchResult[]): string[] {
  const urls: string[] = [];

  for (const result of results) {
    // Check if the URL itself points to an image hosting service
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
        // These are image pages - we'll try to read them
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
    // ---- Strategy 1: Direct image URL search ----
    // Search for images directly using the family-specific queries
    for (const q of queries) {
      if (items.length >= maxItems) break;

      console.log(`[discover] Strategy 1: Web search for "${q}"`);
      const searchResults = await searchWeb(q, 10);

      // Identify image-rich pages from search results
      const imagePageUrls = extractDirectImageUrls(searchResults);

      // Read only top image-rich pages (max 3 per query for speed)
      const pagesToRead = imagePageUrls.slice(0, 3);

      for (const pageUrl of pagesToRead) {
        if (items.length >= maxItems) break;

        await delay(500);
        console.log(`[discover] Reading page: ${pageUrl}`);
        const pageData = await readPageAndExtractImages(pageUrl);

        // Only take the top 3 images per page to diversify sources
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

      // If we still need more, try reading non-image pages
      if (items.length < maxItems) {
        const otherPages = searchResults
          .filter(r => !imagePageUrls.includes(r.url))
          .slice(0, 2);

        for (const result of otherPages) {
          if (items.length >= maxItems) break;

          await delay(500);
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

    // ---- Strategy 2: Unsplash-specific search ----
    // If we still don't have enough images, try Unsplash directly
    if (items.length < maxItems) {
      const unsplashQuery = query?.trim() || `${familyKey.replace(/_/g, ' ')} aesthetic`;
      console.log(`[discover] Strategy 2: Unsplash search for "${unsplashQuery}"`);

      const unsplashResults = await searchWeb(
        `site:unsplash.com ${unsplashQuery}`,
        5
      );

      for (const result of unsplashResults) {
        if (items.length >= maxItems) break;

        // Extract photo ID from Unsplash URL
        const unsplashMatch = result.url.match(/unsplash\.com\/photos\/([a-zA-Z0-9_-]+)/);
        if (unsplashMatch) {
          // Construct a direct image URL using Unsplash's CDN
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
        } else {
          // Try reading the Unsplash page
          await delay(500);
          const pageData = await readPageAndExtractImages(result.url);
          // Unsplash pages have og:image tags
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

    // ---- Strategy 3: Behance/Dribbble search ----
    if (items.length < maxItems) {
      const designQuery = query?.trim() || `${familyKey.replace(/_/g, ' ')} design`;
      console.log(`[discover] Strategy 3: Design platforms search for "${designQuery}"`);

      const designResults = await searchWeb(
        `site:behance.net OR site:dribbble.com ${designQuery}`,
        5
      );

      for (const result of designResults) {
        if (items.length >= maxItems) break;

        await delay(500);
        const pageData = await readPageAndExtractImages(result.url);
        const topImages = pageData.images.slice(0, 3);

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

    console.log(`[discover] Found ${items.length} images for family "${familyKey}"`);
  } catch (error) {
    console.error(
      `[discover] discoverImagesForFamily error for ${familyKey}:`,
      error
    );
  }

  return items;
}
