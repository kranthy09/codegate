import { difficultyColor, questionTypeLabel } from '@/lib/utils'
import { ScoreInput } from './score-input'
import type { Question } from '@/types'

interface Props {
  question: Question
}

export function QuestionPanel({ question }: Props) {
  return (
    <div className="space-y-4">
      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          {questionTypeLabel(question.type)}
        </span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${difficultyColor(question.difficulty)}`}
        >
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

      {/* Question text */}
      <p className="text-sm text-gray-800 leading-relaxed">{question.text}</p>

      {/* Rubric — always visible to interviewer */}
      {question.rubric && (
        <div className="space-y-1 border-l-2 border-gray-100 pl-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Rubric
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{question.rubric}</p>
        </div>
      )}

      {/* Expected answer */}
      {question.expected_answer && (
        <div className="space-y-1 border-l-2 border-gray-100 pl-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Expected Answer
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {question.expected_answer}
          </p>
        </div>
      )}

      <hr className="border-gray-100" />

      {/* Scoring */}
      <ScoreInput questionId={question.id} />
    </div>
  )
}
