// ─── Roles ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'interviewer' | 'interviewee'

// Ordered hierarchy — higher index = higher privilege
export const ROLE_ORDER: UserRole[] = ['interviewee', 'interviewer', 'manager', 'admin']

// ─── Session ──────────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  // Present only for interviewee — enforced scoping
  role_id?: string
  screening_type_id?: string
  difficulty?: Question['difficulty']
}

// ─── Domain Types ────────────────────────────────────────────────────────────

export interface Role {
  id: string
  name: string
  description: string
}

export interface ScreeningType {
  id: string
  name: string
  stage_order: number
}

export interface Question {
  id: string
  role_id: string
  screening_type_id: string
  type: 'text' | 'code' | 'system_design'
  text: string
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
  rubric: string | null           // staff only
  expected_answer: string | null  // staff only
  starter_code: string | null     // code questions
  language: string | null         // code questions default language
  active: boolean
}

// Question without sensitive fields (sent to interviewee)
export type PublicQuestion = Omit<Question, 'rubric' | 'expected_answer'>

export interface Candidate {
  id: string
  name: string
  email: string
  applied_role_id: string
  created_at: string
  status: 'active' | 'hired' | 'rejected' | 'hold'
}

export interface Screening {
  id: string
  candidate_id: string
  role_id: string
  screening_type_id: string
  interviewer_id: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_at: string
  completed_at: string | null
  overall_score: number | null
  recommendation: Recommendation | null
  notes: string | null
}

export interface Response {
  id: string
  screening_id: string
  question_id: string
  question_type: Question['type']
  score: number
  notes: string
  submitted_at: string
}

export interface CodeSubmission {
  id: string
  screening_id: string
  question_id: string
  candidate_id: string
  language: string
  code: string
  stdout: string
  stderr: string
  exit_code: number
  submitted_at: string
}

export interface Drawing {
  id: string
  screening_id: string
  question_id: string
  candidate_id: string
  excalidraw_json: string  // JSON string or Vercel Blob URL if large
  submitted_at: string
}

// ─── Question Answers (with scores) ────────────────────────────────────────

export interface TextAnswer {
  question_id: string
  question_type: 'text'
  question_text: string
  score: number
  notes: string
  submitted_at: string
}

export interface CodeAnswer {
  question_id: string
  question_type: 'code'
  question_text: string
  language: string
  code: string
  stdout: string
  stderr: string
  exit_code: number
  score: number
  notes: string
  submitted_at: string
}

export interface SystemDesignAnswer {
  question_id: string
  question_type: 'system_design'
  question_text: string
  excalidraw_json: string  // JSON string or Blob URL
  score: number
  notes: string
  submitted_at: string
}

export type InterviewAnswer = TextAnswer | CodeAnswer | SystemDesignAnswer

export interface CandidatePipelineSnapshot {
  id: string
  candidate_id: string
  screening_id: string
  role_id: string
  screening_type_id: string
  status: 'completed' | 'in_progress'
  overall_score: number | null
  recommendation: Recommendation | null
  responses_json: InterviewAnswer[]  // All question answers
  code_submissions_json: CodeAnswer[]  // All code submissions
  drawings_json: SystemDesignAnswer[]  // All drawings
  interviewer_notes: string | null
  created_at: string
  completed_at: string | null
}

export interface ApiKey {
  id: string
  name: string
  hashed_key: string  // Never return plaintext
  scope: ExternalApiScope[]
  created_by: string
  created_at: string
  last_used_at: string | null
  active: boolean
}

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'interviewer'
}

// ─── Derived Types ────────────────────────────────────────────────────────────

export type Recommendation = 'strong_yes' | 'yes' | 'neutral' | 'no' | 'strong_no'

export interface CandidatePerformance {
  average_score: number | null
  completed_stages: number
  total_stages: number
  recommendation_counts: Partial<Record<Recommendation, number>>
}

export interface ScreeningSession {
  screening: Screening
  candidate: Candidate
  questions: Question[]
}

export interface ExecResult {
  stdout: string
  stderr: string
  exit_code: number
  run_time_ms: number
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

export interface CreateCandidatePayload {
  name: string
  email: string
  applied_role_id: string
}

export interface CreateScreeningPayload {
  candidate_id: string
  role_id: string
  screening_type_id: string
}

export interface UpdateScreeningPayload {
  status?: Screening['status']
  overall_score?: number
  recommendation?: Recommendation
  notes?: string
  completed_at?: string
}

export interface SubmitResponsesPayload {
  screening_id: string
  responses: {
    question_id: string
    question_type: Question['type']
    score: number
    notes: string
  }[]
}

export interface CodeSubmissionPayload {
  screening_id: string
  question_id: string
  language: string
  code: string
  stdout: string
  stderr: string
  exit_code: number
}

export interface DrawingPayload {
  screening_id: string
  question_id: string
  excalidraw_json: string
}

export interface ExecutePayload {
  language: string
  code: string
  stdin?: string
}

export interface CreateUserPayload {
  name: string
  email: string
  role: User['role']
}

export interface CreateApiKeyPayload {
  name: string
  scope: ExternalApiScope[]
  created_by: string
}

export type ExternalApiScope = 'candidates' | 'screenings' | 'reports'

// ─── Filter Types ─────────────────────────────────────────────────────────────

export interface QuestionFilters {
  role_id?: string
  screening_type_id?: string
  difficulty?: Question['difficulty']
  type?: Question['type']
}
