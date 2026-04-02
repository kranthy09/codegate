import { NextResponse } from 'next/server'
import { getRoles } from '@/lib/sheets/queries'

export async function GET() {
  const roles = await getRoles()
  return NextResponse.json(roles, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' },
  })
}
