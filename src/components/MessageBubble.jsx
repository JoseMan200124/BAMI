// src/components/MessageBubble.jsx
import React from 'react'
import { Bot, User, Headphones, Sparkles } from 'lucide-react'

const roles = {
    bami:    { bg: 'bg-gray-100',    align: '',       icon: Bot,        label: 'BAMI' },
    user:    { bg: 'bg-bami-yellow', align: 'ml-auto',icon: User,       label: 'Tú' },
    advisor: { bg: 'bg-blue-50',     align: '',       icon: Headphones, label: 'Asesor' },
    ai:      { bg: 'bg-emerald-50',  align: '',       icon: Sparkles,   label: 'IA' },
}

export default function MessageBubble({ role = 'bami', text }) {
    const r = roles[role] || roles.bami
    const Icon = r.icon
    return (
        <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${r.bg} ${r.align}`}>
            <div className="flex items-center gap-1 mb-1 text-[11px] text-gray-500">
                <Icon size={12} /> <span className="font-medium">{r.label}</span>
            </div>
            <div className="leading-5 whitespace-pre-wrap">{text}</div>
        </div>
    )
}
