# Google Sheets Setup

## Step 1: Create a Google Cloud Project

1. Go to console.cloud.google.com
2. Create new project → name it `codegate`
3. Enable **Google Sheets API**: APIs & Services → Enable APIs → "Google Sheets API" → Enable

## Step 2: Create a Service Account

1. IAM & Admin → Service Accounts → Create Service Account
2. Name: `codegate-service`
3. Skip GCP role assignment (access is granted via Sheet sharing below)
4. Keys tab → Add Key → JSON → Download

From the downloaded JSON extract:
- `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` → `GOOGLE_PRIVATE_KEY`

## Step 3: Set Up the Workbook

1. Create a new Google Sheets workbook
2. Name it `CodeGate — Interview Portal`
3. Copy the spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/{ID}/edit`
4. Set `GOOGLE_SHEET_ID` to this ID

Create **9 tabs** (right-click sheet tab → Rename):
```
roles
screening_types
questions
candidates
screenings
responses
code_submissions
drawings
users
```

## Step 4: Add Headers

Row 1 of each tab — exact column names, case-sensitive:

**roles:**
`id | name | description`

**screening_types:**
`id | name | stage_order`

**questions:**
`id | role_id | screening_type_id | type | text | difficulty | category | rubric | expected_answer | starter_code | language | active`

**candidates:**
`id | name | email | applied_role_id | created_at | status`

**screenings:**
`id | candidate_id | role_id | screening_type_id | interviewer_id | status | scheduled_at | completed_at | overall_score | recommendation | notes`

**responses:**
`id | screening_id | question_id | question_type | score | notes | submitted_at`

**code_submissions:**
`id | screening_id | question_id | candidate_id | language | code | stdout | stderr | exit_code | submitted_at`

**drawings:**
`id | screening_id | question_id | candidate_id | excalidraw_json | submitted_at`

**users:**
`id | name | email | role`

## Step 5: Share the Workbook

1. Click Share
2. Add the service account email with **Editor** access
3. Uncheck "Notify people" → Share

## Step 6: Seed Initial Data

**roles:**
```
role_001 | Frontend Engineer    | React, TypeScript, CSS
role_002 | Backend Engineer     | Node.js, APIs, Databases
role_003 | Full Stack Engineer  | React, Node.js, SQL
role_004 | Data Engineer        | Python, SQL, Spark
```

**screening_types:**
```
st_001 | HR Screen              | 1
st_002 | Technical Phone Screen | 2
st_003 | Technical Interview    | 3
st_004 | System Design          | 4
st_005 | Behavioral             | 5
st_006 | Final Round            | 6
```

**questions — example DSA (code type):**
```
q_001 | role_002 | st_003 | code | Implement binary search on a sorted array. | medium | Binary Search | Checks edge cases, O(log n) | See solution below | def binary_search(arr, target):\n    pass | python | TRUE
```

**questions — example system design:**
```
q_002 | role_002 | st_004 | system_design | Design a URL shortener like bit.ly. | hard | System Design | Expects: DB schema, hashing strategy, CDN, rate limiting | | | | TRUE
```

**questions — example text/behavioral:**
```
q_003 | role_001 | st_002 | text | Explain the virtual DOM and reconciliation. | medium | React Core | Mentions fiber, diffing algorithm | React creates a virtual tree... | | | TRUE
```

**users (your staff):**
```
usr_001 | Admin User      | admin@company.com    | admin
usr_002 | Hiring Manager  | manager@company.com  | manager
usr_003 | Tech Interviewer| alex@company.com     | interviewer
```

**candidates (add one to test):**
```
cand_001 | Jane Smith | jane@example.com | role_002 | 2026-04-01T10:00:00Z | active
```

## Step 7: Verify External Auth Integration

The `users.email` and `candidates.email` must exactly match what your external auth system returns in `/auth/me/`. This is how the app maps the authenticated identity to a role and profile.

- Staff login: external auth → `/auth/me/` returns `role: admin|manager|interviewer` → app looks up `users` tab by email
- Candidate login: external auth → `/auth/me/` returns `role: interviewee`, `role_id`, `screening_type_id`, `difficulty` → app looks up `candidates` tab by email
