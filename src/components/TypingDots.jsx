// src/components/MessageBubble.jsx
import React from 'react'
import { Bot, User, Headphones, Sparkles } from 'lucide-react'

const roles = {
    bami:    { bg: 'bg-gray-100',    align: '',       icon: 'bami',      label: 'BAMI' },
    user:    { bg: 'bg-bami-yellow', align: 'ml-auto',icon: User,        label: 'Tú' },
    advisor: { bg: 'bg-blue-50',     align: '',       icon: Headphones,  label: 'Asesor' },
    ai:      { bg: 'bg-emerald-50',  align: '',       icon: Sparkles,    label: 'IA' },
}

export default function MessageBubble({ role = 'bami', text }) {
    const r = roles[role] || roles.bami
    const Icon = r.icon
    return (
        <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] sm:text-sm leading-5 ${r.bg} ${r.align}`}>
            <div className="flex items-center gap-1 mb-1 text-[10px] sm:text-[11px] text-gray-500">
                {Icon === 'bami' ? (
                    <img src="/BAMI.svg" alt="BAMI" className="w-3.5 h-3.5 rounded-full ring-1 ring-yellow-300" />
                ) : (
                    <Icon size={12} />
                )}
                <span className="font-medium">{r.label}</span>
            </div>
            <div className="whitespace-pre-wrap break-words">{text}</div>
        </div>
    )
}
