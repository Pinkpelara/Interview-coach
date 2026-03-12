import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

const MODEL = process.env.AI_MODEL || 'google/gemini-2.0-flash-001'

export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2000,
  })

  return response.choices[0]?.message?.content || ''
}

export async function chatCompletionJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<T> {
  const response = await chatCompletion(
    systemPrompt + '\n\nYou MUST respond with valid JSON only. No markdown, no code fences, no explanation.',
    userPrompt,
    options
  )

  // Strip markdown code fences if present
  const cleaned = response.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim()
  return JSON.parse(cleaned)
}

export function isAIConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY
}
