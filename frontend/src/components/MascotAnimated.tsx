import './MascotAnimated.css'

type MascotAnimatedProps = {
  src?: string
  label?: string
  className?: string
}

export default function MascotAnimated({
  src = '/gk-mascot-cutout.png',
  label = '华领医药 GK充电宝+ 吉祥物，快来试试吧',
  className = '',
}: MascotAnimatedProps) {
  const rootClassName = ['mascot-animated', className].filter(Boolean).join(' ')

  return (
    <div className={rootClassName} role="img" aria-label={label}>
      <span className="mascot-shadow" aria-hidden="true" />
      <span className="mascot-speech" aria-hidden="true">快来试试吧</span>
      <span className="mascot-tube-bubbles" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="mascot-tube-glint" aria-hidden="true" />
      <span className="mascot-entry" aria-hidden="true">
        <span className="mascot-bounce">
          <img className="mascot-image" src={src} alt="" draggable={false} />
        </span>
      </span>
    </div>
  )
}
