'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvatarExpression = 'neutral' | 'interested' | 'skeptical' | 'nodding' | 'writing'

export interface AnimatedAvatarProps {
  /** Seed string (character name) for deterministic face generation */
  seed: string
  /** Whether the character is currently speaking */
  isSpeaking: boolean
  /** Current facial expression */
  expression: AvatarExpression
  /** Whether the character is looking away from camera */
  isLookingAway: boolean
  /** Accent color for the character */
  accentColor: string
  /** Canvas width */
  width?: number
  /** Canvas height */
  height?: number
}

// ---------------------------------------------------------------------------
// Deterministic random from seed — produces consistent faces per character
// ---------------------------------------------------------------------------

function seededRandom(seed: string): () => number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  return () => {
    h = (h * 16807 + 0) % 2147483647
    return (h & 0x7fffffff) / 0x7fffffff
  }
}

// ---------------------------------------------------------------------------
// Face generation parameters — derived deterministically from seed
// ---------------------------------------------------------------------------

interface FaceParams {
  skinTone: string
  skinHighlight: string
  skinShadow: string
  hairColor: string
  hairStyle: number // 0-3
  eyeColor: string
  eyeSize: number
  noseWidth: number
  noseLength: number
  lipColor: string
  lipThickness: number
  jawWidth: number
  foreheadHeight: number
  cheekboneWidth: number
  browThickness: number
  browArchHeight: number
  gender: number // 0-1 spectrum
  age: number // 25-60
  hasGlasses: boolean
  glassesStyle: number
}

const SKIN_TONES = [
  { base: '#FDDBB4', hi: '#FEE8D0', sh: '#D4A574' },
  { base: '#F1C27D', hi: '#F8D9A8', sh: '#C4944C' },
  { base: '#E0AC69', hi: '#ECC48D', sh: '#B07A3A' },
  { base: '#C68642', hi: '#D9A366', sh: '#8B5E3C' },
  { base: '#8D5524', hi: '#A97040', sh: '#5C3310' },
  { base: '#6B3E26', hi: '#855433', sh: '#3D2010' },
  { base: '#FFE0BD', hi: '#FFF0DC', sh: '#DDB892' },
  { base: '#D4956A', hi: '#E0AB82', sh: '#A06830' },
]

const EYE_COLORS = ['#4A3728', '#634E3A', '#2E6B4A', '#3B7BAD', '#6B8E9B', '#867256', '#2C4A1E', '#4682B4']
const HAIR_COLORS = ['#1a1a1a', '#3D2314', '#6B3410', '#A0522D', '#D4A76A', '#8B7355', '#2C1608', '#483C32', '#696969']

function generateFaceParams(seed: string): FaceParams {
  const rng = seededRandom(seed)
  const skinIdx = Math.floor(rng() * SKIN_TONES.length)
  const skin = SKIN_TONES[skinIdx]
  const gender = rng()
  const age = 25 + rng() * 35

  return {
    skinTone: skin.base,
    skinHighlight: skin.hi,
    skinShadow: skin.sh,
    hairColor: HAIR_COLORS[Math.floor(rng() * HAIR_COLORS.length)],
    hairStyle: Math.floor(rng() * 4),
    eyeColor: EYE_COLORS[Math.floor(rng() * EYE_COLORS.length)],
    eyeSize: 0.85 + rng() * 0.3,
    noseWidth: 0.8 + rng() * 0.4,
    noseLength: 0.85 + rng() * 0.3,
    lipColor: skinIdx < 4 ? '#C06060' : '#8B4040',
    lipThickness: 0.7 + rng() * 0.6,
    jawWidth: 0.85 + rng() * 0.3,
    foreheadHeight: 0.9 + rng() * 0.2,
    cheekboneWidth: 0.9 + rng() * 0.2,
    browThickness: 1 + rng() * 0.8,
    browArchHeight: 0.8 + rng() * 0.4,
    gender,
    age,
    hasGlasses: rng() > 0.65,
    glassesStyle: Math.floor(rng() * 3),
  }
}

// ---------------------------------------------------------------------------
// Viseme (mouth shape) definitions for lip sync
// ---------------------------------------------------------------------------

type Viseme = 'rest' | 'aa' | 'ee' | 'oo' | 'ch' | 'ff' | 'th' | 'mm'

interface VisemeShape {
  openness: number    // 0-1: how open the mouth is
  width: number       // 0-1: how wide
  roundness: number   // 0-1: how round
  teethShow: number   // 0-1: how much teeth visible
}

const VISEME_SHAPES: Record<Viseme, VisemeShape> = {
  rest:  { openness: 0,    width: 0.5,  roundness: 0,   teethShow: 0 },
  aa:    { openness: 0.8,  width: 0.6,  roundness: 0.3, teethShow: 0.6 },
  ee:    { openness: 0.3,  width: 0.8,  roundness: 0.1, teethShow: 0.7 },
  oo:    { openness: 0.5,  width: 0.3,  roundness: 0.9, teethShow: 0.2 },
  ch:    { openness: 0.2,  width: 0.5,  roundness: 0.2, teethShow: 0.5 },
  ff:    { openness: 0.1,  width: 0.6,  roundness: 0,   teethShow: 0.3 },
  th:    { openness: 0.15, width: 0.5,  roundness: 0,   teethShow: 0.4 },
  mm:    { openness: 0,    width: 0.45, roundness: 0,   teethShow: 0 },
}

// ---------------------------------------------------------------------------
// Canvas Face Renderer
// ---------------------------------------------------------------------------

function drawFace(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  face: FaceParams,
  state: {
    blinkAmount: number        // 0-1 (1 = fully closed)
    mouthViseme: VisemeShape
    eyeOffsetX: number         // -1 to 1
    eyeOffsetY: number         // -1 to 1
    headRotation: number       // degrees
    headTiltX: number          // -1 to 1
    browRaise: number          // -1 to 1 (negative = furrowed)
    smileAmount: number        // 0-1
    time: number               // for subtle animations
  }
) {
  const { blinkAmount, mouthViseme, eyeOffsetX, eyeOffsetY, headRotation, headTiltX, browRaise, smileAmount, time } = state
  ctx.clearRect(0, 0, w, h)

  // Background — dark like a video call room
  ctx.fillStyle = '#0f1218'
  ctx.fillRect(0, 0, w, h)

  // Subtle room lighting gradient behind head
  const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.35, w * 0.1, w * 0.5, h * 0.4, w * 0.6)
  bgGrad.addColorStop(0, '#1a2030')
  bgGrad.addColorStop(1, '#0a0e14')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, w, h)

  ctx.save()

  // Apply head rotation and tilt
  const cx = w * 0.5 + headTiltX * w * 0.02
  const cy = h * 0.42
  ctx.translate(cx, cy)
  ctx.rotate((headRotation * Math.PI) / 180)
  ctx.translate(-cx, -cy)

  // Breathing micro-movement
  const breathe = Math.sin(time * 1.2) * 1.5
  ctx.translate(0, breathe)

  // --- NECK ---
  const neckX = w * 0.5
  const neckY = h * 0.65
  const neckW = w * 0.12
  ctx.fillStyle = face.skinShadow
  ctx.beginPath()
  ctx.moveTo(neckX - neckW, neckY - h * 0.03)
  ctx.lineTo(neckX - neckW * 1.3, h)
  ctx.lineTo(neckX + neckW * 1.3, h)
  ctx.lineTo(neckX + neckW, neckY - h * 0.03)
  ctx.closePath()
  ctx.fill()

  // --- SHOULDERS (shirt/blazer hint) ---
  ctx.fillStyle = '#2a2a3a'
  ctx.beginPath()
  ctx.moveTo(w * 0.15, h)
  ctx.quadraticCurveTo(w * 0.3, h * 0.78, neckX - neckW * 1.1, neckY + h * 0.08)
  ctx.lineTo(neckX + neckW * 1.1, neckY + h * 0.08)
  ctx.quadraticCurveTo(w * 0.7, h * 0.78, w * 0.85, h)
  ctx.lineTo(w * 0.15, h)
  ctx.closePath()
  ctx.fill()

  // Collar/shirt
  ctx.fillStyle = '#e8e8f0'
  ctx.beginPath()
  ctx.moveTo(neckX - neckW * 0.6, neckY + h * 0.04)
  ctx.lineTo(neckX - neckW * 0.1, neckY + h * 0.12)
  ctx.lineTo(neckX, neckY + h * 0.06)
  ctx.lineTo(neckX + neckW * 0.1, neckY + h * 0.12)
  ctx.lineTo(neckX + neckW * 0.6, neckY + h * 0.04)
  ctx.closePath()
  ctx.fill()

  // --- HEAD SHAPE ---
  const headCx = w * 0.5
  const headCy = h * 0.38
  const headRx = w * 0.17 * face.jawWidth
  const headRy = h * 0.24 * face.foreheadHeight
  const jawRx = headRx * 0.92
  const jawRy = headRy * 1.08

  // Head shadow
  ctx.fillStyle = face.skinShadow
  ctx.beginPath()
  ctx.ellipse(headCx + 2, headCy + 2, headRx + 2, headRy + 2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Head base
  const skinGrad = ctx.createRadialGradient(
    headCx - headRx * 0.3, headCy - headRy * 0.3, headRx * 0.1,
    headCx, headCy, headRx * 1.3
  )
  skinGrad.addColorStop(0, face.skinHighlight)
  skinGrad.addColorStop(0.6, face.skinTone)
  skinGrad.addColorStop(1, face.skinShadow)
  ctx.fillStyle = skinGrad
  ctx.beginPath()
  ctx.ellipse(headCx, headCy, headRx, headRy, 0, 0, Math.PI * 2)
  ctx.fill()

  // Jaw definition
  ctx.fillStyle = face.skinTone
  ctx.beginPath()
  ctx.ellipse(headCx, headCy + headRy * 0.15, jawRx, jawRy * 0.85, 0, 0.1, Math.PI - 0.1)
  ctx.fill()

  // Cheekbone highlights
  ctx.fillStyle = face.skinHighlight + '30'
  ctx.beginPath()
  ctx.ellipse(headCx - headRx * 0.55, headCy + headRy * 0.05, headRx * 0.25, headRy * 0.15, -0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(headCx + headRx * 0.55, headCy + headRy * 0.05, headRx * 0.25, headRy * 0.15, 0.2, 0, Math.PI * 2)
  ctx.fill()

  // --- EARS ---
  const earY = headCy + headRy * 0.05
  const earH = headRy * 0.25
  const earW = headRx * 0.15

  // Left ear
  ctx.fillStyle = face.skinTone
  ctx.beginPath()
  ctx.ellipse(headCx - headRx * 0.97, earY, earW, earH, -0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = face.skinShadow + '60'
  ctx.beginPath()
  ctx.ellipse(headCx - headRx * 0.97, earY, earW * 0.6, earH * 0.6, -0.15, 0, Math.PI * 2)
  ctx.fill()

  // Right ear
  ctx.fillStyle = face.skinTone
  ctx.beginPath()
  ctx.ellipse(headCx + headRx * 0.97, earY, earW, earH, 0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = face.skinShadow + '60'
  ctx.beginPath()
  ctx.ellipse(headCx + headRx * 0.97, earY, earW * 0.6, earH * 0.6, 0.15, 0, Math.PI * 2)
  ctx.fill()

  // --- HAIR ---
  drawHair(ctx, face, headCx, headCy, headRx, headRy)

  // --- EYES ---
  const eyeY = headCy - headRy * 0.05
  const eyeSpacing = headRx * 0.5
  const eyeW = headRx * 0.28 * face.eyeSize
  const eyeH = headRy * 0.1 * face.eyeSize

  for (const side of [-1, 1]) {
    const ex = headCx + side * eyeSpacing + eyeOffsetX * eyeW * 0.15
    const ey = eyeY + eyeOffsetY * eyeH * 0.2

    // Eye socket shadow
    ctx.fillStyle = face.skinShadow + '40'
    ctx.beginPath()
    ctx.ellipse(ex, ey - eyeH * 0.1, eyeW * 1.3, eyeH * 1.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // Eyelid crease
    ctx.strokeStyle = face.skinShadow + '50'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.ellipse(ex, ey - eyeH * 0.7, eyeW * 1.05, eyeH * 0.5, 0, Math.PI + 0.3, -0.3)
    ctx.stroke()

    // Eye white (sclera)
    const openH = eyeH * (1 - blinkAmount)
    if (openH > 0.5) {
      ctx.save()
      ctx.beginPath()
      ctx.ellipse(ex, ey, eyeW, openH, 0, 0, Math.PI * 2)
      ctx.clip()

      ctx.fillStyle = '#f5f0eb'
      ctx.beginPath()
      ctx.ellipse(ex, ey, eyeW, eyeH, 0, 0, Math.PI * 2)
      ctx.fill()

      // Iris
      const irisR = eyeW * 0.48
      const irisX = ex + eyeOffsetX * eyeW * 0.2
      const irisY = ey + eyeOffsetY * eyeH * 0.15

      const irisGrad = ctx.createRadialGradient(irisX, irisY, irisR * 0.15, irisX, irisY, irisR)
      irisGrad.addColorStop(0, '#111')
      irisGrad.addColorStop(0.3, face.eyeColor)
      irisGrad.addColorStop(0.85, face.eyeColor)
      irisGrad.addColorStop(1, '#222')
      ctx.fillStyle = irisGrad
      ctx.beginPath()
      ctx.arc(irisX, irisY, irisR, 0, Math.PI * 2)
      ctx.fill()

      // Pupil
      ctx.fillStyle = '#0a0a0a'
      ctx.beginPath()
      ctx.arc(irisX, irisY, irisR * 0.4, 0, Math.PI * 2)
      ctx.fill()

      // Eye shine
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.beginPath()
      ctx.arc(irisX - irisR * 0.25, irisY - irisR * 0.25, irisR * 0.18, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.beginPath()
      ctx.arc(irisX + irisR * 0.2, irisY + irisR * 0.15, irisR * 0.1, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()

      // Eyelid line
      ctx.strokeStyle = face.skinShadow + '90'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.ellipse(ex, ey, eyeW, openH, 0, 0, Math.PI * 2)
      ctx.stroke()

      // Lower eyelash subtle line
      ctx.strokeStyle = face.skinShadow + '40'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.ellipse(ex, ey, eyeW * 0.95, openH * 0.95, 0, 0.2, Math.PI - 0.2)
      ctx.stroke()
    } else {
      // Closed eye — line
      ctx.strokeStyle = face.skinShadow + '80'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(ex - eyeW, ey)
      ctx.quadraticCurveTo(ex, ey + 2, ex + eyeW, ey)
      ctx.stroke()
    }

    // Eyelashes (subtle)
    ctx.strokeStyle = face.hairColor + 'CC'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.ellipse(ex, ey - openH * 0.1, eyeW * 1.02, Math.max(openH * 0.6, 0.5), 0, Math.PI + 0.2, -0.2)
    ctx.stroke()
  }

  // --- EYEBROWS ---
  const browY = eyeY - eyeH * 2.5
  const browLen = eyeW * 1.4
  for (const side of [-1, 1]) {
    const bx = headCx + side * eyeSpacing
    const by = browY - browRaise * headRy * 0.06
    const archY = by - face.browArchHeight * headRy * 0.04

    ctx.strokeStyle = face.hairColor
    ctx.lineWidth = face.browThickness * 2.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    if (side === -1) {
      ctx.moveTo(bx - browLen * 0.5, by + browRaise * 2)
      ctx.quadraticCurveTo(bx, archY, bx + browLen * 0.5, by)
    } else {
      ctx.moveTo(bx - browLen * 0.5, by)
      ctx.quadraticCurveTo(bx, archY, bx + browLen * 0.5, by + browRaise * 2)
    }
    ctx.stroke()
  }

  // --- NOSE ---
  const noseTop = headCy - headRy * 0.05
  const noseBot = headCy + headRy * 0.25 * face.noseLength
  const noseW = headRx * 0.15 * face.noseWidth

  // Nose bridge shadow
  ctx.strokeStyle = face.skinShadow + '35'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(headCx - 1, noseTop)
  ctx.quadraticCurveTo(headCx - 2, (noseTop + noseBot) * 0.5, headCx - noseW * 0.3, noseBot)
  ctx.stroke()

  // Nose tip
  ctx.fillStyle = face.skinHighlight + '25'
  ctx.beginPath()
  ctx.ellipse(headCx, noseBot - noseW * 0.3, noseW * 0.7, noseW * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()

  // Nostrils
  ctx.fillStyle = face.skinShadow + '50'
  ctx.beginPath()
  ctx.ellipse(headCx - noseW * 0.45, noseBot, noseW * 0.22, noseW * 0.15, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(headCx + noseW * 0.45, noseBot, noseW * 0.22, noseW * 0.15, 0.3, 0, Math.PI * 2)
  ctx.fill()

  // --- MOUTH ---
  const mouthY = headCy + headRy * 0.42
  const mouthW = headRx * 0.45 * (0.8 + mouthViseme.width * 0.4)
  const mouthOpen = mouthViseme.openness * headRy * 0.12 * face.lipThickness
  const round = mouthViseme.roundness

  if (mouthOpen > 1) {
    // Open mouth — interior
    ctx.fillStyle = '#3a1520'
    ctx.beginPath()
    if (round > 0.5) {
      ctx.ellipse(headCx, mouthY + mouthOpen * 0.3, mouthW * (0.5 + round * 0.3), mouthOpen * 0.8, 0, 0, Math.PI * 2)
    } else {
      ctx.ellipse(headCx, mouthY + mouthOpen * 0.3, mouthW * 0.85, mouthOpen * 0.7, 0, 0, Math.PI * 2)
    }
    ctx.fill()

    // Teeth (upper)
    if (mouthViseme.teethShow > 0.1) {
      ctx.fillStyle = '#f0ece8'
      ctx.beginPath()
      const teethW = mouthW * 0.7
      const teethH = mouthOpen * 0.3 * mouthViseme.teethShow
      ctx.roundRect(headCx - teethW, mouthY - teethH * 0.2, teethW * 2, teethH, [0, 0, 3, 3])
      ctx.fill()
    }

    // Tongue hint for open vowels
    if (mouthViseme.openness > 0.5) {
      ctx.fillStyle = '#b04050'
      ctx.beginPath()
      ctx.ellipse(headCx, mouthY + mouthOpen * 0.5, mouthW * 0.4, mouthOpen * 0.25, 0, 0, Math.PI)
      ctx.fill()
    }
  }

  // Upper lip
  ctx.fillStyle = face.lipColor
  ctx.beginPath()
  ctx.moveTo(headCx - mouthW, mouthY)
  ctx.quadraticCurveTo(headCx - mouthW * 0.5, mouthY - headRy * 0.04 * face.lipThickness, headCx, mouthY - headRy * 0.02 * face.lipThickness)
  ctx.quadraticCurveTo(headCx + mouthW * 0.5, mouthY - headRy * 0.04 * face.lipThickness, headCx + mouthW, mouthY)
  ctx.quadraticCurveTo(headCx, mouthY + headRy * 0.01, headCx - mouthW, mouthY)
  ctx.fill()

  // Lower lip
  const lowerLipY = mouthY + mouthOpen + headRy * 0.01
  ctx.fillStyle = face.lipColor
  ctx.beginPath()
  ctx.moveTo(headCx - mouthW * 0.9, lowerLipY)
  ctx.quadraticCurveTo(headCx, lowerLipY + headRy * 0.05 * face.lipThickness + smileAmount * 2, headCx + mouthW * 0.9, lowerLipY)
  ctx.quadraticCurveTo(headCx, lowerLipY - headRy * 0.01, headCx - mouthW * 0.9, lowerLipY)
  ctx.fill()

  // Lip shine
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.ellipse(headCx + mouthW * 0.1, lowerLipY + headRy * 0.01, mouthW * 0.3, headRy * 0.015, 0, 0, Math.PI * 2)
  ctx.fill()

  // Smile lines (nasolabial folds)
  if (smileAmount > 0.2 || face.age > 40) {
    const smileDepth = (smileAmount * 0.5 + (face.age > 40 ? 0.3 : 0)) * 0.6
    ctx.strokeStyle = face.skinShadow + Math.round(smileDepth * 80).toString(16).padStart(2, '0')
    ctx.lineWidth = 1.2
    for (const side of [-1, 1]) {
      ctx.beginPath()
      const sx = headCx + side * headRx * 0.45
      ctx.moveTo(sx, headCy + headRy * 0.05)
      ctx.quadraticCurveTo(
        sx + side * headRx * 0.05,
        headCy + headRy * 0.25,
        headCx + side * mouthW * 1.15,
        mouthY + mouthOpen + headRy * 0.03
      )
      ctx.stroke()
    }
  }

  // --- GLASSES ---
  if (face.hasGlasses) {
    drawGlasses(ctx, face, headCx, eyeY, eyeSpacing, eyeW, eyeH)
  }

  // --- FOREHEAD LINES (age) ---
  if (face.age > 35) {
    const lines = face.age > 50 ? 3 : face.age > 40 ? 2 : 1
    ctx.strokeStyle = face.skinShadow + '25'
    ctx.lineWidth = 0.8
    for (let i = 0; i < lines; i++) {
      const ly = headCy - headRy * (0.55 + i * 0.08)
      ctx.beginPath()
      ctx.moveTo(headCx - headRx * 0.4, ly)
      ctx.quadraticCurveTo(headCx, ly - 2, headCx + headRx * 0.4, ly)
      ctx.stroke()
    }
  }

  ctx.restore()

  // --- VIDEO CALL EFFECTS ---
  // Subtle scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.02)'
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1)
  }

  // Slight vignette
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.25, w * 0.5, h * 0.5, w * 0.7)
  vig.addColorStop(0, 'transparent')
  vig.addColorStop(1, 'rgba(0,0,0,0.25)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)

  // Subtle noise (sparse for performance)
  const noisePhase = Math.floor(time * 3) % 5
  ctx.fillStyle = `rgba(255,255,255,0.008)`
  for (let i = 0; i < 40; i++) {
    const nx = ((i * 137 + noisePhase * 43) % w)
    const ny = ((i * 211 + noisePhase * 67) % h)
    ctx.fillRect(nx, ny, 2, 2)
  }
}

// ---------------------------------------------------------------------------
// Hair rendering
// ---------------------------------------------------------------------------

function drawHair(
  ctx: CanvasRenderingContext2D,
  face: FaceParams,
  cx: number,
  cy: number,
  rx: number,
  ry: number
) {
  const hairGrad = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy - ry * 0.5)
  hairGrad.addColorStop(0, face.hairColor)
  hairGrad.addColorStop(0.5, face.hairColor)
  hairGrad.addColorStop(1, face.hairColor + 'CC')

  ctx.fillStyle = hairGrad

  switch (face.hairStyle) {
    case 0: // Short professional
      ctx.beginPath()
      ctx.moveTo(cx - rx * 1.05, cy - ry * 0.15)
      ctx.quadraticCurveTo(cx - rx * 1.1, cy - ry * 0.7, cx - rx * 0.7, cy - ry * 0.95)
      ctx.quadraticCurveTo(cx, cy - ry * 1.15, cx + rx * 0.7, cy - ry * 0.95)
      ctx.quadraticCurveTo(cx + rx * 1.1, cy - ry * 0.7, cx + rx * 1.05, cy - ry * 0.15)
      ctx.quadraticCurveTo(cx + rx * 0.9, cy - ry * 0.5, cx, cy - ry * 0.7)
      ctx.quadraticCurveTo(cx - rx * 0.9, cy - ry * 0.5, cx - rx * 1.05, cy - ry * 0.15)
      ctx.fill()
      break

    case 1: // Side part
      ctx.beginPath()
      ctx.moveTo(cx - rx * 1.08, cy - ry * 0.1)
      ctx.quadraticCurveTo(cx - rx * 1.15, cy - ry * 0.8, cx - rx * 0.5, cy - ry * 1.05)
      ctx.quadraticCurveTo(cx + rx * 0.2, cy - ry * 1.15, cx + rx * 0.8, cy - ry * 0.95)
      ctx.quadraticCurveTo(cx + rx * 1.1, cy - ry * 0.6, cx + rx * 1.05, cy - ry * 0.15)
      ctx.quadraticCurveTo(cx + rx * 0.8, cy - ry * 0.55, cx + rx * 0.1, cy - ry * 0.75)
      ctx.quadraticCurveTo(cx - rx * 0.5, cy - ry * 0.8, cx - rx * 0.9, cy - ry * 0.45)
      ctx.closePath()
      ctx.fill()
      break

    case 2: // Longer/wavy
      ctx.beginPath()
      ctx.moveTo(cx - rx * 1.12, cy + ry * 0.1)
      ctx.quadraticCurveTo(cx - rx * 1.2, cy - ry * 0.6, cx - rx * 0.6, cy - ry * 1.05)
      ctx.quadraticCurveTo(cx, cy - ry * 1.2, cx + rx * 0.6, cy - ry * 1.05)
      ctx.quadraticCurveTo(cx + rx * 1.2, cy - ry * 0.6, cx + rx * 1.12, cy + ry * 0.1)
      ctx.quadraticCurveTo(cx + rx * 0.95, cy - ry * 0.35, cx, cy - ry * 0.65)
      ctx.quadraticCurveTo(cx - rx * 0.95, cy - ry * 0.35, cx - rx * 1.12, cy + ry * 0.1)
      ctx.fill()
      break

    case 3: // Closely cropped / buzz
      ctx.beginPath()
      ctx.moveTo(cx - rx * 1.02, cy - ry * 0.25)
      ctx.quadraticCurveTo(cx - rx * 1.05, cy - ry * 0.7, cx - rx * 0.65, cy - ry * 0.92)
      ctx.quadraticCurveTo(cx, cy - ry * 1.05, cx + rx * 0.65, cy - ry * 0.92)
      ctx.quadraticCurveTo(cx + rx * 1.05, cy - ry * 0.7, cx + rx * 1.02, cy - ry * 0.25)
      ctx.quadraticCurveTo(cx + rx * 0.85, cy - ry * 0.55, cx, cy - ry * 0.72)
      ctx.quadraticCurveTo(cx - rx * 0.85, cy - ry * 0.55, cx - rx * 1.02, cy - ry * 0.25)
      ctx.fill()
      break
  }

  // Hair shine
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.beginPath()
  ctx.ellipse(cx - rx * 0.15, cy - ry * 0.85, rx * 0.35, ry * 0.08, -0.3, 0, Math.PI * 2)
  ctx.fill()
}

// ---------------------------------------------------------------------------
// Glasses rendering
// ---------------------------------------------------------------------------

function drawGlasses(
  ctx: CanvasRenderingContext2D,
  face: FaceParams,
  cx: number,
  eyeY: number,
  eyeSpacing: number,
  eyeW: number,
  eyeH: number
) {
  ctx.strokeStyle = face.glassesStyle === 0 ? '#1a1a1a' : face.glassesStyle === 1 ? '#8B7355' : '#4a4a5a'
  ctx.lineWidth = face.glassesStyle === 0 ? 2.5 : 2

  const glassW = eyeW * 1.8
  const glassH = eyeH * 2.2

  for (const side of [-1, 1]) {
    const gx = cx + side * eyeSpacing
    ctx.beginPath()
    if (face.glassesStyle === 2) {
      // Round
      ctx.arc(gx, eyeY, glassW * 0.7, 0, Math.PI * 2)
    } else {
      // Rectangular with rounded corners
      ctx.roundRect(gx - glassW, eyeY - glassH, glassW * 2, glassH * 2, face.glassesStyle === 0 ? 4 : 8)
    }
    ctx.stroke()

    // Lens reflection
    ctx.fillStyle = 'rgba(200,220,255,0.04)'
    ctx.fill()
  }

  // Bridge
  ctx.beginPath()
  ctx.moveTo(cx - eyeSpacing + glassW, eyeY - glassH * 0.3)
  ctx.quadraticCurveTo(cx, eyeY - glassH * 0.6, cx + eyeSpacing - glassW, eyeY - glassH * 0.3)
  ctx.stroke()

  // Temple arms
  for (const side of [-1, 1]) {
    const gx = cx + side * eyeSpacing
    ctx.beginPath()
    ctx.moveTo(gx + side * glassW, eyeY - glassH * 0.2)
    ctx.lineTo(gx + side * glassW * 1.8, eyeY)
    ctx.stroke()
  }
}

// ---------------------------------------------------------------------------
// Main Animated Avatar Component
// ---------------------------------------------------------------------------

export default function AnimatedAvatar({
  seed,
  isSpeaking,
  expression,
  isLookingAway,
  accentColor,
  width = 400,
  height = 400,
}: AnimatedAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const faceRef = useRef<FaceParams | null>(null)
  const animRef = useRef<number>(0)
  const stateRef = useRef({
    blinkAmount: 0,
    blinkTimer: 0,
    nextBlink: 2000,
    visemeIdx: 0,
    visemeTimer: 0,
    currentViseme: { ...VISEME_SHAPES.rest },
    targetViseme: { ...VISEME_SHAPES.rest },
    eyeTargetX: 0,
    eyeTargetY: 0,
    eyeCurrentX: 0,
    eyeCurrentY: 0,
    eyeMoveTimer: 0,
    headRot: 0,
    headRotTarget: 0,
    headTiltX: 0,
    headTiltXTarget: 0,
    browRaise: 0,
    browRaiseTarget: 0,
    smileAmount: 0,
    smileTarget: 0,
    nodPhase: 0,
    nodding: false,
    time: 0,
    lastTs: 0,
  })

  // Generate face params once per seed
  if (!faceRef.current || seed !== (faceRef.current as FaceParams & { _seed?: string })._seed) {
    const params = generateFaceParams(seed) as FaceParams & { _seed?: string }
    params._seed = seed
    faceRef.current = params
  }

  const [ready, setReady] = useState(false)
  useEffect(() => { setReady(true) }, [])

  // Expression handling
  useEffect(() => {
    const s = stateRef.current
    switch (expression) {
      case 'neutral':
        s.browRaiseTarget = 0
        s.smileTarget = 0
        s.headRotTarget = 0
        s.nodding = false
        break
      case 'interested':
        s.browRaiseTarget = 0.5
        s.smileTarget = 0.3
        s.headRotTarget = 2
        s.nodding = false
        break
      case 'skeptical':
        s.browRaiseTarget = -0.4
        s.smileTarget = 0
        s.headRotTarget = -3
        s.nodding = false
        break
      case 'nodding':
        s.browRaiseTarget = 0.2
        s.smileTarget = 0.2
        s.nodding = true
        s.nodPhase = 0
        break
      case 'writing':
        s.browRaiseTarget = -0.2
        s.smileTarget = 0
        s.headRotTarget = -2
        s.headTiltXTarget = 0.3
        s.nodding = false
        break
    }
  }, [expression])

  // Looking away
  useEffect(() => {
    const s = stateRef.current
    if (isLookingAway) {
      s.eyeTargetX = 0.6 + Math.random() * 0.3
      s.eyeTargetY = 0.3 + Math.random() * 0.3
      s.headTiltXTarget = 0.5
    } else {
      s.eyeTargetX = 0
      s.eyeTargetY = 0
      if (expression !== 'writing') s.headTiltXTarget = 0
    }
  }, [isLookingAway, expression])

  // Animation loop
  const animate = useCallback((ts: number) => {
    const canvas = canvasRef.current
    const face = faceRef.current
    if (!canvas || !face) { animRef.current = requestAnimationFrame(animate); return }

    const ctx = canvas.getContext('2d')
    if (!ctx) { animRef.current = requestAnimationFrame(animate); return }

    const s = stateRef.current
    const dt = s.lastTs ? (ts - s.lastTs) / 1000 : 0.016
    s.lastTs = ts
    s.time += dt

    // --- Blink ---
    s.blinkTimer += dt * 1000
    if (s.blinkTimer > s.nextBlink) {
      s.blinkAmount = 1
      s.blinkTimer = 0
      s.nextBlink = 2500 + Math.random() * 4000
    }
    if (s.blinkAmount > 0) {
      s.blinkAmount -= dt * 8
      if (s.blinkAmount < 0) s.blinkAmount = 0
    }

    // --- Lip sync ---
    if (isSpeaking) {
      s.visemeTimer += dt * 1000
      if (s.visemeTimer > 100 + Math.random() * 80) {
        s.visemeTimer = 0
        const visemes: Viseme[] = ['aa', 'ee', 'oo', 'ch', 'ff', 'mm', 'aa', 'ee', 'th']
        s.visemeIdx = (s.visemeIdx + 1 + Math.floor(Math.random() * 2)) % visemes.length
        const v = VISEME_SHAPES[visemes[s.visemeIdx]]
        s.targetViseme = { ...v }
      }
    } else {
      s.targetViseme = { ...VISEME_SHAPES.rest }
    }

    // Smooth interpolation for mouth
    const mouthLerp = 1 - Math.pow(0.001, dt)
    s.currentViseme.openness += (s.targetViseme.openness - s.currentViseme.openness) * mouthLerp
    s.currentViseme.width += (s.targetViseme.width - s.currentViseme.width) * mouthLerp
    s.currentViseme.roundness += (s.targetViseme.roundness - s.currentViseme.roundness) * mouthLerp
    s.currentViseme.teethShow += (s.targetViseme.teethShow - s.currentViseme.teethShow) * mouthLerp

    // --- Eye movement ---
    s.eyeMoveTimer += dt * 1000
    if (s.eyeMoveTimer > 2000 + Math.random() * 3000) {
      s.eyeMoveTimer = 0
      if (!isLookingAway) {
        s.eyeTargetX = (Math.random() - 0.5) * 0.4
        s.eyeTargetY = (Math.random() - 0.5) * 0.3
      }
    }
    const eyeLerp = 1 - Math.pow(0.01, dt)
    s.eyeCurrentX += (s.eyeTargetX - s.eyeCurrentX) * eyeLerp
    s.eyeCurrentY += (s.eyeTargetY - s.eyeCurrentY) * eyeLerp

    // --- Head ---
    const headLerp = 1 - Math.pow(0.05, dt)
    if (s.nodding) {
      s.nodPhase += dt * 5
      s.headRot = Math.sin(s.nodPhase) * 3
      if (s.nodPhase > Math.PI * 4) {
        s.nodding = false
        s.headRotTarget = 0
      }
    } else {
      s.headRot += (s.headRotTarget - s.headRot) * headLerp
    }
    s.headTiltX += (s.headTiltXTarget - s.headTiltX) * headLerp
    s.browRaise += (s.browRaiseTarget - s.browRaise) * headLerp
    s.smileAmount += (s.smileTarget - s.smileAmount) * headLerp

    // Idle micro-sway
    const idleRotation = s.headRot + Math.sin(s.time * 0.7) * 0.5 + Math.sin(s.time * 1.3) * 0.3

    // --- Draw ---
    drawFace(ctx, canvas.width, canvas.height, face, {
      blinkAmount: s.blinkAmount,
      mouthViseme: s.currentViseme,
      eyeOffsetX: s.eyeCurrentX,
      eyeOffsetY: s.eyeCurrentY,
      headRotation: idleRotation,
      headTiltX: s.headTiltX,
      browRaise: s.browRaise,
      smileAmount: s.smileAmount,
      time: s.time,
    })

    animRef.current = requestAnimationFrame(animate)
  }, [isSpeaking, isLookingAway])

  useEffect(() => {
    if (!ready) return
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [ready, animate])

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
