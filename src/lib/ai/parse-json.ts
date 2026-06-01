// ---------------------------------------------------------------------------
// parseVLMJson — safely parse JSON from AI response text
// ---------------------------------------------------------------------------
// AI models often wrap JSON in markdown code blocks or add extra text.
// This helper tries multiple strategies to extract valid JSON.
// ---------------------------------------------------------------------------

export function parseVLMJson<T = unknown>(text: string): T | null {
  try {
    // Try direct parse first
    return JSON.parse(text) as T;
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim()) as T;
      } catch {
        // continue to next strategy
      }
    }
    // Try to find the first balanced { ... } block (non-greedy)
    // We use a balanced-brace approach instead of greedy .* to avoid
    // matching across multiple JSON objects in the same text
    let depth = 0;
    let start = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (text[i] === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          const candidate = text.slice(start, i + 1);
          try {
            return JSON.parse(candidate) as T;
          } catch {
            // This balanced block wasn't valid JSON, keep searching
            start = -1;
          }
        }
      }
    }
    return null;
  }
}
