// src/components/StageTimeline.jsx
import React from 'react'
import { FileText, Inbox, Search, CheckCircle2, GitBranch, Clock } from 'lucide-react'

export const STAGES = [
    { key: 'requiere',    label: 'Requiere',    icon: FileText,     hint: 'Requisitos iniciales' },
    { key: 'recibido',    label: 'Recibido',    icon: Inbox,        hint: 'Documentos cargados' },
    { key: 'en_revision', label: 'En revisión', icon: Search,       hint: 'IA/analista revisando' },
    { key: 'aprobado',    label: 'Aprobado',    icon: CheckCircle2, hint: '¡Listo!' },
    { key: 'alternativa', label: 'Alternativa', icon: GitBranch,    hint: 'Te proponemos otra opción' },
]

export default function StageTimeline({ stage = 'requiere', history = [], timeline = [] }) {
    const idx = STAGES.findIndex(s => s.key === stage)
    const items = (timeline.length ? timeline.map(t => ({ at: t.ts, stage: t.type, note: t.text })) : history)
    const widthPct = Math.max(0, idx) / (STAGES.length - 1) * 100

    return (
        <div className="w-full">
            <div className="relative">
                <div className="absolute left-0 right-0 top-5 h-1 bg-gray-200 rounded-full"></div>
                <div
                    className="absolute left-0 top-5 h-1 bg-bami-yellow rounded-full transition-all"
                    style={{ width: `${widthPct}%` }}
                />
                <div className="grid grid-cols-5 gap-2">
                    {STAGES.map((s, i) => {
                        const Icon = s.icon
                        const isActive = i === idx
                        const isDone = i < idx && stage !== 'alternativa'
                        const isAlt = stage === 'alternativa' && s.key === 'alternativa'
                        return (
                            <div key={s.key} className="flex flex-col items-center">
                                <div
                                    className={[
                                        'w-10 h-10 grid place-items-center rounded-full border text-gray-700',
                                        isActive ? 'bg-yellow-50 border-bami-yellow' : '',
                                        isDone ? 'bg-emerald-50 border-emerald-300' : '',
                                        isAlt ? 'bg-blue-50 border-blue-300' : '',
                                    ].join(' ')}
                                    title={s.hint}
                                >
                                    <Icon size={18} />
                                </div>
                                <div className="mt-2 text-xs font-semibold">{s.label}</div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs text-gray-600">
                <div className="flex items-center gap-2 font-medium">
                    <Clock size={14} /> Línea de tiempo
                </div>
                <ul className="mt-2 max-h-28 overflow-auto">
                    {items?.slice().reverse().map((h, i) => (
                        <li key={i} className="py-1 border-t first:border-t-0">
                            {new Date(h.at).toLocaleString()} · <span className="font-semibold">{h.stage}</span>{' '}
                            {h.note ? `· ${h.note}` : ''}
                        </li>
                    ))}
                    {!items?.length && <li className="py-1">Sin eventos aún.</li>}
                </ul>
            </div>
        </div>
    )
}
