import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/config'
import { getScreeningById, getCandidateById, getQuestions } from '@/lib/sheets/queries'
import { SessionLayout } from '@/components/session/session-layout'

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [user, { id }] = await Promise.all([getServerUser(), params])

  if (!user || user.role !== 'interviewee') redirect('/')

  const screening = await getScreeningById(id)
  if (!screening || screening.candidate_id !== user.id) redirect('/')

  const [questions, candidate] = await Promise.all([
    getQuestions({
      role_id: screening.role_id,
      screening_type_id: screening.screening_type_id,
    }),
    getCandidateById(screening.candidate_id),
  ])

  // Strip sensitive fields — interviewee never sees rubric / expected_answer
  const safeQuestions = questions.map(({ rubric: _r, expected_answer: _e, ...q }) => ({
    ...q,
    rubric: null,
    expected_answer: null,
  }))

  return (
    <SessionLayout
      screeningId={id}
      candidateName={candidate?.name ?? user.name}
      questions={safeQuestions}
    />
  )
}
