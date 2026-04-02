'use client'

import { create } from 'zustand'
import type { Question, ExecResult } from '@/types'

interface SessionStore {
  screeningId: string | null
  questions: Question[]
  currentIndex: number

  // Per-question state for code questions
  code: Record<string, string>            // question_id → current code in editor
  language: Record<string, string>        // question_id → selected language
  execResult: Record<string, ExecResult>  // question_id → last execution result

  init: (screeningId: string, questions: Question[]) => void
  setCode: (questionId: string, code: string) => void
  setLanguage: (questionId: string, lang: string) => void
  setExecResult: (questionId: string, result: ExecResult) => void
  next: () => void
  prev: () => void
  currentQuestion: () => Question | null
}

export const useSession = create<SessionStore>((set, get) => ({
  screeningId: null,
  questions: [],
  currentIndex: 0,
  code: {},
  language: {},
  execResult: {},

  init: (screeningId, questions) => {
    // Pre-populate code with starter_code for code questions
    const code: Record<string, string> = {}
    const language: Record<string, string> = {}
    for (const q of questions) {
      if (q.type === 'code') {
        code[q.id] = q.starter_code ?? ''
        language[q.id] = q.language ?? 'python'
      }
    }
    set({ screeningId, questions, currentIndex: 0, code, language, execResult: {} })
  },

  setCode: (questionId, code) =>
    set((s) => ({ code: { ...s.code, [questionId]: code } })),

  setLanguage: (questionId, lang) =>
    set((s) => ({ language: { ...s.language, [questionId]: lang } })),

  setExecResult: (questionId, result) =>
    set((s) => ({ execResult: { ...s.execResult, [questionId]: result } })),

  next: () =>
    set((s) => ({ currentIndex: Math.min(s.currentIndex + 1, s.questions.length - 1) })),

  prev: () =>
    set((s) => ({ currentIndex: Math.max(s.currentIndex - 1, 0) })),

  currentQuestion: () => {
    const { questions, currentIndex } = get()
    return questions[currentIndex] ?? null
  },
}))
