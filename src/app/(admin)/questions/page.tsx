import { Suspense } from 'react'
import { unstable_cache } from 'next/cache'
import { getServerUser } from '@/lib/auth/config'
import { getRoles, getScreeningTypes, getQuestions } from '@/lib/sheets/queries'
import { QuestionFilter } from '@/components/questions/question-filter'
import { QuestionList } from '@/components/questions/question-list'
import type { Question, QuestionFilters } from '@/types'

// Cache all question-bank data for 60s — one Sheets round-trip per minute
const getCachedData = unstable_cache(
  async () => Promise.all([getRoles(), getScreeningTypes(), getQuestions()]),
  ['questions-page-data'],
  { revalidate: 60 },
)

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

function filterQuestions(questions: Question[], filters: QuestionFilters): Question[] {
  let result = questions
  if (filters.role_id)            result = result.filter((q) => q.role_id === filters.role_id)
  if (filters.screening_type_id)  result = result.filter((q) => q.screening_type_id === filters.screening_type_id)
  if (filters.type)               result = result.filter((q) => q.type === filters.type)
  if (filters.difficulty)         result = result.filter((q) => q.difficulty === filters.difficulty)
  return result
}

export default async function QuestionsAdminPage({ searchParams }: PageProps) {
  const [user, params] = await Promise.all([getServerUser(), searchParams])

  // Admin questions page: only staff can reach this page (layout guard).
  // showSensitive is always true here; kept generic for future reuse.
  const showSensitive = user?.role !== 'interviewee'

  const filters: QuestionFilters = {
    role_id:           params.role_id,
    screening_type_id: params.screening_type_id,
    type:              params.type as QuestionFilters['type'],
    difficulty:        params.difficulty as QuestionFilters['difficulty'],
  }

  const [roles, screeningTypes, allQuestions] = await getCachedData()
  const questions = filterQuestions(allQuestions, filters)

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Question Bank</h1>
        <span className="text-sm text-gray-400">
          {questions.length} question{questions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/*
        QuestionFilter uses useSearchParams() — must be wrapped in Suspense.
        The fallback shows the same layout skeleton so filters appear instantly.
      */}
      <Suspense
        fallback={
          <div className="flex flex-wrap gap-3 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-36 bg-gray-100 rounded-md animate-pulse" />
            ))}
          </div>
        }
      >
        <QuestionFilter roles={roles} screeningTypes={screeningTypes} />
      </Suspense>

      <QuestionList questions={questions} showSensitive={showSensitive} />
    </main>
  )
}
