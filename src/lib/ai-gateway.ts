import OpenAI from 'openai'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// OpenRouter AI Gateway — Deterministic model routing, fallbacks, caching
// ---------------------------------------------------------------------------

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

// ---------------------------------------------------------------------------
// 1. Task-specific model chains (deterministic, no auto-router)
// ---------------------------------------------------------------------------

export type TaskType =
  | 'resume_parsing'
  | 'question_generation'
  | 'answer_analysis'
  | 'live_interview_response'
  | 'debrief_scoring'
  | 'debrief_coaching'

const MODEL_CHAINS: Record<TaskType, string[]> = {
  resume_parsing: [
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o',
    'google/gemini-2.0-flash-001',
  ],
  question_generation: [
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o',
    'google/gemini-2.0-flash-001',
  ],
  answer_analysis: [
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o',
    'google/gemini-2.0-flash-001',
  ],
  live_interview_response: [
    'openai/gpt-4o',
    'anthropic/claude-sonnet-4',
    'google/gemini-2.0-flash-001',
  ],
  debrief_scoring: [
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o',
    'google/gemini-2.0-flash-001',
  ],
  debrief_coaching: [
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o',
    'google/gemini-2.0-flash-001',
  ],
}

// Override: if AI_MODEL env is set, use it as primary for all tasks
function getModelChain(taskType: TaskType): string[] {
  const override = process.env.AI_MODEL
  if (override) {
    const chain = MODEL_CHAINS[taskType]
    return [override, ...chain.filter(m => m !== override)]
  }
  return MODEL_CHAINS[taskType]
}

// ---------------------------------------------------------------------------
// 2. In-memory cache (deterministic key: model + system + user prompt)
// ---------------------------------------------------------------------------

interface CacheEntry {
  response: string
  timestamp: number
}

const responseCache = new Map<string, CacheEntry>()

const CACHE_TTL: Record<TaskType, number> = {
  resume_parsing: Infinity,        // permanent
  question_generation: Infinity,   // permanent
  answer_analysis: 7 * 24 * 3600 * 1000, // 7 days
  live_interview_response: 0,      // never cache (real-time)
  debrief_scoring: 7 * 24 * 3600 * 1000,
  debrief_coaching: 0,             // never cache (unique)
}

function cacheKey(model: string, systemPrompt: string, userPrompt: string): string {
  return crypto.createHash('sha256')
    .update(`${model}|${systemPrompt}|${userPrompt}`)
    .digest('hex')
}

function getCached(taskType: TaskType, model: string, system: string, user: string): string | null {
  const ttl = CACHE_TTL[taskType]
  if (ttl === 0) return null

  const key = cacheKey(model, system, user)
  const entry = responseCache.get(key)
  if (!entry) return null

  if (ttl !== Infinity && Date.now() - entry.timestamp > ttl) {
    responseCache.delete(key)
    return null
  }

  return entry.response
}

function setCache(model: string, system: string, user: string, response: string): void {
  const key = cacheKey(model, system, user)
  responseCache.set(key, { response, timestamp: Date.now() })

  // Evict old entries if cache gets too large (max 500 entries)
  if (responseCache.size > 500) {
    const entries: [string, CacheEntry][] = []
    responseCache.forEach((v, k) => entries.push([k, v]))
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    entries.slice(0, 100).forEach(([k]) => responseCache.delete(k))
  }
}

// ---------------------------------------------------------------------------
// 3. Cost protection
// ---------------------------------------------------------------------------

const TOKEN_LIMITS = {
  max_tokens_per_call: 4000,
  max_context_tokens: 64000,
}

// Per-user daily token tracking (in-memory, resets on restart)
const userTokenUsage = new Map<string, { tokens: number; resetAt: number }>()
const MAX_DAILY_TOKENS_PER_USER = 500_000

function checkUserTokenLimit(userId?: string): boolean {
  if (!userId) return true
  const now = Date.now()
  const usage = userTokenUsage.get(userId)

  if (!usage || now > usage.resetAt) {
    userTokenUsage.set(userId, {
      tokens: 0,
      resetAt: now + 24 * 3600 * 1000,
    })
    return true
  }

  return usage.tokens < MAX_DAILY_TOKENS_PER_USER
}

function trackTokenUsage(userId: string | undefined, tokens: number): void {
  if (!userId) return
  const usage = userTokenUsage.get(userId)
  if (usage) {
    usage.tokens += tokens
  }
}

// ---------------------------------------------------------------------------
// 4. Core gateway function: run_llm
// ---------------------------------------------------------------------------

interface RunLLMOptions {
  temperature?: number
  maxTokens?: number
  userId?: string
}

export async function runLLM(
  taskType: TaskType,
  systemPrompt: string,
  userPrompt: string,
  options?: RunLLMOptions
): Promise<string> {
  const maxTokens = Math.min(
    options?.maxTokens ?? 2000,
    TOKEN_LIMITS.max_tokens_per_call
  )

  // Cost protection: check user daily limit
  if (!checkUserTokenLimit(options?.userId)) {
    throw new Error('Daily token limit exceeded. Please try again tomorrow.')
  }

  const modelChain = getModelChain(taskType)

  // Check cache first (using primary model for key)
  const cached = getCached(taskType, modelChain[0], systemPrompt, userPrompt)
  if (cached) return cached

  // Try each model in the chain with retries
  let lastError: Error | null = null

  for (const model of modelChain) {
    // Attempt 1: primary try
    // Attempt 2: retry same model
    for (let retry = 0; retry < 2; retry++) {
      try {
        const response = await Promise.race([
          client.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: options?.temperature ?? 0.7,
            max_tokens: maxTokens,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('LLM timeout')), 20000)
          ),
        ])

        const content = response.choices[0]?.message?.content || ''

        // Track token usage
        const tokensUsed = response.usage?.total_tokens ?? maxTokens
        trackTokenUsage(options?.userId, tokensUsed)

        // Cache the response
        setCache(model, systemPrompt, userPrompt, content)

        return content
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        // Don't retry on timeout, move to next model
        if (lastError.message === 'LLM timeout') break
      }
    }
  }

  throw lastError || new Error('All models in chain failed')
}

// ---------------------------------------------------------------------------
// 5. Convenience wrappers (drop-in replacements for old puter-ai functions)
// ---------------------------------------------------------------------------

export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number; taskType?: TaskType; userId?: string }
): Promise<string> {
  return runLLM(
    options?.taskType ?? 'live_interview_response',
    systemPrompt,
    userPrompt,
    {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      userId: options?.userId,
    }
  )
}

export async function chatCompletionJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number; taskType?: TaskType; userId?: string }
): Promise<T> {
  const response = await runLLM(
    options?.taskType ?? 'resume_parsing',
    systemPrompt + '\n\nYou MUST respond with valid JSON only. No markdown, no code fences, no explanation.',
    userPrompt,
    {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      userId: options?.userId,
    }
  )

  // Strip markdown code fences if present
  const cleaned = response.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim()
  return JSON.parse(cleaned)
}

export function isAIConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY
}
