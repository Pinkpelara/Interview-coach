#!/usr/bin/env node

/**
 * AI provider conformance check.
 *
 * Verifies OpenAI-compatible provider(s) expose minimum required endpoints:
 * - GET /models
 * - POST /chat/completions
 * - POST /audio/speech (optional but recommended)
 *
 * Usage:
 *   node scripts/ai-conformance.mjs
 */

const providers = [
  {
    name: 'primary',
    baseURL: process.env.AI_PRIMARY_BASE_URL,
    apiKey: process.env.AI_PRIMARY_API_KEY,
    chatModel: process.env.AI_PRIMARY_CHAT_MODEL,
    ttsModel: process.env.AI_PRIMARY_TTS_MODEL || 'gpt-4o-mini-tts',
  },
  {
    name: 'fallback',
    baseURL: process.env.AI_FALLBACK_BASE_URL,
    apiKey: process.env.AI_FALLBACK_API_KEY,
    chatModel: process.env.AI_FALLBACK_CHAT_MODEL,
    ttsModel: process.env.AI_FALLBACK_TTS_MODEL || 'gpt-4o-mini-tts',
  },
].filter((p) => p.baseURL && p.apiKey && p.chatModel)

if (providers.length === 0) {
  console.error('No AI providers configured. Set AI_PRIMARY_* env vars first.')
  process.exit(1)
}

function withTimeout(promise, timeoutMs) {
  let timeout
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout))
}

async function request(provider, path, init = {}, timeoutMs = 10000) {
  const url = `${provider.baseURL.replace(/\/$/, '')}${path}`
  const headers = {
    Authorization: `Bearer ${provider.apiKey}`,
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers || {}),
  }
  const response = await withTimeout(fetch(url, { ...init, headers }), timeoutMs)
  return response
}

async function checkProvider(provider) {
  console.log(`\n== Checking provider: ${provider.name} ==`)
  const result = {
    provider: provider.name,
    models: false,
    chat: false,
    tts: false,
    errors: [],
  }

  try {
    const modelsRes = await request(provider, '/models')
    if (!modelsRes.ok) {
      result.errors.push(`GET /models failed: ${modelsRes.status}`)
    } else {
      result.models = true
      console.log('✓ models endpoint')
    }
  } catch (e) {
    result.errors.push(`GET /models error: ${e.message}`)
  }

  try {
    const chatRes = await request(
      provider,
      '/chat/completions',
      {
        method: 'POST',
        body: JSON.stringify({
          model: provider.chatModel,
          messages: [
            { role: 'system', content: 'Respond in exactly one word: ok' },
            { role: 'user', content: 'Say ok' },
          ],
          temperature: 0,
          max_tokens: 16,
        }),
      },
      15000
    )

    if (!chatRes.ok) {
      result.errors.push(`POST /chat/completions failed: ${chatRes.status}`)
    } else {
      const json = await chatRes.json()
      const text = json?.choices?.[0]?.message?.content
      if (typeof text !== 'string' || text.trim().length === 0) {
        result.errors.push('POST /chat/completions returned invalid shape')
      } else {
        result.chat = true
        console.log('✓ chat endpoint')
      }
    }
  } catch (e) {
    result.errors.push(`POST /chat/completions error: ${e.message}`)
  }

  try {
    const ttsRes = await request(
      provider,
      '/audio/speech',
      {
        method: 'POST',
        body: JSON.stringify({
          model: provider.ttsModel,
          voice: 'alloy',
          input: 'Conformance test.',
          response_format: 'mp3',
        }),
      },
      20000
    )

    if (!ttsRes.ok) {
      result.errors.push(`POST /audio/speech failed: ${ttsRes.status}`)
    } else {
      const bytes = await ttsRes.arrayBuffer()
      if (!bytes || bytes.byteLength < 32) {
        result.errors.push('POST /audio/speech returned too little data')
      } else {
        result.tts = true
        console.log('✓ tts endpoint')
      }
    }
  } catch (e) {
    result.errors.push(`POST /audio/speech error: ${e.message}`)
  }

  return result
}

const checks = await Promise.all(providers.map(checkProvider))

console.log('\n== Conformance summary ==')
let hasFailure = false
for (const c of checks) {
  const passed = c.models && c.chat
  const status = passed ? 'PASS' : 'FAIL'
  console.log(
    `${status} ${c.provider} | models=${c.models ? 'ok' : 'no'} chat=${c.chat ? 'ok' : 'no'} tts=${c.tts ? 'ok' : 'no'}`
  )
  if (c.errors.length) {
    hasFailure = true
    for (const err of c.errors) {
      console.log(`  - ${err}`)
    }
  }
}

if (hasFailure) {
  process.exit(1)
}

process.exit(0)
