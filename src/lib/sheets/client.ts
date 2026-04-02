import { google } from 'googleapis'

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

export const sheets = google.sheets({ version: 'v4', auth })

export const SHEET_ID = process.env.GOOGLE_SHEET_ID!

// Column ranges must match data-schema.md exactly
export const RANGES = {
  roles:               'roles!A:C',
  screening_types:     'screening_types!A:C',
  questions:           'questions!A:L',            // 12 cols: id..active
  candidates:          'candidates!A:F',
  screenings:          'screenings!A:K',           // 11 cols: id..notes
  responses:           'responses!A:G',            // 7 cols: id..submitted_at (includes question_type)
  code_submissions:    'code_submissions!A:J',
  drawings:            'drawings!A:F',
  users:               'users!A:D',
  candidate_pipeline:  'candidate_pipeline!A:N',   // 14 cols: id..completed_at
  api_keys:            'api_keys!A:H',             // 8 cols: id..active
} as const
