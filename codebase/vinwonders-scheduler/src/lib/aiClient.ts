import type { PlanResponse } from '../types'

const SESSION_KEY = 'vinwonders.sessionId'

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getSessionId() {
  const existing = sessionStorage.getItem(SESSION_KEY)
  if (existing) return existing
  const id = uuid()
  sessionStorage.setItem(SESSION_KEY, id)
  return id
}

export async function requestPlan(
  messages: { role: 'user' | 'assistant'; text: string }[],
  itinerarySummary: string,
  persona = '',
  clientTurnStartedAt = new Date().toISOString(),
): Promise<PlanResponse> {
  const res = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      itinerarySummary,
      persona,
      sessionId: getSessionId(),
      userId: null,
      clientTurnStartedAt,
    }),
  })
  if (!res.ok) throw new Error(`/api/plan failed: ${res.status}`)
  return res.json()
}

export async function logChatTurn(args: {
  startTimestamp: string
  endTimestamp: string
  latencyMs: number
  userMessage: string
  assistantResponse: string
  modelName?: string
  toolCalls?: string[]
}) {
  const res = await fetch('/api/log-turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: getSessionId(),
      userId: null,
      startTimestamp: args.startTimestamp,
      endTimestamp: args.endTimestamp,
      latencyMs: args.latencyMs,
      userMessage: { timestamp: args.startTimestamp, content: args.userMessage },
      assistantResponse: { timestamp: args.endTimestamp, content: args.assistantResponse },
      modelName: args.modelName ?? 'local-catalog-info',
      toolCalls: args.toolCalls ?? [],
    }),
  })
  if (!res.ok) throw new Error(`/api/log-turn failed: ${res.status}`)
}
