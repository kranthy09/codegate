'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { Excalidraw as ExcalidrawStatic } from '@excalidraw/excalidraw'
import type { Drawing } from '@/types'

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((m) => m.Excalidraw),
  { ssr: false },
)

type InitialData = ComponentProps<typeof ExcalidrawStatic>['initialData']

interface Props {
  drawing: Drawing
  score: number
  notes: string
}

/**
 * Read-only display of a system design drawing during the review phase.
 * Shows the submitted Excalidraw drawing in view-only mode.
 */
export function DesignReviewCard({ drawing, score, notes }: Props) {
  const scoreLabel = ['', 'Poor', 'Below Avg', 'Average', 'Good', 'Excellent'][score] ?? ''

  const initialData: InitialData = (() => {
    if (!drawing.excalidraw_json) return undefined
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return JSON.parse(drawing.excalidraw_json) as InitialData
    } catch {
      return undefined
    }
  })()

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500">
        Saved {new Date(drawing.submitted_at).toLocaleTimeString()}
      </div>

      <div
        className="border border-gray-200 rounded-lg overflow-hidden"
        style={{ height: 400 }}
      >
        <Excalidraw initialData={initialData} viewModeEnabled />
      </div>

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
