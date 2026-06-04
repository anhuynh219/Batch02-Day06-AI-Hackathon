import { GoogleGenAI, Type } from '@google/genai'
import type { PlanResponse } from '../src/types'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
  const filePath = path.join(__dirname, 'SYSTEM_PROMPT.md')
  const template = fs.readFileSync(filePath, 'utf8')
  return `${template}${menu}`
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
