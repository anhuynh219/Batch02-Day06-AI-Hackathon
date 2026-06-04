import { describe, it, expect } from 'vitest'
import { toMinutes, toHHMM, addMinutes, normalizeTime } from './time'

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

describe('normalizeTime', () => {
  it('passes through strict HH:MM', () => {
    expect(normalizeTime('09:00')).toBe('09:00')
    expect(normalizeTime('19:30')).toBe('19:30')
  })
  it('zero-pads single-digit hours and bare hours', () => {
    expect(normalizeTime('9:00')).toBe('09:00')
    expect(normalizeTime('9')).toBe('09:00')
  })
  it('handles Vietnamese "h"/"giờ" separators', () => {
    expect(normalizeTime('9h')).toBe('09:00')
    expect(normalizeTime('9h30')).toBe('09:30')
    expect(normalizeTime('9 giờ 30')).toBe('09:30')
    expect(normalizeTime('9.30')).toBe('09:30')
  })
  it('applies am/pm hints (vi + en)', () => {
    expect(normalizeTime('2 giờ chiều')).toBe('14:00')
    expect(normalizeTime('8 tối')).toBe('20:00')
    expect(normalizeTime('2pm')).toBe('14:00')
    expect(normalizeTime('12 sáng')).toBe('00:00')
  })
  it('returns undefined for garbage / out-of-range', () => {
    expect(normalizeTime('abc')).toBeUndefined()
    expect(normalizeTime('')).toBeUndefined()
    expect(normalizeTime('25:00')).toBeUndefined()
    expect(normalizeTime(undefined)).toBeUndefined()
    expect(normalizeTime(123 as unknown)).toBeUndefined()
  })
})
