import type { Question } from '@/types'
import { QuestionCard } from './question-card'

interface Props {
  questions: Question[]
  showSensitive: boolean
}

export function QuestionList({ questions, showSensitive }: Props) {
  if (questions.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg">
        <p className="text-sm text-gray-400">No questions match the selected filters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {questions.map((q) => (
        <QuestionCard key={q.id} question={q} showSensitive={showSensitive} />
      ))}
    </div>
  )
}
