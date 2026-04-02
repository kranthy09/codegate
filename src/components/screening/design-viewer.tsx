'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useCallback } from 'react'
import type { ComponentProps } from 'react'
import type { Excalidraw as ExcalidrawStatic } from '@excalidraw/excalidraw'
import type { Drawing } from '@/types'

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((m) => m.Excalidraw),
  { ssr: false },
)

// Derive the initialData type from the component's own props — no internal imports needed
type InitialData = ComponentProps<typeof ExcalidrawStatic>['initialData']

interface Props {
  screeningId: string
  questionId: string
}

export function DesignViewer({ screeningId, questionId }: Props) {
  const [drawing, setDrawing] = useState<Drawing | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/drawings?screening_id=${screeningId}&question_id=${questionId}`,
      )
      if (res.ok) {
        const data = await res.json() as Drawing | null
        setDrawing(data)
      }
    } finally {
      setLoading(false)
    }
  }, [screeningId, questionId])

  // Initial load + poll every 30s
  useEffect(() => {
    void refresh()
    const interval = setInterval(() => void refresh(), 30_000)
    return () => clearInterval(interval)
  }, [refresh])

  const initialData: InitialData = (() => {
    if (!drawing?.excalidraw_json) return undefined
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return JSON.parse(drawing.excalidraw_json) as InitialData
    } catch {
      return undefined
    }
  })()

  if (loading && !drawing) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-gray-400 animate-pulse">
        Loading…
      </div>
    )
  }

  if (!drawing) {
    return (
      <div className="h-64 flex items-center justify-center border border-dashed border-gray-200 rounded-lg text-sm text-gray-400">
        No drawing yet — polling every 30s
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Last saved {new Date(drawing.submitted_at).toLocaleTimeString()}
        </span>
        <button
          onClick={() => void refresh()}
          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          ↺ Refresh
        </button>
      </div>

      <div
        className="border border-gray-200 rounded-lg overflow-hidden"
        style={{ height: 400 }}
      >
        <Excalidraw initialData={initialData} viewModeEnabled />
      </div>
    </div>
  )
}
