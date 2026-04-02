# Google Sheets Integration Reference

## Authentication

Uses a **service account** (not OAuth user flow). The service account is granted Editor access to the workbook.

Credentials stored as server-only environment variables — never committed to source, never prefixed `NEXT_PUBLIC_`.

Required env vars:
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEET_ID=
```

`GOOGLE_PRIVATE_KEY` is the PEM key with literal `\n`. In code:
```typescript
privateKey: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n')
```

## Client Initialization (`lib/sheets/client.ts`)

```typescript
import { google } from 'googleapis'

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

export const sheets = google.sheets({ version: 'v4', auth })
export const SHEET_ID = process.env.GOOGLE_SHEET_ID!
```

## Range Constants

All ranges defined in `client.ts`. Column counts must match the schema exactly.

```typescript
export const RANGES = {
  roles:            'roles!A:C',
  screening_types:  'screening_types!A:C',
  questions:        'questions!A:L',    // 12 columns (added type, starter_code, language)
  candidates:       'candidates!A:F',
  screenings:       'screenings!A:K',
  responses:        'responses!A:G',    // 7 columns (added question_type)
  code_submissions: 'code_submissions!A:J',
  drawings:         'drawings!A:F',
  users:            'users!A:D',
} as const
```

## Reading Data (`lib/sheets/queries.ts`)

```typescript
async function getRows(range: string): Promise<string[][]> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range })
  const rows = res.data.values ?? []
  return rows.slice(1).filter((r) => r[0]) // skip header, skip empty rows
}
```

All read functions call `getRows()` then map with typed row mappers. Never return raw `string[][]` to callers.

## Batch Read Pattern

When a page needs multiple tabs, use `batchGet` — one API call:

```typescript
const res = await sheets.spreadsheets.values.batchGet({
  spreadsheetId: SHEET_ID,
  ranges: [RANGES.roles, RANGES.screening_types, RANGES.questions],
})
const [rolesRaw, typesRaw, questionsRaw] = res.data.valueRanges ?? []
```

## Writing Data (`lib/sheets/mutations.ts`)

### Append new rows

```typescript
await sheets.spreadsheets.values.append({
  spreadsheetId: SHEET_ID,
  range: RANGES.code_submissions,
  valueInputOption: 'RAW',
  requestBody: {
    values: [[id, screening_id, question_id, candidate_id, language, code, stdout, stderr, exit_code, submitted_at]],
  },
})
```

### Update in-place (screenings only)

Find the row index first, then update specific cells:

```typescript
// screenings rows: index 0 = first data row = sheet row 2
const sheetRow = rowIndex + 2

await sheets.spreadsheets.values.update({
  spreadsheetId: SHEET_ID,
  range: `screenings!F${sheetRow}`,   // status column
  valueInputOption: 'RAW',
  requestBody: { values: [['completed']] },
})
```

For multiple cell updates in one screening, use `Promise.all` over individual update calls.

## ISR Caching

Questions and reference data are wrapped in Next.js fetch-based ISR. Dynamic session data is not cached.

```typescript
// Cacheable — questions, roles, screening_types
// Use googleapis client with revalidate hint via a wrapper fetch
// Or use unstable_cache from next/cache:
import { unstable_cache } from 'next/cache'

export const getRoles = unstable_cache(
  async () => { /* googleapis call */ },
  ['roles'],
  { revalidate: 300 }
)

// Dynamic — screenings, responses, code_submissions, drawings
// Call googleapis directly, no cache wrapper
```

## Rate Limits

- 60 read requests / min per project
- 60 write requests / min per project

Mitigations:
- `batchGet` when loading multiple tabs simultaneously
- ISR caching for questions, roles, screening_types
- Code submissions and drawings are append-only — writes are infrequent
- Never call Sheets from client components or edge middleware

## Error Handling

Wrap all sheets calls in try/catch. Surface as HTTP 500 to clients:

```typescript
try {
  await sheets.spreadsheets.values.append({ ... })
} catch (error) {
  throw new Error(`Sheets write failed: ${error instanceof Error ? error.message : 'unknown'}`)
}
```

## Code Submission Storage Note

The `code` column in `code_submissions` stores the full source. For typical DSA problems this is 50–500 bytes. Sheets cells support up to 50,000 characters — sufficient for all interview code. No external blob storage needed for code.

For Excalidraw drawings, see `docs/architecture.md` for the inline JSON vs Vercel Blob fallback.
