'use client'

import dynamic from 'next/dynamic'
import type { CodeSubmission } from '@/types'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface Props {
  submission: CodeSubmission
  score: number
  notes: string
}

/**
 * Read-only display of a code submission during the review phase.
 * Shows the submitted code in Monaco and the execution output.
 */
export function CodeReviewCard({ submission, score, notes }: Props) {
  const scoreLabel = ['', 'Poor', 'Below Avg', 'Average', 'Good', 'Excellent'][score] ?? ''

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-gray-600">{submission.language}</span>
        <span className="text-gray-500">
          Submitted {new Date(submission.submitted_at).toLocaleTimeString()}
        </span>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden h-56">
        <MonacoEditor
          language={submission.language}
          value={submission.code}
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

      {(submission.stdout || submission.stderr) && (
        <div className="bg-gray-950 text-gray-100 rounded-lg p-3 font-mono text-xs space-y-1">
          {submission.stdout && (
            <pre className="whitespace-pre-wrap break-all">{submission.stdout}</pre>
          )}
          {submission.stderr && (
            <pre className="whitespace-pre-wrap break-all text-red-300">
              {submission.stderr}
            </pre>
          )}
          <p className="text-gray-500 pt-1">exit: {submission.exit_code}</p>
        </div>
      )}

      <div className="border-t border-gray-200 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700">Score</span>
          <span className="inline-flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{score}/5</span>
            <span className="text-xs text-gray-500">{scoreLabel}</span>
          </span>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes || '—'}</p>
        </div>
      </div>
    </div>
  )
}
