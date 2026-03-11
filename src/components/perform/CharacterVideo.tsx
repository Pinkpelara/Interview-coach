'use client'

import { useEffect, useRef, useState } from 'react'
import { AudioAnalyser } from './AudioAnalyser'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExpressionState =
  | 'neutral'
  | 'speaking'
  | 'listening'
  | 'thinking'
  | 'nodding'
  | 'skeptical'
  | 'writing_notes'
  | 'distracted'

export interface CharacterVideoProps {
  /** Character name — used to generate deterministic avatar */
  name: string
  /** Character job title */
  title: string
  /** Current expression state driven by interview conductor */
  expression: ExpressionState
  /** AudioAnalyser instance for lip sync (active when this character speaks) */
  audioAnalyser: AudioAnalyser | null
  /** Whether this character is currently the active speaker */
  isSpeaking: boolean
  /** Accent color for border glow */
  accentColor?: string
}

// ---------------------------------------------------------------------------
// Expression → CSS transform mapping (V4 spec Section 2.13)
// ---------------------------------------------------------------------------

const EXPRESSION_TRANSFORMS: Record<ExpressionState, string> = {
  neutral: 'translate(0, 0) rotate(0deg) scale(1)',
  speaking: 'translate(0, 0) rotate(0deg) scale(1)',
  listening: 'translate(0, -2px) rotate(0deg) scale(1.01)',
  thinking: 'translate(0, -3px) rotate(0deg) scale(1)',
  nodding: 'translate(0, 0) rotate(0deg) scale(1)', // handled by CSS animation
  skeptical: 'translate(0, 0) rotate(-2deg) scale(1)',
  writing_notes: 'translate(0, 4px) rotate(0deg) scale(1)',
  distracted: 'translate(5px, 0) rotate(1deg) scale(1)',
}

// ---------------------------------------------------------------------------
// CharacterVideo Component
// ---------------------------------------------------------------------------

export default function CharacterVideo({
  name,
  title,
  expression,
  audioAnalyser,
  isSpeaking,
  accentColor = '#4ade80',
}: CharacterVideoProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  // Refs for 60fps animation (no React re-renders)
  const containerRef = useRef<HTMLDivElement>(null)
  const mouthOverlayRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)
  const timeRef = useRef(0)
  const blinkRef = useRef<HTMLDivElement>(null)
  const lastBlinkRef = useRef(0)
  const nextBlinkRef = useRef(3000 + Math.random() * 2000)
  const idleSeedRef = useRef(Math.random() * 100)

  const avatarUrl = `/api/avatar?seed=${encodeURIComponent(name)}`
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase()

  // --- MAIN ANIMATION LOOP (60fps, direct DOM) ---
  useEffect(() => {
    const el = containerRef.current
    const mouthEl = mouthOverlayRef.current
    const blinkEl = blinkRef.current
    if (!el) return

    let lastTs = 0

    const tick = (ts: number) => {
      const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0.016
      lastTs = ts
      timeRef.current += dt
      const t = timeRef.current
      const seed = idleSeedRef.current

      // === IDLE ANIMATIONS (always running) ===

      // Micro-sway: ±1px X, ±0.5px Y on slow sine waves
      const swayX = Math.sin(t * 0.4 + seed) * 1.0 + Math.sin(t * 1.1 + seed * 2) * 0.3
      const swayY = Math.sin(t * 0.55 + seed * 3) * 0.5 + Math.sin(t * 0.25) * 0.3

      // Breathing: scale 1.0 → 1.002 on 4-5s period
      const breathe = 1 + Math.sin(t * 1.3) * 0.002

      // Combine idle with expression transform
      el.style.transform = `translate(${swayX.toFixed(2)}px, ${swayY.toFixed(2)}px) scale(${breathe.toFixed(4)})`

      // === BLINK (every 3-5s, 150ms duration) ===
      lastBlinkRef.current += dt * 1000
      if (blinkEl) {
        if (lastBlinkRef.current > nextBlinkRef.current) {
          blinkEl.style.opacity = '1'
          setTimeout(() => {
            if (blinkEl) blinkEl.style.opacity = '0'
          }, 150)
          lastBlinkRef.current = 0
          nextBlinkRef.current = 3000 + Math.random() * 2000
        }
      }

      // === LIP SYNC (driven by real audio amplitude) ===
      if (mouthEl) {
        let amplitude = 0
        if (isSpeaking && audioAnalyser?.isConnected()) {
          amplitude = audioAnalyser.getAmplitude()
        }

        if (amplitude > 0.05) {
          // Show mouth movement proportional to audio amplitude
          const openAmount = amplitude * 12 // max ~12px
          const scaleAmount = 1 + amplitude * 0.04
          mouthEl.style.opacity = String(Math.min(amplitude * 1.5, 0.85))
          mouthEl.style.height = `${8 + openAmount}%`
          mouthEl.style.transform = `translate(-50%, 0) scaleY(${scaleAmount.toFixed(3)})`
        } else {
          mouthEl.style.opacity = '0'
          mouthEl.style.height = '8%'
          mouthEl.style.transform = 'translate(-50%, 0) scaleY(1)'
        }
      }

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [isSpeaking, audioAnalyser])

  // --- EXPRESSION CSS CLASS ---
  const isNodding = expression === 'nodding'
  const expressionStyle = !isNodding ? EXPRESSION_TRANSFORMS[expression] : EXPRESSION_TRANSFORMS.neutral

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden bg-[#0c0f14] group">

      {/* Nodding CSS animation keyframes */}
      <style>{`
        @keyframes nod {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }
        .animate-nod-head {
          animation: nod 0.6s ease-in-out 3;
        }
      `}</style>

      {/* Photo container with expression transforms */}
      <div
        className={`absolute inset-0 transition-transform duration-300 ease-out ${isNodding ? 'animate-nod-head' : ''}`}
        style={{ transform: expressionStyle }}
      >
        {/* Idle animation wrapper (micro-sway + breathing) */}
        <div
          ref={containerRef}
          className="absolute inset-0 will-change-transform"
          style={{ transformOrigin: 'center 40%' }}
        >
          {/* The actual portrait photo */}
          {!imgError ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-full h-full object-cover select-none"
              style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.5s' }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              draggable={false}
            />
          ) : null}

          {/* Fallback initials */}
          {(imgError || !imgLoaded) && (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, #1a1a2e 0%, ${accentColor}15 100%)` }}>
              <div
                className="w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center text-2xl md:text-3xl font-bold text-white"
                style={{ backgroundColor: accentColor + '30', border: `3px solid ${accentColor}50` }}
              >
                {initials}
              </div>
            </div>
          )}

          {/* === BLINK OVERLAY === */}
          {/* Horizontal strip across eye region, flashes briefly */}
          <div
            ref={blinkRef}
            className="absolute pointer-events-none"
            style={{
              left: '25%', right: '25%',
              top: '34%', height: '5%',
              backgroundColor: '#b8977a',
              opacity: 0,
              transition: 'opacity 0.06s ease-out',
              filter: 'blur(2px)',
              borderRadius: '50%',
            }}
          />

          {/* === MOUTH / LIP SYNC OVERLAY === */}
          {/* Dark region in lower face that opens/closes with audio amplitude */}
          <div
            ref={mouthOverlayRef}
            className="absolute pointer-events-none"
            style={{
              left: '50%',
              top: '60%',
              width: '18%',
              height: '8%',
              transform: 'translate(-50%, 0)',
              backgroundColor: '#1a0810',
              borderRadius: '35% 35% 45% 45%',
              opacity: 0,
              transition: 'height 0.05s ease, opacity 0.05s ease',
              filter: 'blur(1px)',
            }}
          />
        </div>
      </div>

      {/* Webcam vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center 40%, transparent 40%, rgba(0,0,0,0.35) 100%)' }}
      />

      {/* Warm color temperature */}
      <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-[0.03]"
        style={{ backgroundColor: '#ffaa44' }}
      />

      {/* Speaking border glow */}
      {isSpeaking && (
        <div className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ border: `2px solid ${accentColor}`, boxShadow: `0 0 20px ${accentColor}40` }}
        />
      )}

      {/* Name label — Zoom/Teams style */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium truncate">{name}</p>
          {isSpeaking && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          )}
        </div>
        <p className="text-gray-400 text-xs truncate">{title}</p>
      </div>

      {/* Expression indicator (subtle, for writing_notes) */}
      {expression === 'writing_notes' && (
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
          <span className="text-yellow-400 text-[10px] animate-pulse">Taking notes...</span>
        </div>
      )}
    </div>
  )
}
