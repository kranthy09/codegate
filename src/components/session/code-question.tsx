'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useSession } from '@/hooks/use-session'
import { SUPPORTED_LANGUAGES } from '@/lib/utils'
import type { Question, ExecResult } from '@/types'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface Props {
  question: Question
  screeningId: string
}

export function CodeQuestion({ question, screeningId }: Props) {
  const { code, language, execResult, setCode, setLanguage, setExecResult } = useSession()
  const qCode = code[question.id] ?? question.starter_code ?? ''
  const qLang = language[question.id] ?? question.language ?? 'python'
  const qResult = execResult[question.id] ?? null

  const [stdin, setStdin] = useState('')
  const [running, setRunning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  async function handleRun() {
    setRunning(true)
    setRunError(null)
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: qLang, code: qCode, stdin }),
      })
      if (!res.ok) {
        setRunError('Execution service unavailable')
        return
      }
      const result = await res.json() as ExecResult
      setExecResult(question.id, result)
    } catch {
      setRunError('Network error')
    } finally {
      setRunning(false)
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await fetch('/api/code-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screening_id: screeningId,
          question_id: question.id,
          language: qLang,
          code: qCode,
          stdout: qResult?.stdout ?? '',
          stderr: qResult?.stderr ?? '',
          exit_code: qResult?.exit_code ?? 0,
        }),
      })
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 2500)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-base text-gray-800 leading-relaxed">{question.text}</p>

      {/* Language selector */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-500 shrink-0">Language</label>
        <select
          value={qLang}
          onChange={(e) => setLanguage(question.id, e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      {/* Monaco Editor */}
      <div className="border border-gray-200 rounded-lg overflow-hidden h-72">
        <MonacoEditor
          language={qLang}
          value={qCode}
          onChange={(v) => setCode(question.id, v ?? '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            lineNumbersMinChars: 3,
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>

      {/* Stdin + actions */}
      <textarea
        value={stdin}
        onChange={(e) => setStdin(e.target.value)}
        placeholder="stdin (optional)"
        rows={2}
        className="w-full text-xs font-mono border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder:text-gray-300"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={() => void handleRun()}
          disabled={running}
          className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {running ? 'Running…' : '▶ Run'}
        </button>
        <button
          onClick={() => void handleSubmit()}
          disabled={submitting || submitted}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {submitted ? 'Submitted ✓' : submitting ? 'Submitting…' : 'Submit Code'}
        </button>
        {runError && <span className="text-xs text-red-500">{runError}</span>}
      </div>

      {/* Output pane */}
      {qResult && (
        <div className="bg-gray-950 text-gray-100 rounded-lg p-3 font-mono text-xs space-y-1">
          {qResult.stdout && (
            <pre className="whitespace-pre-wrap break-all">{qResult.stdout}</pre>
          )}
          {qResult.stderr && (
            <pre className="whitespace-pre-wrap break-all text-red-300">{qResult.stderr}</pre>
          )}
          <p className="text-gray-500 pt-1">exit: {qResult.exit_code}</p>
        </div>
      )}
    </div>
  )
}
