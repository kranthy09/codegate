import { NextResponse } from 'next/server'
import { getScreeningTypes } from '@/lib/sheets/queries'

export async function GET() {
  const types = await getScreeningTypes()
  return NextResponse.json(types, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' },
  })
}
