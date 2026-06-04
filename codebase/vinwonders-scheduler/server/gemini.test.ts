import { describe, it, expect } from 'vitest'
import { composeSystemInstruction } from './gemini'

describe('composeSystemInstruction', () => {
  it('inserts a persona block between template and menu', () => {
    const out = composeSystemInstruction('TEMPLATE', 'Khách: cặp đôi.', 'MENU')
    expect(out).toBe('TEMPLATE\n\n# Hồ sơ khách\nKhách: cặp đôi.\nMENU')
  })
  it('omits the persona block when persona is empty/whitespace', () => {
    expect(composeSystemInstruction('TEMPLATE', '', 'MENU')).toBe('TEMPLATEMENU')
    expect(composeSystemInstruction('TEMPLATE', '   ', 'MENU')).toBe('TEMPLATEMENU')
  })
})
