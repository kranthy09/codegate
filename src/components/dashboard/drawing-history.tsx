'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { SystemDesignAnswer } from '@/types'
import type { ComponentProps } from '@excalidraw/excalidraw'

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((m) => m.Excalidraw),
  { ssr: false },
)

interface Props {
  drawing: SystemDesignAnswer
}

/**
 * Display system design drawing in read-only format.
 * Shows the Excalidraw canvas with saved drawing.
 */
export function DrawingHistory({ drawing }: Props) {
  const initialData = useMemo(() => {
    try {
      return JSON.parse(drawing.excalidraw_json) as ComponentProps<typeof Excalidraw>['initialData']
    } catch {
      return undefined
    }
  }, [drawing.excalidraw_json])

  return (
    <div className="space-y-3">
      {/* Drawing Canvas */}
      <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: 400 }}>
        <Excalidraw
          initialData={initialData}
          options={{
            viewModeEnabled: true,
            skipVersionFallback: true,
          }}
          onChange={() => {
            // Read-only — no-op
          }}
          onPointerUpdate={() => {
            // Read-only — no-op
          }}
        />
      </div>

      {/* Submission Metadata */}
      <div className="text-xs text-gray-600">
        Submitted {new Date(drawing.submitted_at).toLocaleString()}
      </div>
    </div>
  )
}
