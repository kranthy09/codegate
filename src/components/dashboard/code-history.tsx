'use client'

import dynamic from 'next/dynamic'
import type { CodeAnswer } from '@/types'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface Props {
  submission: CodeAnswer
}

/**
 * Display code submission in read-only format.
 * Shows the submitted code with execution output.
 */
export function CodeHistory({ submission }: Props) {
  const hasOutput = submission.stdout || submission.stderr

  return (
    <div className="space-y-3">
      {/* Code Editor */}
      <div className="border border-gray-200 rounded-lg overflow-hidden h-56">
        <MonacoEditor
          language={submission.language.toLowerCase()}
          value={submission.code}
          theme="vs-light"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 12,
          }}
        />
      </div>

      {/* Execution Output */}
      {hasOutput && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">Output</p>
          <div className="bg-gray-950 text-gray-100 rounded-lg p-3 font-mono text-xs space-y-1 max-h-32 overflow-y-auto">
            {submission.stdout && (
              <div>
                <span className="text-green-400">stdout:</span>
                <pre className="whitespace-pre-wrap break-words text-gray-100">{submission.stdout}</pre>
              </div>
            )}
            {submission.stderr && (
              <div>
                <span className="text-red-400">stderr:</span>
                <pre className="whitespace-pre-wrap break-words text-gray-100">{submission.stderr}</pre>
              </div>
            )}
            <div>
              <span className="text-blue-400">exit:</span> {submission.exit_code}
            </div>
          </div>
        </div>
      )}

      {/* Submission Metadata */}
      <div className="text-xs text-gray-600">
        <span className="font-medium">{submission.language}</span> •{' '}
        {new Date(submission.submitted_at).toLocaleString()}
      </div>
    </div>
  )
}
