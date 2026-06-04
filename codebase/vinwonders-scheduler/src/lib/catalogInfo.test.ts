import { describe, expect, it } from 'vitest'
import { getCatalogInfo, isCatalogInfoIntent } from './catalogInfo'

const infoQueries = [
  'Thủy cung có gì chơi?',
  'Cho tôi thông tin về Cung Điện Hải Vương',
  'Làng Viking là gì?',
  'Wrath of Zeus có đáng chơi không?',
  'Đại Lộ Châu Âu có gì đặc biệt?',
  'Fantasy World là khu nào?',
  'Tôi đang ở Thế Giới Phiêu Lưu',
  'Thông tin về show Once',
  'Mô tả Typhoon World',
]

describe('SearchPlaceInfo catalog lookup', () => {
  it('detects place-info queries', () => {
    for (const query of infoQueries) expect(isCatalogInfoIntent(query), query).toBe(true)
  })

  it('does not hijack planning queries', () => {
    expect(isCatalogInfoIntent('Đoàn 4 người có bé 6 tuổi, đến 9h về 15h')).toBe(false)
    expect(isCatalogInfoIntent('Xếp lịch cho tôi từ 9h đến 17h')).toBe(false)
  })

  it('returns Cung Điện Hải Vương for aquarium queries', () => {
    const info = getCatalogInfo('Thủy cung có gì chơi?')
    expect(info?.ids).toContain('aquarium')
    expect(info?.text).toContain('Tên: Tham quan Cung điện Hải Vương')
    expect(info?.text).toContain('Mô tả:')
    expect(info?.text).toContain('Đường hầm đại dương')
  })

  it('answers child suitability queries directly', () => {
    const info = getCatalogInfo('Cung điện hải vương có phù hợp với trẻ con không')

    expect(info?.ids).toEqual(['aquarium'])
    expect(info?.text).toContain('Có, phù hợp với trẻ con.')
    expect(info?.text).toContain('Phù hợp mọi lứa tuổi')
    expect(info?.text).not.toContain('Mô tả:')
    expect(info?.text).not.toContain('Điểm nổi bật:')
  })

  it('matches English and alias queries to the top place', () => {
    expect(getCatalogInfo('Wrath of Zeus có đáng chơi không?')?.ids).toEqual(['zeus'])
    expect(getCatalogInfo('Thông tin về show Once')?.ids).toEqual(['once-show'])
    expect(getCatalogInfo('Fantasy World là khu nào?')?.text).toContain('Tên: Thế giới diệu kỳ')
    expect(getCatalogInfo('Mô tả Typhoon World')?.text).toContain('Tên: Thế giới lốc xoáy')
  })

  it('returns a local not-found fallback', () => {
    const info = getCatalogInfo('Thông tin về Công viên Sao Hỏa')
    expect(info?.ids).toEqual([])
    expect(info?.text).toContain('chưa tìm thấy địa điểm này')
  })
})
