import { describe, expect, it } from 'vitest'
import { isReductionEditRequest } from './ChatPanel'

describe('ChatPanel edit intent detection', () => {
  it('detects requests to reduce itinerary destinations', () => {
    expect(isReductionEditRequest('bỏ bớt thêm điểm đến')).toBe(true)
    expect(isReductionEditRequest('Rút gọn lịch trình, ít điểm hơn')).toBe(true)
    expect(isReductionEditRequest('xóa bớt vài điểm đến')).toBe(true)
  })

  it('does not treat adding destinations as reduction', () => {
    expect(isReductionEditRequest('thêm điểm đến cho tôi')).toBe(false)
  })
})
