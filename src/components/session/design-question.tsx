'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { Question } from '@/types'

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((m) => m.Excalidraw),
  { ssr: false },
)

// Minimal surface of the Excalidraw imperative API we use
type ExcalidrawAPI = {
  getSceneElements: () => readonly Record<string, unknown>[]
  getAppState: () => Record<string, unknown>
  getFiles: () => Record<string, unknown>
}

interface Props {
  question: Question
  screeningId: string
}

export function DesignQuestion({ question, screeningId }: Props) {
  const apiRef = useRef<ExcalidrawAPI | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const save = useCallback(async () => {
    const api = apiRef.current
    if (!api) return
    setSaving(true)
    try {
      const elements = api.getSceneElements()
      const appState = api.getAppState()
      const files = api.getFiles()
      const excalidraw_json = JSON.stringify({ elements, appState, files })
      await fetch('/api/drawings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screening_id: screeningId,
          question_id: question.id,
          excalidraw_json,
        }),
      })
      setLastSaved(new Date())
    } finally {
      setSaving(false)
    }
  }, [screeningId, question.id])

  // Auto-save every 30s
  useEffect(() => {
    const interval = setInterval(() => void save(), 30_000)
    return () => clearInterval(interval)
  }, [save])

  return (
    <div className="space-y-3">
      <p className="text-base text-gray-800 leading-relaxed">{question.text}</p>

      <div
        className="border border-gray-200 rounded-lg overflow-hidden"
        style={{ height: 480 }}
      >
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api as ExcalidrawAPI
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Now'}
        </button>
        <span className="text-xs text-gray-400">
          {lastSaved
            ? `Saved at ${lastSaved.toLocaleTimeString()}`
            : 'Auto-saves every 30s'}
        </span>
      </div>
    </div>
  )
}
