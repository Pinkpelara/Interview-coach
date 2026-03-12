interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

function checkRateLimitMemory(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, existing.resetAt - now),
    }
  }

  existing.count += 1
  buckets.set(key, existing)
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterMs: 0,
  }
}

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

function hasRedisConfigured() {
  return Boolean(REDIS_URL && REDIS_TOKEN)
}

async function checkRateLimitRedis(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error('Redis is not configured')
  }

  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs
  const redisKey = `rl:${key}:${windowStart}`
  const windowSec = Math.ceil(windowMs / 1000)

  const response = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', redisKey],
      ['EXPIRE', redisKey, String(windowSec)],
      ['TTL', redisKey],
    ]),
  })

  if (!response.ok) {
    throw new Error(`Redis pipeline failed: ${response.status}`)
  }

  const payload = (await response.json()) as Array<{ result?: unknown }>
  const countRaw = payload?.[0]?.result
  const ttlRaw = payload?.[2]?.result

  const count = typeof countRaw === 'number' ? countRaw : Number.parseInt(String(countRaw), 10)
  const ttlSec = typeof ttlRaw === 'number' ? ttlRaw : Number.parseInt(String(ttlRaw), 10)

  if (!Number.isFinite(count) || !Number.isFinite(ttlSec)) {
    throw new Error('Invalid Redis rate-limit response')
  }

  if (count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, ttlSec * 1000),
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - count),
    retryAfterMs: 0,
  }
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (hasRedisConfigured()) {
    try {
      return await checkRateLimitRedis(key, limit, windowMs)
    } catch {
      return checkRateLimitMemory(key, limit, windowMs)
    }
  }

  return checkRateLimitMemory(key, limit, windowMs)
}
