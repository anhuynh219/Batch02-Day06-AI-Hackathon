import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/aiClient', () => ({
  requestPlan: vi.fn(async () => ({
    action: 'plan', assistantText: 'Đã xếp lịch!', chosenIds: ['zeus'],
    constraints: { arrivalTime: '09:00', departureTime: '19:00', meals: [] },
  })),
}))

import { useStore } from './useStore'
import { requestPlan } from '../lib/aiClient'
import type { SurveyProfile } from '../survey/types'

const profile: SurveyProfile = {
  timeRange: 'full', groupType: 'couple', intensity: 'high',
  interests: ['thrill'], pace: 'balanced', avoid: [], completedAt: '2026-06-04T00:00:00Z',
}

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ messages: [], entries: [], itinerary: [], busy: false, profile: null, persona: '', surveyOpen: false })
})

describe('completeSurvey', () => {
  it('stores profile + persona, pre-fills constraints, and runs a plan with the persona', async () => {
    await useStore.getState().completeSurvey(profile)
    const s = useStore.getState()
    expect(s.profile).toEqual(profile)
    expect(s.persona).toContain('cặp đôi')
    expect(s.surveyOpen).toBe(false)
    expect(localStorage.getItem('surveyDone')).toBe('1')
    expect(requestPlan).toHaveBeenCalled()
    const personaArg = (requestPlan as any).mock.calls[0][2]
    expect(personaArg).toContain('cặp đôi')
    expect(s.entries.some((e: any) => e.refId === 'zeus')).toBe(true)
  })
})

describe('skipSurvey', () => {
  it('marks done and closes without running a plan', () => {
    useStore.getState().skipSurvey()
    expect(useStore.getState().surveyOpen).toBe(false)
    expect(localStorage.getItem('surveyDone')).toBe('1')
  })
})
