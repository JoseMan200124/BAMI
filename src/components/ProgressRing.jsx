// src/components/ProgressRing.jsx
import React from 'react'

export default function ProgressRing({ size = 72, stroke = 8, value = 0, label = '' }) {
    const r = (size - stroke) / 2
    const c = 2 * Math.PI * r
    const pct = Math.min(Math.max(value, 0), 100)
    const dash = (pct / 100) * c
    return (
        <div className="relative inline-block" style={{ width: size, height: size }}>
            <svg width={size} height={size} role="img" aria-label={`Progreso ${pct}%`}>
                <circle cx={size / 2} cy={size / 2} r={r} stroke="#eee" strokeWidth={stroke} fill="none" />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke="currentColor"
                    className="text-bami-yellow"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${dash} ${c - dash}`}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-xs font-semibold">
                {label || `${pct}%`}
            </div>
        </div>
    )
}
