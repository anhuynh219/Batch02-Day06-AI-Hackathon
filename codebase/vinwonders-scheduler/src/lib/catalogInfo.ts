import { ATTRACTIONS } from '../data/attractions'
import { ENTRANCE, ZONES } from '../data/zones'
import type { Attraction, Zone } from '../types'

type Candidate =
  | { entityType: 'attraction'; attraction: Attraction; name: string; aliases: string[]; zone?: Zone }
  | { entityType: 'zone'; zone: Zone; name: string; aliases: string[] }

type ScoredCandidate = { candidate: Candidate; score: number }

const INFO_KEYWORDS = [
  'thong tin', 'gioi thieu', 'mo ta', 'description', 'shortdesc', 'dia diem', 'co gi',
  'la gi', 'co gi choi', 'co gi dac biet', 'co dang choi', 'dang o', 'khu nao',
  'where is', 'what is', 'tell me about', 'info', 'describe', 'worth', 'which zone',
]

const PLAN_KEYWORDS = ['xep lich', 'lich trinh', 'may gio', 'an trua', 'an toi']
const SUITABILITY_KEYWORDS = [
  'phu hop', 'hop voi', 'danh cho', 'nen cho', 'co cho', 'tre con', 'tre nho',
  'em be', 'con nit', 'kids', 'children', 'family', 'gia dinh', 'nguoi lon tuoi',
]
const CHILD_KEYWORDS = ['tre con', 'tre nho', 'em be', 'con nit', 'kids', 'children']
const INTENT_PHRASES = [
  'cho toi', 'thong tin ve', 'thong tin', 'gioi thieu ve', 'gioi thieu', 'mo ta',
  'description', 'shortdesc', 'la gi', 'co gi choi', 'co gi dac biet', 'co dang choi khong',
  'co dang choi', 'toi dang o', 'dang o', 'khu nao', 'o dau', 'what is', 'tell me about',
  'info about', 'describe', 'is it worth', 'where is', 'which zone', 'co gi', 'choi',
]
const GENERIC_TOKENS = new Set(['thong', 'tin', 'gioi', 'thieu', 'mo', 'ta', 'dia', 'diem', 'khu', 'world', 'choi', 'dang', 'toi', 'what', 'where', 'which', 'about', 'info', 'cong', 'vien'])

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function tokens(text: string) {
  return normalize(text).split(' ').filter((token) => token.length >= 2 && !GENERIC_TOKENS.has(token))
}

function stripIntent(text: string) {
  let out = normalize(text)
  for (const phrase of INTENT_PHRASES) out = out.replaceAll(phrase, ' ')
  return out.replace(/\s+/g, ' ').trim()
}

function nameParts(name: string) {
  return name.split(/[()]/).map((part) => part.trim()).filter(Boolean)
}

function buildCandidates(): Candidate[] {
  const zones = [ENTRANCE, ...ZONES]
  const zoneCandidates: Candidate[] = zones.map((zone) => ({
    entityType: 'zone',
    zone,
    name: zone.name,
    aliases: [zone.id, zone.name, ...(zone.aliases ?? [])],
  }))
  const attractionCandidates: Candidate[] = ATTRACTIONS.map((attraction) => ({
    entityType: 'attraction',
    attraction,
    zone: zones.find((zone) => zone.id === attraction.zoneId),
    name: attraction.name,
    aliases: [attraction.id, attraction.name, ...nameParts(attraction.name), ...(attraction.aliases ?? [])],
  }))
  return [...attractionCandidates, ...zoneCandidates]
}

function hasKnownPlaceMention(q: string) {
  return buildCandidates().some((candidate) => candidate.aliases.some((alias) => {
    const normalized = normalize(alias)
    return normalized.length > 2 && q.includes(normalized)
  }))
}

function isStrongPlanningRequest(q: string) {
  return includesAny(q, PLAN_KEYWORDS) || /\b(den|tu|toi)\s*\d{1,2}h/.test(q)
}

export function isCatalogInfoIntent(text: string) {
  const q = normalize(text)
  return !isStrongPlanningRequest(q) && (includesAny(q, INFO_KEYWORDS) || hasKnownPlaceMention(q))
}

function contextBoost(candidate: Candidate, q: string) {
  let score = 0
  if (candidate.entityType === 'zone' && includesAny(q, ['khu', 'world', 'dang o', 'khu nao', 'which zone'])) score += 20
  if (candidate.entityType === 'attraction' && includesAny(q, ['choi', 'show', 'thuy cung', 'co dang choi', 'tro', 'ride'])) score += 20
  if (candidate.entityType === 'attraction' && candidate.attraction.kind === 'aquarium' && includesAny(q, ['thuy cung', 'aquarium', 'hai vuong'])) score += 25
  if (candidate.entityType === 'attraction' && candidate.attraction.kind === 'show' && q.includes('show')) score += 25
  return score
}

function scoreCandidate(candidate: Candidate, fullQuery: string, cleanedQuery: string) {
  let score = contextBoost(candidate, fullQuery)
  const queryTokens = tokens(cleanedQuery || fullQuery)

  for (const alias of candidate.aliases) {
    const normalizedAlias = normalize(alias)
    if (!normalizedAlias || GENERIC_TOKENS.has(normalizedAlias)) continue
    const aliasTokens = tokens(normalizedAlias)
    if (fullQuery === normalizedAlias || cleanedQuery === normalizedAlias) score += 150
    if (fullQuery.includes(normalizedAlias)) score += 110
    if (cleanedQuery.includes(normalizedAlias)) score += 120
    if (normalizedAlias.includes(cleanedQuery) && cleanedQuery.length >= 3) score += 80
    for (const token of aliasTokens) {
      if (queryTokens.includes(token)) score += 16
    }
  }

  if (candidate.entityType === 'attraction') {
    const tagText = normalize(candidate.attraction.tags.join(' '))
    for (const token of queryTokens) if (tagText.includes(token)) score += 8
    if (candidate.zone) {
      const zoneText = normalize([candidate.zone.name, ...(candidate.zone.aliases ?? [])].join(' '))
      for (const token of queryTokens) if (zoneText.includes(token)) score += 4
    }
  } else {
    const descText = normalize([candidate.zone.shortDesc, candidate.zone.description ?? '', ...(candidate.zone.highlights ?? [])].join(' '))
    for (const token of queryTokens) if (descText.includes(token)) score += 4
  }

  return score
}

function findBestPlace(text: string) {
  const fullQuery = normalize(text)
  const cleanedQuery = stripIntent(text)
  const scored = buildCandidates()
    .map((candidate): ScoredCandidate => ({ candidate, score: scoreCandidate(candidate, fullQuery, cleanedQuery) }))
    .filter((item) => item.score >= 45)
    .sort((a, b) => b.score - a.score)
  return scored[0]?.candidate ?? null
}

function kindLabel(kind: Attraction['kind']) {
  return {
    thrill: 'Trò cảm giác mạnh',
    family: 'Trò chơi gia đình',
    kids: 'Trò chơi trẻ em',
    water: 'Trò chơi nước',
    indoor: 'Trải nghiệm trong nhà',
    show: 'Show biểu diễn',
    aquarium: 'Thủy cung / tham quan trong nhà',
  }[kind]
}

function formatHighlights(highlights?: string[]) {
  if (!highlights?.length) return '- Chưa có dữ liệu trong KB'
  return highlights.map((highlight) => `- ${highlight}`).join('\n')
}

function formatDuration(duration?: number) {
  return duration ? `Khoảng ${duration} phút` : 'Chưa có dữ liệu trong KB'
}

function formatSuitability(candidate: Candidate, q: string) {
  const isChildQuestion = includesAny(q, CHILD_KEYWORDS)

  if (candidate.entityType === 'attraction') {
    const { attraction } = candidate
    const audience = attraction.suitableAudience ?? (attraction.kidFriendly ? 'Phù hợp gia đình có trẻ nhỏ.' : 'Không khuyến nghị cho trẻ nhỏ.')
    const prefix = isChildQuestion
      ? attraction.kidFriendly ? 'Có, phù hợp với trẻ con.' : 'Không khuyến nghị cho trẻ nhỏ.'
      : 'Phù hợp.'
    return { text: `${prefix}\n${audience}`, ids: [attraction.id] }
  }

  const audience = candidate.zone.suitableAudience ?? 'Chưa có dữ liệu trong KB'
  const normalizedAudience = normalize(audience)
  const isChildFriendly = includesAny(normalizedAudience, ['tre nho', 'tre em', 'tre con', 'gia dinh', 'moi lua tuoi'])
  const prefix = isChildQuestion && isChildFriendly ? 'Có, phù hợp với trẻ con.' : isChildQuestion ? 'Có thể phù hợp với trẻ con tùy lịch trình.' : 'Phù hợp.'
  return { text: `${prefix}\n${audience}`, ids: ATTRACTIONS.filter((attraction) => attraction.zoneId === candidate.zone.id).map((item) => item.id).slice(0, 5) }
}

function formatAttraction(candidate: Extract<Candidate, { entityType: 'attraction' }>) {
  const { attraction, zone } = candidate
  const duration = attraction.suggestedDurationMin ?? attraction.durationMin
  const lines = [
    `Tên: ${attraction.name}`,
    `Loại địa điểm: ${kindLabel(attraction.kind)}`,
    `Khu: ${zone?.name ?? attraction.zoneId}`,
    '',
    'Mô tả:',
    attraction.description || 'Chưa có dữ liệu trong KB',
    '',
    'Điểm nổi bật:',
    formatHighlights(attraction.highlights),
    '',
    'Phù hợp với:',
    attraction.suitableAudience ?? (attraction.kidFriendly ? 'Phù hợp gia đình có trẻ nhỏ.' : 'Không khuyến nghị cho trẻ nhỏ.'),
    '',
    'Thời lượng gợi ý:',
    formatDuration(duration),
  ]
  if (attraction.showTimes?.length) lines.push('', `Suất biểu diễn: ${attraction.showTimes.join(', ')}`)
  return { text: lines.join('\n'), ids: [attraction.id] }
}

function formatZone(candidate: Extract<Candidate, { entityType: 'zone' }>) {
  const { zone } = candidate
  const attractions = ATTRACTIONS.filter((attraction) => attraction.zoneId === zone.id)
  const lines = [
    `Tên: ${zone.name}`,
    'Loại địa điểm: Khu chủ đề',
    `Khu: ${zone.name}`,
    '',
    'Mô tả:',
    zone.description ?? zone.shortDesc ?? 'Chưa có dữ liệu trong KB',
    '',
    'Điểm nổi bật:',
    formatHighlights(zone.highlights),
    '',
    'Phù hợp với:',
    zone.suitableAudience ?? 'Chưa có dữ liệu trong KB',
    '',
    'Thời lượng gợi ý:',
    formatDuration(zone.suggestedDurationMin),
  ]
  if (attractions.length) lines.push('', `Một số địa điểm/trò chơi trong khu: ${attractions.map((item) => item.name).join(', ')}.`)
  return { text: lines.join('\n'), ids: attractions.map((item) => item.id).slice(0, 5) }
}

export function getCatalogInfo(text: string) {
  const q = normalize(text)
  const candidate = findBestPlace(text)
  if (!candidate) {
    return {
      text: 'Mình chưa tìm thấy địa điểm này trong dữ liệu VinWonders hiện có. Bạn thử nhập tên cụ thể hơn như Cung Điện Hải Vương, Show Once, Cơn thịnh nộ của Zeus, Đại lộ châu Âu.',
      ids: [],
    }
  }
  if (includesAny(q, SUITABILITY_KEYWORDS)) return formatSuitability(candidate, q)
  return candidate.entityType === 'attraction' ? formatAttraction(candidate) : formatZone(candidate)
}
