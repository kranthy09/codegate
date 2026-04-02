'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useCallback } from 'react'
import type { CodeSubmission } from '@/types'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface Props {
  screeningId: string
  questionId: string
}

export function CodeViewer({ screeningId, questionId }: Props) {
  const [latest, setLatest] = useState<CodeSubmission | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/code-submissions?screening_id=${screeningId}&question_id=${questionId}`,
      )
      if (res.ok) {
        const data = await res.json() as CodeSubmission[]
        // getCodeSubmissions returns sorted desc — [0] is latest
        setLatest(data[0] ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [screeningId, questionId])

  // Initial load + poll every 15s
  useEffect(() => {
    void refresh()
    const interval = setInterval(() => void refresh(), 15_000)
    return () => clearInterval(interval)
  }, [refresh])

  if (loading && !latest) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-gray-400 animate-pulse">
        Loading…
      </div>
    )
  }

  if (!latest) {
    return (
      <div className="h-48 flex items-center justify-center border border-dashed border-gray-200 rounded-lg text-sm text-gray-400">
        No submission yet — polling every 15s
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-gray-500">{latest.language}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Submitted {new Date(latest.submitted_at).toLocaleTimeString()}
          </span>
          <button
            onClick={() => void refresh()}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden h-56">
        <MonacoEditor
          language={latest.language}
          value={latest.code}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            scrollBeyondLastLine: false,
            lineNumbersMinChars: 3,
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>

      {(latest.stdout || latest.stderr) && (
        <div className="bg-gray-950 text-gray-100 rounded-lg p-3 font-mono text-xs space-y-1">
          {latest.stdout && (
            <pre className="whitespace-pre-wrap break-all">{latest.stdout}</pre>
          )}
          {latest.stderr && (
            <pre className="whitespace-pre-wrap break-all text-red-300">
              {latest.stderr}
            </pre>
          )}
          <p className="text-gray-500 pt-1">exit: {latest.exit_code}</p>
        </div>
      )}
    </div>
  )
}
