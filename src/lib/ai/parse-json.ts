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
    // Try to find the first { ... } block
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]) as T;
      } catch {
        // give up
      }
    }
    return null;
  }
}
