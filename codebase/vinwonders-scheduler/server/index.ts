import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { askGemini } from './gemini'
import { ATTRACTIONS, ATTRACTIONS_BY_ID } from '../src/data/attractions'
import { ZONES_BY_ID } from '../src/data/zones'
import { normalizeTime } from '../src/engine/time'
import type { PlanResponse } from '../src/types'

// Coerce loose time strings from Gemini ("9h", "2 giờ chiều", …) into strict
// "HH:MM" before they reach the engine. Drop arrival/departure values that can't
// be parsed so the store keeps its safe defaults instead of producing "NaN:NaN".
function normalizeConstraints(c: PlanResponse['constraints']): PlanResponse['constraints'] {
  if (!c || typeof c !== 'object') return c
  const at = normalizeTime(c.arrivalTime)
  if (at) c.arrivalTime = at
  else delete c.arrivalTime
  const dt = normalizeTime(c.departureTime)
  if (dt) c.departureTime = dt
  else delete c.departureTime
  if (Array.isArray(c.meals)) {
    c.meals = c.meals.map((m) => ({ ...m, around: normalizeTime(m.around) ?? m.around }))
  }
  return c
}

const app = express()
app.use(cors())
app.use(express.json())

const menu = ATTRACTIONS.map((a) =>
  `${a.id} — ${a.name} — ${ZONES_BY_ID[a.zoneId].name} — ${a.kind} — ${a.durationMin}p — cường độ ${a.intensity} — ${a.kidFriendly ? 'hợp trẻ em' : 'không hợp trẻ nhỏ'}`,
).join('\n')

app.post('/api/plan', async (req, res) => {
  const { messages = [], itinerarySummary = '' } = req.body ?? {}
  try {
    let out: PlanResponse | null = null
    for (let attempt = 0; attempt < 2 && !out; attempt++) {
      try {
        const r = await askGemini({ messages, itinerarySummary, menu })
        if (r.chosenIds) r.chosenIds = r.chosenIds.filter((id) => ATTRACTIONS_BY_ID[id])
        if (r.constraints) r.constraints = normalizeConstraints(r.constraints)
        out = r
      } catch (e) {
        if (attempt === 1) throw e
      }
    }
    res.json(out)
  } catch (e: any) {
    console.error('plan error', e?.message)
    res.status(200).json({
      action: 'clarify',
      assistantText: 'Xin lỗi, mình gặp trục trặc khi xử lý. Bạn thử nói lại yêu cầu ngắn gọn hơn nhé?',
      clarifyQuestion: 'Bạn muốn chơi từ mấy giờ tới mấy giờ, đoàn có trẻ nhỏ không?',
    } satisfies PlanResponse)
  }
})

const PORT = Number(process.env.PORT) || 8787
const server = app.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT}`))
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[api] ⚠ Cổng ${PORT} đang bị chiếm — có thể một phiên 'npm run dev' cũ vẫn chạy.`)
    console.error('[api]   → Tắt phiên cũ rồi chạy lại, hoặc đổi PORT trong .env (nhớ chỉnh proxy trong vite.config.ts).')
    process.exit(1)
  }
  throw err
})
