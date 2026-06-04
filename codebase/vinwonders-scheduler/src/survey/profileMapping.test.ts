import { describe, it, expect } from 'vitest'
import { toConstraints, toPersona, toSeedPrompt } from './profileMapping'
import type { SurveyProfile } from './types'

const base: SurveyProfile = {
  timeRange: 'full', groupType: 'couple', intensity: 'high',
  interests: ['thrill', 'water'], pace: 'relaxed', avoid: ['heights'], completedAt: '2026-06-04T00:00:00Z',
}

describe('toConstraints', () => {
  it('maps full day to 09:00–19:00 with lunch and dinner', () => {
    const c = toConstraints(base)
    expect(c.arrivalTime).toBe('09:00')
    expect(c.departureTime).toBe('19:00')
    expect(c.meals).toEqual([{ type: 'lunch', around: '12:00' }, { type: 'dinner', around: '18:30' }])
  })
  it('maps morning to a single lunch, afternoon to a single dinner', () => {
    expect(toConstraints({ ...base, timeRange: 'morning' }).meals).toEqual([{ type: 'lunch', around: '12:00' }])
    expect(toConstraints({ ...base, timeRange: 'afternoon' }).meals).toEqual([{ type: 'dinner', around: '18:30' }])
  })
  it('maps group type to size + hasKids', () => {
    expect(toConstraints({ ...base, groupType: 'solo' })).toMatchObject({ groupSize: 1, hasKids: false })
    expect(toConstraints({ ...base, groupType: 'family' })).toMatchObject({ groupSize: 4, hasKids: true })
  })
  it('builds prefs from intensity + interests', () => {
    const c = toConstraints(base)
    expect(c.prefs).toContain('thích cảm giác mạnh')
    expect(c.prefs).toContain('tàu lượn cảm giác mạnh')
    expect(c.prefs).toContain('công viên nước')
  })
  it('maps only attraction-relevant avoid keys (heights), not dietary', () => {
    const c = toConstraints({ ...base, avoid: ['heights', 'vegetarian'] })
    expect(c.avoid).toEqual(['trò chơi trên cao / độ cao'])
  })
})

describe('toPersona', () => {
  it('summarises group, intensity, interests, pace and avoid', () => {
    const s = toPersona(base)
    expect(s).toContain('cặp đôi')
    expect(s).toContain('thích cảm giác mạnh')
    expect(s).toContain('công viên nước')
    expect(s).toContain('thong thả')
    expect(s).toContain('tránh')
    expect(s.endsWith('.')).toBe(true)
  })
})

describe('toSeedPrompt', () => {
  it('produces a natural request with the time window and an ask to plan', () => {
    const s = toSeedPrompt(base)
    expect(s).toContain('09:00')
    expect(s).toContain('19:00')
    expect(s.toLowerCase()).toContain('lên lịch')
  })
})
