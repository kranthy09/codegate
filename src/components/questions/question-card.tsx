import type { Question } from '@/types'
import { difficultyColor, questionTypeLabel } from '@/lib/utils'

interface Props {
  question: Question
  showSensitive: boolean
}

const TYPE_BADGE: Record<Question['type'], string> = {
  text:          'bg-blue-50 text-blue-700',
  code:          'bg-purple-50 text-purple-700',
  system_design: 'bg-teal-50 text-teal-700',
}

export function QuestionCard({ question, showSensitive }: Props) {
  const starterLines = question.starter_code?.split('\n').slice(0, 8).join('\n')

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-4 space-y-3">
      {/* ── Badges ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_BADGE[question.type]}`}>
          {questionTypeLabel(question.type)}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${difficultyColor(question.difficulty)}`}>
          {question.difficulty}
        </span>
        {question.category && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {question.category}
          </span>
        )}
        {question.language && (
          <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
            {question.language}
          </span>
        )}
      </div>

      {/* ── Question text ── */}
      <p className="text-sm text-gray-800 leading-relaxed">{question.text}</p>

      {/* ── Code preview — first 8 lines of starter_code (no Monaco, avoids SSR) ── */}
      {question.type === 'code' && starterLines && (
        <pre className="text-xs bg-gray-950 text-gray-100 rounded-md p-3 overflow-x-auto font-mono leading-5 select-none">
          {starterLines}
        </pre>
      )}

      {/* ── Staff-only expandable: rubric + expected answer ── */}
      {showSensitive && (question.rubric || question.expected_answer) && (
        <details className="text-sm group">
          <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">›</span>
            Rubric &amp; expected answer
          </summary>
          <div className="mt-2 space-y-3 pl-3 border-l-2 border-gray-100">
            {question.rubric && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Rubric</p>
                <p className="text-gray-700 whitespace-pre-wrap text-sm">{question.rubric}</p>
              </div>
            )}
            {question.expected_answer && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Expected Answer</p>
                <p className="text-gray-700 whitespace-pre-wrap text-sm">{question.expected_answer}</p>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  )
}
