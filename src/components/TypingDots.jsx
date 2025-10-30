// src/components/TypingDots.jsx
import React from 'react'
export default function TypingDots({ className = '' }) {
    return (
        <span className={`inline-flex items-center gap-1 ${className}`} aria-label="Escribiendo…">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '120ms' }}></span>
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '240ms' }}></span>
    </span>
    )
}
