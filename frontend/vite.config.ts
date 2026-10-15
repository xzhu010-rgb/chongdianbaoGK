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
                messages: [{ role: 'user', content: question.trim() }],
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

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), gkChatProxy(environment)],
    server: {
      port: 4174,
      host: '0.0.0.0',
      allowedHosts: privateIpv4Hosts,
    },
  }
})
