import { GoogleGenAI, Type } from '@google/genai'
import type { PlanResponse } from '../src/types'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ['plan', 'edit', 'clarify'] },
    chosenIds: { type: Type.ARRAY, items: { type: Type.STRING } },
    clarifyQuestion: { type: Type.STRING },
    assistantText: { type: Type.STRING },
    constraints: {
      type: Type.OBJECT,
      properties: {
        arrivalTime: { type: Type.STRING },
        departureTime: { type: Type.STRING },
        groupSize: { type: Type.NUMBER },
        hasKids: { type: Type.BOOLEAN },
        prefs: { type: Type.ARRAY, items: { type: Type.STRING } },
        mustDo: { type: Type.ARRAY, items: { type: Type.STRING } },
        avoid: { type: Type.ARRAY, items: { type: Type.STRING } },
        meals: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['lunch', 'dinner', 'snack'] },
              around: { type: Type.STRING },
            },
          },
        },
      },
    },
  },
  required: ['action', 'assistantText'],
}

function systemPrompt(menu: string): string {
  return `Bạn là trợ lý lập lịch vui chơi tại VinWonders Phú Quốc. NHIỆM VỤ:
- Đọc yêu cầu của khách (ngôn ngữ tự nhiên, tiếng Việt).
- Trích "constraints" (giờ đến, giờ về, số người, có trẻ nhỏ, sở thích).
- CHỌN trò chơi BẰNG ĐÚNG "id" trong DANH SÁCH dưới đây. TUYỆT ĐỐI KHÔNG bịa id hay tên mới, KHÔNG tự tính giờ (hệ thống khác lo việc tính giờ).
- Nếu yêu cầu quá mơ hồ (vd "có trò nào vui không") -> action="clarify" và đặt 1-2 câu hỏi ngắn trong clarifyQuestion.
- Nếu đã đủ thông tin -> action="plan" (lịch mới) hoặc "edit" (sửa lịch hiện có), điền chosenIds theo THỨ TỰ chơi hợp lý.
- assistantText: lời nhắn thân thiện, ngắn gọn cho khách (giải thích vì sao chọn các trò này).

DANH SÁCH TRÒ CHƠI (id — tên — khu — loại — phút — cường độ — hợp trẻ em):
${menu}`
}

export async function askGemini(opts: {
  messages: { role: 'user' | 'assistant'; text: string }[]
  itinerarySummary: string
  menu: string
}): Promise<PlanResponse> {
  const contents = opts.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }))
  contents.push({
    role: 'user',
    parts: [{ text: `Lịch hiện tại:\n${opts.itinerarySummary || '(chưa có)'}` }],
  })

  const res = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt(opts.menu),
      responseMimeType: 'application/json',
      responseSchema,
    },
  })
  const text = res.text ?? '{}'
  return JSON.parse(text) as PlanResponse
}
