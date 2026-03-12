export interface AIProviderConfig {
  name: string
  baseURL: string
  apiKey: string
  chatModel: string
  ttsModel: string
  timeoutMs: number
  source: 'modern' | 'legacy'
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
    source: 'modern',
  }
}

function readLegacyProvider(): AIProviderConfig | null {
  const legacyToken = process.env.PUTER_API_TOKEN
  if (!legacyToken) return null

  const timeoutRaw = process.env.AI_PRIMARY_TIMEOUT_MS
  const timeoutMs = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : DEFAULT_TIMEOUT_MS

  return {
    name: 'legacy-puter',
    baseURL: 'https://api.puter.com/puterai/openai/v1/',
    apiKey: legacyToken,
    chatModel: process.env.PUTER_AI_MODEL || 'gpt-4.1-nano',
    ttsModel: 'gpt-4o-mini-tts',
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS,
    source: 'legacy',
  }
}

export interface AIConfig {
  providers: AIProviderConfig[]
  maxRetriesPerProvider: number
  maxInputChars: number
  promptVersion: string
  sourceMode: 'modern' | 'legacy' | 'none'
}

const modernProviders = [readProvider('PRIMARY'), readProvider('FALLBACK')].filter(
  (p): p is AIProviderConfig => Boolean(p)
)
const legacyProvider = modernProviders.length === 0 ? readLegacyProvider() : null
const providers = legacyProvider ? [legacyProvider] : modernProviders

export const aiConfig: AIConfig = {
  providers,
  maxRetriesPerProvider: Number.parseInt(process.env.AI_MAX_RETRIES || '2', 10),
  maxInputChars: Number.parseInt(process.env.AI_MAX_INPUT_CHARS || '12000', 10),
  promptVersion: process.env.AI_PROMPT_VERSION || 'v1',
  sourceMode: legacyProvider ? 'legacy' : providers.length > 0 ? 'modern' : 'none',
}

if (aiConfig.sourceMode === 'legacy') {
  console.warn(
    '[AI CONFIG] Using legacy PUTER_* environment variables. Migrate to AI_PRIMARY_* for production reliability.'
  )
}

export function isAIConfigured() {
  return aiConfig.providers.length > 0
}
