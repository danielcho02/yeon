'use client'

import { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface Particle {
  id: number
  x: number
  y: number
  color: string
  size: number
  angle: number
  speed: number
}

const COLORS = ['#f43f5e', '#fda4af', '#d97706', '#fcd34d', '#fb923c', '#a78bfa', '#34d399']

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 50 + (Math.random() - 0.5) * 20,
    y: 50 + (Math.random() - 0.5) * 10,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 8,
    angle: Math.random() * 360,
    speed: 80 + Math.random() * 120,
  }))
}

interface ConfettiProps {
  active: boolean
  count?: number
}

export function Confetti({ active, count = 40 }: ConfettiProps) {
  const particles = useRef(createParticles(count))

  return (
    <AnimatePresence>
      {active && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {particles.current.map((p) => {
            const rad = (p.angle * Math.PI) / 180
            const tx = Math.cos(rad) * p.speed
            const ty = Math.sin(rad) * p.speed - 60
            return (
              <motion.div
                key={p.id}
                className="absolute rounded-sm"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: p.size,
                  height: p.size * 0.5,
                  backgroundColor: p.color,
                  originX: '50%',
                  originY: '50%',
                }}
                initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
                animate={{
                  opacity: 0,
                  x: tx,
                  y: ty + 200,
                  rotate: p.angle * 3,
                  scale: 0.3,
                }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
              />
            )
          })}
        </div>
      )}
    </AnimatePresence>
  )
}
