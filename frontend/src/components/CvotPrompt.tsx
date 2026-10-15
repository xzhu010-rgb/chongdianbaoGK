import { useState } from 'react'

type CvotPromptProps = {
  onContinue: (selection: string) => void
}

const options = [
  {
    title: '已完成的 CVOT 研究',
    description: '多格列艾汀是否有已完成的心血管结局研究（如 3 期 CVOT）及其结果。',
  },
  {
    title: '心血管安全性证据',
    description: '多格列艾汀在临床研究中关于心血管安全性的证据（如 MACE 风险、非劣效性等）。',
  },
  {
    title: '正在进行中的临床研究',
    description: '多格列艾汀目前是否有正在进行中的 CVOT 或其他心血管相关临床研究。',
  },
]

export default function CvotPrompt({ onContinue }: CvotPromptProps) {
  const [selected, setSelected] = useState(options[1].title)

  return (
    <div className="cvot-card">
      <p>为了更准确地回答你，想先确认一下你具体想了解的是：</p>
      <div className="cvot-options">
        <strong>你想了解的是：</strong>
        {options.map((option) => (
          <button
            className={`cvot-option ${selected === option.title ? 'selected' : ''}`}
            key={option.title}
            onClick={() => setSelected(option.title)}
            type="button"
          >
            <span className="radio" aria-hidden="true" />
            <span>
              <b>{option.title}</b>
              <small>{option.description}</small>
            </span>
          </button>
        ))}
        <div className="tip">ⓘ　选择后我会继续为你整理对应证据。</div>
      </div>
      <button className="primary-button" onClick={() => onContinue(selected)} type="button">
        继续生成回答
      </button>
      <button className="link-button" type="button">或者继续输入补充说明</button>
    </div>
  )
}
