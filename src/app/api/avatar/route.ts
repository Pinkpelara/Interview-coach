import { NextRequest, NextResponse } from 'next/server'

// Proxy interviewer portraits with deterministic persona keys.
// Usage: /api/avatar?key=women-32&seed=Maya%20Chen

const AVATAR_CACHE = new Map<string, { data: Buffer; contentType: string; ts: number }>()
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

function parsePortraitKey(key: string): { gender: 'men' | 'women'; index: number } | null {
  const match = /^(men|women)-(\d{1,3})$/.exec(key)
  if (!match) return null
  const index = Number.parseInt(match[2], 10)
  if (Number.isNaN(index) || index < 0 || index > 99) return null
  return { gender: match[1] as 'men' | 'women', index }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function initialsFromSeed(seed: string): string {
  const initials = seed
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('')
  return initials || 'AI'
}

function svgFallback(seed: string): Buffer {
  const initials = escapeXml(initialsFromSeed(seed))
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1f2937" />
      <stop offset="100%" stop-color="#111827" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)" />
  <circle cx="256" cy="220" r="96" fill="#334155" />
  <path d="M96 470c22-84 88-134 160-134s138 50 160 134z" fill="#334155" />
  <circle cx="256" cy="256" r="84" fill="#0f172a" opacity="0.35" />
  <text x="256" y="278" text-anchor="middle" fill="#e5e7eb" font-size="48" font-family="Inter,Arial,sans-serif" font-weight="700">${initials}</text>
</svg>`.trim()

  return Buffer.from(svg)
}

export async function GET(req: NextRequest) {
  const seed = req.nextUrl.searchParams.get('seed') || 'Interviewer'
  const key = req.nextUrl.searchParams.get('key') || ''
  const parsed = parsePortraitKey(key)

  // Check cache
  const cacheKey = `${key}:${seed}`
  const cached = AVATAR_CACHE.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return new NextResponse(new Uint8Array(cached.data), {
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  if (parsed) {
    const portraitUrl = `https://randomuser.me/api/portraits/${parsed.gender}/${parsed.index}.jpg`
    try {
      const response = await fetch(portraitUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      })

      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer())
        const contentType = response.headers.get('content-type') || 'image/jpeg'
        AVATAR_CACHE.set(cacheKey, { data: buffer, contentType, ts: Date.now() })

        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
    } catch {
      // Fall through to SVG fallback.
    }
  }

  const fallbackBuffer = svgFallback(seed)
  AVATAR_CACHE.set(cacheKey, {
    data: fallbackBuffer,
    contentType: 'image/svg+xml; charset=utf-8',
    ts: Date.now(),
  })

  return new NextResponse(new Uint8Array(fallbackBuffer), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
