import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { networkInterfaces } from 'node:os'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv } from 'vite'

const privateIpv4Hosts = Object.values(networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .filter(({ address, family, internal }) => {
    if (family !== 'IPv4' || internal) return false
    const octets = address.split('.').map(Number)
    return octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
  })
  .map(({ address }) => address)

type FastGptEnvironment = {
  GK_API_KEY?: string
  GK_APP_ID?: string
  GK_API_URL?: string
  FOLLOWUP_API_KEY?: string
  FOLLOWUP_API_MODEL?: string
  FOLLOWUP_API_BASE_URL?: string
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

async function readRequestBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 1024 * 1024) throw new Error('请求内容不能超过 1 MB。')
    chunks.push(buffer)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('请求内容不是有效的 JSON。')
  }
}

function contentToText(content: unknown): string | undefined {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return undefined

  const parts = content.flatMap((item) => {
    if (typeof item === 'string') return [item]
    if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') return [item.text]
    return []
  })
  return parts.length ? parts.join('') : undefined
}

function extractAnswer(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const data = payload as Record<string, unknown>
  const choices = Array.isArray(data.choices) ? data.choices : []
  const firstChoice = choices[0] as Record<string, unknown> | undefined
  const message = firstChoice?.message as Record<string, unknown> | undefined

  return contentToText(message?.content)
    ?? contentToText(firstChoice?.text)
    ?? (typeof data.answer === 'string' ? data.answer : undefined)
    ?? ((data.responseData && typeof data.responseData === 'object' && 'answer' in data.responseData)
      ? contentToText((data.responseData as Record<string, unknown>).answer)
      : undefined)
}

function gkChatProxy(environment: FastGptEnvironment) {
  return {
    name: 'gk-fastgpt-chat-proxy',
    configureServer(server: { middlewares: { use: (handler: (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => void) => void } }) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split('?')[0]
        if (pathname !== '/api/chat') return next()

        void (async () => {
          if (request.method !== 'POST') {
            response.setHeader('Allow', 'POST')
            return sendJson(response, 405, { error: '仅支持 POST 请求。' })
          }

          let body: unknown
          try {
            body = await readRequestBody(request)
          } catch (error) {
            return sendJson(response, 400, { error: error instanceof Error ? error.message : '请求内容无法读取。' })
          }

          const question = body && typeof body === 'object' && 'question' in body
            ? (body as { question?: unknown }).question
            : undefined
          if (typeof question !== 'string' || !question.trim()) {
            return sendJson(response, 400, { error: '请提供有效的 question。' })
          }

          const { GK_API_KEY: apiKey, GK_APP_ID: appId, GK_API_URL: apiUrl } = environment
          if (!apiKey || !appId || !apiUrl) {
            console.error('[GK API] 缺少服务端配置，请检查 frontend/.env.local 中的 GK_API_KEY、GK_APP_ID、GK_API_URL。')
            return sendJson(response, 500, { error: 'API 尚未配置，请检查服务端 .env.local 配置。' })
          }

          const history = body && typeof body === 'object' && 'history' in body && Array.isArray((body as { history?: unknown }).history)
            ? (body as { history: unknown[] }).history
                .filter((turn): turn is { question: string; answer: string } => (
                  !!turn && typeof turn === 'object' &&
                  'question' in turn && typeof turn.question === 'string' &&
                  'answer' in turn && typeof turn.answer === 'string'
                ))
                .slice(-12)
            : []

          let endpoint: URL
          try {
            endpoint = new URL(apiUrl)
          } catch {
            console.error('[GK API] GK_API_URL 不是有效的 URL。')
            return sendJson(response, 500, { error: '服务端 API 地址配置无效。' })
          }

          try {
            const upstream = await fetch(endpoint, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                appId,
                stream: false,
                messages: [
                  ...history.flatMap((turn) => [
                    { role: 'user', content: turn.question.trim().slice(0, 2000) },
                    { role: 'assistant', content: turn.answer.trim().slice(0, 12000) },
                  ]),
                  { role: 'user', content: question.trim() },
                ],
              }),
              signal: AbortSignal.timeout(60_000),
            })
            const raw = await upstream.text()
            let payload: unknown
            try {
              payload = JSON.parse(raw)
            } catch {
              payload = undefined
            }

            if (!upstream.ok) {
              const safeBody = raw.replaceAll(apiKey, '[REDACTED]').slice(0, 4000)
              console.error('[GK API] 上游请求失败。', {
                url: endpoint.toString(),
                status: upstream.status,
                statusText: upstream.statusText,
                response: safeBody,
              })
              return sendJson(response, 502, { error: `GK+ API 请求失败（${upstream.status}）。请稍后重试。` })
            }

            const answer = extractAnswer(payload)
            if (!answer) {
              console.error('[GK API] 上游返回成功状态，但响应中未找到回答内容。', {
                url: endpoint.toString(),
                status: upstream.status,
                responseKeys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
              })
              return sendJson(response, 502, { error: 'GK+ API 返回格式无法识别。' })
            }

            return sendJson(response, 200, { answer })
          } catch (error) {
            const detail = error instanceof Error ? error.message : String(error)
            console.error('[GK API] 无法连接上游服务。', {
              url: endpoint.toString(),
              error: detail.replaceAll(apiKey, '[REDACTED]'),
            })
            return sendJson(response, 502, { error: '无法连接 GK+ API，请检查网络或服务地址。' })
          }
        })().catch((error) => {
          console.error('[GK API] 代理处理异常。', error instanceof Error ? error.message : String(error))
          if (!response.headersSent) sendJson(response, 500, { error: '服务端处理请求时发生错误。' })
        })
      })
    },
  }
}

function parseSuggestedQuestions(content: string): string[] {
  const withoutCodeFence = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const jsonStart = withoutCodeFence.indexOf('{')
  const jsonEnd = withoutCodeFence.lastIndexOf('}')
  const arrayStart = withoutCodeFence.indexOf('[')
  const arrayEnd = withoutCodeFence.lastIndexOf(']')
  const candidate = jsonStart >= 0 && jsonEnd > jsonStart
    ? withoutCodeFence.slice(jsonStart, jsonEnd + 1)
    : arrayStart >= 0 && arrayEnd > arrayStart
      ? withoutCodeFence.slice(arrayStart, arrayEnd + 1)
      : withoutCodeFence

  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch {
    parsed = undefined
  }

  const questions = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>).suggestedQuestions ?? (parsed as Record<string, unknown>).questions
      : undefined

  if (Array.isArray(questions)) {
    return [...new Set(questions
      .filter((question): question is string => typeof question === 'string')
      .map((question) => question.trim())
      .filter(Boolean))]
      .slice(0, 3)
  }

  return withoutCodeFence
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)、])\s*/, '').replace(/^['"“”]|['"“”]$/g, '').trim())
    .filter(Boolean)
    .slice(0, 3)
}

function followUpQuestionsProxy(environment: FastGptEnvironment) {
  return {
    name: 'gk-follow-up-questions-proxy',
    configureServer(server: { middlewares: { use: (handler: (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => void) => void } }) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split('?')[0]
        if (pathname !== '/api/suggestions') return next()

        void (async () => {
          if (request.method !== 'POST') {
            response.setHeader('Allow', 'POST')
            return sendJson(response, 405, { error: '仅支持 POST 请求。' })
          }

          let body: unknown
          try {
            body = await readRequestBody(request)
          } catch (error) {
            return sendJson(response, 400, { error: error instanceof Error ? error.message : '请求内容无法读取。' })
          }

          const data = body && typeof body === 'object' ? body as Record<string, unknown> : {}
          const question = typeof data.question === 'string' ? data.question.trim() : ''
          const answer = typeof data.answer === 'string' ? data.answer.trim() : ''
          if (!question || !answer) {
            return sendJson(response, 400, { error: '请提供有效的 question 和 answer。' })
          }

          const { FOLLOWUP_API_KEY: apiKey, FOLLOWUP_API_MODEL: model, FOLLOWUP_API_BASE_URL: baseUrl = 'http://223.108.218.44:54001/v1' } = environment
          if (!apiKey || !model) {
            console.error('[追问推荐 API] 缺少服务端配置，请检查 frontend/.env.local 中的 FOLLOWUP_API_KEY 和 FOLLOWUP_API_MODEL。')
            return sendJson(response, 503, { error: '追问推荐 API 尚未配置。' })
          }

          let endpoint: URL
          try {
            endpoint = new URL('chat/completions', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
          } catch {
            console.error('[追问推荐 API] FOLLOWUP_API_BASE_URL 不是有效的 URL。')
            return sendJson(response, 500, { error: '追问推荐 API 地址配置无效。' })
          }

          const history = Array.isArray(data.history)
            ? data.history
                .filter((turn): turn is { question: string; answer: string } => (
                  !!turn && typeof turn === 'object' &&
                  'question' in turn && typeof turn.question === 'string' &&
                  'answer' in turn && typeof turn.answer === 'string'
                ))
                .slice(-8)
            : []
          const excluded = Array.isArray(data.excludeQuestions)
            ? data.excludeQuestions.filter((item): item is string => typeof item === 'string').slice(0, 12)
            : []
          const context = [
            ...history.flatMap((turn) => [
              `此前问题：${turn.question.trim().slice(0, 1000)}`,
              `此前回答：${turn.answer.trim().slice(0, 3000)}`,
            ]),
            `当前问题：${question.slice(0, 1000)}`,
            `当前回答：${answer.slice(0, 5000)}`,
            ...(excluded.length ? [`请避开这些已显示的问题：${excluded.join('；')}`] : []),
          ].join('\n')

          try {
            const upstream = await fetch(endpoint, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model,
                stream: false,
                temperature: 0.7,
                messages: [
                  {
                    role: 'system',
                    content: '你是医学知识助手的追问推荐器。根据对话中的问题和回答，推荐恰好 3 个简洁、具体、彼此不同且适合继续提问的问题。问题应紧扣当前回答，不要重复已有问题，不要回答问题。只输出 JSON 对象，格式为 {"suggestedQuestions":["问题1","问题2","问题3"]}，不要输出 Markdown 或其他文字。',
                  },
                  { role: 'user', content: context },
                ],
              }),
              signal: AbortSignal.timeout(30_000),
            })
            const raw = await upstream.text()
            let payload: unknown
            try {
              payload = JSON.parse(raw)
            } catch {
              payload = undefined
            }

            if (!upstream.ok) {
              const safeBody = raw.replaceAll(apiKey, '[REDACTED]').slice(0, 3000)
              console.error('[追问推荐 API] 上游请求失败。', {
                url: endpoint.toString(),
                status: upstream.status,
                statusText: upstream.statusText,
                response: safeBody,
              })
              return sendJson(response, 502, { error: `追问推荐 API 请求失败（${upstream.status}）。` })
            }

            const answerText = extractAnswer(payload)
            const suggestedQuestions = answerText ? parseSuggestedQuestions(answerText) : []
            if (suggestedQuestions.length === 0) {
              console.error('[追问推荐 API] 响应中未解析到推荐问题。', {
                url: endpoint.toString(),
                responseKeys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
              })
              return sendJson(response, 502, { error: '追问推荐 API 返回格式无法识别。' })
            }

            return sendJson(response, 200, { suggestedQuestions })
          } catch (error) {
            const detail = error instanceof Error ? error.message : String(error)
            console.error('[追问推荐 API] 无法连接上游服务。', {
              url: endpoint.toString(),
              error: detail.replaceAll(apiKey, '[REDACTED]'),
            })
            return sendJson(response, 502, { error: '无法连接追问推荐 API，请检查网络或服务地址。' })
          }
        })().catch((error) => {
          console.error('[追问推荐 API] 代理处理异常。', error instanceof Error ? error.message : String(error))
          if (!response.headersSent) sendJson(response, 500, { error: '服务端处理请求时发生错误。' })
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), gkChatProxy(environment), followUpQuestionsProxy(environment)],
    server: {
      port: 4174,
      host: '0.0.0.0',
      allowedHosts: privateIpv4Hosts,
    },
  }
})
