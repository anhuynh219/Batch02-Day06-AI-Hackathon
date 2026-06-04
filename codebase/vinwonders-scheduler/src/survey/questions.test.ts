import { describe, it, expect } from 'vitest'
import { QUESTIONS } from './questions'

describe('QUESTIONS', () => {
  it('has 6 questions with stable ids', () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual(['time', 'group', 'intensity', 'interests', 'pace', 'avoid'])
  })
  it('every option has value/label/icon and non-empty options', () => {
    for (const q of QUESTIONS) {
      expect(q.options.length).toBeGreaterThan(0)
      for (const o of q.options) {
        expect(o.value).toBeTruthy()
        expect(o.label).toBeTruthy()
        expect(o.icon).toBeTruthy()
      }
    }
  })
  it('interests and avoid are multi-select; others are single', () => {
    const multi = QUESTIONS.filter((q) => q.multi).map((q) => q.id)
    expect(multi.sort()).toEqual(['avoid', 'interests'])
  })
})
