import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import type { SessionUser, UserRole } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy')
}

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy · h:mm a')
}

// ─── RBAC ─────────────────────────────────────────────────────────────────────

export class UnauthorizedError extends Error {
  status = 403
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

/**
 * Throws UnauthorizedError if the session user's role is not in the allowed list.
 * Call at the top of every API route handler.
 */
export function requireRole(user: SessionUser | null, allowed: UserRole[]): asserts user is SessionUser {
  if (!user || !allowed.includes(user.role)) {
    throw new UnauthorizedError()
  }
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export function scoreLabel(score: number): string {
  return ({ 1: 'Poor', 2: 'Below Average', 3: 'Average', 4: 'Good', 5: 'Excellent' })[score] ?? '—'
}

export function recommendationLabel(r: string): string {
  return ({
    strong_yes: 'Strong Yes',
    yes: 'Yes',
    neutral: 'Neutral',
    no: 'No',
    strong_no: 'Strong No',
  })[r] ?? r
}

export function difficultyColor(d: string): string {
  return ({ easy: 'text-green-700 bg-green-50', medium: 'text-yellow-700 bg-yellow-50', hard: 'text-red-700 bg-red-50' })[d] ?? 'text-gray-700 bg-gray-50'
}

export function questionTypeLabel(t: string): string {
  return ({ text: 'Q&A', code: 'Code', system_design: 'System Design' })[t] ?? t
}

// ─── Code Execution ───────────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = [
  'python',
  'javascript',
  'typescript',
  'java',
  'go',
  'cpp',
  'rust',
  'csharp',
  'ruby',
  'kotlin',
] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export function isSupported(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)
}
