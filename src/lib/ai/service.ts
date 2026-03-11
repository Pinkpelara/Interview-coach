import { z, type ZodType } from 'zod'
import { aiConfig, type AIProviderConfig, isAIConfigured } from './config'
import { logger, metricSnapshot, recordMetric } from '@/lib/monitoring'
import { sendAlert } from '@/lib/alerts'

type ChatOptions = {
  temperature?: number
  maxTokens?: number
  requestId?: string
}

export class AIServiceError extends Error {
  constructor(
    message: string,
    public code:
      | 'NOT_CONFIGURED'
      | 'UPSTREAM_TIMEOUT'
      | 'UPSTREAM_ERROR'
      | 'INVALID_RESPONSE'
      | 'ALL_PROVIDERS_FAILED'
  ) {
    super(message)
  }
}

const ChatResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable().optional(),
      }),
    })
  ).min(1),
})

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clampInput(input: string) {
  if (input.length <= aiConfig.maxInputChars) return input
  return input.slice(0, aiConfig.maxInputChars)
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function chatWithProvider(
  provider: AIProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  options?: ChatOptions
) {
  const started = Date.now()
  const response = await fetchWithTimeout(
    `${provider.baseURL.replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.chatModel,
        messages: [
          { role: 'system', content: clampInput(systemPrompt) },
          { role: 'user', content: clampInput(userPrompt) },
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1200,
      }),
    },
    provider.timeoutMs
  )

  const latency = Date.now() - started
  recordMetric('ai.chat.latency_ms', latency, { provider: provider.name })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new AIServiceError(
      `AI provider error (${provider.name}): ${response.status} ${body.slice(0, 200)}`,
      'UPSTREAM_ERROR'
    )
  }

  const json = await response.json()
  const parsed = ChatResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new AIServiceError(
      `Invalid AI chat response from ${provider.name}`,
      'INVALID_RESPONSE'
    )
  }

  const content = parsed.data.choices[0]?.message?.content?.trim() || ''
  if (!content) {
    throw new AIServiceError(`Empty AI response from ${provider.name}`, 'INVALID_RESPONSE')
  }

  return content
}

export async function chatText(
  systemPrompt: string,
  userPrompt: string,
  options?: ChatOptions
): Promise<string> {
  if (!isAIConfigured()) {
    throw new AIServiceError('AI provider not configured', 'NOT_CONFIGURED')
  }

  let lastError: unknown = null
  for (const provider of aiConfig.providers) {
    for (let attempt = 1; attempt <= aiConfig.maxRetriesPerProvider; attempt++) {
      const started = Date.now()
      try {
        const output = await chatWithProvider(provider, systemPrompt, userPrompt, options)
        logger.info('ai_chat_success', {
          provider: provider.name,
          attempt,
          latency_ms: Date.now() - started,
          request_id: options?.requestId,
          prompt_version: aiConfig.promptVersion,
        })

        const usage = metricSnapshot('ai.chat.latency_ms', 60_000)
        if (usage.count > 120) {
          logger.warn('ai_usage_spike', { metric: 'ai.chat.latency_ms', per_minute: usage.count })
        }
        return output
      } catch (error) {
        lastError = error
        const code = error instanceof AIServiceError ? error.code : 'UNKNOWN'
        logger.warn('ai_chat_attempt_failed', {
          provider: provider.name,
          attempt,
          code,
          request_id: options?.requestId,
        })
        if (attempt < aiConfig.maxRetriesPerProvider) {
          await sleep(150 * attempt)
        }
      }
    }
  }

  if (lastError instanceof AIServiceError) throw lastError
  await sendAlert('ai_chat_all_providers_failed', {
    reason: 'all_providers_failed',
  })
  throw new AIServiceError('All AI providers failed', 'ALL_PROVIDERS_FAILED')
}

export async function chatJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  schema?: ZodType<T>,
  options?: ChatOptions
): Promise<T> {
  const text = await chatText(
    `${systemPrompt}\n\nRespond with JSON only. No markdown, no extra text.`,
    userPrompt,
    options
  )

  const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new AIServiceError('AI returned invalid JSON', 'INVALID_RESPONSE')
  }

  if (schema) {
    const validated = schema.safeParse(parsed)
    if (!validated.success) {
      throw new AIServiceError('AI JSON failed validation', 'INVALID_RESPONSE')
    }
    return validated.data
  }

  return parsed as T
}

export async function synthesizeSpeech(
  text: string,
  voice: string,
  instructions?: string
): Promise<Buffer> {
  if (!isAIConfigured()) {
    throw new AIServiceError('AI provider not configured', 'NOT_CONFIGURED')
  }

  let lastError: unknown = null
  for (const provider of aiConfig.providers) {
    for (let attempt = 1; attempt <= aiConfig.maxRetriesPerProvider; attempt++) {
      const started = Date.now()
      try {
        const response = await fetchWithTimeout(
          `${provider.baseURL.replace(/\/$/, '')}/audio/speech`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${provider.apiKey}`,
            },
            body: JSON.stringify({
              model: provider.ttsModel,
              voice,
              input: clampInput(text),
              instructions: instructions || '',
              response_format: 'mp3',
            }),
          },
          provider.timeoutMs
        )

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new AIServiceError(
            `TTS provider error (${provider.name}): ${response.status} ${body.slice(0, 200)}`,
            'UPSTREAM_ERROR'
          )
        }

        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.length === 0) {
          throw new AIServiceError('TTS provider returned empty audio', 'INVALID_RESPONSE')
        }

        const latency = Date.now() - started
        recordMetric('ai.tts.latency_ms', latency, { provider: provider.name })
        logger.info('ai_tts_success', { provider: provider.name, attempt, latency_ms: latency })
        return buffer
      } catch (error) {
        lastError = error
        logger.warn('ai_tts_attempt_failed', {
          provider: provider.name,
          attempt,
          code: error instanceof AIServiceError ? error.code : 'UNKNOWN',
        })
        if (attempt < aiConfig.maxRetriesPerProvider) await sleep(150 * attempt)
      }
    }
  }

  if (lastError instanceof AIServiceError) throw lastError
  await sendAlert('ai_tts_all_providers_failed', {
    reason: 'all_providers_failed',
  })
  throw new AIServiceError('All TTS providers failed', 'ALL_PROVIDERS_FAILED')
}

export async function aiHealthCheck() {
  if (!isAIConfigured()) {
    return { ok: false, reason: 'not_configured' as const }
  }

  try {
    const provider = aiConfig.providers[0]
    const response = await fetchWithTimeout(
      `${provider.baseURL.replace(/\/$/, '')}/models`,
      {
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
        },
      },
      Math.min(provider.timeoutMs, 5000)
    )
    return { ok: response.ok, status: response.status }
  } catch {
    return { ok: false, reason: 'unreachable' as const }
  }
}
