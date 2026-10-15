import { useRef, useState } from 'react'
import CvotPrompt from './components/CvotPrompt'
import { sendChat } from './services/api'

const questions = [
  '什么是血糖稳态和血糖稳态系统？',
  '多格列艾汀是否有CVOT 的研究证据?',
  '多格列艾汀的推荐剂量？为何会选择该剂量？如出现误服、漏服该如何处理？',
  '多格列艾汀片在临床应用中分别与肝酶指标、胆红素指标，合成功能指标等的对应关系。',
]

const mindmapPpt = '/gk-glucose-homeostasis-with-mindmap.pptx'
const summaryPpt = '/gk-glucose-homeostasis-summary-only.pptx'

type OutputTab = 'mindmap' | 'ppt'

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

function BroomIcon() {
  return (
    <svg className="broom-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 3v7M8 10h11l-1.3 3H6.7L8 10ZM7 13l-2 7h14l-2-7M9 16l-.4 2M13 16l-.4 2M17 16l-.4 2" />
    </svg>
  )
}

function MindmapPreview({ large = false }: { large?: boolean }) {
  return (
    <div className={`mindmap-preview ${large ? 'large' : ''}`}>
      <span className="mindmap-node one">血糖稳态</span>
      <span className="mindmap-node two">GK传感器</span>
      <span className="mindmap-node three">调节轴</span>
      <span className="mindmap-node four">2型糖尿病</span>
      <span className="mindmap-center">血糖稳态系统</span>
    </div>
  )
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [model, setModel] = useState('GK充电宝+V1.2')
  const [question, setQuestion] = useState('')
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [outputTab, setOutputTab] = useState<OutputTab | null>(null)
  const [mindmapReady, setMindmapReady] = useState(false)
  const [includeMindmap, setIncludeMindmap] = useState(false)
  const [pptGenerating, setPptGenerating] = useState(false)
  const [generatedPpt, setGeneratedPpt] = useState<boolean | null>(null)
  const [mindmapModalOpen, setMindmapModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const ask = async (value: string, displayQuestion = value) => {
    setActiveQuestion(displayQuestion)
    setAnswer('')
    setLoading(true)
    setOutputTab(null)
    setMindmapReady(false)
    setGeneratedPpt(null)
    setIncludeMindmap(false)
    try {
      const result = await sendChat({ question: value, model })
      setAnswer(result.answer)
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : '请求失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  const openMindmap = () => {
    setMindmapReady(true)
    setOutputTab('mindmap')
    setGeneratedPpt(null)
  }

  const openPpt = () => {
    setOutputTab('ppt')
    setIncludeMindmap(mindmapReady)
    setGeneratedPpt(null)
  }

  const startPpt = () => {
    const containsMindmap = includeMindmap && mindmapReady
    setPptGenerating(true)
    setGeneratedPpt(null)
    window.setTimeout(() => {
      setPptGenerating(false)
      setGeneratedPpt(containsMindmap)
    }, 650)
  }

  const startNewChat = () => {
    setActiveQuestion(null)
    setAnswer('')
    setOutputTab(null)
    setMindmapReady(false)
    setGeneratedPpt(null)
    setSelectedFile(null)
    setSidebarOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand"><img className="brand-logo" src="./huaming-logo.png" alt="" /><span>GK充电宝</span></div>
        <div className="sidebar-actions">
          <button className="new-chat" onClick={startNewChat} type="button"><ChatBubbleIcon /><span>新对话</span><b>＋</b></button>
          <button className="clear-history" onClick={startNewChat} type="button" aria-label="清理当前对话并新建对话" title="清理当前对话"><BroomIcon /></button>
        </div>
        <div className="history-list">
          <button className="history-item current" onClick={startNewChat} type="button"><ChatBubbleIcon active /><span className="history-label">新对话</span><small>刚刚</small></button>
          <button className="history-item" type="button"><ChatBubbleIcon /><span className="history-label">GK充电宝智能体…</span><small>09:48</small></button>
          <button className="history-item" type="button"><ChatBubbleIcon /><span className="history-label">为什么说葡萄糖激酶…</span><small>昨天</small></button>
          <button className="history-item" type="button"><ChatBubbleIcon /><span className="history-label">GK充电宝智能体…</span><small>昨天</small></button>
          <button className="history-item" type="button"><ChatBubbleIcon /><span className="history-label">为什么说葡萄糖激酶…</span><small>昨天</small></button>
          <button className="history-item" type="button"><ChatBubbleIcon /><span className="history-label">什么是血糖稳态…</span><small>昨天</small></button>
          <button className="history-item" type="button"><ChatBubbleIcon /><span className="history-label">什么是血糖稳态…</span><small>昨天</small></button>
          <button className="history-item" type="button"><ChatBubbleIcon /><span className="history-label">为什么说葡萄糖激酶…</span><small>昨天</small></button>
          <button className="history-item" type="button"><ChatBubbleIcon /><span className="history-label">为什么说葡萄糖激酶…</span><small>10-13</small></button>
        </div>
      </aside>
      {sidebarOpen && <button className="scrim" onClick={() => setSidebarOpen(false)} type="button" aria-label="关闭边栏" />}

      <main className="phone">
        <nav className="nav"><button onClick={() => setSidebarOpen(true)} type="button" aria-label="打开边栏">☰</button><button type="button">•••</button></nav>
        {!activeQuestion ? (
          <section className="home">
            <div className="hero"><small>GK Biopharma</small><h1>你好，我是华领医药 <em>GK充电宝</em></h1><p>专注多格列艾汀的医学知识助手</p><hr /><span>基于公司内部资料，帮助你快速查询和理解多格列艾汀的相关医学信息。</span></div>
            <div className="question-heading"><h2>猜你想问</h2><button type="button">换一批　⟳</button></div>
            <div className="question-list">{questions.map((item, index) => <button className="question" key={item} onClick={() => void ask(item)} type="button"><i>0{index + 1}</i><span>{item}</span><b>›</b></button>)}</div>
          </section>
        ) : (
          <section className="conversation">
            <div className="user-bubble">{activeQuestion}</div>
            {activeQuestion === questions[1] ? <><div className="assistant-head">♙　GK充电宝　<small>09:41</small></div><CvotPrompt onContinue={(selection) => { void ask(`${activeQuestion}\n我想了解的是：${selection}`, activeQuestion) }} />{loading && <div className="answer">正在生成回答…</div>}{answer && <div className="answer cvot-result">{answer}</div>}</> : <div className="answer">{loading ? '正在生成回答…' : answer}</div>}
            {answer && <>
              <div className="answer-actions"><button type="button">)))</button><button type="button">♡</button><button type="button">♧</button></div>
              <section className="generation-section" aria-label="回答内容生成工具">
                <div className="generation-tabs" role="tablist" aria-label="生成内容">
                  <button className={outputTab === 'mindmap' ? 'active' : ''} onClick={openMindmap} role="tab" aria-selected={outputTab === 'mindmap'} type="button">生成思维导图</button>
                  <button className={outputTab === 'ppt' ? 'active' : ''} onClick={openPpt} role="tab" aria-selected={outputTab === 'ppt'} type="button">生成PPT</button>
                </div>

                {outputTab === 'mindmap' && <div className="generation-panel">
                  <div className="flow-title"><i>✓</i>思维导图已生成</div>
                  <p className="flow-hint">已完成血糖稳态系统的结构化整理，可预览后继续生成 PPT。</p>
                  <MindmapPreview />
                  <div className="preview-actions">
                    <button onClick={openMindmap} type="button">重新生成</button>
                    <button onClick={() => setMindmapModalOpen(true)} type="button">查看大图</button>
                  </div>
                </div>}

                {outputTab === 'ppt' && <div className="generation-panel">
                  {generatedPpt === null ? <>
                    <div className="flow-title">PPT内容设置　ⓘ</div>
                    <p className="flow-hint">选择 PPT 是否包含已生成的思维导图。</p>
                    <label className={`ppt-option ${!mindmapReady ? 'unavailable' : ''}`}>
                      <input type="checkbox" checked={includeMindmap} disabled={!mindmapReady || pptGenerating} onChange={(event) => setIncludeMindmap(event.target.checked)} />
                      <span><strong>包含思维导图</strong><small>{mindmapReady ? '将已生成的思维导图页面包含在 PPT 中' : '生成思维导图后即可勾选此项'}</small></span>
                    </label>
                    <button className="start-ppt" disabled={pptGenerating} onClick={startPpt} type="button">{pptGenerating ? <><span className="spinner" />正在生成PPT…</> : '开始生成PPT'}</button>
                  </> : <>
                    <div className="ppt-card">
                      <div className="ppt-icon">PPT</div>
                      <div className="ppt-info"><strong>{generatedPpt ? 'GK充电宝_分析报告_含思维导图.pptx' : 'GK充电宝_分析报告_总结要点.pptx'}</strong><span className="ppt-status"><i>✓</i> PPT已生成，{generatedPpt ? '包含思维导图' : '仅总结要点'}</span></div>
                      <a className="ppt-download" href={generatedPpt ? mindmapPpt : summaryPpt} download={generatedPpt ? 'GK充电宝_分析报告_含思维导图.pptx' : 'GK充电宝_分析报告_总结要点.pptx'}>⇩ 下载PPT</a>
                    </div>
                    <button className="regenerate-ppt" onClick={startPpt} type="button">重新生成PPT</button>
                  </>}
                </div>}
              </section>
            </>}
          </section>
        )}
        <form className="composer" onSubmit={(event) => { event.preventDefault(); if (question.trim()) { void ask(question.trim()); setQuestion('') } }}>
          <input ref={fileInput} className="file-input" type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,image/*" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
          <button className="attach-button" type="button" aria-label="选择要附加的文件" title="选择文件" onClick={() => fileInput.current?.click()}>📎</button>
          {selectedFile && <span className="selected-file" title={selectedFile.name}>{selectedFile.name}<button type="button" aria-label="移除文件" onClick={() => { setSelectedFile(null); if (fileInput.current) fileInput.current.value = '' }}>×</button></span>}
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="输入问题" />
          <select value={model} onChange={(event) => setModel(event.target.value)}><option>GK充电宝+V1.2</option><option>GK充电宝</option></select>
          <button type="submit" aria-label="发送问题">➤</button>
        </form>
      </main>

      {mindmapModalOpen && <div className="mindmap-modal-backdrop" role="presentation" onClick={() => setMindmapModalOpen(false)}>
        <section className="mindmap-modal" role="dialog" aria-modal="true" aria-label="血糖稳态系统思维导图大图" onClick={(event) => event.stopPropagation()}>
          <div className="modal-heading"><strong>血糖稳态系统思维导图</strong><button type="button" aria-label="关闭大图" onClick={() => setMindmapModalOpen(false)}>×</button></div>
          <MindmapPreview large />
        </section>
      </div>}
    </div>
  )
}
