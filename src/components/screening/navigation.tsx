'use client'

import { useScreening } from '@/hooks/use-screening'

export function Navigation() {
  const { currentIndex, questions, prev, next } = useScreening()
  const total = questions.length

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={prev}
        disabled={currentIndex === 0}
        className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ← Prev
      </button>
      <span className="text-xs text-gray-400 tabular-nums">
        {currentIndex + 1} / {total}
      </span>
      <button
        onClick={next}
        disabled={currentIndex === total - 1}
        className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next →
      </button>
    </div>
  )
}
