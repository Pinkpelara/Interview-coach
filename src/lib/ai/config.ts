export interface AIProviderConfig {
  name: string
  baseURL: string
  apiKey: string
  chatModel: string
  ttsModel: string
  timeoutMs: number
}

const DEFAULT_TIMEOUT_MS = 12_000

function readProvider(prefix: 'PRIMARY' | 'FALLBACK'): AIProviderConfig | null {
  const baseURL = process.env[`AI_${prefix}_BASE_URL`]
  const apiKey = process.env[`AI_${prefix}_API_KEY`]
  const chatModel = process.env[`AI_${prefix}_CHAT_MODEL`]
  const ttsModel = process.env[`AI_${prefix}_TTS_MODEL`] || 'gpt-4o-mini-tts'

  if (!baseURL || !apiKey || !chatModel) {
    return null
  }

  const timeoutRaw = process.env[`AI_${prefix}_TIMEOUT_MS`]
  const timeoutMs = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : DEFAULT_TIMEOUT_MS

  return {
    name: prefix.toLowerCase(),
    baseURL,
    apiKey,
    chatModel,
    ttsModel,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS,
  }
}

export interface AIConfig {
  providers: AIProviderConfig[]
  maxRetriesPerProvider: number
  maxInputChars: number
  promptVersion: string
}

export const aiConfig: AIConfig = {
  providers: [readProvider('PRIMARY'), readProvider('FALLBACK')].filter(
    (p): p is AIProviderConfig => Boolean(p)
  ),
  maxRetriesPerProvider: Number.parseInt(process.env.AI_MAX_RETRIES || '2', 10),
  maxInputChars: Number.parseInt(process.env.AI_MAX_INPUT_CHARS || '12000', 10),
  promptVersion: process.env.AI_PROMPT_VERSION || 'v1',
}

export function isAIConfigured() {
  return aiConfig.providers.length > 0
}
