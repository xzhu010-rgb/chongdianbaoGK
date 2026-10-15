import { useState } from 'react'
import CvotPrompt from './components/CvotPrompt'
import { sendChat } from './services/api'

const questions = [
  '什么是血糖稳态和血糖稳态系统？',
  '多格列艾汀是否有CVOT 的研究证据?',
  '多格列艾汀的推荐剂量？为何会选择该剂量？如出现误服、漏服该如何处理？',
  '多格列艾汀片在临床应用中分别与肝酶指标、胆红素指标，合成功能指标等的对应关系。',
]

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [model, setModel] = useState('GK充电宝+V1.2')
  const [question, setQuestion] = useState('')
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  const ask = async (value: string, displayQuestion = value) => {
    setActiveQuestion(displayQuestion)
    setAnswer('')
    setLoading(true)
    try {
      const result = await sendChat({ question: value, model })
      setAnswer(result.answer)
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : '请求失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">🌈 <span>GK充电宝</span></div>
        <button className="new-chat" onClick={() => { setActiveQuestion(null); setAnswer(''); setSidebarOpen(false) }} type="button">◉　新对话　＋</button>
        <div className="history-item current">◉　新对话 <small>刚刚</small></div>
        <div className="history-item">◌　为什么说葡萄糖激酶（GK）</div>
        <div className="history-item">◌　什么是血糖稳态和血糖稳态系统</div>
      </aside>
      {sidebarOpen && <button className="scrim" onClick={() => setSidebarOpen(false)} type="button" aria-label="关闭边栏" />}

      <main className="phone">
        <nav className="nav"><button onClick={() => setSidebarOpen(true)} type="button">☰</button><strong>GK充电宝</strong><button type="button">•••</button></nav>
        {!activeQuestion ? (
          <section className="home">
            <div className="hero"><small>GK Biopharma</small><h1>你好，我是华领医药 <em>GK充电宝</em></h1><p>专注多格列艾汀的医学知识助手</p><hr /><span>基于公司内部资料，帮助你快速查询和理解多格列艾汀的相关医学信息。</span></div>
            <div className="question-heading"><h2>猜你想问</h2><button type="button">换一批　⟳</button></div>
            <div className="question-list">{questions.map((item, index) => <button className="question" key={item} onClick={() => ask(item)} type="button"><i>0{index + 1}</i><span>{item}</span><b>›</b></button>)}</div>
          </section>
        ) : (
          <section className="conversation">
            <div className="user-bubble">{activeQuestion}</div>
            {activeQuestion === questions[1] ? <><div className="assistant-head">♙　GK充电宝　<small>09:41</small></div><CvotPrompt onContinue={(selection) => { void ask(`${activeQuestion}\n我想了解的是：${selection}`, activeQuestion) }} />{loading && <div className="answer">正在生成回答…</div>}{answer && <div className="answer cvot-result">{answer}</div>}</> : <div className="answer">{loading ? '正在生成回答…' : answer}</div>}
            {answer && <div className="answer-actions"><button type="button">)))</button><button type="button">♡</button><button type="button">♧</button></div>}
          </section>
        )}
        <form className="composer" onSubmit={(event) => { event.preventDefault(); if (question.trim()) { ask(question.trim()); setQuestion('') } }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="输入问题" /><select value={model} onChange={(event) => setModel(event.target.value)}><option>GK充电宝+V1.2</option><option>GK充电宝</option></select><button type="submit">➤</button></form>
      </main>
    </div>
  )
}
