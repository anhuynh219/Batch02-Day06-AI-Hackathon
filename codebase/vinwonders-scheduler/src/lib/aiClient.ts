import type { PlanResponse } from '../types'

export async function requestPlan(
  messages: { role: 'user' | 'assistant'; text: string }[],
  itinerarySummary: string,
): Promise<PlanResponse> {
  const res = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, itinerarySummary }),
  })
  if (!res.ok) throw new Error(`/api/plan failed: ${res.status}`)
  return res.json()
}
