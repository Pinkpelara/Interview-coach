import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import crypto from 'crypto'

export type TaskType =
  | 'resume_parsing'
  | 'jd_parsing'
  | 'question_generation'
  | 'answer_analysis'
  | 'live_conversation'
  | 'live_followup'
  | 'debrief_analysis'
  | 'observe_generation'
  | 'countdown_planning'

const CLAUDE_SONNET = 'anthropic/claude-3.5-sonnet'
const GPT_4O = 'openai/gpt-4o'
const MISTRAL_LARGE = 'mistralai/mistral-large'

const CLAUDE_FIRST: [string, string, string] = [CLAUDE_SONNET, GPT_4O, MISTRAL_LARGE]
const GPT_FIRST: [string, string, string] = [GPT_4O, CLAUDE_SONNET, MISTRAL_LARGE]

const MODEL_CHAINS: Record<TaskType, [string, string, string]> = {
  resume_parsing: CLAUDE_FIRST,
  jd_parsing: CLAUDE_FIRST,
  question_generation: CLAUDE_FIRST,
  answer_analysis: CLAUDE_FIRST,
  live_conversation: GPT_FIRST,
  live_followup: GPT_FIRST,
  debrief_analysis: CLAUDE_FIRST,
  observe_generation: CLAUDE_FIRST,
  countdown_planning: GPT_FIRST,
}

const LLM_TIMEOUT_MS = 20_000
const DEFAULT_MAX_TOKENS = 2000
const MAX_DAILY_TOKENS_PER_USER = 500_000
const MAX_CACHE_ENTRIES = 500
const CACHE_EVICT_COUNT = 100
const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000

const CACHE_TTL: Record<TaskType, number> = {
  resume_parsing: Infinity,
  jd_parsing: Infinity,
  question_generation: Infinity,
  observe_generation: Infinity,
  debrief_analysis: Infinity,
  answer_analysis: SEVEN_DAYS_MS,
  live_conversation: 0,
  live_followup: 0,
  countdown_planning: Infinity,
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set')
  }
  return new OpenAI({
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey,
  })
}

// --- In-memory cache ---

interface CacheEntry {
  response: string
  timestamp: number
}

const responseCache = new Map<string, CacheEntry>()

function makeCacheKey(model: string, messages: ChatCompletionMessageParam[], systemPrompt: string): string {
  const raw = `${model}|${systemPrompt}|${JSON.stringify(messages)}`
  return crypto.createHash('sha256').update(raw).digest('hex')
}

function getCached(taskType: TaskType, key: string): string | null {
  const ttl = CACHE_TTL[taskType]
  if (ttl === 0) return null

  const entry = responseCache.get(key)
  if (!entry) return null

  if (ttl !== Infinity && Date.now() - entry.timestamp > ttl) {
    responseCache.delete(key)
    return null
  }

  return entry.response
}

function setCache(taskType: TaskType, key: string, response: string): void {
  if (CACHE_TTL[taskType] === 0) return

  responseCache.set(key, { response, timestamp: Date.now() })

  if (responseCache.size > MAX_CACHE_ENTRIES) {
    const entries = Array.from(responseCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    for (let i = 0; i < CACHE_EVICT_COUNT; i++) {
      responseCache.delete(entries[i][0])
    }
  }
}

export function clearCache(): void {
  responseCache.clear()
}

// --- Per-user daily token tracking ---

const userTokenUsage = new Map<string, { tokens: number; resetAt: number }>()

function checkAndTrackTokens(userId: string | undefined, tokens: number): void {
  if (!userId) return
  const now = Date.now()
  let usage = userTokenUsage.get(userId)

  if (!usage || now > usage.resetAt) {
    usage = { tokens: 0, resetAt: now + 24 * 3600 * 1000 }
    userTokenUsage.set(userId, usage)
  }

  if (usage.tokens >= MAX_DAILY_TOKENS_PER_USER) {
    throw new Error('Daily token limit exceeded. Please try again tomorrow.')
  }

  usage.tokens += tokens
}

function assertTokenBudget(userId?: string): void {
  if (!userId) return
  const now = Date.now()
  const usage = userTokenUsage.get(userId)
  if (usage && now <= usage.resetAt && usage.tokens >= MAX_DAILY_TOKENS_PER_USER) {
    throw new Error('Daily token limit exceeded. Please try again tomorrow.')
  }
}

// --- Core gateway ---

export interface RunLLMOptions {
  temperature?: number
  maxTokens?: number
  userId?: string
  responseFormat?: 'json' | 'text'
}

export async function runLLM(
  taskType: TaskType,
  messages: ChatCompletionMessageParam[],
  systemPrompt: string,
  options?: RunLLMOptions
): Promise<string> {
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS
  assertTokenBudget(options?.userId)

  const chain = MODEL_CHAINS[taskType]
  const primaryModel = chain[0]

  const cacheKey = makeCacheKey(primaryModel, messages, systemPrompt)
  const cached = getCached(taskType, cacheKey)
  if (cached) return cached

  const client = getClient()
  const fullMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ]

  // Retry policy: attempt 1 = primary, 2 = primary retry, 3 = fallback1, 4 = fallback2, 5 = error
  const attempts: string[] = [chain[0], chain[0], chain[1], chain[2]]
  let lastError: Error | null = null

  for (const model of attempts) {
    try {
      const response = await Promise.race([
        client.chat.completions.create({
          model,
          messages: fullMessages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: maxTokens,
          ...(options?.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`LLM timeout after ${LLM_TIMEOUT_MS}ms`)), LLM_TIMEOUT_MS)
        ),
      ])

      const content = response.choices[0]?.message?.content || ''
      const tokensUsed = response.usage?.total_tokens ?? maxTokens
      checkAndTrackTokens(options?.userId, tokensUsed)
      setCache(taskType, cacheKey, content)

      return content
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  throw lastError ?? new Error('All models in chain failed')
}

// --- Convenience functions ---

export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number
    maxTokens?: number
    taskType?: TaskType
    userId?: string
  }
): Promise<string> {
  return runLLM(
    options?.taskType ?? 'live_conversation',
    [{ role: 'user', content: userPrompt }],
    systemPrompt,
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
  options?: {
    temperature?: number
    maxTokens?: number
    taskType?: TaskType
    userId?: string
  }
): Promise<T> {
  const response = await runLLM(
    options?.taskType ?? 'resume_parsing',
    [{ role: 'user', content: userPrompt }],
    systemPrompt + '\n\nYou MUST respond with valid JSON only. No markdown, no code fences, no explanation.',
    {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      userId: options?.userId,
      responseFormat: 'json',
    }
  )

  const cleaned = response.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim()
  return JSON.parse(cleaned)
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY)
}
