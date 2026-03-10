'use client'

import { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvatarExpression = 'neutral' | 'interested' | 'skeptical' | 'nodding' | 'writing'

export interface AnimatedAvatarProps {
  seed: string
  isSpeaking: boolean
  expression: AvatarExpression
  isLookingAway: boolean
  accentColor: string
  width?: number
  height?: number
}

// ---------------------------------------------------------------------------
// Component — Real human photo with life-like movement animation
//
// Approach: Instead of crude overlays on the face (which never look right),
// we animate the entire photo with realistic webcam-like motion:
// - Continuous subtle breathing/sway (never static)
// - Expression-driven head movement (lean, tilt, nod)
// - Speaking animation (chin movement + subtle body shift)
// - Video-call visual treatment (vignette, noise, color temp)
// This makes the photo look like a live video feed of a real person.
// ---------------------------------------------------------------------------

export default function AnimatedAvatar({
  seed,
  isSpeaking,
  expression,
  isLookingAway,
  accentColor,
}: AnimatedAvatarProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)

  // Persistent animation state (no React re-renders — direct DOM manipulation for 60fps)
  const stateRef = useRef({
    time: 0,
    // Current interpolated values
    cx: 0, cy: 0, crot: 0, cscale: 1.12, cbrightness: 1.0,
    // Targets
    tx: 0, ty: 0, trot: 0, tscale: 1.12, tbrightness: 1.0,
    // Nodding
    nodding: false, nodPhase: 0,
    // Speaking bounce
    speakPhase: 0,
    // Idle variation
    idleSeed: Math.random() * 100,
  })

  const avatarUrl = `/api/avatar?seed=${encodeURIComponent(seed)}`

  // --- EXPRESSION-DRIVEN TARGETS ---
  useEffect(() => {
    const s = stateRef.current
    s.nodding = false

    switch (expression) {
      case 'neutral':
        s.tx = 0; s.ty = 0; s.trot = 0; s.tscale = 1.12; s.tbrightness = 1.0
        break
      case 'interested':
        // Lean forward slightly, tilt head, brighten (engaged)
        s.tx = 2; s.ty = -4; s.trot = 2; s.tscale = 1.16; s.tbrightness = 1.03
        break
      case 'skeptical':
        // Lean back, tilt opposite, slightly darker (evaluating)
        s.tx = -3; s.ty = 1; s.trot = -3; s.tscale = 1.10; s.tbrightness = 0.97
        break
      case 'nodding':
        s.nodding = true; s.nodPhase = 0; s.tscale = 1.13
        break
      case 'writing':
        // Look down at notes, shift to side
        s.tx = 5; s.ty = 8; s.trot = -2; s.tscale = 1.10; s.tbrightness = 0.96
        break
    }
  }, [expression])

  // --- LOOKING AWAY ---
  useEffect(() => {
    const s = stateRef.current
    if (isLookingAway) {
      const dir = Math.random() > 0.5 ? 1 : -1
      s.tx = dir * (12 + Math.random() * 10)
      s.ty = 3 + Math.random() * 5
      s.trot = dir * 4
      s.tscale = 1.10
    } else if (expression === 'neutral') {
      s.tx = 0; s.ty = 0; s.trot = 0; s.tscale = 1.12
    }
  }, [isLookingAway, expression])

  // --- 60FPS ANIMATION LOOP (direct DOM updates, no setState) ---
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let lastTs = 0

    const tick = (ts: number) => {
      const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0.016
      lastTs = ts
      const s = stateRef.current
      s.time += dt

      const t = s.time
      const lerp = 1 - Math.pow(0.03, dt) // smooth ~30ms response

      // --- Nodding ---
      if (s.nodding) {
        s.nodPhase += dt * 5
        s.ty = Math.sin(s.nodPhase) * 5
        s.trot = Math.sin(s.nodPhase * 0.6) * 1.5
        if (s.nodPhase > Math.PI * 6) {
          s.nodding = false
          s.ty = 0; s.trot = 0
        }
      }

      // --- Speaking body movement ---
      if (isSpeaking) {
        s.speakPhase += dt * 8
        // Subtle chin/jaw movement + slight body shift
        s.cy += (s.ty + Math.sin(s.speakPhase) * 1.8 + Math.sin(s.speakPhase * 1.7) * 0.8 - s.cy) * lerp
        s.cx += (s.tx + Math.sin(s.speakPhase * 0.5) * 1.5 - s.cx) * lerp
      } else {
        s.speakPhase = 0
        s.cx += (s.tx - s.cx) * lerp
        s.cy += (s.ty - s.cy) * lerp
      }

      // --- Smooth interpolation ---
      s.crot += (s.trot - s.crot) * lerp
      s.cscale += (s.tscale - s.cscale) * lerp
      s.cbrightness += (s.tbrightness - s.cbrightness) * lerp

      // --- Idle micro-sway (always active — the key to looking alive) ---
      const seed = s.idleSeed
      const idleX = s.cx + Math.sin(t * 0.4 + seed) * 1.5 + Math.sin(t * 1.1 + seed * 2) * 0.7
      const idleY = s.cy + Math.sin(t * 0.55 + seed * 3) * 1.0 + Math.sin(t * 0.25 + seed) * 1.2
      const idleRot = s.crot + Math.sin(t * 0.35 + seed) * 0.5 + Math.sin(t * 0.8 + seed * 2) * 0.3
      const breathe = s.cscale + Math.sin(t * 1.3) * 0.004 // breathing rhythm

      // --- Occasional webcam-like auto-exposure shift ---
      const exposureShift = Math.sin(t * 0.15) * 0.02

      // Apply directly to DOM (bypasses React render cycle for smooth 60fps)
      el.style.transform = `translate(${idleX.toFixed(1)}px, ${idleY.toFixed(1)}px) rotate(${idleRot.toFixed(2)}deg) scale(${breathe.toFixed(4)})`
      el.style.filter = `brightness(${(s.cbrightness + exposureShift).toFixed(3)})`

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [isSpeaking])

  // Initials fallback
  const initials = seed.split(' ').map(n => n[0]).join('').toUpperCase()

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0c0f14]">
      {/* Animated photo container — transformed at 60fps */}
      <div
        ref={containerRef}
        className="absolute inset-0 will-change-transform"
        style={{ transformOrigin: 'center 40%' }}
      >
        {!imgError ? (
          <img
            src={avatarUrl}
            alt=""
            className="w-full h-full object-cover select-none"
            style={{
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.6s ease-in',
            }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            draggable={false}
          />
        ) : null}

        {/* Fallback: initials if photo fails to load */}
        {(imgError || !imgLoaded) && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, #1a1a2e 0%, ${accentColor}15 100%)` }}>
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-2xl"
              style={{ backgroundColor: accentColor + '35', border: `3px solid ${accentColor}50` }}
            >
              {initials}
            </div>
          </div>
        )}
      </div>

      {/* Speaking indicator: subtle chin shadow that pulses with speech */}
      {isSpeaking && imgLoaded && (
        <div
          className="absolute pointer-events-none animate-pulse"
          style={{
            left: '30%', right: '30%',
            bottom: '30%', height: '8%',
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.15) 0%, transparent 70%)',
            animation: 'pulse 0.4s ease-in-out infinite alternate',
          }}
        />
      )}

      {/* Webcam vignette effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center 40%, transparent 40%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      {/* Subtle color temperature variation (warmer, like indoor lighting) */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-[0.04]"
        style={{ backgroundColor: '#ffaa44' }}
      />

      {/* Very subtle noise texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}
