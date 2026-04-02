# Data Schema — Google Sheets

Single workbook. Row 1 is always the header. All IDs are UUID v4 strings generated in the app before writing. Column names are case-sensitive.

---

## Tab: `roles`

Job roles candidates apply for.

| Column | Type | Example |
|--------|------|---------|
| id | string (uuid) | `role_fe_001` |
| name | string | `Frontend Engineer` |
| description | string | `React, TypeScript, CSS` |

---

## Tab: `screening_types`

Pipeline stages in order.

| Column | Type | Example |
|--------|------|---------|
| id | string (uuid) | `st_hr_001` |
| name | string | `Technical Interview` |
| stage_order | number | `3` |

Typical pipeline:
1. HR Screen
2. Technical Phone Screen
3. Technical Interview (DSA / Code)
4. System Design
5. Behavioral
6. Final Round

---

## Tab: `questions`

Question bank. Source of truth for all screenings.

| Column | Type | Notes |
|--------|------|-------|
| id | string (uuid) | Primary key |
| role_id | ref roles.id | Which role this question targets |
| screening_type_id | ref screening_types.id | Which stage this belongs to |
| type | string: `text`\|`code`\|`system_design` | Determines how it renders |
| text | string | The question prompt |
| difficulty | string: `easy`\|`medium`\|`hard` | Used for interviewee scoping |
| category | string | e.g. `Dynamic Programming`, `Database Design` |
| rubric | string | Scoring guide — visible to interviewer only |
| expected_answer | string | Model answer — visible to interviewer only |
| starter_code | string | Initial code for `code` type questions |
| language | string | Default language: `python`, `javascript`, `java`, `go` etc. |
| active | boolean string: `TRUE`\|`FALSE` | Inactive questions excluded from sessions |

> `type = text`: `starter_code` and `language` are empty.
> `type = system_design`: `starter_code`, `language`, `rubric` describe the design brief.
> `type = code`: all columns used.

---

## Tab: `candidates`

One row per candidate in the pipeline.

| Column | Type | Example |
|--------|------|---------|
| id | string (uuid) | `cand_001` |
| name | string | `Jane Smith` |
| email | string | `jane@example.com` |
| applied_role_id | ref roles.id | `role_fe_001` |
| created_at | ISO 8601 | `2026-04-01T10:00:00Z` |
| status | string: `active`\|`hired`\|`rejected`\|`hold` | `active` |

---

## Tab: `screenings`

One row per screening session (candidate × stage).

| Column | Type | Example |
|--------|------|---------|
| id | string (uuid) | `scr_001` |
| candidate_id | ref candidates.id | `cand_001` |
| role_id | ref roles.id | `role_fe_001` |
| screening_type_id | ref screening_types.id | `st_tech_001` |
| interviewer_id | ref users.id | `usr_001` |
| status | string: `scheduled`\|`in_progress`\|`completed`\|`cancelled` | `completed` |
| scheduled_at | ISO 8601 | `2026-04-01T14:00:00Z` |
| completed_at | ISO 8601 | `2026-04-01T15:30:00Z` |
| overall_score | number 1–5 | `4` |
| recommendation | string: `strong_yes`\|`yes`\|`neutral`\|`no`\|`strong_no` | `yes` |
| notes | string | `Strong on algorithms, weak on system design` |

---

## Tab: `responses`

One row per question scored by the interviewer.

| Column | Type | Example |
|--------|------|---------|
| id | string (uuid) | `resp_001` |
| screening_id | ref screenings.id | `scr_001` |
| question_id | ref questions.id | `q_001` |
| question_type | string: `text`\|`code`\|`system_design` | `code` |
| score | number 1–5 | `4` |
| notes | string | `O(n log n) solution, explained trade-offs` |
| submitted_at | ISO 8601 | `2026-04-01T15:00:00Z` |

---

## Tab: `code_submissions`

One row per code submission by a candidate during a screening.

| Column | Type | Example |
|--------|------|---------|
| id | string (uuid) | `cs_001` |
| screening_id | ref screenings.id | `scr_001` |
| question_id | ref questions.id | `q_002` |
| candidate_id | ref candidates.id | `cand_001` |
| language | string | `python` |
| code | string | Full source code |
| stdout | string | Program output |
| stderr | string | Error output |
| exit_code | number | `0` = success |
| submitted_at | ISO 8601 | `2026-04-01T14:45:00Z` |

> Multiple submissions per question are allowed. Each run creates a new row. Interviewer sees the latest non-empty submission.

---

## Tab: `drawings`

One row per saved system design drawing.

| Column | Type | Example |
|--------|------|---------|
| id | string (uuid) | `drw_001` |
| screening_id | ref screenings.id | `scr_001` |
| question_id | ref questions.id | `q_003` |
| candidate_id | ref candidates.id | `cand_001` |
| excalidraw_json | string | Excalidraw state JSON, or Vercel Blob URL if >100KB |
| submitted_at | ISO 8601 | `2026-04-01T14:55:00Z` |

> Auto-saved every 30s during the session. Multiple rows may exist; read the latest by `submitted_at`.

---

## Tab: `users`

Staff who access the platform (admin, manager, interviewer). Not candidates.

| Column | Type | Example |
|--------|------|---------|
| id | string (uuid) | `usr_001` |
| name | string | `Alex Johnson` |
| email | string | `alex@company.com` |
| role | string: `admin`\|`manager`\|`interviewer` | `interviewer` |

---

## Tab: `candidate_pipeline` (Reporting)

Denormalized snapshot of each candidate's complete pipeline journey. One row per (candidate, screening). Synced atomically when interviewer completes a screening. Used by external APIs to report on candidate progress.

| Column | Type | Notes |
|--------|------|-------|
| id | string (uuid) | Primary key |
| candidate_id | ref candidates.id | Candidate being assessed |
| screening_id | ref screenings.id | Screening session |
| role_id | ref roles.id | Applied role |
| screening_type_id | ref screening_types.id | Pipeline stage |
| status | string: `completed`\|`in_progress` | Stage completion |
| overall_score | number 1–5 | Interviewer final score |
| recommendation | string | `strong_yes`\|`yes`\|`neutral`\|`no`\|`strong_no` |
| responses_json | string | JSON array of all question scores + notes |
| code_submissions_json | string | JSON array of code attempts with exec results |
| drawings_json | string | JSON array of system design drawing snapshots |
| interviewer_notes | string | Final assessment notes |
| created_at | ISO 8601 | When screening started |
| completed_at | ISO 8601 | When screening ended |

> Auto-populated atomically when interviewer submits review. Denormalization for fast external API reads.

---

## Tab: `api_keys` (External Integrations)

API keys for 3rd-party ATS/HR tools to read candidate pipeline data.

| Column | Type | Example |
|--------|------|---------|
| id | string (uuid) | `api_key_001` |
| name | string | `ATS Sync - Lever` |
| hashed_key | string | SHA256(key) — key not stored plaintext |
| scope | string | Comma-separated: `candidates`, `screenings`, `reports` |
| created_by | ref users.id | Admin who created it |
| created_at | ISO 8601 | `2026-04-01T10:00:00Z` |
| last_used_at | ISO 8601 | Last API call timestamp |
| active | boolean string: `TRUE`\|`FALSE` | Can toggle to revoke |

> Keys issued by admin. External tools pass key in `Authorization: Bearer <key>` header on API calls. Hashed server-side before storage.

---

## Notes

- All 11 tabs must exist before running the app. Create manually in the workbook.
- Headers are case-sensitive and must exactly match the column names above.
- App appends new rows for all tabs except `screenings` and `candidate_pipeline` — which are updated in-place.
- `candidate_pipeline` is a denormalization of `screenings` + `responses` + `code_submissions` + `drawings`. Synced atomically when a screening completes (Phase 5).
- `api_keys` managed by admin via `/api/admin/api-keys/` endpoints. Hashing happens server-side only.
- `candidates` are authenticated as `interviewee` via the external auth system — they do not have rows in the `users` tab.
