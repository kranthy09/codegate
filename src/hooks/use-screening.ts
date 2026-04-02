'use client'

import { create } from 'zustand'
import type { Question, Recommendation } from '@/types'

interface ScreeningStore {
  screeningId: string | null
  candidateName: string
  questions: Question[]
  currentIndex: number
  scores: Record<string, number>      // question_id → 1-5
  notes: Record<string, string>       // question_id → interviewer notes

  // Final submission fields
  overallScore: number | null
  recommendation: Recommendation | null
  overallNotes: string

  init: (screeningId: string, candidateName: string, questions: Question[]) => void
  setScore: (questionId: string, score: number) => void
  setNotes: (questionId: string, notes: string) => void
  next: () => void
  prev: () => void
  isComplete: () => boolean
  setOverallScore: (score: number) => void
  setRecommendation: (rec: Recommendation) => void
  setOverallNotes: (notes: string) => void
  reset: () => void
}

export const useScreening = create<ScreeningStore>((set, get) => ({
  screeningId: null,
  candidateName: '',
  questions: [],
  currentIndex: 0,
  scores: {},
  notes: {},
  overallScore: null,
  recommendation: null,
  overallNotes: '',

  init: (screeningId, candidateName, questions) =>
    set({ screeningId, candidateName, questions, currentIndex: 0, scores: {}, notes: {} }),

  setScore: (questionId, score) =>
    set((s) => ({ scores: { ...s.scores, [questionId]: score } })),

  setNotes: (questionId, notes) =>
    set((s) => ({ notes: { ...s.notes, [questionId]: notes } })),

  next: () =>
    set((s) => ({ currentIndex: Math.min(s.currentIndex + 1, s.questions.length - 1) })),

  prev: () =>
    set((s) => ({ currentIndex: Math.max(s.currentIndex - 1, 0) })),

  isComplete: () => {
    const { questions, scores } = get()
    return questions.length > 0 && questions.every((q) => scores[q.id] !== undefined)
  },

  setOverallScore: (score) => set({ overallScore: score }),
  setRecommendation: (rec) => set({ recommendation: rec }),
  setOverallNotes: (notes) => set({ overallNotes: notes }),
  reset: () => set({
    screeningId: null, candidateName: '', questions: [], currentIndex: 0,
    scores: {}, notes: {}, overallScore: null, recommendation: null, overallNotes: '',
  }),
}))
