'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

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
// Deterministic hash from seed — consistent avatar per character
// ---------------------------------------------------------------------------

function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

// ---------------------------------------------------------------------------
// Get a realistic AI-generated / stock portrait photo URL
// Uses multiple free avatar services for variety and realism
// ---------------------------------------------------------------------------

function getPhotoUrl(seed: string): string {
  const h = hashSeed(seed)
  // Use randomuser.me-style portraits via pravatar (real human photos)
  // IDs 1-70 are available, all are real professional-looking headshots
  const id = (h % 70) + 1
  return `https://i.pravatar.cc/512?img=${id}`
}

// Fallback: generate a second URL from a different service
function getFallbackPhotoUrl(seed: string): string {
  const h = hashSeed(seed)
  // Use UI Faces style - different set of real photos
  const gender = h % 2 === 0 ? 'men' : 'women'
  const id = (h % 80) + 1
  return `https://randomuser.me/api/portraits/${gender}/${id}.jpg`
}

// ---------------------------------------------------------------------------
// Face landmark estimation (approximate for portrait photos)
// Standard portrait: face centered, eyes ~40% from top, mouth ~70% from top
// ---------------------------------------------------------------------------

interface FaceLandmarks {
  leftEye: { x: number; y: number }
  rightEye: { x: number; y: number }
  mouth: { x: number; y: number; width: number; height: number }
  chin: { x: number; y: number }
  faceCenter: { x: number; y: number }
}

function estimateLandmarks(w: number, h: number): FaceLandmarks {
  return {
    leftEye: { x: w * 0.38, y: h * 0.38 },
    rightEye: { x: w * 0.62, y: h * 0.38 },
    mouth: { x: w * 0.5, y: h * 0.62, width: w * 0.2, height: h * 0.06 },
    chin: { x: w * 0.5, y: h * 0.75 },
    faceCenter: { x: w * 0.5, y: h * 0.45 },
  }
}

// ---------------------------------------------------------------------------
// Mouth shape definitions for lip sync overlay
// ---------------------------------------------------------------------------

interface MouthShape {
  openness: number    // 0-1
  width: number       // 0.5-1.2
  roundness: number   // 0-1
}

const MOUTH_SHAPES = {
  rest:   { openness: 0,    width: 1.0,  roundness: 0 },
  aa:     { openness: 0.85, width: 0.9,  roundness: 0.3 },
  ee:     { openness: 0.3,  width: 1.2,  roundness: 0.1 },
  oo:     { openness: 0.6,  width: 0.6,  roundness: 0.9 },
  ch:     { openness: 0.2,  width: 0.8,  roundness: 0.2 },
  ff:     { openness: 0.1,  width: 1.0,  roundness: 0 },
  mm:     { openness: 0,    width: 0.9,  roundness: 0 },
  th:     { openness: 0.15, width: 0.9,  roundness: 0 },
}

type VisemeKey = keyof typeof MOUTH_SHAPES
const SPEECH_VISEMES: VisemeKey[] = ['aa', 'ee', 'oo', 'ch', 'ff', 'mm', 'aa', 'ee', 'th', 'oo']

// ---------------------------------------------------------------------------
// Canvas Renderer — draws real photo + animated overlays
// ---------------------------------------------------------------------------

function renderFrame(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement,
  cw: number,
  ch: number,
  state: {
    blinkAmount: number
    mouthShape: MouthShape
    headOffsetX: number
    headOffsetY: number
    headRotation: number
    headScale: number
    time: number
    skinSample: string
  }
) {
  const { blinkAmount, mouthShape, headOffsetX, headOffsetY, headRotation, headScale, time, skinSample } = state

  ctx.clearRect(0, 0, cw, ch)

  // Dark background like a real video call
  ctx.fillStyle = '#0c0f14'
  ctx.fillRect(0, 0, cw, ch)

  // --- Draw the photo with head movement transforms ---
  ctx.save()

  // Apply subtle head movement
  const cx = cw / 2
  const cy = ch / 2
  ctx.translate(cx + headOffsetX, cy + headOffsetY)
  ctx.rotate((headRotation * Math.PI) / 180)
  ctx.scale(headScale, headScale)
  ctx.translate(-cx, -cy)

  // Draw the photo scaled to fill the canvas (cover mode)
  const imgAspect = photo.width / photo.height
  const canvasAspect = cw / ch
  let drawW: number, drawH: number, drawX: number, drawY: number

  if (imgAspect > canvasAspect) {
    drawH = ch
    drawW = ch * imgAspect
    drawX = (cw - drawW) / 2
    drawY = 0
  } else {
    drawW = cw
    drawH = cw / imgAspect
    drawX = 0
    drawY = (ch - drawH) / 2
  }

  ctx.drawImage(photo, drawX, drawY, drawW, drawH)

  // --- Face landmarks (estimated for standard portrait photos) ---
  const landmarks = estimateLandmarks(cw, ch)

  // --- BLINK ANIMATION ---
  // Draw skin-colored patches over eye areas during blink
  if (blinkAmount > 0.05) {
    const eyeW = cw * 0.065
    const eyeH = ch * 0.02

    ctx.fillStyle = skinSample
    ctx.globalAlpha = blinkAmount

    for (const eye of [landmarks.leftEye, landmarks.rightEye]) {
      ctx.beginPath()
      ctx.ellipse(eye.x, eye.y, eyeW, eyeH + blinkAmount * ch * 0.012, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.globalAlpha = 1
  }

  // --- LIP SYNC MOUTH ANIMATION ---
  if (mouthShape.openness > 0.02) {
    const mouth = landmarks.mouth
    const mw = mouth.width * mouthShape.width
    const openH = mouth.height * mouthShape.openness * 2.5

    // Cover the photo's mouth area with skin tone
    ctx.fillStyle = skinSample
    ctx.beginPath()
    ctx.ellipse(mouth.x, mouth.y, mw * 1.15, openH * 1.2 + ch * 0.008, 0, 0, Math.PI * 2)
    ctx.fill()

    // Dark mouth interior
    ctx.fillStyle = '#2a1015'
    ctx.beginPath()
    if (mouthShape.roundness > 0.5) {
      // Round mouth (oo shape)
      ctx.ellipse(mouth.x, mouth.y + openH * 0.15, mw * 0.5, openH * 0.8, 0, 0, Math.PI * 2)
    } else {
      ctx.ellipse(mouth.x, mouth.y + openH * 0.15, mw * 0.85, openH * 0.7, 0, 0, Math.PI * 2)
    }
    ctx.fill()

    // Upper teeth
    if (mouthShape.openness > 0.15) {
      ctx.fillStyle = '#f0ece6'
      const teethW = mw * 0.65
      const teethH = openH * 0.25
      ctx.beginPath()
      ctx.roundRect(mouth.x - teethW, mouth.y - openH * 0.25, teethW * 2, teethH, [0, 0, 2, 2])
      ctx.fill()
    }

    // Tongue hint for open vowels
    if (mouthShape.openness > 0.5) {
      ctx.fillStyle = '#b04555'
      ctx.beginPath()
      ctx.ellipse(mouth.x, mouth.y + openH * 0.35, mw * 0.4, openH * 0.2, 0, 0, Math.PI)
      ctx.fill()
    }

    // Upper lip
    ctx.fillStyle = skinSample
    ctx.globalAlpha = 0.85
    const lipShade = adjustColor(skinSample, -20)
    ctx.strokeStyle = lipShade
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(mouth.x - mw, mouth.y - openH * 0.1)
    ctx.quadraticCurveTo(mouth.x - mw * 0.4, mouth.y - openH * 0.45, mouth.x, mouth.y - openH * 0.35)
    ctx.quadraticCurveTo(mouth.x + mw * 0.4, mouth.y - openH * 0.45, mouth.x + mw, mouth.y - openH * 0.1)
    ctx.stroke()
    ctx.globalAlpha = 1

    // Lower lip
    ctx.strokeStyle = lipShade
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(mouth.x - mw * 0.9, mouth.y + openH * 0.25)
    ctx.quadraticCurveTo(mouth.x, mouth.y + openH * 0.8, mouth.x + mw * 0.9, mouth.y + openH * 0.25)
    ctx.stroke()
  }

  ctx.restore()

  // --- VIDEO CALL POST-PROCESSING ---

  // Subtle vignette
  const vig = ctx.createRadialGradient(cw * 0.5, ch * 0.45, cw * 0.2, cw * 0.5, ch * 0.5, cw * 0.75)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.3)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, cw, ch)

  // Very subtle scanlines (webcam feel)
  ctx.fillStyle = 'rgba(0,0,0,0.015)'
  for (let y = 0; y < ch; y += 2) {
    ctx.fillRect(0, y, cw, 1)
  }

  // Minimal noise
  const noisePhase = Math.floor(time * 4) % 7
  ctx.fillStyle = 'rgba(255,255,255,0.006)'
  for (let i = 0; i < 25; i++) {
    const nx = ((i * 137 + noisePhase * 43) % cw)
    const ny = ((i * 211 + noisePhase * 67) % ch)
    ctx.fillRect(nx, ny, 1, 1)
  }
}

// ---------------------------------------------------------------------------
// Color utility
// ---------------------------------------------------------------------------

function adjustColor(hex: string, amount: number): string {
  // Parse any CSS color and darken/lighten
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!match) return hex
  const r = Math.max(0, Math.min(255, parseInt(match[1], 16) + amount))
  const g = Math.max(0, Math.min(255, parseInt(match[2], 16) + amount))
  const b = Math.max(0, Math.min(255, parseInt(match[3], 16) + amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Sample skin color from the loaded photo (forehead area)
// ---------------------------------------------------------------------------

function sampleSkinColor(img: HTMLImageElement): string {
  try {
    const c = document.createElement('canvas')
    c.width = img.naturalWidth || img.width
    c.height = img.naturalHeight || img.height
    const ctx = c.getContext('2d')
    if (!ctx) return '#d4a574'
    ctx.drawImage(img, 0, 0)
    // Sample from forehead region (center-top of face)
    const sx = Math.floor(c.width * 0.5)
    const sy = Math.floor(c.height * 0.3)
    const pixel = ctx.getImageData(sx, sy, 1, 1).data
    return `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`
  } catch {
    return '#d4a574'
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AnimatedAvatar({
  seed,
  isSpeaking,
  expression,
  isLookingAway,
  accentColor,
  width = 480,
  height = 480,
}: AnimatedAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const photoRef = useRef<HTMLImageElement | null>(null)
  const animRef = useRef<number>(0)
  const [photoLoaded, setPhotoLoaded] = useState(false)
  const [photoError, setPhotoError] = useState(false)
  const skinColorRef = useRef('#d4a574')

  const stateRef = useRef({
    // Blink
    blinkAmount: 0,
    blinkTimer: 0,
    nextBlink: 2500,
    // Mouth
    currentMouth: { ...MOUTH_SHAPES.rest },
    targetMouth: { ...MOUTH_SHAPES.rest },
    visemeIdx: 0,
    visemeTimer: 0,
    // Head
    headOffsetX: 0,
    headOffsetY: 0,
    headTargetX: 0,
    headTargetY: 0,
    headRot: 0,
    headRotTarget: 0,
    headScale: 1.06,
    headScaleTarget: 1.06,
    // Nodding
    nodding: false,
    nodPhase: 0,
    // Timing
    time: 0,
    lastTs: 0,
    idleTimer: 0,
  })

  // Load photo
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      photoRef.current = img
      // Sample skin color from the actual photo for matching overlays
      skinColorRef.current = sampleSkinColor(img)
      setPhotoLoaded(true)
    }
    img.onerror = () => {
      // Try fallback URL
      const fallback = new Image()
      fallback.crossOrigin = 'anonymous'
      fallback.onload = () => {
        photoRef.current = fallback
        skinColorRef.current = sampleSkinColor(fallback)
        setPhotoLoaded(true)
      }
      fallback.onerror = () => setPhotoError(true)
      fallback.src = getFallbackPhotoUrl(seed)
    }
    img.src = getPhotoUrl(seed)
  }, [seed])

  // Update expression targets
  useEffect(() => {
    const s = stateRef.current
    switch (expression) {
      case 'neutral':
        s.headRotTarget = 0
        s.headTargetX = 0
        s.headTargetY = 0
        s.headScaleTarget = 1.06
        s.nodding = false
        break
      case 'interested':
        s.headRotTarget = 1.5
        s.headTargetX = 2
        s.headTargetY = -3
        s.headScaleTarget = 1.08 // lean in slightly
        s.nodding = false
        break
      case 'skeptical':
        s.headRotTarget = -2.5
        s.headTargetX = -3
        s.headTargetY = 0
        s.headScaleTarget = 1.05
        s.nodding = false
        break
      case 'nodding':
        s.nodding = true
        s.nodPhase = 0
        s.headScaleTarget = 1.07
        break
      case 'writing':
        s.headRotTarget = -1.5
        s.headTargetX = 4
        s.headTargetY = 6 // looking down at notes
        s.headScaleTarget = 1.05
        s.nodding = false
        break
    }
  }, [expression])

  // Update look-away
  useEffect(() => {
    const s = stateRef.current
    if (isLookingAway) {
      s.headTargetX = 12 + Math.random() * 8
      s.headTargetY = 4 + Math.random() * 4
      s.headRotTarget = 3
    } else if (expression === 'neutral') {
      s.headTargetX = 0
      s.headTargetY = 0
      s.headRotTarget = 0
    }
  }, [isLookingAway, expression])

  // Animation loop
  const animate = useCallback((ts: number) => {
    const canvas = canvasRef.current
    const photo = photoRef.current
    if (!canvas || !photo) {
      animRef.current = requestAnimationFrame(animate)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      animRef.current = requestAnimationFrame(animate)
      return
    }

    const s = stateRef.current
    const dt = s.lastTs ? Math.min((ts - s.lastTs) / 1000, 0.05) : 0.016
    s.lastTs = ts
    s.time += dt

    // === BLINK ===
    s.blinkTimer += dt * 1000
    if (s.blinkTimer > s.nextBlink) {
      s.blinkAmount = 1
      s.blinkTimer = 0
      s.nextBlink = 2000 + Math.random() * 4500
      // Sometimes double-blink
      if (Math.random() < 0.2) {
        s.nextBlink = 200
      }
    }
    if (s.blinkAmount > 0) {
      s.blinkAmount = Math.max(0, s.blinkAmount - dt * 7)
    }

    // === LIP SYNC ===
    if (isSpeaking) {
      s.visemeTimer += dt * 1000
      if (s.visemeTimer > 80 + Math.random() * 100) {
        s.visemeTimer = 0
        s.visemeIdx = (s.visemeIdx + 1 + Math.floor(Math.random() * 2)) % SPEECH_VISEMES.length
        s.targetMouth = { ...MOUTH_SHAPES[SPEECH_VISEMES[s.visemeIdx]] }
      }
    } else {
      s.targetMouth = { ...MOUTH_SHAPES.rest }
    }

    // Smooth mouth interpolation
    const mLerp = 1 - Math.pow(0.0005, dt)
    s.currentMouth.openness += (s.targetMouth.openness - s.currentMouth.openness) * mLerp
    s.currentMouth.width += (s.targetMouth.width - s.currentMouth.width) * mLerp
    s.currentMouth.roundness += (s.targetMouth.roundness - s.currentMouth.roundness) * mLerp

    // === HEAD MOVEMENT ===
    const hLerp = 1 - Math.pow(0.02, dt)

    // Nodding
    if (s.nodding) {
      s.nodPhase += dt * 4.5
      s.headOffsetY = Math.sin(s.nodPhase) * 4
      s.headRot = Math.sin(s.nodPhase * 0.5) * 1.5
      if (s.nodPhase > Math.PI * 5) {
        s.nodding = false
        s.headRotTarget = 0
        s.headTargetY = 0
      }
    } else {
      s.headOffsetX += (s.headTargetX - s.headOffsetX) * hLerp
      s.headOffsetY += (s.headTargetY - s.headOffsetY) * hLerp
      s.headRot += (s.headRotTarget - s.headRot) * hLerp
    }

    s.headScale += (s.headScaleTarget - s.headScale) * hLerp

    // Idle micro-sway (makes the person look alive even when still)
    s.idleTimer += dt
    const idleX = s.headOffsetX + Math.sin(s.idleTimer * 0.6) * 1.2 + Math.sin(s.idleTimer * 1.4) * 0.6
    const idleY = s.headOffsetY + Math.sin(s.idleTimer * 0.8) * 0.8 + Math.sin(s.idleTimer * 0.3) * 1.0
    const idleRot = s.headRot + Math.sin(s.idleTimer * 0.5) * 0.4
    const idleScale = s.headScale + Math.sin(s.idleTimer * 1.2) * 0.003 // breathing

    // === RENDER ===
    renderFrame(ctx, photo, canvas.width, canvas.height, {
      blinkAmount: s.blinkAmount,
      mouthShape: s.currentMouth,
      headOffsetX: idleX,
      headOffsetY: idleY,
      headRotation: idleRot,
      headScale: idleScale,
      time: s.time,
      skinSample: skinColorRef.current,
    })

    animRef.current = requestAnimationFrame(animate)
  }, [isSpeaking])

  useEffect(() => {
    if (!photoLoaded) return
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [photoLoaded, animate])

  // Fallback if photo completely fails
  if (photoError) {
    const initials = seed.split(' ').map(n => n[0]).join('').toUpperCase()
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: '#0c0f14' }}
      >
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center text-3xl font-bold text-white"
          style={{ backgroundColor: accentColor + '40', border: `3px solid ${accentColor}60` }}
        >
          {initials}
        </div>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-full"
      style={{ imageRendering: 'auto' }}
    />
  )
}
