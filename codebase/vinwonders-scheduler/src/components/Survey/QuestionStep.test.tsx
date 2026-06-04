import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuestionStep } from './QuestionStep'
import type { Question } from '../../survey/questions'

const single: Question = {
  id: 'group', title: 'Đi cùng ai?', multi: false,
  options: [{ value: 'solo', label: 'Một mình', icon: '🧍' }, { value: 'couple', label: 'Cặp đôi', icon: '💑' }],
}
const multi: Question = {
  id: 'interests', title: 'Mê gì?', multi: true,
  options: [{ value: 'thrill', label: 'Mạnh', icon: '🎢' }, { value: 'water', label: 'Nước', icon: '🌊' }],
}

describe('QuestionStep', () => {
  it('single-select reports one value', () => {
    const onChange = vi.fn()
    render(<QuestionStep question={single} value={[]} onChange={onChange} />)
    fireEvent.click(screen.getByText('Cặp đôi'))
    expect(onChange).toHaveBeenCalledWith(['couple'])
  })
  it('multi-select toggles values on/off', () => {
    const onChange = vi.fn()
    const { rerender } = render(<QuestionStep question={multi} value={['thrill']} onChange={onChange} />)
    fireEvent.click(screen.getByText('Nước'))
    expect(onChange).toHaveBeenCalledWith(['thrill', 'water'])
    rerender(<QuestionStep question={multi} value={['thrill', 'water']} onChange={onChange} />)
    fireEvent.click(screen.getByText('Mạnh'))
    expect(onChange).toHaveBeenCalledWith(['water'])
  })
})
