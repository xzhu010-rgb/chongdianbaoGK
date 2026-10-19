import { useCallback, useEffect, useRef, useState } from 'react'
import { App as AntdApp, Button, Checkbox, Empty, Input, Menu, Modal, Tooltip, Upload } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import type { UploadChangeParam, UploadFile } from 'antd/es/upload/interface'
import mermaid from 'mermaid'
import {
  ArrowRightOutlined,
  ApartmentOutlined,
  CheckCircleFilled,
  CloseOutlined,
  CopyOutlined,
  DislikeOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  LikeOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MessageOutlined,
  MenuUnfoldOutlined,
  PaperClipOutlined,
  ReloadOutlined,
  SendOutlined,
  SoundOutlined,
} from '@ant-design/icons'
import HeroVisual from './components/HeroVisual'
import { recommendFollowUpQuestions, sendChat } from './services/api'

const questions = [
  '多格列艾汀对机体GK功能的促进如何？',
  '什么是血糖稳态和血糖稳态系统？',
  '使用多格列艾汀会发生低血糖吗？什么情况下风险更高，应该如何预防和处理？',
  '多格列艾汀对体重和肝肾功能有影响吗？',
  '多格列艾汀的常见不良反应是什么？',
  '多格列艾汀在临床上还有其他获益？',
]

const followUpQuestionBatches = {
  gk: [
    [
      '血糖稳态系统的作用机制是什么？',
      '与二甲双胍相比有什么优势？',
      '有哪些血糖稳态相关的临床研究？',
    ],
    [
      '多格列艾汀如何调节葡萄糖激酶？',
      '血糖稳态调节和传统降糖机制有什么不同？',
      '多格列艾汀在临床研究中有哪些治疗获益？',
    ],
  ],
  cardiovascular: [
    [
      '多格列艾汀目前有哪些临床研究？',
      '多格列艾汀的心血管安全性如何？',
      '多格列艾汀与其他降糖药有什么区别？',
    ],
    [
      '多格列艾汀的心血管结局证据到哪一步？',
      '哪些患者需要重点评估心血管风险？',
      '现有研究结论适用于哪些人群？',
    ],
  ],
  general: [
    [
      '这个结论有哪些关键临床证据？',
      '哪些患者更适合关注这个问题？',
      '相关安全性信息有哪些？',
    ],
    [
      '如何理解答案中的关键机制？',
      '临床研究结果有哪些限制？',
      '治疗过程中需要关注什么？',
    ],
  ],
}

function getFollowUpQuestionBatches(question: string) {
  if (/CVOT|心血管|心脏|心血管安全/i.test(question)) return followUpQuestionBatches.cardiovascular
  if (/GK|葡萄糖激酶|血糖稳态|机制/i.test(question)) return followUpQuestionBatches.gk
  return followUpQuestionBatches.general
}

type HistoryItem = {
  key: string
  title: string
  time: string
}

type ConversationTurn = {
  question: string
  answer: string
}

function getHistoryTitle(value: string) {
  const title = value.replace(/\s+/g, ' ').trim()
  return title.length > 16 ? `${title.slice(0, 16)}…` : title
}

async function copyTextToClipboard(value: string) {
  const previouslyFocusedElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  let copied = false
  try {
    textarea.focus()
    textarea.select()
    copied = document.execCommand('copy')
  } catch {
    copied = false
  } finally {
    textarea.remove()
    previouslyFocusedElement?.focus({ preventScroll: true })
  }

  if (copied) return
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  throw new Error('Clipboard access is unavailable.')
}

const model = 'GK充电宝+'

let mindmapRenderSequence = 0

function cleanMindmapNode(value: string, maxLength = 58) {
  return value
    .replace(/[`*_~]/g, '')
    .replace(/[()[\]{}<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function splitMindmapSentences(value: string) {
  return value
    .split(/(?<=[。！？.!?；;])\s*/)
    .map((item) => cleanMindmapNode(item, 72))
    .filter(Boolean)
}

function buildMindmapDefinition(answerText: string, questionText: string) {
  const root = cleanMindmapNode(questionText || '回答思维导图', 26) || '回答思维导图'
  const lines = answerText.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.trim())
  const nodes: Array<{ level: number; text: string }> = []
  let hasStructure = false

  lines.forEach((line) => {
    const heading = line.match(/^(#{1,6})\s*(.+)$/)
    const listItem = line.match(/^(\s*)(?:[-*•]|\d+[.)、])\s*(.+)$/)

    if (heading) {
      const text = cleanMindmapNode(heading[2])
      if (text) {
        hasStructure = true
        nodes.push({ level: heading[1].length > 2 ? 2 : 1, text })
      }
      return
    }

    if (listItem) {
      const text = cleanMindmapNode(listItem[2])
      if (text) {
        hasStructure = true
        nodes.push({ level: listItem[1].length > 1 ? 2 : 1, text })
      }
      return
    }

    const text = cleanMindmapNode(splitMindmapSentences(line).slice(0, 2).join('；'))
    if (text) nodes.push({ level: hasStructure ? 2 : 1, text })
  })

  const fallbackNodes = splitMindmapSentences(answerText).map((text) => ({ level: 1, text }))
  const uniqueNodes = (hasStructure ? nodes : fallbackNodes)
    .filter((node, index, list) => list.findIndex((item) => item.text === node.text) === index)
    .slice(0, 10)

  if (uniqueNodes.length === 0) uniqueNodes.push({ level: 1, text: '等待回答接口返回内容' })

  return [
    'mindmap',
    `  root((${root}))`,
    ...uniqueNodes.map((node) => `${'  '.repeat(node.level + 1)}${node.text}`),
  ].join('\n')
}

function ChatBubbleIcon({ active = false }: { active?: boolean }) {
  return (
    <svg className={`chat-bubble-icon ${active ? 'active' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11.8a8 8 0 0 1-8.2 8.1 8.7 8.7 0 0 1-3.6-.8L4 20l1.2-3.6A7.8 7.8 0 0 1 3.8 12c0-4.6 3.6-8 8.2-8a8 8 0 0 1 8 7.8Z" />
      <circle cx="8.3" cy="12" r=".8" />
      <circle cx="12" cy="12" r=".8" />
      <circle cx="15.7" cy="12" r=".8" />
    </svg>
  )
}

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'base',
  themeVariables: {
    fontFamily: 'Inter, "Microsoft YaHei", sans-serif',
    primaryColor: '#e7f2ff',
    primaryBorderColor: '#4a9cff',
    primaryTextColor: '#17325e',
    lineColor: '#83b5f2',
    secondaryColor: '#f5faff',
    tertiaryColor: '#ffffff',
  },
})

function MindmapPreview({
  definition,
  large = false,
  onSvgReady,
}: {
  definition: string
  large?: boolean
  onSvgReady?: (svg: string) => void
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [rendering, setRendering] = useState(true)
  const [renderError, setRenderError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const renderDiagram = async () => {
      setRendering(true)
      setRenderError(false)
      const renderId = `gkMindmap${mindmapRenderSequence++}`

      try {
        const { svg, bindFunctions } = await mermaid.render(renderId, definition)
        if (cancelled || !canvasRef.current) return
        canvasRef.current.innerHTML = svg
        const svgElement = canvasRef.current.querySelector('svg')
        svgElement?.setAttribute('role', 'img')
        svgElement?.setAttribute('aria-label', '根据回答内容生成的思维导图')
        svgElement?.setAttribute('width', '100%')
        svgElement?.setAttribute('height', '100%')
        svgElement?.setAttribute('preserveAspectRatio', 'xMidYMid meet')
        svgElement?.style.setProperty('height', '100%')
        svgElement?.style.setProperty('max-width', '100%')
        bindFunctions?.(canvasRef.current)
        onSvgReady?.(svg)
      } catch {
        if (!cancelled) {
          setRenderError(true)
          onSvgReady?.('')
        }
      } finally {
        if (!cancelled) setRendering(false)
      }
    }

    void renderDiagram()
    return () => {
      cancelled = true
      if (canvasRef.current) canvasRef.current.innerHTML = ''
    }
  }, [definition, onSvgReady])

  return (
    <div className={`mindmap-preview mermaid-preview ${large ? 'large' : ''}`} aria-busy={rendering}>
      <div ref={canvasRef} className="mermaid-canvas" />
      {rendering && <span className="mindmap-rendering">正在生成思维导图…</span>}
      {renderError && <span className="mindmap-error">当前回答暂时无法生成思维导图。</span>}
    </div>
  )
}
export default function App() {
  const { message } = AntdApp.useApp()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [question, setQuestion] = useState('')
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [activeHistory, setActiveHistory] = useState('new')
  const [draftChatVisible, setDraftChatVisible] = useState(false)
  const [historyManagerOpen, setHistoryManagerOpen] = useState(false)
  const [selectedHistoryKeys, setSelectedHistoryKeys] = useState<string[]>([])
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([])
  const [loading, setLoading] = useState(false)
  const [mindmapGenerated, setMindmapGenerated] = useState(false)
  const [mindmapDefinition, setMindmapDefinition] = useState('')
  const [mindmapSvg, setMindmapSvg] = useState('')
  const [mindmapRevision, setMindmapRevision] = useState(0)
  const [mindmapModalOpen, setMindmapModalOpen] = useState(false)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [suggestionBatchIndex, setSuggestionBatchIndex] = useState(0)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const questionInputRef = useRef<TextAreaRef>(null)
  const answerGroupRef = useRef<HTMLDivElement>(null)
  const suggestionRequestIdRef = useRef(0)
  const deletableHistoryItems = historyItems.filter((item) => item.key !== 'new')
  const visibleHistoryItems = historyItems.filter((item) => item.key !== 'new' || draftChatVisible)
  const fallbackSuggestionBatches = getFollowUpQuestionBatches(`${activeQuestion ?? ''} ${answer}`)
  const fallbackFollowUpQuestions = fallbackSuggestionBatches[suggestionBatchIndex % fallbackSuggestionBatches.length]
  const visibleFollowUpQuestions = suggestionBatchIndex === 0 && suggestedQuestions.length > 0
    ? suggestedQuestions
    : fallbackFollowUpQuestions

  const requestSuggestedQuestions = async (
    questionText: string,
    answerText: string,
    history: ConversationTurn[],
    excludeQuestions: string[] = [],
    rotateFallbackOnFailure = false,
  ) => {
    const requestId = ++suggestionRequestIdRef.current
    setSuggestionsLoading(true)
    try {
      const recommendations = await recommendFollowUpQuestions({
        question: questionText,
        answer: answerText,
        history,
        excludeQuestions,
      })
      if (requestId !== suggestionRequestIdRef.current) return
      if (recommendations.length === 3) {
        setSuggestedQuestions(recommendations)
        setSuggestionBatchIndex(0)
      } else if (rotateFallbackOnFailure) {
        setSuggestionBatchIndex((index) => index + 1)
      }
    } catch {
      if (requestId === suggestionRequestIdRef.current && rotateFallbackOnFailure) {
        setSuggestionBatchIndex((index) => index + 1)
      }
    } finally {
      if (requestId === suggestionRequestIdRef.current) setSuggestionsLoading(false)
    }
  }

  const ask = async (value: string, continueConversation = false) => {
    const history = continueConversation && activeQuestion && answer
      ? [...conversationTurns, { question: activeQuestion, answer }]
      : conversationTurns

    if (history !== conversationTurns) setConversationTurns(history)
    if (activeHistory === 'new') {
      const historyKey = `chat-${Date.now()}`
      const historyTitle = getHistoryTitle(value)
      setActiveHistory(historyKey)
      setDraftChatVisible(false)
      setHistoryItems((items) => items.some((item) => item.key === 'new')
        ? items.map((item) => item.key === 'new' ? { key: historyKey, title: historyTitle, time: '刚刚' } : item)
        : [{ key: historyKey, title: historyTitle, time: '刚刚' }, ...items])
    }
    setActiveQuestion(value)
    setAnswer('')
    setLoading(true)
    setMindmapGenerated(false)
    setMindmapDefinition('')
    setMindmapSvg('')
    setMindmapRevision(0)
    setSuggestedQuestions([])
    setSuggestionBatchIndex(0)
    setSuggestionsLoading(false)
    suggestionRequestIdRef.current += 1
    try {
      const result = await sendChat({ question: value, model, history })
      setAnswer(result.answer)
      void requestSuggestedQuestions(value, result.answer, history)
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : '请求失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  const openMindmap = () => {
    setMindmapDefinition(buildMindmapDefinition(answer, activeQuestion ?? '回答思维导图'))
    setMindmapSvg('')
    setMindmapRevision((revision) => revision + 1)
    setMindmapGenerated(true)
  }

  const askFollowUpQuestion = (value: string) => {
    setQuestion('')
    void ask(value, true)
    window.requestAnimationFrame(() => {
      answerGroupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const refreshFollowUpQuestions = () => {
    if (!activeQuestion || !answer) {
      setSuggestionBatchIndex((index) => index + 1)
      return
    }
    void requestSuggestedQuestions(activeQuestion, answer, conversationTurns, visibleFollowUpQuestions, true)
  }

  const handleMindmapSvgReady = useCallback((svg: string) => {
    setMindmapSvg(svg)
  }, [])

  const copyActiveQuestion = async () => {
    if (!activeQuestion) return
    try {
      await copyTextToClipboard(activeQuestion)
      message.success('问题已复制。')
    } catch {
      message.error('复制失败，请检查浏览器剪贴板权限。')
    }
  }

  const editActiveQuestion = () => {
    if (!activeQuestion) return
    setQuestion(activeQuestion)
    window.requestAnimationFrame(() => questionInputRef.current?.focus())
  }

  const downloadMindmap = () => {
    if (!mindmapSvg) {
      message.info('思维导图仍在生成，请稍候。')
      return
    }
    const blob = new Blob([mindmapSvg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'GK充电宝_回答思维导图.svg'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const renderAnswerFooter = () => (
    <section className={`mindmap-operation ${mindmapGenerated ? 'expanded' : ''}`} aria-label="思维导图操作区">
      {!mindmapGenerated ? (
        <>
          <div className="mindmap-operation-copy">
            <div className="mindmap-operation-title"><ApartmentOutlined /> 想更直观地理解这个答案？</div>
            <p>将回答整理为思维导图，快速梳理核心知识与逻辑关系。</p>
          </div>
          <Button className="mindmap-operation-trigger" onClick={openMindmap}>
            生成思维导图 <ArrowRightOutlined />
          </Button>
        </>
      ) : (
        <>
          <div className="mindmap-result-heading"><span><CheckCircleFilled /> 思维导图</span></div>
          <p className="flow-hint">已根据当前回答提取结构。</p>
          <MindmapPreview key={mindmapRevision} definition={mindmapDefinition} onSvgReady={handleMindmapSvgReady} />
          <div className="preview-actions">
            <Button icon={<ReloadOutlined />} onClick={openMindmap}>重新生成</Button>
            <Button icon={<EyeOutlined />} onClick={() => setMindmapModalOpen(true)}>查看大图</Button>
          </div>
          <div className="artifact-downloads">
            <Button type="link" onClick={downloadMindmap} disabled={!mindmapSvg} icon={<DownloadOutlined />}>下载当前思维导图 SVG</Button>
          </div>
        </>
      )}
    </section>
  )

  const startNewChat = () => {
    setActiveHistory('new')
    setDraftChatVisible(true)
    setHistoryItems((items) => items.some((item) => item.key === 'new')
      ? items
      : [{ key: 'new', title: '新对话', time: '刚刚' }, ...items])
    setActiveQuestion(null)
    setAnswer('')
    setConversationTurns([])
    setMindmapGenerated(false)
    setMindmapDefinition('')
    setMindmapSvg('')
    setMindmapRevision(0)
    setSuggestedQuestions([])
    setSuggestionBatchIndex(0)
    setSuggestionsLoading(false)
    suggestionRequestIdRef.current += 1
    setSelectedFile(null)
    setSidebarOpen(false)
  }

  const handleHistorySelect = (key: string) => {
    setActiveHistory(key)
    if (key === 'new') {
      startNewChat()
      return
    }
    setSidebarOpen(false)
    message.info('历史对话将在接入会话存储后恢复。')
  }

  const openHistoryManager = () => {
    setSelectedHistoryKeys([])
    setHistoryManagerOpen(true)
  }

  const deleteSelectedHistory = () => {
    if (selectedHistoryKeys.length === 0) {
      message.info('请先选择要删除的对话记录。')
      return
    }

    const deletingActiveHistory = selectedHistoryKeys.includes(activeHistory)
    setHistoryItems((items) => items.filter((item) => item.key === 'new' || !selectedHistoryKeys.includes(item.key)))
    setSelectedHistoryKeys([])
    setHistoryManagerOpen(false)

    if (deletingActiveHistory) {
      startNewChat()
    }
    message.success(`已删除 ${selectedHistoryKeys.length} 条对话记录。`)
  }

  const handleUploadChange = ({ file }: UploadChangeParam<UploadFile>) => {
    setSelectedFile(file.originFileObj ?? null)
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="brand"><img className="brand-logo" src={sidebarCollapsed ? './gk-charger-mark.png' : './gk-charger-logo.png'} alt="GK Charger" /><span>华领医药GK充电宝+</span></div>
          <Tooltip title={sidebarCollapsed ? '展开边栏' : '收起边栏'} placement="right" arrow={false}>
            <Button
              className="collapse-sidebar"
              type="text"
              icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              aria-label={sidebarCollapsed ? '展开边栏' : '收起边栏'}
            />
          </Tooltip>
        </div>
        <div className="sidebar-actions">
          <Tooltip title={sidebarCollapsed ? '新对话' : undefined} placement="right" arrow={false}>
            <Button className="new-chat" icon={sidebarCollapsed ? <EditOutlined /> : <ChatBubbleIcon />} onClick={startNewChat}>
              <span className="new-chat-label">新对话</span>
            </Button>
          </Tooltip>
        </div>
        <div className="recent-heading">
          <span>最近</span>
          <div className="recent-actions">
            <Tooltip title="清理对话记录" placement="right" arrow={false} align={{ offset: [12, 0] }}>
              <Button className="recent-action" type="text" icon={<span className="trash-lines-icon"><DeleteOutlined /></span>} onClick={openHistoryManager} aria-label="清理对话记录" />
            </Tooltip>
          </div>
        </div>
        <Menu
          className="history-menu"
          mode="inline"
          selectedKeys={[activeHistory]}
          items={visibleHistoryItems.map((item) => ({
            key: item.key,
            icon: sidebarCollapsed ? <MessageOutlined /> : <ChatBubbleIcon active={activeHistory === item.key} />,
            label: <span className="history-menu-label"><span>{item.title}</span><small>{item.time}</small></span>,
          }))}
          onClick={({ key }) => handleHistorySelect(key)}
        />
        <div className="sidebar-qr-card">
          <img src="./conversation-qr.png" alt="扫码在手机上继续本次对话" />
        </div>
      </aside>
      {sidebarOpen && <Button className="scrim" type="text" onClick={() => setSidebarOpen(false)} aria-label="关闭边栏" />}

      <main className="phone">
        <nav className="nav">
          <Button type="text" icon={<MenuOutlined />} onClick={() => setSidebarOpen(true)} aria-label="打开边栏" />
        </nav>
        {!activeQuestion ? (
          <section className="home">
            <div className="hero">
              <div className="hero-copy">
                <h1><span className="hero-title-line">你好，我是华领医药</span><em>GK充电宝+</em></h1>
                <p>专注多格列艾汀的医学知识助手</p>
                <hr />
                <span>基于公司内部资料，帮助你快速查询和理解多格列艾汀的相关医学信息，包括药物机制、临床证据、用法用量、安全性等内容。</span>
                <Button className="hero-intro-link" type="link" icon={<ArrowRightOutlined />} onClick={() => void ask('GK充电宝智能体介绍')}>
                  GK充电宝智能体介绍
                </Button>
              </div>
              <HeroVisual />
              <div className="hero-notice"><ExclamationCircleOutlined /><span>本回答基于公司内部资料及公开医学文献，仅供专业人士参考，不替代医生的专业判断。</span></div>
            </div>
            <div className="question-heading"><h2>猜你想问</h2></div>
            <div className="question-list">{questions.map((item, index) => <Button className="question" key={item} onClick={() => void ask(item)} type="default" block><i>0{index + 1}</i><span>{item}</span><ArrowRightOutlined /></Button>)}</div>
          </section>
        ) : (
          <section className="conversation">
            {conversationTurns.map((turn, index) => (
              <div className="conversation-previous-turn" key={`${index}-${turn.question}`}>
                <div className="user-message">
                  <div className="user-bubble">{turn.question}</div>
                </div>
                <div className="answer-group previous-answer">
                  <div className="answer answer-integrated">{turn.answer}</div>
                </div>
              </div>
            ))}
            <div className="user-message">
              <div className="user-bubble">{activeQuestion}</div>
              <div className="user-question-actions">
                <Tooltip title="复制问题"><Button className="user-question-action" type="text" icon={<CopyOutlined />} aria-label="复制问题" onClick={() => void copyActiveQuestion()} /></Tooltip>
                <Tooltip title="编辑问题"><Button className="user-question-action" type="text" icon={<EditOutlined />} aria-label="编辑问题" disabled={loading} onClick={editActiveQuestion} /></Tooltip>
              </div>
            </div>
            <div className="answer-group" ref={answerGroupRef}>
              <div className="answer answer-integrated">
                {loading ? '正在生成回答…' : answer}
              </div>
              {answer && (
                <>
                  <div className="answer-actions answer-actions-outside">
                    <Tooltip title="朗读回答"><Button className="answer-action" type="text" size="small" icon={<SoundOutlined />} aria-label="朗读回答" /></Tooltip>
                    <Tooltip title="复制回答"><Button className="answer-action" type="text" size="small" icon={<CopyOutlined />} aria-label="复制回答" onClick={() => message.success('回答已复制。')} /></Tooltip>
                    <Tooltip title="有帮助"><Button className="answer-action" type="text" size="small" icon={<LikeOutlined />} aria-label="有帮助" /></Tooltip>
                    <Tooltip title="没有帮助"><Button className="answer-action" type="text" size="small" icon={<DislikeOutlined />} aria-label="没有帮助" /></Tooltip>
                    <span className="answer-completed"><CheckCircleFilled /> 回答完毕</span>
                  </div>
                  {renderAnswerFooter()}
                  <section className="follow-up-panel" aria-labelledby="follow-up-title">
                    <header className="follow-up-heading">
                      <div className="follow-up-heading-copy">
                        <ChatBubbleIcon active />
                        <h2 id="follow-up-title">你还可以继续问</h2>
                      </div>
                      <Button type="text" className="follow-up-refresh" icon={<ReloadOutlined />} loading={suggestionsLoading} onClick={refreshFollowUpQuestions}>
                        换一批
                      </Button>
                    </header>
                    <div className="follow-up-questions">
                      {visibleFollowUpQuestions.map((item) => (
                        <Button className="follow-up-question" key={item} onClick={() => askFollowUpQuestion(item)}>
                          <span className="follow-up-question-label">{item}</span><ArrowRightOutlined />
                        </Button>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          </section>
        )}
        <form className="composer" onSubmit={(event) => { event.preventDefault(); if (question.trim()) { void ask(question.trim(), Boolean(activeQuestion)); setQuestion('') } }}>
          <Upload beforeUpload={() => false} maxCount={1} showUploadList={false} accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,image/*" onChange={handleUploadChange}>
            <Tooltip title="选择要附加的文件"><Button className="attach-button" type="text" icon={<PaperClipOutlined />} aria-label="选择要附加的文件" /></Tooltip>
          </Upload>
          {selectedFile && <span className="selected-file" title={selectedFile.name}>{selectedFile.name}<Button type="text" icon={<CloseOutlined />} aria-label="移除文件" onClick={() => setSelectedFile(null)} /></span>}
          <Input.TextArea
            className="composer-input"
            ref={questionInputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="输入问题"
            aria-label="输入问题"
            autoSize={{ minRows: 1, maxRows: 5 }}
          />
          <span className="model-label" aria-label="当前模型">{model}</span>
          <Button type="primary" htmlType="submit" shape="circle" disabled={!question.trim() || loading} icon={<SendOutlined />} aria-label="发送问题" />
        </form>
      </main>

      <Modal
        className="mindmap-modal"
        title="血糖稳态系统思维导图"
        open={mindmapModalOpen}
        centered
        width={900}
        footer={null}
        onCancel={() => setMindmapModalOpen(false)}
      >
        <MindmapPreview key={`large-${mindmapRevision}`} large definition={mindmapDefinition} onSvgReady={handleMindmapSvgReady} />
      </Modal>

      <Modal
        className="history-manager-modal"
        title="清理对话记录"
        open={historyManagerOpen}
        centered
        okText="删除选中"
        cancelText="取消"
        okButtonProps={{ danger: true, disabled: selectedHistoryKeys.length === 0 }}
        onCancel={() => setHistoryManagerOpen(false)}
        onOk={deleteSelectedHistory}
      >
        {deletableHistoryItems.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可删除的对话记录" /> : <div className="history-manager">
          <Checkbox
            indeterminate={selectedHistoryKeys.length > 0 && selectedHistoryKeys.length < deletableHistoryItems.length}
            checked={selectedHistoryKeys.length === deletableHistoryItems.length}
            onChange={(event) => setSelectedHistoryKeys(event.target.checked ? deletableHistoryItems.map((item) => item.key) : [])}
          >
            全选对话记录（{deletableHistoryItems.length}）
          </Checkbox>
          <div className="history-manager-list">
            {deletableHistoryItems.map((item) => <Checkbox
              key={item.key}
              checked={selectedHistoryKeys.includes(item.key)}
              onChange={(event) => setSelectedHistoryKeys((keys) => event.target.checked ? [...keys, item.key] : keys.filter((key) => key !== item.key))}
            >
              <span className="history-manager-item"><span>{item.title}</span><small>{item.time}</small></span>
            </Checkbox>)}
          </div>
        </div>}
      </Modal>
    </div>
  )
}
