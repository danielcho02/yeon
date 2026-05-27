'use client'

import { useEffect, useRef } from 'react'
import { useMotionValue, useSpring, useTransform, motion } from 'framer-motion'

interface CountUpProps {
  value: number
  className?: string
  formatter?: (v: number) => string
  duration?: number
}

export function CountUp({
  value,
  className,
  formatter = (v) => Math.round(v).toLocaleString('ko-KR'),
  duration = 0.6,
}: CountUpProps) {
  const motionValue = useMotionValue(value)
  const spring = useSpring(motionValue, { stiffness: 180, damping: 20, duration })
  const display = useTransform(spring, (v) => formatter(v))
  const prevValue = useRef(value)

  useEffect(() => {
    if (prevValue.current !== value) {
      motionValue.set(value)
      prevValue.current = value
    }
  }, [value, motionValue])

  return <motion.span className={className}>{display}</motion.span>
}

interface PriceCountUpProps {
  value: number
  className?: string
  unit?: string
}

export function PriceCountUp({ value, className, unit = '원' }: PriceCountUpProps) {
  return (
    <CountUp
      value={value}
      className={className}
      formatter={(v) => `${Math.round(v).toLocaleString('ko-KR')}${unit}`}
    />
  )
}
