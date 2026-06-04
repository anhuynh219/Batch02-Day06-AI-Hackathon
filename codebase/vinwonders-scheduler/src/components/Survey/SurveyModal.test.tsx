import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const completeSurvey = vi.fn()
const skipSurvey = vi.fn()
vi.mock('../../store/useStore', () => ({
  useStore: (sel: any) => sel({ surveyOpen: true, profile: null, completeSurvey, skipSurvey }),
}))

import { SurveyModal } from './SurveyModal'

beforeEach(() => { completeSurvey.mockClear(); skipSurvey.mockClear() })

describe('SurveyModal', () => {
  it('shows the first question and a skip button', () => {
    render(<SurveyModal />)
    expect(screen.getByText(/khung giờ nào/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /bỏ qua/i })).toBeTruthy()
  })
  it('skip calls skipSurvey', () => {
    render(<SurveyModal />)
    fireEvent.click(screen.getByRole('button', { name: /bỏ qua/i }))
    expect(skipSurvey).toHaveBeenCalled()
  })
  it('walking all 6 questions and finishing calls completeSurvey with a full profile', () => {
    render(<SurveyModal />)
    fireEvent.click(screen.getByText(/Cả ngày/))
    fireEvent.click(screen.getByRole('button', { name: /tiếp/i }))
    fireEvent.click(screen.getByText(/Cặp đôi/))
    fireEvent.click(screen.getByRole('button', { name: /tiếp/i }))
    fireEvent.click(screen.getByText(/Mạo hiểm tối đa/))
    fireEvent.click(screen.getByRole('button', { name: /tiếp/i }))
    fireEvent.click(screen.getByText(/Tàu lượn mạnh/))
    fireEvent.click(screen.getByRole('button', { name: /tiếp/i }))
    fireEvent.click(screen.getByText(/Chơi hết mình/))
    fireEvent.click(screen.getByRole('button', { name: /tiếp/i }))
    fireEvent.click(screen.getByRole('button', { name: /xong/i }))
    expect(completeSurvey).toHaveBeenCalledTimes(1)
    const profile = completeSurvey.mock.calls[0][0]
    expect(profile).toMatchObject({
      timeRange: 'full', groupType: 'couple', intensity: 'high',
      interests: ['thrill'], pace: 'packed', avoid: [],
    })
  })
})
