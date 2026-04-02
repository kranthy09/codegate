'use client'

import { useEffect } from 'react'
import { useScreening } from '@/hooks/use-screening'
import { SessionHeader } from './session-header'
import { QuestionPanel } from './question-panel'
import { CodeViewer } from './code-viewer'
import { DesignViewer } from './design-viewer'
import { Navigation } from './navigation'
import type { Question } from '@/types'

interface Props {
  screeningId: string
  candidateName: string
  screeningTypeName: string
  questions: Question[]
}

export function ScreeningLayout({
  screeningId,
  candidateName,
  screeningTypeName,
  questions,
}: Props) {
  const { init, currentIndex } = useScreening()
  const total = questions.length
  const q = questions[currentIndex] ?? null

  useEffect(() => {
    init(screeningId, candidateName, questions)
    // Re-init only when screeningId changes (different session)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screeningId, init])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ── */}
      <SessionHeader
        candidateName={candidateName}
        screeningTypeName={screeningTypeName}
        currentIndex={currentIndex}
        total={total}
      />

      {/* ── Two-column body ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 max-w-7xl w-full mx-auto">

        {/* Left — Question + rubric + scoring */}
        <div className="p-6 overflow-y-auto">
          {q ? (
            <QuestionPanel question={q} />
          ) : (
            <p className="text-sm text-gray-400">No questions in this session.</p>
          )}
        </div>

        {/* Right — Candidate activity (code / design / nothing for text) */}
        <div className="p-6 overflow-y-auto">
          {q?.type === 'code' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                Candidate Activity
              </p>
              <CodeViewer screeningId={screeningId} questionId={q.id} />
            </div>
          )}

          {q?.type === 'system_design' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                Candidate Drawing
              </p>
              <DesignViewer screeningId={screeningId} questionId={q.id} />
            </div>
          )}

          {q?.type === 'text' && (
            <div className="flex items-center justify-center h-full min-h-48">
              <p className="text-sm text-gray-400 text-center">
                Verbal question — listen and score on the left panel.
              </p>
            </div>
          )}

          {!q && (
            <div className="flex items-center justify-center h-full min-h-48">
              <p className="text-sm text-gray-400">—</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      <footer className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <Navigation />
        </div>
      </footer>
    </div>
  )
}
