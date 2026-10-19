export type ChatRequest = {
  question: string
  model: string
  history?: Array<{ question: string; answer: string }>
}

export type ChatResponse = {
  answer: string
  references?: Array<{ title: string; source: string }>
}

export type FollowUpRequest = {
  question: string
  answer: string
  history?: Array<{ question: string; answer: string }>
  excludeQuestions?: string[]
}

export async function sendChat(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: request.question, history: request.history ?? [] }),
  })

  const payload = await response.json() as ChatResponse & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error || `API 请求失败（${response.status}）`)
  }

  if (typeof payload.answer !== 'string') throw new Error('API 返回内容格式无法识别。')
  return payload
}

export async function recommendFollowUpQuestions(request: FollowUpRequest): Promise<string[]> {
  const response = await fetch('/api/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  const payload = await response.json() as { suggestedQuestions?: unknown; error?: string }
  if (!response.ok) throw new Error(payload.error || `追问推荐请求失败（${response.status}）`)
  if (!Array.isArray(payload.suggestedQuestions)) return []
  return payload.suggestedQuestions
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3)
}
