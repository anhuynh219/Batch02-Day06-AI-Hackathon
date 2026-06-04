import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { QUESTIONS } from '../../survey/questions'
import type { SurveyProfile } from '../../survey/types'
import { QuestionStep } from './QuestionStep'

type Answers = Record<string, string[]>

function buildProfile(a: Answers): SurveyProfile {
  return {
    timeRange: (a.time?.[0] ?? 'full') as SurveyProfile['timeRange'],
    groupType: (a.group?.[0] ?? 'couple') as SurveyProfile['groupType'],
    intensity: (a.intensity?.[0] ?? 'balanced') as SurveyProfile['intensity'],
    interests: (a.interests ?? []) as SurveyProfile['interests'],
    pace: (a.pace?.[0] ?? 'balanced') as SurveyProfile['pace'],
    avoid: (a.avoid ?? []) as SurveyProfile['avoid'],
    completedAt: new Date().toISOString(),
  }
}

export function SurveyModal() {
  const surveyOpen = useStore((s) => s.surveyOpen)
  const existing = useStore((s) => s.profile)
  const completeSurvey = useStore((s) => s.completeSurvey)
  const skipSurvey = useStore((s) => s.skipSurvey)

  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>(() => existing ? {
    time: [existing.timeRange], group: [existing.groupType], intensity: [existing.intensity],
    interests: existing.interests, pace: [existing.pace], avoid: existing.avoid,
  } : {})

  if (!surveyOpen) return null

  const q = QUESTIONS[step]
  const isLast = step === QUESTIONS.length - 1
  const value = answers[q.id] ?? []
  const canAdvance = q.multi ? true : value.length > 0

  function setValue(next: string[]) { setAnswers((a) => ({ ...a, [q.id]: next })) }
  function next() {
    if (isLast) completeSurvey(buildProfile(answers))
    else setStep((s) => s + 1)
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[24px] bg-cream shadow-lift ring-1 ring-ink/10 p-6">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Cá nhân hoá · {step + 1}/{QUESTIONS.length}</span>
          <button onClick={skipSurvey} className="text-[12px] text-muted hover:text-ink underline-offset-2 hover:underline">Bỏ qua</button>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-gradient-to-r from-mango to-coral transition-all"
            style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
        </div>

        <div className="mt-5">
          <QuestionStep question={q} value={value} onChange={setValue} />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            className="text-[13px] text-muted disabled:opacity-30 hover:text-ink">← Quay lại</button>
          <button onClick={next} disabled={!canAdvance}
            className="rounded-full bg-gradient-to-br from-coral to-coral-deep text-cream px-5 py-2 text-[13px] font-semibold shadow transition hover:shadow-lift hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0">
            {isLast ? 'Xong ✨' : 'Tiếp →'}
          </button>
        </div>
      </div>
    </div>
  )
}
