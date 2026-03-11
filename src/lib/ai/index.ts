import { z, type ZodType } from 'zod'
import { aiHealthCheck, chatJSON, chatText } from './service'
import { isAIConfigured } from './config'

export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
) {
  return chatText(systemPrompt, userPrompt, options)
}

export async function chatCompletionJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
) {
  return chatJSON<T>(systemPrompt, userPrompt, undefined, options)
}

export async function chatCompletionJSONValidated<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: ZodType<T>,
  options?: { temperature?: number; maxTokens?: number }
) {
  return chatJSON<T>(systemPrompt, userPrompt, schema, options)
}

export { isAIConfigured as isAIServiceConfigured, aiHealthCheck }
export { synthesizeSpeech, AIServiceError } from './service'
export { z }
