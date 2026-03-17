'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface MomentSegment {
  startMs: number
  endMs: number
  quality: string
  note: string
  transcript?: string
  coachingNote?: string
}

export default function DebriefClient({
  momentMap,
  totalDurationMs,
}: {
  momentMap: MomentSegment[]
  totalDurationMs: number
}) {
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null)

  if (momentMap.length === 0) return null

  function formatTime(ms: number) {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="rounded-2xl bg-[#292929] p-5">
      <h3 className="text-sm font-medium text-white mb-4">Moment Map</h3>
      <p className="text-xs text-gray-500 mb-3">Click any segment to see details</p>

      {/* Clickable bar */}
      <div className="flex h-8 rounded-lg overflow-hidden gap-px">
        {momentMap.map((segment, i) => {
          const width = totalDurationMs > 0
            ? ((segment.endMs - segment.startMs) / totalDurationMs) * 100
            : 100 / momentMap.length
          const color = segment.quality === 'strong' ? 'bg-emerald-500'
            : segment.quality === 'recoverable' ? 'bg-yellow-500'
            : 'bg-red-500'
          const isActive = selectedSegment === i
          return (
            <button
              key={i}
              onClick={() => setSelectedSegment(isActive ? null : i)}
              className={`${color} transition-all cursor-pointer relative ${
                isActive ? 'opacity-100 ring-2 ring-white ring-offset-1 ring-offset-[#292929]' : 'hover:opacity-80'
              }`}
              style={{ width: `${Math.max(width, 2)}%` }}
              title={segment.note}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Strong</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Recoverable</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Dropped</span>
      </div>

      {/* Detail panel for clicked segment (spec 7.3) */}
      {selectedSegment !== null && momentMap[selectedSegment] && (
        <div className="mt-4 rounded-xl bg-[#1b1b1b] border border-[#333] p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                momentMap[selectedSegment].quality === 'strong' ? 'bg-emerald-900/30 text-emerald-400' :
                momentMap[selectedSegment].quality === 'recoverable' ? 'bg-yellow-900/30 text-yellow-400' :
                'bg-red-900/30 text-red-400'
              }`}>
                {momentMap[selectedSegment].quality}
              </span>
              <span className="ml-2 text-xs text-gray-500">
                {formatTime(momentMap[selectedSegment].startMs)} &ndash; {formatTime(momentMap[selectedSegment].endMs)}
              </span>
            </div>
            <button onClick={() => setSelectedSegment(null)} className="text-gray-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm text-gray-300 mb-2">{momentMap[selectedSegment].note}</p>

          {momentMap[selectedSegment].transcript && (
            <div className="mt-3 border-t border-[#333] pt-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Transcript</p>
              <p className="text-sm text-gray-400">{momentMap[selectedSegment].transcript}</p>
            </div>
          )}

          {momentMap[selectedSegment].coachingNote && (
            <div className="mt-3 border-t border-[#333] pt-3">
              <p className="text-xs text-[#5b5fc7] uppercase tracking-wider mb-1">Coaching Note</p>
              <p className="text-sm text-gray-300">{momentMap[selectedSegment].coachingNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
