import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/config'
import { requireRole } from '@/lib/utils'
import {
  getScreeningById,
  getQuestions,
  getCandidateById,
  getResponsesByScreeningId,
  getCodeSubmissions,
  getLatestDrawing,
  getRoles,
  getScreeningTypes,
} from '@/lib/sheets/queries'
import { ReviewClient } from './review-client'

export const revalidate = 0 // No cache — real-time review data

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReviewPage({ params }: Props) {
  const user = await getServerUser()
  requireRole(user, ['admin', 'manager', 'interviewer'])

  const { id: screeningId } = await params

  // Fetch all required data
  const screening = await getScreeningById(screeningId)
  if (!screening) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-600">Screening not found</p>
      </div>
    )
  }

  // RBAC: interviewer can only review their own screenings
  if (user.role === 'interviewer' && screening.interviewer_id !== user.id) {
    redirect('/')
  }

  // Fetch candidate, questions, responses
  const [candidate, questions, responses, allRoles, allScreeningTypes] = await Promise.all([
    getCandidateById(screening.candidate_id),
    getQuestions({
      role_id: screening.role_id,
      screening_type_id: screening.screening_type_id,
    }),
    getResponsesByScreeningId(screeningId),
    getRoles(),
    getScreeningTypes(),
  ])

  if (!candidate) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-600">Candidate not found</p>
      </div>
    )
  }

  // Fetch code submissions
  const submissions = await getCodeSubmissions(screeningId)
  const submissionsMap = new Map(submissions.map((s) => [s.question_id, s]))

  // Fetch drawings (one per question)
  const drawingsMap = new Map()
  for (const question of questions) {
    if (question.type === 'system_design') {
      const drawing = await getLatestDrawing(screeningId, question.id)
      if (drawing) {
        drawingsMap.set(question.id, drawing)
      }
    }
  }

  // Get friendly names
  const roleName = allRoles.find((r) => r.id === screening.role_id)?.name ?? 'Unknown'
  const screeningTypeName = allScreeningTypes.find(
    (st) => st.id === screening.screening_type_id,
  )?.name ?? 'Unknown'

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <ReviewClient
          screening={screening}
          candidate={candidate}
          questions={questions}
          responses={responses}
          submissions={submissionsMap}
          drawings={drawingsMap}
          roleName={roleName}
          screeningTypeName={screeningTypeName}
        />
      </div>
    </div>
  )
}
