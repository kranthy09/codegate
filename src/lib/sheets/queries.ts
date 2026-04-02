import { sheets, SHEET_ID, RANGES } from './client'
import type {
  Role,
  ScreeningType,
  Question,
  Candidate,
  Screening,
  Response,
  CodeSubmission,
  Drawing,
  User,
  ApiKey,
  CandidatePipelineSnapshot,
  QuestionFilters,
  SessionUser,
} from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getRows(range: string): Promise<string[][]> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range })
  const rows = res.data.values ?? []
  return rows.slice(1).filter((r) => r[0])
}

// ─── Row Mappers ──────────────────────────────────────────────────────────────

function rowToRole(row: string[]): Role {
  return { id: row[0], name: row[1], description: row[2] ?? '' }
}

function rowToScreeningType(row: string[]): ScreeningType {
  return { id: row[0], name: row[1], stage_order: Number(row[2]) }
}

function rowToQuestion(row: string[]): Question {
  return {
    id: row[0],
    role_id: row[1],
    screening_type_id: row[2],
    type: (row[3] as Question['type']) ?? 'text',
    text: row[4],
    difficulty: (row[5] as Question['difficulty']) ?? 'medium',
    category: row[6] ?? '',
    rubric: row[7] || null,
    expected_answer: row[8] || null,
    starter_code: row[9] || null,
    language: row[10] || null,
    active: row[11] === 'TRUE',
  }
}

function rowToCandidate(row: string[]): Candidate {
  return {
    id: row[0],
    name: row[1],
    email: row[2],
    applied_role_id: row[3],
    created_at: row[4],
    status: (row[5] as Candidate['status']) ?? 'active',
  }
}

function rowToScreening(row: string[]): Screening {
  return {
    id: row[0],
    candidate_id: row[1],
    role_id: row[2],
    screening_type_id: row[3],
    interviewer_id: row[4],
    status: (row[5] as Screening['status']) ?? 'scheduled',
    scheduled_at: row[6],
    completed_at: row[7] || null,
    overall_score: row[8] ? Number(row[8]) : null,
    recommendation: (row[9] as Screening['recommendation']) || null,
    notes: row[10] || null,
  }
}

function rowToResponse(row: string[]): Response {
  return {
    id: row[0],
    screening_id: row[1],
    question_id: row[2],
    question_type: (row[3] as Question['type']) ?? 'text',
    score: Number(row[4]),
    notes: row[5] ?? '',
    submitted_at: row[6],
  }
}

function rowToCodeSubmission(row: string[]): CodeSubmission {
  return {
    id: row[0],
    screening_id: row[1],
    question_id: row[2],
    candidate_id: row[3],
    language: row[4],
    code: row[5],
    stdout: row[6] ?? '',
    stderr: row[7] ?? '',
    exit_code: Number(row[8] ?? 0),
    submitted_at: row[9],
  }
}

function rowToDrawing(row: string[]): Drawing {
  return {
    id: row[0],
    screening_id: row[1],
    question_id: row[2],
    candidate_id: row[3],
    excalidraw_json: row[4],
    submitted_at: row[5],
  }
}

function rowToUser(row: string[]): User {
  return {
    id: row[0],
    name: row[1],
    email: row[2],
    role: (row[3] as User['role']) ?? 'interviewer',
  }
}

function rowToCandidatePipelineSnapshot(row: string[]): CandidatePipelineSnapshot {
  return {
    id: row[0],
    candidate_id: row[1],
    screening_id: row[2],
    role_id: row[3],
    screening_type_id: row[4],
    status: (row[5] as 'completed' | 'in_progress') ?? 'in_progress',
    overall_score: row[6] ? Number(row[6]) : null,
    recommendation: (row[7] as CandidatePipelineSnapshot['recommendation']) || null,
    responses_json: row[8] ? (JSON.parse(row[8]) as CandidatePipelineSnapshot['responses_json']) : [],
    code_submissions_json: row[9] ? (JSON.parse(row[9]) as CandidatePipelineSnapshot['code_submissions_json']) : [],
    drawings_json: row[10] ? (JSON.parse(row[10]) as CandidatePipelineSnapshot['drawings_json']) : [],
    interviewer_notes: row[11] || null,
    created_at: row[12],
    completed_at: row[13] || null,
  }
}

function rowToApiKey(row: string[]): ApiKey {
  return {
    id: row[0],
    name: row[1],
    hashed_key: row[2],
    scope: (row[3] ?? '').split(',').filter(Boolean) as ApiKey['scope'],
    created_by: row[4],
    created_at: row[5],
    last_used_at: row[6] || null,
    active: row[7] === 'TRUE',
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getRoles(): Promise<Role[]> {
  const rows = await getRows(RANGES.roles)
  return rows.map(rowToRole)
}

export async function getScreeningTypes(): Promise<ScreeningType[]> {
  const rows = await getRows(RANGES.screening_types)
  return rows.map(rowToScreeningType).sort((a, b) => a.stage_order - b.stage_order)
}

export async function getQuestions(filters?: QuestionFilters): Promise<Question[]> {
  const rows = await getRows(RANGES.questions)
  let questions = rows.map(rowToQuestion).filter((q) => q.active)

  if (filters?.role_id) questions = questions.filter((q) => q.role_id === filters.role_id)
  if (filters?.screening_type_id) questions = questions.filter((q) => q.screening_type_id === filters.screening_type_id)
  if (filters?.difficulty) questions = questions.filter((q) => q.difficulty === filters.difficulty)
  if (filters?.type) questions = questions.filter((q) => q.type === filters.type)

  return questions
}

export async function getCandidates(): Promise<Candidate[]> {
  const rows = await getRows(RANGES.candidates)
  return rows.map(rowToCandidate)
}

export async function getCandidateById(id: string): Promise<Candidate | null> {
  const all = await getCandidates()
  return all.find((c) => c.id === id) ?? null
}

export async function getCandidateByEmail(email: string): Promise<Candidate | null> {
  const all = await getCandidates()
  return all.find((c) => c.email === email) ?? null
}

export async function getScreenings(caller?: SessionUser): Promise<Screening[]> {
  const rows = await getRows(RANGES.screenings)
  const all = rows.map(rowToScreening)

  if (!caller || caller.role === 'admin' || caller.role === 'manager') return all
  if (caller.role === 'interviewer') return all.filter((s) => s.interviewer_id === caller.id)
  if (caller.role === 'interviewee') return all.filter((s) => s.candidate_id === caller.id)
  return []
}

export async function getScreeningById(id: string): Promise<Screening | null> {
  const rows = await getRows(RANGES.screenings)
  const all = rows.map(rowToScreening)
  return all.find((s) => s.id === id) ?? null
}

export async function getResponsesByScreeningId(screening_id: string): Promise<Response[]> {
  const rows = await getRows(RANGES.responses)
  return rows.map(rowToResponse).filter((r) => r.screening_id === screening_id)
}

export async function getCodeSubmissions(
  screening_id: string,
  question_id?: string,
  caller?: SessionUser,
): Promise<CodeSubmission[]> {
  const rows = await getRows(RANGES.code_submissions)
  let submissions = rows.map(rowToCodeSubmission).filter((s) => s.screening_id === screening_id)
  if (question_id) submissions = submissions.filter((s) => s.question_id === question_id)
  // RBAC: interviewee can only see their own submissions
  if (caller?.role === 'interviewee') {
    submissions = submissions.filter((s) => s.candidate_id === caller.id)
  }
  return submissions.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
}

export async function getLatestDrawing(
  screening_id: string,
  question_id: string,
  caller?: SessionUser,
): Promise<Drawing | null> {
  const rows = await getRows(RANGES.drawings)
  let drawings = rows
    .map(rowToDrawing)
    .filter((d) => d.screening_id === screening_id && d.question_id === question_id)
  // RBAC: interviewee can only see their own drawing
  if (caller?.role === 'interviewee') {
    drawings = drawings.filter((d) => d.candidate_id === caller.id)
  }
  drawings.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
  return drawings[0] ?? null
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await getRows(RANGES.users)
  return rows.map(rowToUser).find((u) => u.email === email) ?? null
}

export async function getUsers(): Promise<User[]> {
  const rows = await getRows(RANGES.users)
  return rows.map(rowToUser)
}

// ─── Candidate Pipeline ───────────────────────────────────────────────────────

/** Returns all pipeline snapshots for a candidate (one per completed screening). */
export async function getCandidatePipelineSnapshot(
  candidate_id: string,
): Promise<CandidatePipelineSnapshot[]> {
  const rows = await getRows(RANGES.candidate_pipeline)
  return rows
    .map(rowToCandidatePipelineSnapshot)
    .filter((s) => s.candidate_id === candidate_id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

/** Look up an API key by its SHA-256 hash. Returns null if not found or inactive. */
export async function getApiKeyByHash(hashed: string): Promise<ApiKey | null> {
  const rows = await getRows(RANGES.api_keys)
  return rows.map(rowToApiKey).find((k) => k.hashed_key === hashed && k.active) ?? null
}

/** List all API keys, optionally filtered to those created by a specific user. */
export async function listApiKeys(created_by?: string): Promise<ApiKey[]> {
  const rows = await getRows(RANGES.api_keys)
  const all = rows.map(rowToApiKey)
  return created_by ? all.filter((k) => k.created_by === created_by) : all
}
