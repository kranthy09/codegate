import { createHash, randomBytes } from 'crypto'
import { sheets, SHEET_ID, RANGES } from './client'
import { getScreenings, getUsers } from './queries'
import type {
  ApiKey,
  Candidate,
  CandidatePipelineSnapshot,
  CreateApiKeyPayload,
  CreateCandidatePayload,
  CreateScreeningPayload,
  CreateUserPayload,
  CodeSubmissionPayload,
  DrawingPayload,
  Screening,
  SubmitResponsesPayload,
  User,
  UpdateScreeningPayload,
} from '@/types'

function generateId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

async function append(range: string, values: unknown[][]): Promise<void> {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  })
}

async function updateCell(range: string, value: unknown): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [[value]] },
  })
}

// ─── Candidates ───────────────────────────────────────────────────────────────

export async function createCandidate(data: CreateCandidatePayload): Promise<Candidate> {
  const candidate: Candidate = {
    id: generateId(),
    name: data.name,
    email: data.email,
    applied_role_id: data.applied_role_id,
    created_at: now(),
    status: 'active',
  }
  await append(RANGES.candidates, [[
    candidate.id, candidate.name, candidate.email,
    candidate.applied_role_id, candidate.created_at, candidate.status,
  ]])
  return candidate
}

export async function updateCandidateStatus(id: string, status: Candidate['status']): Promise<void> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RANGES.candidates })
  const rows = (res.data.values ?? []).slice(1)
  const rowIndex = rows.findIndex((r) => r[0] === id)
  if (rowIndex === -1) throw new Error(`Candidate ${id} not found`)
  await updateCell(`candidates!F${rowIndex + 2}`, status)
}

// ─── Screenings ───────────────────────────────────────────────────────────────

export async function createScreening(data: CreateScreeningPayload, interviewer_id: string): Promise<Screening> {
  const screening: Screening = {
    id: generateId(),
    candidate_id: data.candidate_id,
    role_id: data.role_id,
    screening_type_id: data.screening_type_id,
    interviewer_id,
    status: 'in_progress',
    scheduled_at: now(),
    completed_at: null,
    overall_score: null,
    recommendation: null,
    notes: null,
  }
  await append(RANGES.screenings, [[
    screening.id, screening.candidate_id, screening.role_id,
    screening.screening_type_id, screening.interviewer_id, screening.status,
    screening.scheduled_at, '', '', '', '',
  ]])
  return screening
}

export async function updateScreening(id: string, data: UpdateScreeningPayload): Promise<void> {
  const screenings = await getScreenings()
  const rowIndex = screenings.findIndex((s) => s.id === id)
  if (rowIndex === -1) throw new Error(`Screening ${id} not found`)
  const sheetRow = rowIndex + 2

  // Column map: F=status, H=completed_at, I=overall_score, J=recommendation, K=notes
  const colMap: Record<string, string> = {
    status:        `screenings!F${sheetRow}`,
    completed_at:  `screenings!H${sheetRow}`,
    overall_score: `screenings!I${sheetRow}`,
    recommendation:`screenings!J${sheetRow}`,
    notes:         `screenings!K${sheetRow}`,
  }

  const updates = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => updateCell(colMap[key], value))

  await Promise.all(updates)
}

// ─── Responses ────────────────────────────────────────────────────────────────

export async function appendResponses(payload: SubmitResponsesPayload): Promise<void> {
  const timestamp = now()
  const rows = payload.responses.map((r) => [
    generateId(), payload.screening_id, r.question_id,
    r.question_type, r.score, r.notes, timestamp,
  ])
  await append(RANGES.responses, rows)
}

// ─── Code Submissions ─────────────────────────────────────────────────────────

export async function appendCodeSubmission(payload: CodeSubmissionPayload, candidate_id: string): Promise<void> {
  await append(RANGES.code_submissions, [[
    generateId(), payload.screening_id, payload.question_id,
    candidate_id, payload.language, payload.code,
    payload.stdout, payload.stderr, payload.exit_code, now(),
  ]])
}

// ─── Drawings ─────────────────────────────────────────────────────────────────

export async function appendDrawing(payload: DrawingPayload, candidate_id: string): Promise<void> {
  await append(RANGES.drawings, [[
    generateId(), payload.screening_id, payload.question_id,
    candidate_id, payload.excalidraw_json, now(),
  ]])
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function createUser(data: CreateUserPayload): Promise<User> {
  const user: User = { id: generateId(), ...data }
  await append(RANGES.users, [[user.id, user.name, user.email, user.role]])
  return user
}

export async function updateUserRole(id: string, role: User['role']): Promise<void> {
  const users = await getUsers()
  const rowIndex = users.findIndex((u) => u.id === id)
  if (rowIndex === -1) throw new Error(`User ${id} not found`)
  await updateCell(`users!D${rowIndex + 2}`, role)
}

// ─── Candidate Pipeline ───────────────────────────────────────────────────────

/**
 * Upsert a pipeline snapshot for a screening.
 * Finds an existing row by screening_id and updates it in-place,
 * or appends a new row if none exists.
 */
export async function syncCandidatePipelineSnapshot(snapshot: CandidatePipelineSnapshot): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGES.candidate_pipeline,
  })
  const rows = (res.data.values ?? []).slice(1)
  const rowIndex = rows.findIndex((r) => r[2] === snapshot.screening_id) // col C = screening_id

  const rowData = [
    snapshot.id,
    snapshot.candidate_id,
    snapshot.screening_id,
    snapshot.role_id,
    snapshot.screening_type_id,
    snapshot.status,
    snapshot.overall_score ?? '',
    snapshot.recommendation ?? '',
    JSON.stringify(snapshot.responses_json),
    JSON.stringify(snapshot.code_submissions_json),
    JSON.stringify(snapshot.drawings_json),
    snapshot.interviewer_notes ?? '',
    snapshot.created_at,
    snapshot.completed_at ?? '',
  ]

  if (rowIndex === -1) {
    await append(RANGES.candidate_pipeline, [rowData])
  } else {
    const sheetRow = rowIndex + 2 // +1 header, +1 for 1-based indexing
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `candidate_pipeline!A${sheetRow}:N${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    })
  }
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

/**
 * Create a new external API key.
 * Returns both the stored ApiKey record and the plaintext key (shown once).
 * The plaintext is never stored — only the SHA-256 hash is persisted.
 */
export async function createApiKey(
  data: CreateApiKeyPayload,
): Promise<{ key: ApiKey; plaintext: string }> {
  const plaintext = randomBytes(32).toString('hex')
  const hashed_key = createHash('sha256').update(plaintext).digest('hex')

  const key: ApiKey = {
    id: generateId(),
    name: data.name,
    hashed_key,
    scope: data.scope,
    created_by: data.created_by,
    created_at: now(),
    last_used_at: null,
    active: true,
  }

  await append(RANGES.api_keys, [[
    key.id,
    key.name,
    key.hashed_key,
    key.scope.join(','),
    key.created_by,
    key.created_at,
    '',       // last_used_at — empty on creation
    'TRUE',   // active
  ]])

  return { key, plaintext }
}

/** Update last_used_at timestamp for audit trail. */
export async function updateApiKeyLastUsed(key_id: string): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGES.api_keys,
  })
  const rows = (res.data.values ?? []).slice(1)
  const rowIndex = rows.findIndex((r) => r[0] === key_id)
  if (rowIndex === -1) return
  await updateCell(`api_keys!G${rowIndex + 2}`, now())
}

/** Revoke an API key by setting active to FALSE. */
export async function revokeApiKey(key_id: string): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGES.api_keys,
  })
  const rows = (res.data.values ?? []).slice(1)
  const rowIndex = rows.findIndex((r) => r[0] === key_id)
  if (rowIndex === -1) throw new Error(`API key ${key_id} not found`)
  await updateCell(`api_keys!H${rowIndex + 2}`, 'FALSE')
}

/** Update API key metadata: name and/or active status. */
export async function patchApiKey(key_id: string, data: { name?: string; active?: boolean }): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGES.api_keys,
  })
  const rows = (res.data.values ?? []).slice(1)
  const rowIndex = rows.findIndex((r) => r[0] === key_id)
  if (rowIndex === -1) throw new Error(`API key ${key_id} not found`)
  const sheetRow = rowIndex + 2

  const updates: Promise<void>[] = []
  if (data.name !== undefined) {
    updates.push(updateCell(`api_keys!B${sheetRow}`, data.name))
  }
  if (data.active !== undefined) {
    updates.push(updateCell(`api_keys!H${sheetRow}`, data.active ? 'TRUE' : 'FALSE'))
  }

  await Promise.all(updates)
}
