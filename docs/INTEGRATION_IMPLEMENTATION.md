# CodeGate + Resume-Processor Integration: Complete Implementation Guide

> **Goal:** Make CodeGate fully compatible with Resume-Processor's infrastructure (Supabase PostgreSQL, Drizzle ORM, JWT auth) so the two systems share candidates, users, and interview data through a single database.
>
> **Constraint:** Resume-Processor is untouched. All changes happen inside the `codegate/` repository.
>
> **Current state:** Zero integration points. Different databases (Google Sheets vs Supabase), different auth systems, different candidate/user models.

---

## Architecture: Before vs After

```
BEFORE (isolated):

  Resume-Processor                    CodeGate
  ┌────────────────┐                 ┌────────────────┐
  │ Express + React │                 │ Next.js 15     │
  │ Drizzle ORM    │                 │ Google Sheets  │
  │ Supabase PG    │                 │ googleapis     │
  │ JWT (bcrypt)   │                 │ External Auth  │
  └────────────────┘                 └────────────────┘
         │                                  │
    Supabase DB                       Google Sheets
   (candidates,                     (11 tabs: roles,
    users, etc.)                     questions, etc.)


AFTER (integrated):

  Resume-Processor                    CodeGate
  ┌────────────────┐                 ┌────────────────┐
  │ Express + React │                 │ Next.js 15     │
  │ Drizzle ORM    │                 │ Drizzle ORM    │  <-- NEW
  │ Supabase PG    │                 │ Supabase PG    │  <-- SAME DB
  │ JWT (bcrypt)   │◄────────────────│ RP JWT auth    │  <-- BRIDGE
  └────────────────┘                 └────────────────┘
         │                                  │
         └──────────┐          ┌────────────┘
                    ▼          ▼
               Supabase PostgreSQL
              ┌─────────────────────────┐
              │ RP tables (untouched):  │
              │  candidates, users,     │
              │  organizations, etc.    │
              │                         │
              │ CG tables (new):        │
              │  cg_roles, cg_questions,│
              │  cg_screenings, etc.    │
              │                         │
              │ Bridge tables (new):    │
              │  cg_interview_links     │
              └─────────────────────────┘
```

---

## Session Overview

| Session | Name | Depends On | Effort | Outcome |
|---------|------|------------|--------|---------|
| 1 | Supabase Schema & DB Client | None | High | All 11 Sheets tabs → Drizzle tables in Supabase |
| 2 | Data Access Layer Rewrite | Session 1 | High | `lib/sheets/` → `lib/db/` with identical function signatures |
| 3 | Auth Bridge | Session 1 | Medium | CodeGate authenticates via RP's JWT system |
| 4 | Candidate & User Unification | Sessions 1-3 | Medium | Shared candidates/users, no duplication |
| 5 | Status Sync & Interview Linking | Session 4 | Medium | CG screening completion updates RP candidate status |
| 6 | Storage Migration | Session 1 | Low-Medium | Drawings/large assets → Supabase Storage |
| 7 | Environment & Deployment | Sessions 1-6 | Low | Env vars, dependency cleanup, deployment config |

---

## Session 1: Supabase Schema & DB Client

### 1.1 Objective

Replace Google Sheets (11 tabs) with Supabase PostgreSQL tables using Drizzle ORM — the same ORM and connection pattern used by Resume-Processor.

### 1.2 New Dependencies

Add to `codegate/package.json`:

```json
{
  "dependencies": {
    "drizzle-orm": "^0.45.1",
    "pg": "^8.13.3",
    "@neondatabase/serverless": "^0.10.4"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.1",
    "@types/pg": "^8.11.11"
  }
}
```

Remove (after Session 2 is complete):

```json
{
  "dependencies": {
    "googleapis": "^144.0.0"   // <-- remove
  }
}
```

### 1.3 DB Client Setup

Create `src/lib/db/client.ts` — mirrors Resume-Processor's `lib/db/src/index.ts`:

```typescript
// src/lib/db/client.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
})

export const db = drizzle(pool, { schema })
export { pool }
```

### 1.4 Drizzle Config

Create `drizzle.config.ts` at CodeGate root:

```typescript
// codegate/drizzle.config.ts
import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },
  tablesFilter: ['cg_*'],  // Only manage cg_ prefixed tables
})
```

### 1.5 Schema Definitions

All CodeGate-specific tables are prefixed `cg_` to avoid collision with Resume-Processor's existing tables. Tables that bridge to RP (candidates, users) use foreign keys referencing RP tables.

Create `src/lib/db/schema/index.ts`:

```typescript
export * from './codegate'
```

Create `src/lib/db/schema/codegate.ts`:

```typescript
// src/lib/db/schema/codegate.ts
import {
  pgTable, text, serial, integer, timestamp,
  boolean, jsonb, uniqueIndex, real,
} from 'drizzle-orm/pg-core'

// ─── Reference Tables (master data) ──────────────────────────────────────────

/**
 * Maps to Sheets tab: roles
 * Job roles that candidates apply for (e.g., "Frontend Engineer")
 */
export const cgRolesTable = pgTable('cg_roles', {
  id: text('id').primaryKey(),                    // UUID string (matches existing IDs)
  name: text('name').notNull(),
  description: text('description').default(''),
  // Bridge to RP: optional FK to job_requirements
  jobRequirementId: integer('job_requirement_id'),  // FK → RP job_requirements.id
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

/**
 * Maps to Sheets tab: screening_types
 * Pipeline stages in order (HR Screen, Technical, System Design, etc.)
 */
export const cgScreeningTypesTable = pgTable('cg_screening_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  stageOrder: integer('stage_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

/**
 * Maps to Sheets tab: questions
 * Question bank: text / code / system_design with rubrics
 */
export const cgQuestionsTable = pgTable('cg_questions', {
  id: text('id').primaryKey(),
  roleId: text('role_id').notNull().references(() => cgRolesTable.id),
  screeningTypeId: text('screening_type_id').notNull().references(() => cgScreeningTypesTable.id),
  type: text('type').notNull().default('text'),           // 'text' | 'code' | 'system_design'
  text: text('text').notNull(),
  difficulty: text('difficulty').notNull().default('medium'), // 'easy' | 'medium' | 'hard'
  category: text('category').default(''),
  rubric: text('rubric'),                                 // Staff only
  expectedAnswer: text('expected_answer'),                // Staff only
  starterCode: text('starter_code'),                      // Code questions
  language: text('language'),                             // Default language
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── Screening & Interview ───────────────────────────────────────────────────

/**
 * Maps to Sheets tab: screenings
 * A single screening session: candidate x stage x interviewer
 *
 * candidate_id references RP's candidates.id (integer)
 * interviewer_id references RP's users.id (integer)
 */
export const cgScreeningsTable = pgTable('cg_screenings', {
  id: text('id').primaryKey(),
  candidateId: integer('candidate_id').notNull(),         // FK → RP candidates.id
  roleId: text('role_id').notNull().references(() => cgRolesTable.id),
  screeningTypeId: text('screening_type_id').notNull().references(() => cgScreeningTypesTable.id),
  interviewerId: integer('interviewer_id').notNull(),     // FK → RP users.id
  status: text('status').notNull().default('scheduled'),  // scheduled|in_progress|completed|cancelled
  scheduledAt: timestamp('scheduled_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  overallScore: integer('overall_score'),                 // 1-5
  recommendation: text('recommendation'),                 // strong_yes|yes|neutral|no|strong_no
  notes: text('notes'),
  // Bridge to RP: optional link to RP's interviews table
  rpInterviewId: integer('rp_interview_id'),              // FK → RP interviews.id
  orgId: integer('org_id').notNull(),                     // FK → RP organizations.id (multi-org)
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/**
 * Maps to Sheets tab: responses
 * Per-question scores from the interviewer
 */
export const cgResponsesTable = pgTable('cg_responses', {
  id: text('id').primaryKey(),
  screeningId: text('screening_id').notNull().references(() => cgScreeningsTable.id, { onDelete: 'cascade' }),
  questionId: text('question_id').notNull().references(() => cgQuestionsTable.id),
  questionType: text('question_type').notNull().default('text'),
  score: integer('score').notNull(),                      // 1-5
  notes: text('notes').default(''),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
})

/**
 * Maps to Sheets tab: code_submissions
 * Each code execution run (candidate can submit multiple times)
 */
export const cgCodeSubmissionsTable = pgTable('cg_code_submissions', {
  id: text('id').primaryKey(),
  screeningId: text('screening_id').notNull().references(() => cgScreeningsTable.id, { onDelete: 'cascade' }),
  questionId: text('question_id').notNull().references(() => cgQuestionsTable.id),
  candidateId: integer('candidate_id').notNull(),         // FK → RP candidates.id
  language: text('language').notNull(),
  code: text('code').notNull(),
  stdout: text('stdout').default(''),
  stderr: text('stderr').default(''),
  exitCode: integer('exit_code').default(0),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
})

/**
 * Maps to Sheets tab: drawings
 * Excalidraw system design drawings (auto-saved every 30s)
 */
export const cgDrawingsTable = pgTable('cg_drawings', {
  id: text('id').primaryKey(),
  screeningId: text('screening_id').notNull().references(() => cgScreeningsTable.id, { onDelete: 'cascade' }),
  questionId: text('question_id').notNull().references(() => cgQuestionsTable.id),
  candidateId: integer('candidate_id').notNull(),         // FK → RP candidates.id
  excalidrawJson: text('excalidraw_json').notNull(),      // JSON string or Supabase Storage URL
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
})

// ─── Pipeline & Reporting ────────────────────────────────────────────────────

/**
 * Maps to Sheets tab: candidate_pipeline
 * Denormalized snapshot for fast external API reads
 */
export const cgCandidatePipelineTable = pgTable('cg_candidate_pipeline', {
  id: text('id').primaryKey(),
  candidateId: integer('candidate_id').notNull(),         // FK → RP candidates.id
  screeningId: text('screening_id').notNull().references(() => cgScreeningsTable.id),
  roleId: text('role_id').notNull().references(() => cgRolesTable.id),
  screeningTypeId: text('screening_type_id').notNull().references(() => cgScreeningTypesTable.id),
  status: text('status').notNull().default('in_progress'),
  overallScore: integer('overall_score'),
  recommendation: text('recommendation'),
  responsesJson: jsonb('responses_json').default([]),     // InterviewAnswer[]
  codeSubmissionsJson: jsonb('code_submissions_json').default([]),
  drawingsJson: jsonb('drawings_json').default([]),
  interviewerNotes: text('interviewer_notes'),
  orgId: integer('org_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  screeningIdx: uniqueIndex('cg_pipeline_screening_idx').on(table.screeningId),
}))

// ─── API Keys ────────────────────────────────────────────────────────────────

/**
 * Maps to Sheets tab: api_keys
 * External API keys for ATS/HR tool integration
 */
export const cgApiKeysTable = pgTable('cg_api_keys', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  hashedKey: text('hashed_key').notNull(),
  scope: text('scope').notNull(),                         // comma-separated: candidates,screenings,reports
  createdBy: integer('created_by').notNull(),             // FK → RP users.id
  orgId: integer('org_id').notNull(),                     // FK → RP organizations.id
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
  active: boolean('active').notNull().default(true),
})

// ─── Interviewee Tokens ──────────────────────────────────────────────────────

/**
 * NEW: Temporary access tokens for candidates taking a coding round.
 * Similar concept to RP's screening_tokens but for CG session access.
 */
export const cgIntervieweeTokensTable = pgTable('cg_interviewee_tokens', {
  id: text('id').primaryKey(),
  candidateId: integer('candidate_id').notNull(),         // FK → RP candidates.id
  screeningId: text('screening_id').notNull().references(() => cgScreeningsTable.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),                // UUID sent to candidate
  roleId: text('role_id').notNull(),                      // Scoped access: which role's questions
  screeningTypeId: text('screening_type_id').notNull(),   // Scoped access: which stage
  difficulty: text('difficulty'),                          // Scoped access: difficulty tier
  expiresAt: timestamp('expires_at').notNull(),            // Default: 24 hours
  usedAt: timestamp('used_at'),                            // When candidate first accessed
  orgId: integer('org_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

### 1.6 Drizzle Push Command

Add to `codegate/package.json` scripts:

```json
{
  "scripts": {
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:generate": "drizzle-kit generate"
  }
}
```

Run to create tables in Supabase:

```bash
cd codegate
npx drizzle-kit push
```

### 1.7 Schema-to-Sheets Mapping Reference

| Google Sheets Tab | Supabase Table | Key Changes |
|---|---|---|
| `roles` | `cg_roles` | Added `job_requirement_id` FK to RP |
| `screening_types` | `cg_screening_types` | Direct port |
| `questions` | `cg_questions` | `expected_answer` → `expectedAnswer` (camelCase) |
| `candidates` | **RP's `candidates`** | No CG table — use RP's directly |
| `screenings` | `cg_screenings` | `candidate_id` is now integer FK to RP, added `org_id`, `rp_interview_id` |
| `responses` | `cg_responses` | `question_type` kept, added cascade delete |
| `code_submissions` | `cg_code_submissions` | `candidate_id` integer FK to RP |
| `drawings` | `cg_drawings` | Direct port with integer candidate FK |
| `users` | **RP's `users`** | No CG table — use RP's directly |
| `candidate_pipeline` | `cg_candidate_pipeline` | JSON columns → `jsonb` type, added `org_id` |
| `api_keys` | `cg_api_keys` | `scope` stored as comma-separated text, added `org_id` |
| *(new)* | `cg_interviewee_tokens` | New table for candidate session access |

### 1.8 Verification Checklist

- [ ] `DATABASE_URL` env var added to `.env.local` (same connection string as RP)
- [ ] `drizzle.config.ts` created with `tablesFilter: ['cg_*']`
- [ ] `src/lib/db/client.ts` created and exports `db`
- [ ] `src/lib/db/schema/codegate.ts` contains all 10 table definitions
- [ ] `npx drizzle-kit push` succeeds — tables visible in Supabase dashboard
- [ ] RP's existing tables (`candidates`, `users`, `organizations`, etc.) are NOT modified
- [ ] All `cg_*` tables have correct FK constraints (integer IDs to RP tables, text IDs within CG)

---

## Session 2: Data Access Layer Rewrite

### 2.1 Objective

Replace every Google Sheets API call with Drizzle ORM queries. The **function signatures stay identical** so that API route handlers require zero changes in this session.

### 2.2 Files to Replace

| Old File (Sheets) | New File (Drizzle) | Lines |
|---|---|---|
| `src/lib/sheets/client.ts` | `src/lib/db/client.ts` (from Session 1) | ~28 → ~15 |
| `src/lib/sheets/queries.ts` | `src/lib/db/queries.ts` | ~288 → ~200 |
| `src/lib/sheets/mutations.ts` | `src/lib/db/mutations.ts` | ~291 → ~220 |
| `src/lib/sheets/reporting.ts` | `src/lib/db/reporting.ts` | ~142 → ~142 (mostly unchanged) |

### 2.3 Migration Strategy

1. Create new `src/lib/db/queries.ts` and `src/lib/db/mutations.ts` with the **same exported function names**
2. Update all imports across the codebase: `from '@/lib/sheets/queries'` → `from '@/lib/db/queries'`
3. Keep old `lib/sheets/` directory until all routes are verified working
4. Delete `lib/sheets/` and remove `googleapis` dependency

### 2.4 Queries Rewrite: `src/lib/db/queries.ts`

Each function maps 1:1 from the Sheets version. Below is the complete file.

```typescript
// src/lib/db/queries.ts
import { db } from './client'
import { eq, and, desc, asc, inArray } from 'drizzle-orm'
import {
  cgRolesTable,
  cgScreeningTypesTable,
  cgQuestionsTable,
  cgScreeningsTable,
  cgResponsesTable,
  cgCodeSubmissionsTable,
  cgDrawingsTable,
  cgCandidatePipelineTable,
  cgApiKeysTable,
} from './schema'
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

// ─── Mappers (DB row → domain type) ──────────────────────────────────────────

// NOTE: Drizzle returns typed objects, so mappers are thinner than Sheets row-index mappers.
// They mainly handle column name differences (camelCase DB → snake_case domain types).

function dbToRole(row: typeof cgRolesTable.$inferSelect): Role {
  return { id: row.id, name: row.name, description: row.description ?? '' }
}

function dbToScreeningType(row: typeof cgScreeningTypesTable.$inferSelect): ScreeningType {
  return { id: row.id, name: row.name, stage_order: row.stageOrder }
}

function dbToQuestion(row: typeof cgQuestionsTable.$inferSelect): Question {
  return {
    id: row.id,
    role_id: row.roleId,
    screening_type_id: row.screeningTypeId,
    type: row.type as Question['type'],
    text: row.text,
    difficulty: row.difficulty as Question['difficulty'],
    category: row.category ?? '',
    rubric: row.rubric,
    expected_answer: row.expectedAnswer,
    starter_code: row.starterCode,
    language: row.language,
    active: row.active,
  }
}

function dbToScreening(row: typeof cgScreeningsTable.$inferSelect): Screening {
  return {
    id: row.id,
    candidate_id: String(row.candidateId),  // CG types use string IDs
    role_id: row.roleId,
    screening_type_id: row.screeningTypeId,
    interviewer_id: String(row.interviewerId),
    status: row.status as Screening['status'],
    scheduled_at: row.scheduledAt.toISOString(),
    completed_at: row.completedAt?.toISOString() ?? null,
    overall_score: row.overallScore,
    recommendation: row.recommendation as Screening['recommendation'],
    notes: row.notes,
  }
}

function dbToResponse(row: typeof cgResponsesTable.$inferSelect): Response {
  return {
    id: row.id,
    screening_id: row.screeningId,
    question_id: row.questionId,
    question_type: row.questionType as Question['type'],
    score: row.score,
    notes: row.notes ?? '',
    submitted_at: row.submittedAt.toISOString(),
  }
}

function dbToCodeSubmission(row: typeof cgCodeSubmissionsTable.$inferSelect): CodeSubmission {
  return {
    id: row.id,
    screening_id: row.screeningId,
    question_id: row.questionId,
    candidate_id: String(row.candidateId),
    language: row.language,
    code: row.code,
    stdout: row.stdout ?? '',
    stderr: row.stderr ?? '',
    exit_code: row.exitCode ?? 0,
    submitted_at: row.submittedAt.toISOString(),
  }
}

function dbToDrawing(row: typeof cgDrawingsTable.$inferSelect): Drawing {
  return {
    id: row.id,
    screening_id: row.screeningId,
    question_id: row.questionId,
    candidate_id: String(row.candidateId),
    excalidraw_json: row.excalidrawJson,
    submitted_at: row.submittedAt.toISOString(),
  }
}

function dbToPipeline(row: typeof cgCandidatePipelineTable.$inferSelect): CandidatePipelineSnapshot {
  return {
    id: row.id,
    candidate_id: String(row.candidateId),
    screening_id: row.screeningId,
    role_id: row.roleId,
    screening_type_id: row.screeningTypeId,
    status: row.status as 'completed' | 'in_progress',
    overall_score: row.overallScore,
    recommendation: row.recommendation as CandidatePipelineSnapshot['recommendation'],
    responses_json: (row.responsesJson ?? []) as CandidatePipelineSnapshot['responses_json'],
    code_submissions_json: (row.codeSubmissionsJson ?? []) as CandidatePipelineSnapshot['code_submissions_json'],
    drawings_json: (row.drawingsJson ?? []) as CandidatePipelineSnapshot['drawings_json'],
    interviewer_notes: row.interviewerNotes,
    created_at: row.createdAt.toISOString(),
    completed_at: row.completedAt?.toISOString() ?? null,
  }
}

function dbToApiKey(row: typeof cgApiKeysTable.$inferSelect): ApiKey {
  return {
    id: row.id,
    name: row.name,
    hashed_key: row.hashedKey,
    scope: row.scope.split(',').filter(Boolean) as ApiKey['scope'],
    created_by: String(row.createdBy),
    created_at: row.createdAt.toISOString(),
    last_used_at: row.lastUsedAt?.toISOString() ?? null,
    active: row.active,
  }
}

// ─── Query Functions ─────────────────────────────────────────────────────────
// Same signatures as lib/sheets/queries.ts — drop-in replacement

export async function getRoles(): Promise<Role[]> {
  const rows = await db.select().from(cgRolesTable)
  return rows.map(dbToRole)
}

export async function getScreeningTypes(): Promise<ScreeningType[]> {
  const rows = await db.select().from(cgScreeningTypesTable).orderBy(asc(cgScreeningTypesTable.stageOrder))
  return rows.map(dbToScreeningType)
}

export async function getQuestions(filters?: QuestionFilters): Promise<Question[]> {
  const conditions = [eq(cgQuestionsTable.active, true)]

  if (filters?.role_id) conditions.push(eq(cgQuestionsTable.roleId, filters.role_id))
  if (filters?.screening_type_id) conditions.push(eq(cgQuestionsTable.screeningTypeId, filters.screening_type_id))
  if (filters?.difficulty) conditions.push(eq(cgQuestionsTable.difficulty, filters.difficulty))
  if (filters?.type) conditions.push(eq(cgQuestionsTable.type, filters.type))

  const rows = await db.select().from(cgQuestionsTable).where(and(...conditions))
  return rows.map(dbToQuestion)
}

export async function getCandidates(): Promise<Candidate[]> {
  // NOTE: This now queries RP's candidates table directly.
  // Imported from the shared schema. See Session 4 for full integration.
  // For now, stub that returns candidates from cg_screenings (linked).
  throw new Error('Use RP candidates table directly — see Session 4')
}

export async function getCandidateById(id: string): Promise<Candidate | null> {
  // Delegates to RP candidates table — see Session 4
  throw new Error('Use RP candidates table directly — see Session 4')
}

export async function getCandidateByEmail(email: string): Promise<Candidate | null> {
  throw new Error('Use RP candidates table directly — see Session 4')
}

export async function getScreenings(caller?: SessionUser): Promise<Screening[]> {
  const rows = await db.select().from(cgScreeningsTable)
  let screenings = rows.map(dbToScreening)

  if (!caller || caller.role === 'admin' || caller.role === 'manager') return screenings
  if (caller.role === 'interviewer') return screenings.filter((s) => s.interviewer_id === caller.id)
  if (caller.role === 'interviewee') return screenings.filter((s) => s.candidate_id === caller.id)
  return []
}

export async function getScreeningById(id: string): Promise<Screening | null> {
  const rows = await db.select().from(cgScreeningsTable).where(eq(cgScreeningsTable.id, id)).limit(1)
  return rows[0] ? dbToScreening(rows[0]) : null
}

export async function getResponsesByScreeningId(screening_id: string): Promise<Response[]> {
  const rows = await db.select().from(cgResponsesTable).where(eq(cgResponsesTable.screeningId, screening_id))
  return rows.map(dbToResponse)
}

export async function getCodeSubmissions(
  screening_id: string,
  question_id?: string,
  caller?: SessionUser,
): Promise<CodeSubmission[]> {
  const conditions = [eq(cgCodeSubmissionsTable.screeningId, screening_id)]
  if (question_id) conditions.push(eq(cgCodeSubmissionsTable.questionId, question_id))

  const rows = await db
    .select()
    .from(cgCodeSubmissionsTable)
    .where(and(...conditions))
    .orderBy(desc(cgCodeSubmissionsTable.submittedAt))

  let submissions = rows.map(dbToCodeSubmission)
  if (caller?.role === 'interviewee') {
    submissions = submissions.filter((s) => s.candidate_id === caller.id)
  }
  return submissions
}

export async function getLatestDrawing(
  screening_id: string,
  question_id: string,
  caller?: SessionUser,
): Promise<Drawing | null> {
  const conditions = [
    eq(cgDrawingsTable.screeningId, screening_id),
    eq(cgDrawingsTable.questionId, question_id),
  ]
  if (caller?.role === 'interviewee') {
    conditions.push(eq(cgDrawingsTable.candidateId, Number(caller.id)))
  }

  const rows = await db
    .select()
    .from(cgDrawingsTable)
    .where(and(...conditions))
    .orderBy(desc(cgDrawingsTable.submittedAt))
    .limit(1)

  return rows[0] ? dbToDrawing(rows[0]) : null
}

export async function getUsers(): Promise<User[]> {
  // Delegates to RP users table — see Session 4
  throw new Error('Use RP users table directly — see Session 4')
}

export async function getUserByEmail(email: string): Promise<User | null> {
  throw new Error('Use RP users table directly — see Session 4')
}

export async function getCandidatePipelineSnapshot(
  candidate_id: string,
): Promise<CandidatePipelineSnapshot[]> {
  const rows = await db
    .select()
    .from(cgCandidatePipelineTable)
    .where(eq(cgCandidatePipelineTable.candidateId, Number(candidate_id)))
    .orderBy(asc(cgCandidatePipelineTable.createdAt))
  return rows.map(dbToPipeline)
}

export async function getApiKeyByHash(hashed: string): Promise<ApiKey | null> {
  const rows = await db
    .select()
    .from(cgApiKeysTable)
    .where(and(eq(cgApiKeysTable.hashedKey, hashed), eq(cgApiKeysTable.active, true)))
    .limit(1)
  return rows[0] ? dbToApiKey(rows[0]) : null
}

export async function listApiKeys(created_by?: string): Promise<ApiKey[]> {
  const rows = created_by
    ? await db.select().from(cgApiKeysTable).where(eq(cgApiKeysTable.createdBy, Number(created_by)))
    : await db.select().from(cgApiKeysTable)
  return rows.map(dbToApiKey)
}
```

### 2.5 Mutations Rewrite: `src/lib/db/mutations.ts`

```typescript
// src/lib/db/mutations.ts
import { createHash, randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from './client'
import {
  cgScreeningsTable,
  cgResponsesTable,
  cgCodeSubmissionsTable,
  cgDrawingsTable,
  cgCandidatePipelineTable,
  cgApiKeysTable,
  cgRolesTable,
  cgScreeningTypesTable,
  cgQuestionsTable,
} from './schema'
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

// ─── Candidates ───────────────────────────────────────────────────────────────
// Candidate creation is handled by RP — CG does not create candidates.
// See Session 4 for how CG reads RP candidates.

export async function createCandidate(_data: CreateCandidatePayload): Promise<Candidate> {
  throw new Error('Candidate creation is handled by Resume-Processor. Use RP API instead.')
}

export async function updateCandidateStatus(_id: string, _status: Candidate['status']): Promise<void> {
  throw new Error('Candidate status updates flow through the sync layer. See Session 5.')
}

// ─── Screenings ───────────────────────────────────────────────────────────────

export async function createScreening(
  data: CreateScreeningPayload,
  interviewer_id: string,
  orgId: number,
): Promise<Screening> {
  const id = generateId()
  const now = new Date()

  const [row] = await db.insert(cgScreeningsTable).values({
    id,
    candidateId: Number(data.candidate_id),
    roleId: data.role_id,
    screeningTypeId: data.screening_type_id,
    interviewerId: Number(interviewer_id),
    status: 'in_progress',
    scheduledAt: now,
    orgId,
  }).returning()

  return {
    id: row.id,
    candidate_id: String(row.candidateId),
    role_id: row.roleId,
    screening_type_id: row.screeningTypeId,
    interviewer_id: String(row.interviewerId),
    status: 'in_progress',
    scheduled_at: now.toISOString(),
    completed_at: null,
    overall_score: null,
    recommendation: null,
    notes: null,
  }
}

export async function updateScreening(id: string, data: UpdateScreeningPayload): Promise<void> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() }

  if (data.status !== undefined) updateData.status = data.status
  if (data.completed_at !== undefined) updateData.completedAt = new Date(data.completed_at)
  if (data.overall_score !== undefined) updateData.overallScore = data.overall_score
  if (data.recommendation !== undefined) updateData.recommendation = data.recommendation
  if (data.notes !== undefined) updateData.notes = data.notes

  await db.update(cgScreeningsTable).set(updateData).where(eq(cgScreeningsTable.id, id))
}

// ─── Responses ────────────────────────────────────────────────────────────────

export async function appendResponses(payload: SubmitResponsesPayload): Promise<void> {
  const now = new Date()
  const rows = payload.responses.map((r) => ({
    id: generateId(),
    screeningId: payload.screening_id,
    questionId: r.question_id,
    questionType: r.question_type,
    score: r.score,
    notes: r.notes,
    submittedAt: now,
  }))

  await db.insert(cgResponsesTable).values(rows)
}

// ─── Code Submissions ─────────────────────────────────────────────────────────

export async function appendCodeSubmission(
  payload: CodeSubmissionPayload,
  candidate_id: string,
): Promise<void> {
  await db.insert(cgCodeSubmissionsTable).values({
    id: generateId(),
    screeningId: payload.screening_id,
    questionId: payload.question_id,
    candidateId: Number(candidate_id),
    language: payload.language,
    code: payload.code,
    stdout: payload.stdout,
    stderr: payload.stderr,
    exitCode: payload.exit_code,
  })
}

// ─── Drawings ─────────────────────────────────────────────────────────────────

export async function appendDrawing(
  payload: DrawingPayload,
  candidate_id: string,
): Promise<void> {
  await db.insert(cgDrawingsTable).values({
    id: generateId(),
    screeningId: payload.screening_id,
    questionId: payload.question_id,
    candidateId: Number(candidate_id),
    excalidrawJson: payload.excalidraw_json,
  })
}

// ─── Users ────────────────────────────────────────────────────────────────────
// Users are managed by RP. CG reads them from RP's users table.

export async function createUser(_data: CreateUserPayload): Promise<User> {
  throw new Error('User creation is handled by Resume-Processor.')
}

export async function updateUserRole(_id: string, _role: User['role']): Promise<void> {
  throw new Error('User role updates are handled by Resume-Processor.')
}

// ─── Pipeline Snapshots ──────────────────────────────────────────────────────

export async function syncCandidatePipelineSnapshot(
  snapshot: CandidatePipelineSnapshot,
  orgId: number,
): Promise<void> {
  const existing = await db
    .select()
    .from(cgCandidatePipelineTable)
    .where(eq(cgCandidatePipelineTable.screeningId, snapshot.screening_id))
    .limit(1)

  const rowData = {
    id: snapshot.id,
    candidateId: Number(snapshot.candidate_id),
    screeningId: snapshot.screening_id,
    roleId: snapshot.role_id,
    screeningTypeId: snapshot.screening_type_id,
    status: snapshot.status,
    overallScore: snapshot.overall_score,
    recommendation: snapshot.recommendation,
    responsesJson: snapshot.responses_json,
    codeSubmissionsJson: snapshot.code_submissions_json,
    drawingsJson: snapshot.drawings_json,
    interviewerNotes: snapshot.interviewer_notes,
    orgId,
    completedAt: snapshot.completed_at ? new Date(snapshot.completed_at) : null,
  }

  if (existing.length === 0) {
    await db.insert(cgCandidatePipelineTable).values(rowData)
  } else {
    await db
      .update(cgCandidatePipelineTable)
      .set(rowData)
      .where(eq(cgCandidatePipelineTable.screeningId, snapshot.screening_id))
  }
}

// ─── API Keys ────────────────────────────────────────────────────────────────

export async function createApiKey(
  data: CreateApiKeyPayload,
  orgId: number,
): Promise<{ key: ApiKey; plaintext: string }> {
  const plaintext = randomBytes(32).toString('hex')
  const hashed_key = createHash('sha256').update(plaintext).digest('hex')

  const key: ApiKey = {
    id: generateId(),
    name: data.name,
    hashed_key,
    scope: data.scope,
    created_by: data.created_by,
    created_at: new Date().toISOString(),
    last_used_at: null,
    active: true,
  }

  await db.insert(cgApiKeysTable).values({
    id: key.id,
    name: key.name,
    hashedKey: hashed_key,
    scope: data.scope.join(','),
    createdBy: Number(data.created_by),
    orgId,
    active: true,
  })

  return { key, plaintext }
}

export async function updateApiKeyLastUsed(key_id: string): Promise<void> {
  await db
    .update(cgApiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(cgApiKeysTable.id, key_id))
}

export async function revokeApiKey(key_id: string): Promise<void> {
  await db
    .update(cgApiKeysTable)
    .set({ active: false })
    .where(eq(cgApiKeysTable.id, key_id))
}

export async function patchApiKey(
  key_id: string,
  data: { name?: string; active?: boolean },
): Promise<void> {
  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.active !== undefined) updateData.active = data.active

  await db.update(cgApiKeysTable).set(updateData).where(eq(cgApiKeysTable.id, key_id))
}
```

### 2.6 Reporting (mostly unchanged): `src/lib/db/reporting.ts`

Copy `src/lib/sheets/reporting.ts` → `src/lib/db/reporting.ts` **as-is**. The `buildCandidatePipelineSnapshot()` function operates purely on domain types and has no Sheets-specific code. No changes needed.

### 2.7 Import Path Updates

Run a global find-and-replace across all files in `src/`:

| Old Import | New Import |
|---|---|
| `from '@/lib/sheets/queries'` | `from '@/lib/db/queries'` |
| `from '@/lib/sheets/mutations'` | `from '@/lib/db/mutations'` |
| `from '@/lib/sheets/reporting'` | `from '@/lib/db/reporting'` |
| `from '@/lib/sheets/client'` | *(delete — no longer needed)* |

Also update `src/lib/auth/external-api.ts` line 2-3:
```typescript
// Old:
import { getApiKeyByHash } from '@/lib/sheets/queries'
import { updateApiKeyLastUsed } from '@/lib/sheets/mutations'
// New:
import { getApiKeyByHash } from '@/lib/db/queries'
import { updateApiKeyLastUsed } from '@/lib/db/mutations'
```

### 2.8 Verification Checklist

- [ ] All imports updated from `@/lib/sheets/*` to `@/lib/db/*`
- [ ] Every query function returns the same shape as the Sheets version
- [ ] `npm run build` passes with no type errors
- [ ] API routes return same response shapes (test with `curl` or Postman)
- [ ] `lib/sheets/` directory deleted
- [ ] `googleapis` removed from `package.json`
- [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID` removed from `.env.example`

---

## Session 3: Auth Bridge

### 3.1 Objective

Make CodeGate authenticate users through Resume-Processor's JWT system instead of an arbitrary `EXTERNAL_AUTH_URL`. Support two auth flows:

1. **Staff (admin/manager/interviewer):** Authenticated via RP's `auth_token` cookie
2. **Interviewee (candidate):** Authenticated via a temporary `cg_interviewee_token`

### 3.2 Understanding RP's Auth

RP issues JWTs with this payload (from `auth.ts:63`):
```typescript
{
  userId: number,
  orgId: number,
  email: string,
  name: string,
  jobTitle: string | null,
  department: string | null,
  role: string  // "member" | "admin" | "super_admin"
}
```

Cookie name: `auth_token` (7-day expiry, httpOnly, sameSite=lax)

### 3.3 Role Mapping

| RP Role (`usersTable.role`) | CG Role (`UserRole`) | Access Level |
|---|---|---|
| `super_admin` | `admin` | Full access: users, questions, all candidates |
| `admin` | `manager` | All candidates, assign interviewers |
| `member` | `interviewer` | Own assigned screenings only |
| *(candidate via token)* | `interviewee` | Own session only |

### 3.4 Rewrite `src/lib/auth/external.ts`

Replace the external fetch with direct JWT verification of RP's token:

```typescript
// src/lib/auth/external.ts
import jwt from 'jsonwebtoken'
import type { SessionUser } from '@/types'

// RP's JWT secret — must match Resume-Processor's JWT_SECRET
const RP_JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-prod'

interface RPAuthPayload {
  userId: number
  orgId: number
  email: string
  name: string
  jobTitle: string | null
  department: string | null
  role: string  // "member" | "admin" | "super_admin"
}

/** Map RP roles to CG roles */
function mapRole(rpRole: string): SessionUser['role'] {
  switch (rpRole) {
    case 'super_admin': return 'admin'
    case 'admin':       return 'manager'
    case 'member':      return 'interviewer'
    default:            return 'interviewer'
  }
}

/**
 * Verify RP's auth_token cookie and return a CG SessionUser.
 * No external HTTP call — direct JWT verification using shared secret.
 */
export function verifyRPToken(token: string): SessionUser {
  const payload = jwt.verify(token, RP_JWT_SECRET) as RPAuthPayload

  return {
    id: String(payload.userId),
    name: payload.name,
    email: payload.email,
    role: mapRole(payload.role),
    // Staff users don't need scoped claims
    // orgId is carried separately (not in SessionUser type yet — see 3.6)
  }
}

/**
 * Extract orgId from RP's JWT payload.
 * Used for multi-org scoping on CG tables.
 */
export function extractOrgId(token: string): number {
  const payload = jwt.verify(token, RP_JWT_SECRET) as RPAuthPayload
  return payload.orgId
}
```

### 3.5 Rewrite `src/middleware.ts`

Read RP's `auth_token` cookie instead of `access_token`. For interviewee sessions, check the `cg_interviewee` cookie.

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifySession, createSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/session'
import { verifyRPToken } from '@/lib/auth/external'
import { verifyIntervieweeToken } from '@/lib/auth/interviewee'

const ROLE_PATH_RULES: Record<string, string[]> = {
  '/admin':       ['admin'],
  '/management':  ['admin', 'manager'],
  '/staff':       ['admin', 'manager', 'interviewer'],
  '/session':     ['admin', 'manager', 'interviewer', 'interviewee'],
}

function isAllowed(role: string, pathname: string): boolean {
  for (const [prefix, allowed] of Object.entries(ROLE_PATH_RULES)) {
    if (pathname.startsWith(prefix) && !allowed.includes(role)) return false
  }
  return true
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1. Try existing CG session
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value
  if (sessionToken) {
    const user = await verifySession(sessionToken)
    if (user) {
      if (!isAllowed(user.role, pathname)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const res = NextResponse.next()
      res.headers.set('x-user-id', user.id)
      res.headers.set('x-user-name', user.name)
      res.headers.set('x-user-email', user.email)
      res.headers.set('x-user-role', user.role)
      if (user.role_id) res.headers.set('x-role-id', user.role_id)
      if (user.screening_type_id) res.headers.set('x-screening-type-id', user.screening_type_id)
      if (user.difficulty) res.headers.set('x-difficulty', user.difficulty)
      return res
    }
  }

  // 2. Try RP's auth_token cookie (staff users)
  const rpToken = req.cookies.get('auth_token')?.value
  if (rpToken) {
    try {
      const user = verifyRPToken(rpToken)
      if (!isAllowed(user.role, pathname)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      // Create CG session to avoid re-verifying RP token on every request
      const newSessionToken = await createSession(user)
      const res = NextResponse.next()
      res.cookies.set(SESSION_COOKIE, newSessionToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_MAX_AGE,
        path: '/',
      })
      res.headers.set('x-user-id', user.id)
      res.headers.set('x-user-name', user.name)
      res.headers.set('x-user-email', user.email)
      res.headers.set('x-user-role', user.role)
      return res
    } catch {
      // Invalid RP token — fall through
    }
  }

  // 3. Try interviewee token (candidate session link)
  const intervieweeToken = req.cookies.get('cg_interviewee')?.value
  if (intervieweeToken) {
    try {
      const user = await verifyIntervieweeToken(intervieweeToken)
      if (!isAllowed(user.role, pathname)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const newSessionToken = await createSession(user)
      const res = NextResponse.next()
      res.cookies.set(SESSION_COOKIE, newSessionToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_MAX_AGE,
        path: '/',
      })
      res.headers.set('x-user-id', user.id)
      res.headers.set('x-user-name', user.name)
      res.headers.set('x-user-email', user.email)
      res.headers.set('x-user-role', user.role)
      if (user.role_id) res.headers.set('x-role-id', user.role_id)
      if (user.screening_type_id) res.headers.set('x-screening-type-id', user.screening_type_id)
      if (user.difficulty) res.headers.set('x-difficulty', user.difficulty)
      return res
    } catch {
      // Invalid interviewee token — fall through
    }
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|api/external).*)'],
}
```

### 3.6 New File: `src/lib/auth/interviewee.ts`

Handles candidate session access via `cg_interviewee_tokens` table:

```typescript
// src/lib/auth/interviewee.ts
import { eq, and, gt } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { cgIntervieweeTokensTable } from '@/lib/db/schema'
import type { SessionUser } from '@/types'

// RP candidates table — imported from shared schema
// import { candidatesTable } from '<shared-schema-path>'  // See Session 4

/**
 * Verify an interviewee token from the cg_interviewee cookie.
 * Looks up the token in DB, checks expiry, returns a scoped SessionUser.
 */
export async function verifyIntervieweeToken(token: string): Promise<SessionUser> {
  const [row] = await db
    .select()
    .from(cgIntervieweeTokensTable)
    .where(
      and(
        eq(cgIntervieweeTokensTable.token, token),
        gt(cgIntervieweeTokensTable.expiresAt, new Date()),
      )
    )
    .limit(1)

  if (!row) throw new Error('Invalid or expired interviewee token')

  // Mark as used on first access
  if (!row.usedAt) {
    await db
      .update(cgIntervieweeTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(cgIntervieweeTokensTable.id, row.id))
  }

  return {
    id: String(row.candidateId),
    name: '',  // Will be populated from RP candidates table in Session 4
    email: '',
    role: 'interviewee',
    role_id: row.roleId,
    screening_type_id: row.screeningTypeId,
    difficulty: row.difficulty as SessionUser['difficulty'],
  }
}

/**
 * Generate an interviewee token for a candidate's coding session.
 * Called when a staff member creates a screening.
 */
export async function createIntervieweeToken(
  candidateId: number,
  screeningId: string,
  roleId: string,
  screeningTypeId: string,
  difficulty: string | null,
  orgId: number,
): Promise<string> {
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await db.insert(cgIntervieweeTokensTable).values({
    id: crypto.randomUUID(),
    candidateId,
    screeningId,
    token,
    roleId,
    screeningTypeId,
    difficulty,
    expiresAt,
    orgId,
  })

  return token
}
```

### 3.7 New Dependency

Add to `package.json` (for RP JWT verification in Node.js route handlers):

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.9"
  }
}
```

> Note: Edge middleware uses `jose` (already installed) for CG session JWTs. The `jsonwebtoken` package is used in Node.js route handlers for RP token verification. If you want to avoid the extra dependency, you can verify RP tokens with `jose` as well — the HS256 algorithm is the same.

### 3.8 Update `src/app/api/auth/me/route.ts`

Replace the external HTTP call with direct RP token verification:

```typescript
// src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyRPToken } from '@/lib/auth/external'
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  const rpToken = req.cookies.get('auth_token')?.value
  if (!rpToken) {
    return NextResponse.json({ error: 'No auth token' }, { status: 401 })
  }

  try {
    const user = verifyRPToken(rpToken)
    const sessionToken = await createSession(user)

    const res = NextResponse.json(user)
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
```

### 3.9 New Endpoint: `POST /api/auth/interviewee`

Public endpoint that sets the interviewee cookie from a token in the URL query:

```typescript
// src/app/api/auth/interviewee/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyIntervieweeToken } from '@/lib/auth/interviewee'
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  try {
    const user = await verifyIntervieweeToken(token)
    const sessionToken = await createSession(user)

    // Redirect to session page
    const screeningId = req.nextUrl.searchParams.get('screening')
    const redirectUrl = screeningId ? `/session/${screeningId}` : '/'

    const res = NextResponse.redirect(new URL(redirectUrl, req.url))
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }
}
```

### 3.10 Verification Checklist

- [ ] `JWT_SECRET` env var shared between RP and CG (same value)
- [ ] Staff user logged into RP can access CG pages without re-login
- [ ] RP's `auth_token` cookie is correctly read by CG middleware
- [ ] Role mapping works: RP `super_admin` → CG `admin`, etc.
- [ ] Interviewee token generation works via `createIntervieweeToken()`
- [ ] Interviewee can access `/session/[id]` via token link
- [ ] `EXTERNAL_AUTH_URL` env var removed from `.env.example`
- [ ] `fetchExternalUser()` function replaced — no more external HTTP auth calls

---

## Session 4: Candidate & User Unification

### 4.1 Objective

Eliminate duplicate candidate and user stores. CodeGate reads candidates and users directly from Resume-Processor's existing Supabase tables.

### 4.2 Import RP's Schema Tables

Since both apps share the same Supabase database, CG can import RP's table definitions. Create a thin re-export:

```typescript
// src/lib/db/rp-schema.ts
// Re-declare RP table shapes for Drizzle queries.
// These MUST match Resume-Processor's lib/db/src/schema/candidates.ts exactly.
// DO NOT modify these — they are owned by RP.

import { pgTable, text, serial, integer, timestamp, boolean, uniqueIndex } from 'drizzle-orm/pg-core'

export const candidatesTable = pgTable(
  'candidates',
  {
    id: serial('id').primaryKey(),
    candidateId: text('candidate_id').notNull().unique(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    linkedinUrl: text('linkedin_url'),
    skills: text('skills'),
    source: text('source'),
    status: text('status').notNull().default('New'),
    department: text('department'),
    hiringRole: text('hiring_role'),
    notes: text('notes'),
    interviewer: text('interviewer'),
    currentCtc: text('current_ctc'),
    expectedCtc: text('expected_ctc'),
    noticePeriod: text('notice_period'),
    priority: text('priority').notNull().default('Medium'),
    resumeFileName: text('resume_file_name'),
    resumeFilePath: text('resume_file_path'),
    jobSlug: text('job_slug'),
    driveFileLink: text('drive_file_link'),
    driveFileId: text('drive_file_id'),
    sheetsRowId: text('sheets_row_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex('candidates_email_idx').on(table.email),
  })
)

export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  jobTitle: text('job_title'),
  department: text('department'),
  role: text('role').notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const organizationsTable = pgTable('organizations', {
  id: serial('id').primaryKey(),
  domain: text('domain').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const interviewsTable = pgTable('interviews', {
  id: serial('id').primaryKey(),
  candidateId: integer('candidate_id').notNull(),
  interviewerId: integer('interviewer_id').notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  mode: text('mode').notNull(),
  locationOrLink: text('location_or_link'),
  notes: text('notes'),
  rating: integer('rating'),
  status: text('status').notNull().default('scheduled'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

### 4.3 Implement Candidate Queries in `src/lib/db/queries.ts`

Replace the placeholder `throw` calls from Session 2:

```typescript
// Add to src/lib/db/queries.ts
import { candidatesTable, usersTable } from './rp-schema'

// RP role → CG role mapping
function mapRPUserRole(rpRole: string): User['role'] {
  switch (rpRole) {
    case 'super_admin': return 'admin'
    case 'admin':       return 'manager'
    case 'member':      return 'interviewer'
    default:            return 'interviewer'
  }
}

export async function getCandidates(): Promise<Candidate[]> {
  const rows = await db.select().from(candidatesTable)
  return rows.map((r) => ({
    id: String(r.id),
    name: r.fullName,
    email: r.email,
    applied_role_id: '',  // RP doesn't have CG role_id — will be empty or resolved via jobSlug
    created_at: r.createdAt.toISOString(),
    status: mapRPCandidateStatus(r.status),
  }))
}

export async function getCandidateById(id: string): Promise<Candidate | null> {
  const [row] = await db
    .select()
    .from(candidatesTable)
    .where(eq(candidatesTable.id, Number(id)))
    .limit(1)

  if (!row) return null
  return {
    id: String(row.id),
    name: row.fullName,
    email: row.email,
    applied_role_id: '',
    created_at: row.createdAt.toISOString(),
    status: mapRPCandidateStatus(row.status),
  }
}

export async function getCandidateByEmail(email: string): Promise<Candidate | null> {
  const [row] = await db
    .select()
    .from(candidatesTable)
    .where(eq(candidatesTable.email, email))
    .limit(1)

  if (!row) return null
  return {
    id: String(row.id),
    name: row.fullName,
    email: row.email,
    applied_role_id: '',
    created_at: row.createdAt.toISOString(),
    status: mapRPCandidateStatus(row.status),
  }
}

export async function getUsers(): Promise<User[]> {
  const rows = await db.select().from(usersTable)
  return rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    email: r.email,
    role: mapRPUserRole(r.role),
  }))
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1)

  if (!row) return null
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    role: mapRPUserRole(row.role),
  }
}

/** Map RP candidate statuses to CG's simpler status enum */
function mapRPCandidateStatus(rpStatus: string): Candidate['status'] {
  switch (rpStatus) {
    case 'Rejected': return 'rejected'
    case 'Selected': return 'hired'
    case 'New':
    case 'Shortlisted':
    case 'Interviewed':
    case 'Screening Form Sent':
    case 'Screening Response Received':
    case 'Promoted to next round':
    default: return 'active'
  }
}
```

### 4.4 Org-Scoped Queries

Add `orgId` filtering to screening queries so each organization only sees its own data:

```typescript
// Update getScreenings in src/lib/db/queries.ts
export async function getScreenings(caller?: SessionUser, orgId?: number): Promise<Screening[]> {
  const conditions = []
  if (orgId) conditions.push(eq(cgScreeningsTable.orgId, orgId))

  const rows = conditions.length
    ? await db.select().from(cgScreeningsTable).where(and(...conditions))
    : await db.select().from(cgScreeningsTable)

  let screenings = rows.map(dbToScreening)

  if (!caller || caller.role === 'admin' || caller.role === 'manager') return screenings
  if (caller.role === 'interviewer') return screenings.filter((s) => s.interviewer_id === caller.id)
  if (caller.role === 'interviewee') return screenings.filter((s) => s.candidate_id === caller.id)
  return []
}
```

### 4.5 Extend SessionUser Type

Add `orgId` to the session so it's available in route handlers:

```typescript
// Update in src/types/index.ts
export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  org_id?: number              // NEW: from RP's JWT orgId
  role_id?: string
  screening_type_id?: string
  difficulty?: Question['difficulty']
}
```

Update `verifyRPToken()` in `external.ts` to include `org_id`:
```typescript
return {
  id: String(payload.userId),
  name: payload.name,
  email: payload.email,
  role: mapRole(payload.role),
  org_id: payload.orgId,  // NEW
}
```

### 4.6 API Route Updates for Candidate CRUD

CG's `POST /api/candidates` and `PATCH /api/candidates/[id]` should be removed or converted to read-only wrappers:

**`src/app/api/candidates/route.ts` — GET stays, POST removed:**

```typescript
// POST handler — remove or return error
export async function POST() {
  return NextResponse.json(
    { error: 'Candidate creation is managed by Resume-Processor' },
    { status: 405 }
  )
}
```

**`src/app/api/candidates/[id]/route.ts` — GET stays (enriched with CG screening data), PATCH restricted:**

The GET handler should return RP candidate data + CG screening performance:
```typescript
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getServerUser()
  requireRole(user, ['admin', 'manager', 'interviewer'])

  const candidate = await getCandidateById(params.id)
  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const screenings = (await getScreenings()).filter((s) => s.candidate_id === params.id)
  const pipeline = await getCandidatePipelineSnapshot(params.id)

  // Compute performance (same logic as before)
  const completed = pipeline.filter((p) => p.status === 'completed')
  const scores = completed.map((p) => p.overall_score).filter((s): s is number => s !== null)
  const performance = {
    average_score: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    completed_stages: completed.length,
    total_stages: screenings.length,
    recommendation_counts: /* ... same as before ... */,
  }

  return NextResponse.json({ candidate, screenings, performance })
}
```

### 4.7 Verification Checklist

- [ ] `src/lib/db/rp-schema.ts` created with RP table definitions
- [ ] `getCandidates()`, `getCandidateById()`, `getCandidateByEmail()` read from RP's `candidates` table
- [ ] `getUsers()`, `getUserByEmail()` read from RP's `users` table
- [ ] Role mapping works: RP `member` → CG `interviewer`, etc.
- [ ] Status mapping works: RP `Selected` → CG `hired`, etc.
- [ ] `POST /api/candidates` returns 405
- [ ] `GET /api/candidates/[id]` returns RP candidate + CG screening data
- [ ] `org_id` is present in SessionUser and used in screening queries
- [ ] CG's `users/route.ts` and `users/[id]/route.ts` read from RP's users table (no separate user creation)

---

## Session 5: Status Sync & Interview Linking

### 5.1 Objective

When a CodeGate screening is completed, automatically:
1. Update the candidate's status in RP's `candidates` table
2. Write the overall score to RP's `interviews` table
3. Optionally link CG screenings to RP interviews at creation time

### 5.2 Status Sync Service

Create `src/lib/sync/status-sync.ts`:

```typescript
// src/lib/sync/status-sync.ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { candidatesTable, interviewsTable } from '@/lib/db/rp-schema'
import type { Screening, Recommendation } from '@/types'

/**
 * Map CG screening completion to RP candidate status.
 *
 * Called after interviewer submits final review in CG.
 * Updates RP's candidates.status based on recommendation.
 */
export async function syncScreeningToRP(screening: {
  candidate_id: string
  overall_score: number | null
  recommendation: Recommendation | null
  notes: string | null
  rp_interview_id: number | null
}): Promise<void> {
  const candidateId = Number(screening.candidate_id)

  // 1. Update RP candidate status
  const newStatus = mapRecommendationToRPStatus(screening.recommendation)
  if (newStatus) {
    await db
      .update(candidatesTable)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(candidatesTable.id, candidateId))
  }

  // 2. If linked to an RP interview, update its rating
  if (screening.rp_interview_id && screening.overall_score) {
    await db
      .update(interviewsTable)
      .set({
        rating: screening.overall_score,
        status: 'completed',
        notes: screening.notes,
        updatedAt: new Date(),
      })
      .where(eq(interviewsTable.id, screening.rp_interview_id))
  }
}

function mapRecommendationToRPStatus(rec: Recommendation | null): string | null {
  switch (rec) {
    case 'strong_yes':
    case 'yes':
      return 'Interviewed'  // Positive — move to interviewed, not auto-selected
    case 'neutral':
      return 'Interviewed'
    case 'no':
    case 'strong_no':
      return 'Rejected'
    default:
      return null  // Don't change status if no recommendation
  }
}
```

### 5.3 Wire Sync into Screening Completion

The sync is triggered in two places:

**A. Pipeline Snapshot Route** (`src/app/api/screenings/pipeline-snapshot/route.ts`):

Add after the `syncCandidatePipelineSnapshot()` call:

```typescript
import { syncScreeningToRP } from '@/lib/sync/status-sync'
import { cgScreeningsTable } from '@/lib/db/schema'

// ... existing pipeline snapshot logic ...

// After building and saving the pipeline snapshot:
// Fetch the screening to get rp_interview_id
const [screeningRow] = await db
  .select()
  .from(cgScreeningsTable)
  .where(eq(cgScreeningsTable.id, body.screening_id))
  .limit(1)

if (screeningRow) {
  await syncScreeningToRP({
    candidate_id: String(screeningRow.candidateId),
    overall_score: body.overall_score,
    recommendation: body.recommendation,
    notes: body.notes,
    rp_interview_id: screeningRow.rpInterviewId,
  })
}
```

**B. Screening Update Route** (`PATCH /api/screenings/[id]`):

When status changes to `completed`, trigger sync:

```typescript
// In the PATCH handler, after updateScreening():
if (data.status === 'completed') {
  const screening = await getScreeningById(id)
  if (screening) {
    await syncScreeningToRP({
      candidate_id: screening.candidate_id,
      overall_score: data.overall_score ?? screening.overall_score,
      recommendation: (data.recommendation ?? screening.recommendation) as Recommendation | null,
      notes: data.notes ?? screening.notes,
      rp_interview_id: screeningRow?.rpInterviewId ?? null,
    })
  }
}
```

### 5.4 Interview Linking at Creation Time

When RP schedules an interview with `mode = "coding_round"`, it can pass the RP interview ID to CG when creating a screening:

Update `POST /api/screenings` to accept optional `rp_interview_id`:

```typescript
// In CreateScreeningPayload — add optional field
export interface CreateScreeningPayload {
  candidate_id: string
  role_id: string
  screening_type_id: string
  rp_interview_id?: number  // NEW: link back to RP's interviews table
}
```

Update `createScreening()` in mutations to store it:

```typescript
export async function createScreening(
  data: CreateScreeningPayload,
  interviewer_id: string,
  orgId: number,
): Promise<Screening> {
  const id = generateId()
  const [row] = await db.insert(cgScreeningsTable).values({
    id,
    candidateId: Number(data.candidate_id),
    roleId: data.role_id,
    screeningTypeId: data.screening_type_id,
    interviewerId: Number(interviewer_id),
    status: 'in_progress',
    scheduledAt: new Date(),
    rpInterviewId: data.rp_interview_id ?? null,  // NEW
    orgId,
  }).returning()
  // ... return Screening object
}
```

### 5.5 Full Status Flow Diagram

```
RP: Schedule Interview (mode=coding_round)
  │
  ├─→ RP interviews table: status=scheduled
  │
  ▼
CG: POST /api/screenings { candidate_id, rp_interview_id }
  │
  ├─→ cg_screenings table: status=in_progress
  ├─→ cg_interviewee_tokens: token generated, emailed to candidate
  │
  ▼
Candidate takes coding round in CG
  │
  ├─→ cg_code_submissions: code runs saved
  ├─→ cg_drawings: design drawings saved
  │
  ▼
Interviewer reviews & submits scores in CG
  │
  ├─→ cg_responses: per-question scores saved
  ├─→ cg_candidate_pipeline: denormalized snapshot saved
  │
  ├─→ syncScreeningToRP() triggers:
  │     ├─→ RP candidates.status → "Interviewed" or "Rejected"
  │     └─→ RP interviews.rating → overall_score
  │         RP interviews.status → "completed"
  │
  ▼
RP Dashboard shows updated candidate with coding round score
```

### 5.6 Verification Checklist

- [ ] `src/lib/sync/status-sync.ts` created
- [ ] `syncScreeningToRP()` updates RP `candidates.status` based on recommendation
- [ ] `syncScreeningToRP()` updates RP `interviews.rating` and `interviews.status` when linked
- [ ] Pipeline snapshot route triggers sync after saving snapshot
- [ ] `createScreening()` accepts and stores `rp_interview_id`
- [ ] `CreateScreeningPayload` type updated
- [ ] End-to-end test: complete a screening in CG → verify RP candidate status changed

---

## Session 6: Storage Migration

### 6.1 Objective

Replace Vercel Blob with Supabase Storage for large Excalidraw drawings (>100KB). Use RP's existing Supabase project.

### 6.2 New Dependency

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.49.4"
  }
}
```

### 6.3 Supabase Storage Client

Create `src/lib/storage/supabase.ts`:

```typescript
// src/lib/storage/supabase.ts
import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const BUCKET = 'codegate-drawings'
const SIZE_THRESHOLD = 100 * 1024  // 100KB

/**
 * Store drawing JSON. If >100KB, upload to Supabase Storage and return URL.
 * Otherwise return the JSON string directly (stored inline in DB).
 */
export async function storeDrawingJson(
  screeningId: string,
  questionId: string,
  json: string,
): Promise<string> {
  if (json.length <= SIZE_THRESHOLD) return json

  const path = `${screeningId}/${questionId}/${Date.now()}.json`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, json, { contentType: 'application/json', upsert: true })

  if (error) throw new Error(`Drawing upload failed: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Retrieve drawing JSON. If it's a URL, fetch it. Otherwise return as-is.
 */
export async function retrieveDrawingJson(stored: string): Promise<string> {
  if (!stored.startsWith('http')) return stored

  const res = await fetch(stored)
  if (!res.ok) throw new Error(`Drawing fetch failed: ${res.status}`)
  return res.text()
}
```

### 6.4 Create Supabase Bucket

Run once (or add to a setup script):

```bash
# Via Supabase dashboard: create bucket "codegate-drawings", set to public
# Or via Supabase CLI:
# supabase storage create codegate-drawings --public
```

### 6.5 Update Drawing Routes

In `POST /api/drawings` route, call `storeDrawingJson()` before saving:

```typescript
import { storeDrawingJson } from '@/lib/storage/supabase'

// In POST handler:
const storedJson = await storeDrawingJson(
  body.screening_id,
  body.question_id,
  body.excalidraw_json,
)
await appendDrawing({ ...body, excalidraw_json: storedJson }, user.id)
```

In `GET /api/drawings` route, call `retrieveDrawingJson()` before returning:

```typescript
import { retrieveDrawingJson } from '@/lib/storage/supabase'

// In GET handler:
const drawing = await getLatestDrawing(screening_id, question_id, user)
if (drawing) {
  drawing.excalidraw_json = await retrieveDrawingJson(drawing.excalidraw_json)
}
```

### 6.6 Verification Checklist

- [ ] `codegate-drawings` bucket created in Supabase (public)
- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` added to `.env.local`
- [ ] Drawings <100KB stored inline in DB (no upload)
- [ ] Drawings >100KB uploaded to Supabase Storage, URL stored in DB
- [ ] `BLOB_READ_WRITE_TOKEN` removed from `.env.example`
- [ ] Reading drawings works for both inline and URL-stored drawings

---

## Session 7: Environment & Deployment

### 7.1 Objective

Clean up environment variables, remove unused dependencies, update deployment config, and verify end-to-end flow.

### 7.2 Updated `.env.example`

```bash
# ============================================================================
# Database — Supabase PostgreSQL (same instance as Resume-Processor)
# ============================================================================
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# ============================================================================
# Supabase Storage (for large Excalidraw drawings)
# ============================================================================
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ============================================================================
# Auth — shared JWT secret with Resume-Processor
# ============================================================================
# MUST match Resume-Processor's JWT_SECRET
JWT_SECRET=your-shared-jwt-secret

# Internal CG session secret (separate from JWT_SECRET)
# Generate: openssl rand -base64 32
SESSION_SECRET=your-random-session-secret

# Optional: Session TTL in hours (default: 8)
# SESSION_TTL_HOURS=8

# ============================================================================
# Code Execution Service (Piston API)
# ============================================================================
# Self-hosted (recommended): http://your-piston-vps:2000
# Public (dev only):          https://emkc.org
CODE_EXECUTION_URL=https://emkc.org

# ============================================================================
# Node environment
# ============================================================================
NODE_ENV=development
```

### 7.3 Removed Variables (compared to original)

| Variable | Reason |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | No more Google Sheets |
| `GOOGLE_PRIVATE_KEY` | No more Google Sheets |
| `GOOGLE_SHEET_ID` | No more Google Sheets |
| `EXTERNAL_AUTH_URL` | Auth via shared JWT, no external HTTP call |
| `BLOB_READ_WRITE_TOKEN` | Replaced by Supabase Storage |

### 7.4 New Variables (compared to original)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection (shared with RP) |
| `SUPABASE_URL` | Supabase project URL (for Storage) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for Storage) |
| `JWT_SECRET` | Shared JWT secret with RP (for auth bridge) |

### 7.5 Dependency Changes

**Add:**
```
drizzle-orm, pg, @types/pg, drizzle-kit
jsonwebtoken, @types/jsonwebtoken
@supabase/supabase-js
```

**Remove:**
```
googleapis
```

**Keep (unchanged):**
```
jose (CG internal session signing)
@monaco-editor/react (code editor)
@excalidraw/excalidraw (whiteboarding)
zustand (client state)
next, react, tailwindcss, radix-ui, etc.
```

### 7.6 Updated `vercel.json`

```json
{
  "regions": ["iad1"],
  "functions": {
    "api/execute": {
      "maxDuration": 15
    }
  },
  "env": {
    "DATABASE_URL": "@database-url",
    "SUPABASE_URL": "@supabase-url",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-role-key",
    "JWT_SECRET": "@jwt-secret",
    "SESSION_SECRET": "@session-secret",
    "CODE_EXECUTION_URL": "@code-execution-url"
  }
}
```

### 7.7 Updated `next.config.ts`

Remove `googleapis` from webpack externals (no longer needed). Keep Monaco and Excalidraw externals.

### 7.8 Migration Script: Sheets → Supabase

For existing data in Google Sheets, create a one-time migration script:

```typescript
// scripts/migrate-sheets-to-supabase.ts
// Run once to migrate existing data from Google Sheets to Supabase.
// This is a standalone script — not part of the app.
//
// Usage: npx tsx scripts/migrate-sheets-to-supabase.ts
//
// Steps:
// 1. Read all rows from each Google Sheets tab
// 2. Transform to Drizzle insert format
// 3. Insert into corresponding cg_* Supabase tables
// 4. Log results
//
// IMPORTANT: Run this BEFORE switching the app to use Supabase.
// After migration, verify data in Supabase dashboard, then deploy the new code.
```

This script would:
1. Read `roles` sheet → insert into `cg_roles`
2. Read `screening_types` sheet → insert into `cg_screening_types`
3. Read `questions` sheet → insert into `cg_questions`
4. Read `screenings` sheet → insert into `cg_screenings` (mapping candidate emails → RP candidate IDs)
5. Read `responses` sheet → insert into `cg_responses`
6. Read `code_submissions` sheet → insert into `cg_code_submissions`
7. Read `drawings` sheet → insert into `cg_drawings`
8. Read `candidate_pipeline` sheet → insert into `cg_candidate_pipeline`
9. Read `api_keys` sheet → insert into `cg_api_keys`

### 7.9 End-to-End Verification Checklist

- [ ] **DB:** All `cg_*` tables exist in Supabase, data migrated from Sheets
- [ ] **Auth:** Staff logged into RP can access CG without re-login
- [ ] **Auth:** Interviewee can access session via token link
- [ ] **Candidates:** CG reads candidates from RP's table, no duplication
- [ ] **Users:** CG reads users from RP's table, roles correctly mapped
- [ ] **Screenings:** CRUD works with Drizzle, org-scoped
- [ ] **Code Execution:** Piston proxy still works (unchanged)
- [ ] **Drawings:** Small drawings stored inline, large ones in Supabase Storage
- [ ] **Scoring:** Pipeline snapshot builds correctly from Drizzle data
- [ ] **Status Sync:** Completing a screening updates RP candidate status
- [ ] **Interview Link:** CG screening linked to RP interview, rating flows back
- [ ] **External API:** API key auth works with Supabase, scopes enforced
- [ ] **Build:** `npm run build` passes with zero type errors
- [ ] **Deploy:** Vercel deployment succeeds with new env vars

---

## Appendix A: File Change Summary

### New Files

| File | Session | Purpose |
|---|---|---|
| `drizzle.config.ts` | 1 | Drizzle Kit config for CG tables |
| `src/lib/db/client.ts` | 1 | Supabase PostgreSQL connection |
| `src/lib/db/schema/index.ts` | 1 | Schema barrel export |
| `src/lib/db/schema/codegate.ts` | 1 | All `cg_*` table definitions |
| `src/lib/db/queries.ts` | 2 | Read operations (replaces sheets/queries.ts) |
| `src/lib/db/mutations.ts` | 2 | Write operations (replaces sheets/mutations.ts) |
| `src/lib/db/reporting.ts` | 2 | Pipeline snapshot builder (copy from sheets/) |
| `src/lib/db/rp-schema.ts` | 4 | Read-only RP table definitions |
| `src/lib/auth/interviewee.ts` | 3 | Interviewee token management |
| `src/lib/sync/status-sync.ts` | 5 | CG → RP status sync |
| `src/lib/storage/supabase.ts` | 6 | Supabase Storage for drawings |
| `src/app/api/auth/interviewee/route.ts` | 3 | Interviewee token auth endpoint |
| `scripts/migrate-sheets-to-supabase.ts` | 7 | One-time data migration |

### Modified Files

| File | Session | Changes |
|---|---|---|
| `package.json` | 1, 6 | Add drizzle-orm, pg, supabase-js; remove googleapis |
| `.env.example` | 7 | Replace Sheets vars with Supabase + JWT vars |
| `vercel.json` | 7 | Update env references |
| `next.config.ts` | 7 | Remove googleapis from externals |
| `src/types/index.ts` | 4 | Add `org_id` to SessionUser |
| `src/middleware.ts` | 3 | Read RP's `auth_token` cookie, handle interviewee tokens |
| `src/lib/auth/external.ts` | 3 | Replace HTTP fetch with direct JWT verification |
| `src/lib/auth/external-api.ts` | 2 | Update imports from sheets → db |
| `src/lib/auth/config.ts` | — | No changes (reads from headers) |
| `src/lib/auth/session.ts` | — | No changes (jose JWT signing) |
| `src/app/api/auth/me/route.ts` | 3 | Direct RP token verification |
| `src/app/api/candidates/route.ts` | 4 | Remove POST, update imports |
| `src/app/api/screenings/route.ts` | 5 | Add rp_interview_id support |
| `src/app/api/screenings/pipeline-snapshot/route.ts` | 5 | Trigger status sync |
| `src/app/api/drawings/route.ts` | 6 | Use Supabase Storage |
| All other `src/app/api/*/route.ts` | 2 | Update imports from sheets → db |

### Deleted Files

| File | Session | Reason |
|---|---|---|
| `src/lib/sheets/client.ts` | 2 | Replaced by db/client.ts |
| `src/lib/sheets/queries.ts` | 2 | Replaced by db/queries.ts |
| `src/lib/sheets/mutations.ts` | 2 | Replaced by db/mutations.ts |
| `src/lib/sheets/reporting.ts` | 2 | Moved to db/reporting.ts |

---

## Appendix B: Type System Impact

### CG Types That Change

| Type | Change | Reason |
|---|---|---|
| `SessionUser` | Add `org_id?: number` | Multi-org scoping from RP |
| `CreateScreeningPayload` | Add `rp_interview_id?: number` | Interview linking |
| `Candidate.id` | Remains `string` but holds RP's numeric `id` as string | CG uses string IDs throughout, RP uses integers. Conversion at query boundary. |

### CG Types That Stay Identical

All other types in `src/types/index.ts` remain unchanged:
- `Role`, `ScreeningType`, `Question`, `Screening`, `Response`
- `CodeSubmission`, `Drawing`, `User`, `ApiKey`
- `CandidatePipelineSnapshot`, `CandidatePerformance`
- All answer types, all payload types, `ExecResult`

---

## Appendix C: Risk Mitigation

| Risk | Mitigation |
|---|---|
| RP schema changes break CG | `rp-schema.ts` is a manual copy — add a CI check that diffs it against RP's schema |
| Shared DB credentials | Both apps must use the same Supabase project; `DATABASE_URL` is identical |
| Migration data loss | Run migration script with `--dry-run` first; keep Sheets as read-only backup for 30 days |
| Auth cookie domain mismatch | RP and CG must be on the same domain (or subdomain) for cookie sharing. If on different domains, use RP's API as a token proxy. |
| Performance regression | Drizzle → PostgreSQL queries are faster than Sheets API calls (no HTTP overhead, real indexes). Performance will improve. |
| CG writes to RP tables | CG only writes to `candidates.status`, `candidates.updatedAt`, and `interviews.rating/status/notes`. All other RP tables are read-only from CG. |
