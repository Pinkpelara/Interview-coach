import { NextRequest, NextResponse } from 'next/server'

// Proxy avatar images to avoid CORS issues with external services
// Usage: /api/avatar?seed=James+Martinez

const AVATAR_CACHE = new Map<string, { data: Buffer; contentType: string; ts: number }>()
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export async function GET(req: NextRequest) {
  const seed = req.nextUrl.searchParams.get('seed') || 'default'
  const h = hashSeed(seed)

  // Check cache
  const cached = AVATAR_CACHE.get(seed)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return new NextResponse(new Uint8Array(cached.data), {
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  // Try multiple sources in order
  const sources = [
    `https://i.pravatar.cc/512?img=${(h % 70) + 1}`,
    `https://randomuser.me/api/portraits/${h % 2 === 0 ? 'men' : 'women'}/${(h % 80) + 1}.jpg`,
  ]

  for (const url of sources) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) continue

      const buffer = Buffer.from(await response.arrayBuffer())
      const contentType = response.headers.get('content-type') || 'image/jpeg'

      // Cache it
      AVATAR_CACHE.set(seed, { data: buffer, contentType, ts: Date.now() })

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      })
    } catch {
      continue
    }
  }

  // Return a 1x1 transparent pixel if all sources fail
  return new NextResponse(null, { status: 404 })
}
