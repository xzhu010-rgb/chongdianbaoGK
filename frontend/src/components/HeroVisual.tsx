import { useLayoutEffect, useRef } from 'react'
import MascotAnimated from './MascotAnimated'
import './HeroVisual.css'

export default function HeroVisual() {
  const visualRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const visual = visualRef.current
    const hero = visual?.closest<HTMLElement>('.hero')
    if (!visual || !hero) return

    const background = new Image()
    let animationFrame = 0

    const getPositionRatio = (position: string) => {
      const value = Number.parseFloat(position)
      if (Number.isFinite(value)) return value / 100
      if (position === 'right' || position === 'bottom') return 1
      if (position === 'center') return 0.5
      return 0
    }

    const updateMascotAnchor = () => {
      if (!background.naturalWidth || !background.naturalHeight) return

      const width = hero.clientWidth
      const height = hero.clientHeight
      if (!width || !height) return

      const scale = Math.max(width / background.naturalWidth, height / background.naturalHeight)
      const renderedWidth = background.naturalWidth * scale
      const renderedHeight = background.naturalHeight * scale
      const style = window.getComputedStyle(hero)
      const offsetX = (width - renderedWidth) * getPositionRatio(style.backgroundPositionX)
      const offsetY = (height - renderedHeight) * getPositionRatio(style.backgroundPositionY)

      // These anchors mark the center of the platform and the point where the mascot's feet touch it.
      const stageX = offsetX + renderedWidth * 0.755
      const stageY = offsetY + renderedHeight * 0.79
      visual.style.setProperty('--mascot-stage-left', `${stageX}px`)
      visual.style.setProperty('--mascot-stage-bottom', `${height - stageY}px`)
    }

    const scheduleUpdate = () => {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(updateMascotAnchor)
    }

    background.onload = scheduleUpdate
    background.src = '/hero-background.png'
    if (background.complete) scheduleUpdate()

    const resizeObserver = new ResizeObserver(scheduleUpdate)
    resizeObserver.observe(hero)
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
      background.onload = null
    }
  }, [])

  return (
    <div ref={visualRef} className="hero-visual" role="group" aria-label="华领医药 GK充电宝+ 吉祥物">
      <MascotAnimated />
    </div>
  )
}
