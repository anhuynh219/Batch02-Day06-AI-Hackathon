import { describe, it, expect } from 'vitest'
import { toMinutes, toHHMM, addMinutes } from './time'

describe('time helpers', () => {
  it('parses HH:MM to minutes', () => {
    expect(toMinutes('09:00')).toBe(540)
    expect(toMinutes('19:30')).toBe(1170)
  })
  it('formats minutes to HH:MM zero-padded', () => {
    expect(toHHMM(540)).toBe('09:00')
    expect(toHHMM(1170)).toBe('19:30')
  })
  it('adds minutes', () => {
    expect(addMinutes('09:50', 20)).toBe('10:10')
  })
})
