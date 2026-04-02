import type { Question } from '@/types'

interface Props {
  question: Question
}

export function TextQuestion({ question }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-base text-gray-800 leading-relaxed">{question.text}</p>
      <p className="text-sm text-gray-400 italic">Answer verbally — no text input required.</p>
    </div>
  )
}
