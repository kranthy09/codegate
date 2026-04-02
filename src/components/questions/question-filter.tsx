'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Role, ScreeningType } from '@/types'

interface Props {
  roles: Role[]
  screeningTypes: ScreeningType[]
}

const TYPES = [
  { value: '', label: 'All Types' },
  { value: 'text', label: 'Q&A' },
  { value: 'code', label: 'Code' },
  { value: 'system_design', label: 'System Design' },
]

const DIFFICULTIES = [
  { value: '', label: 'All Difficulties' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

const SELECT_CLS =
  'text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300'

export function QuestionFilter({ roles, screeningTypes }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <select
        value={searchParams.get('role_id') ?? ''}
        onChange={(e) => update('role_id', e.target.value)}
        className={SELECT_CLS}
      >
        <option value="">All Roles</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>

      <select
        value={searchParams.get('screening_type_id') ?? ''}
        onChange={(e) => update('screening_type_id', e.target.value)}
        className={SELECT_CLS}
      >
        <option value="">All Stages</option>
        {screeningTypes.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      <select
        value={searchParams.get('type') ?? ''}
        onChange={(e) => update('type', e.target.value)}
        className={SELECT_CLS}
      >
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <select
        value={searchParams.get('difficulty') ?? ''}
        onChange={(e) => update('difficulty', e.target.value)}
        className={SELECT_CLS}
      >
        {DIFFICULTIES.map((d) => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>
    </div>
  )
}
