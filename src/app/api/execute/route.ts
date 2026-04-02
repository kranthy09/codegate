import { NextResponse, type NextRequest } from 'next/server'
import { getServerUser } from '@/lib/auth/config'
import { isSupported } from '@/lib/utils'
import type { ExecutePayload } from '@/types'

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as ExecutePayload
  if (!body.language || !body.code) {
    return NextResponse.json({ error: 'language and code are required' }, { status: 400 })
  }
  if (!isSupported(body.language)) {
    return NextResponse.json({ error: `Unsupported language: ${body.language}` }, { status: 400 })
  }

  const pistonUrl = `${process.env.CODE_EXECUTION_URL}/api/v2/execute`
  const res = await fetch(pistonUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: body.language,
      version: '*',
      files: [{ content: body.code }],
      stdin: body.stdin ?? '',
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Code execution service unavailable' }, { status: 502 })
  }

  const result = await res.json() as {
    run: { stdout: string; stderr: string; code: number }
    language: string
  }

  return NextResponse.json({
    stdout: result.run.stdout,
    stderr: result.run.stderr,
    exit_code: result.run.code,
    run_time_ms: 0, // Piston v2 doesn't return timing in this field
  })
}
