'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvatarExpression = 'neutral' | 'interested' | 'skeptical' | 'nodding' | 'writing'

export interface AnimatedAvatarProps {
  seed: string
  avatarKey?: string
  isSpeaking: boolean
  audioLevel?: number
  expression: AvatarExpression
  isLookingAway: boolean
  accentColor: string
  width?: number
  height?: number
}

// ---------------------------------------------------------------------------
// Speech visemes drive subtle jaw/lower-face motion
// ---------------------------------------------------------------------------

interface MouthShape {
  openness: number
  width: number
  roundness: number
  teethShow: boolean
}

const VISEMES: Record<string, MouthShape> = {
  rest:  { openness: 0,    width: 1.0, roundness: 0,   teethShow: false },
  aa:    { openness: 0.9,  width: 0.9, roundness: 0.2, teethShow: true },
  ee:    { openness: 0.3,  width: 1.2, roundness: 0.1, teethShow: true },
  oo:    { openness: 0.65, width: 0.5, roundness: 0.9, teethShow: false },
  ch:    { openness: 0.2,  width: 0.8, roundness: 0.2, teethShow: true },
  ff:    { openness: 0.1,  width: 1.0, roundness: 0,   teethShow: true },
  mm:    { openness: 0,    width: 0.9, roundness: 0,   teethShow: false },
  th:    { openness: 0.15, width: 0.9, roundness: 0,   teethShow: true },
}

const SPEECH_ORDER: (keyof typeof VISEMES)[] = ['aa', 'ee', 'oo', 'ch', 'ff', 'mm', 'aa', 'ee', 'th', 'oo']

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnimatedAvatar({
  seed,
  avatarKey,
  isSpeaking,
  audioLevel = 0,
  expression,
  isLookingAway,
  accentColor,
}: AnimatedAvatarProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  // Animation states
  const [blinking, setBlinking] = useState(false)
  const [mouthShape, setMouthShape] = useState<MouthShape>(VISEMES.rest)
  const [headTransform, setHeadTransform] = useState('translate(0px, 0px) rotate(0deg) scale(1.08)')

  const blinkTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const visemeRef = useRef(0)
  const visemeTimerRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const idleRef = useRef<ReturnType<typeof requestAnimationFrame>>(undefined)
  const timeRef = useRef(0)
  const nodPhaseRef = useRef(0)
  const noddingRef = useRef(false)

  // Target values for smooth interpolation
  const targetRef = useRef({ x: 0, y: 0, rot: 0, scale: 1.08 })
  const currentRef = useRef({ x: 0, y: 0, rot: 0, scale: 1.08 })

  const avatarUrl = `/api/avatar?key=${encodeURIComponent(avatarKey || seed)}&seed=${encodeURIComponent(seed)}`

  // --- NATURAL BLINKING ---
  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 2000 + Math.random() * 4000
      blinkTimerRef.current = setTimeout(() => {
        setBlinking(true)
        // Double blink sometimes
        const doubleBlink = Math.random() < 0.2
        setTimeout(() => {
          setBlinking(false)
          if (doubleBlink) {
            setTimeout(() => {
              setBlinking(true)
              setTimeout(() => setBlinking(false), 120)
            }, 180)
          }
        }, 130)
        scheduleBlink()
      }, delay)
    }
    scheduleBlink()
    return () => clearTimeout(blinkTimerRef.current)
  }, [])

  // --- LIP SYNC (fallback timer when no live audio level) ---
  useEffect(() => {
    if (isSpeaking && audioLevel < 0.03) {
      visemeTimerRef.current = setInterval(() => {
        visemeRef.current = (visemeRef.current + 1 + Math.floor(Math.random() * 2)) % SPEECH_ORDER.length
        setMouthShape(VISEMES[SPEECH_ORDER[visemeRef.current]])
      }, 90 + Math.random() * 80)
    } else {
      clearInterval(visemeTimerRef.current)
      setMouthShape(VISEMES.rest)
    }
    return () => clearInterval(visemeTimerRef.current)
  }, [isSpeaking, audioLevel])

  // --- LIP SYNC (primary: audio-reactive level) ---
  useEffect(() => {
    if (!isSpeaking) {
      setMouthShape(VISEMES.rest)
      return
    }

    const level = Math.max(0, Math.min(1, audioLevel))
    if (level < 0.04) {
      setMouthShape(VISEMES.mm)
      return
    }
    if (level < 0.18) {
      setMouthShape(Math.random() > 0.5 ? VISEMES.ff : VISEMES.th)
      return
    }
    if (level < 0.35) {
      setMouthShape(Math.random() > 0.5 ? VISEMES.ee : VISEMES.ch)
      return
    }
    if (level < 0.62) {
      setMouthShape(Math.random() > 0.5 ? VISEMES.oo : VISEMES.ee)
      return
    }
    setMouthShape(VISEMES.aa)
  }, [audioLevel, isSpeaking])

  // --- EXPRESSION & HEAD MOVEMENT ---
  useEffect(() => {
    const t = targetRef.current
    noddingRef.current = false

    switch (expression) {
      case 'neutral':
        t.x = 0; t.y = 0; t.rot = 0; t.scale = 1.08
        break
      case 'interested':
        t.x = 1; t.y = -2; t.rot = 1.5; t.scale = 1.11 // lean in
        break
      case 'skeptical':
        t.x = -2; t.y = 0; t.rot = -2.5; t.scale = 1.07
        break
      case 'nodding':
        noddingRef.current = true
        nodPhaseRef.current = 0
        t.scale = 1.09
        break
      case 'writing':
        t.x = 3; t.y = 5; t.rot = -1.5; t.scale = 1.06 // looking down
        break
    }
  }, [expression])

  // --- LOOKING AWAY ---
  useEffect(() => {
    const t = targetRef.current
    if (isLookingAway) {
      t.x = 10 + Math.random() * 8
      t.y = 3 + Math.random() * 3
      t.rot = 3
    } else if (expression === 'neutral') {
      t.x = 0; t.y = 0; t.rot = 0
    }
  }, [isLookingAway, expression])

  // --- SMOOTH ANIMATION LOOP (idle sway + interpolation) ---
  useEffect(() => {
    const tick = () => {
      timeRef.current += 0.016
      const t = timeRef.current
      const target = targetRef.current
      const cur = currentRef.current

      // Nodding animation
      if (noddingRef.current) {
        nodPhaseRef.current += 0.072
        target.y = Math.sin(nodPhaseRef.current) * 4
        target.rot = Math.sin(nodPhaseRef.current * 0.5) * 1.2
        if (nodPhaseRef.current > Math.PI * 5) {
          noddingRef.current = false
          target.y = 0; target.rot = 0
        }
      }

      // Smooth lerp
      const lerp = 0.06
      cur.x += (target.x - cur.x) * lerp
      cur.y += (target.y - cur.y) * lerp
      cur.rot += (target.rot - cur.rot) * lerp
      cur.scale += (target.scale - cur.scale) * lerp

      // Add idle micro-sway (always on — makes them look alive)
      const idleX = cur.x + Math.sin(t * 0.6) * 1.0 + Math.sin(t * 1.3) * 0.5
      const idleY = cur.y + Math.sin(t * 0.8) * 0.7 + Math.sin(t * 0.3) * 0.8
      const idleRot = cur.rot + Math.sin(t * 0.5) * 0.3
      const breatheScale = cur.scale + Math.sin(t * 1.2) * 0.003

      setHeadTransform(
        `translate(${idleX.toFixed(2)}px, ${idleY.toFixed(2)}px) rotate(${idleRot.toFixed(2)}deg) scale(${breatheScale.toFixed(4)})`
      )

      idleRef.current = requestAnimationFrame(tick)
    }
    idleRef.current = requestAnimationFrame(tick)
    return () => { if (idleRef.current) cancelAnimationFrame(idleRef.current) }
  }, [])

  // Initials fallback
  const initials = seed.split(' ').map(n => n[0]).join('').toUpperCase()

  // Use viseme openness to drive subtle lower-face motion.
  // This avoids uncanny cartoon overlays while preserving speech reactivity.
  const mouthOpen = mouthShape.openness
  const jawShiftPx = mouthOpen * 2.8
  const jawScaleY = 1 + mouthOpen * 0.12
  const jawScaleX = 1 - mouthOpen * 0.03
  const jawShadowOpacity = Math.min(0.26, 0.05 + mouthOpen * 0.2)

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0c0f14]">
      {/* Photo layer — the real human face */}
      <div
        className="absolute inset-0 transition-none"
        style={{ transform: headTransform, transformOrigin: 'center 40%' }}
      >
        {!imgError ? (
          <img
            src={avatarUrl}
            alt=""
            className={`w-full h-full object-cover select-none ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ transition: 'opacity 0.5s' }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            draggable={false}
          />
        ) : null}

        {/* Fallback initials if photo fails */}
        {(imgError || !imgLoaded) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center text-3xl font-bold text-white"
              style={{ backgroundColor: accentColor + '40', border: `3px solid ${accentColor}60` }}
            >
              {initials}
            </div>
          </div>
        )}

        {/* Blink cue: subtle upper-eye darkening instead of skin patches */}
        {blinking && imgLoaded && (
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute rounded-full"
              style={{
                left: '31%',
                top: '34.2%',
                width: '13%',
                height: '2.4%',
                backgroundColor: 'rgba(0,0,0,0.22)',
                filter: 'blur(0.8px)',
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                left: '56%',
                top: '34.2%',
                width: '13%',
                height: '2.4%',
                backgroundColor: 'rgba(0,0,0,0.22)',
                filter: 'blur(0.8px)',
              }}
            />
          </div>
        )}

        {/* Lower-face motion blend (no cartoon mouth drawing) */}
        {imgLoaded && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              style={{
                position: 'absolute',
                left: '21%',
                top: '53%',
                width: '58%',
                height: '31%',
                borderRadius: '45% 45% 52% 52%',
                overflow: 'hidden',
                transform: `translateY(${jawShiftPx.toFixed(2)}px) scale(${jawScaleX.toFixed(3)}, ${jawScaleY.toFixed(3)})`,
                transformOrigin: '50% 8%',
              }}
            >
              <img
                src={avatarUrl}
                alt=""
                className="w-full h-full object-cover select-none"
                style={{
                  transform: 'scale(1.1)',
                  transformOrigin: 'center 40%',
                  opacity: 0.98,
                }}
                draggable={false}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to bottom, rgba(0,0,0,0) 15%, rgba(0,0,0,${(jawShadowOpacity * 0.45).toFixed(3)}) 70%, rgba(0,0,0,${jawShadowOpacity.toFixed(3)}) 100%)`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Vignette overlay — webcam realism */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center 40%, transparent 45%, rgba(0,0,0,0.35) 100%)',
        }}
      />

      {/* Subtle scanlines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,1) 1px, rgba(0,0,0,1) 2px)',
          backgroundSize: '100% 2px',
        }}
      />
    </div>
  )
}
