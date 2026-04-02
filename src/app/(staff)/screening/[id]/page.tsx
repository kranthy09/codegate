import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/config'
import {
  getScreeningById,
  getCandidateById,
  getQuestions,
  getScreeningTypes,
} from '@/lib/sheets/queries'
import { ScreeningLayout } from '@/components/screening/screening-layout'

export default async function ScreeningPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [user, { id }] = await Promise.all([getServerUser(), params])

  if (!user) redirect('/')

  const screening = await getScreeningById(id)
  if (!screening) redirect('/dashboard')

  // Interviewer can only see their assigned screenings
  if (user.role === 'interviewer' && screening.interviewer_id !== user.id) {
    redirect('/dashboard')
  }

  const [questions, candidate, screeningTypes] = await Promise.all([
    getQuestions({
      role_id: screening.role_id,
      screening_type_id: screening.screening_type_id,
    }),
    getCandidateById(screening.candidate_id),
    getScreeningTypes(),
  ])

  const screeningType = screeningTypes.find((t) => t.id === screening.screening_type_id)

  return (
    <ScreeningLayout
      screeningId={id}
      candidateName={candidate?.name ?? 'Candidate'}
      screeningTypeName={screeningType?.name ?? 'Interview'}
      questions={questions}
    />
  )
}
