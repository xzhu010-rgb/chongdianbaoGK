export type ChatRequest = {
  question: string
  model: string
}

export type ChatResponse = {
  answer: string
  references?: Array<{ title: string; source: string }>
}

export async function sendChat(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: request.question }),
  })

  const payload = await response.json() as ChatResponse & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error || `API 请求失败（${response.status}）`)
  }

  if (typeof payload.answer !== 'string') throw new Error('API 返回内容格式无法识别。')
  return payload
}
