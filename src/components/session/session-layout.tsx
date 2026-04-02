'use client'

import { useEffect } from 'react'
import { useSession } from '@/hooks/use-session'
import { TextQuestion } from './text-question'
import { CodeQuestion } from './code-question'
import { DesignQuestion } from './design-question'
import { questionTypeLabel } from '@/lib/utils'
import type { Question } from '@/types'

interface Props {
  screeningId: string
  candidateName: string
  questions: Question[]
}

export function SessionLayout({ screeningId, candidateName, questions }: Props) {
  const { init, currentIndex, next, prev } = useSession()
  const total = questions.length
  const q = questions[currentIndex] ?? null
  const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0

  useEffect(() => {
    init(screeningId, questions)
    // questions reference is stable per RSC render; re-init only if screeningId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screeningId, init])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <span className="text-sm font-semibold text-gray-700">CodeGate Interview</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{candidateName}</span>
          <span className="text-xs text-gray-400">
            Q {currentIndex + 1}/{total}
          </span>
          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-700 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* ── Question ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
        {q ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                Question {currentIndex + 1} of {total}
              </span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{questionTypeLabel(q.type)}</span>
            </div>

            {q.type === 'text' && <TextQuestion question={q} />}
            {q.type === 'code' && (
              <CodeQuestion question={q} screeningId={screeningId} />
            )}
            {q.type === 'system_design' && (
              <DesignQuestion question={q} screeningId={screeningId} />
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-sm text-gray-400">
            No questions found for this session.
          </div>
        )}
      </main>

      {/* ── Navigation ── */}
      <footer className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
        <button
          onClick={prev}
          disabled={currentIndex === 0}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Prev
        </button>
        <span className="text-xs text-gray-400">
          {currentIndex + 1} / {total}
        </span>
        <button
          onClick={next}
          disabled={currentIndex === total - 1}
          className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </footer>
    </div>
  )
}
