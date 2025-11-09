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

const EASE = 'cubic-bezier(0.22,1,0.36,1)'

export default function StageTimeline({ stage = 'requiere', history = [], timeline = [] }) {
    const idx = STAGES.findIndex((s) => s.key === stage)
    // Compatibilidad: soporta {at,stage,note} y también {ts,type,text}
    const items = (timeline && timeline.length
        ? timeline.map(t => ({
            at:   t.at   ?? t.ts   ?? Date.now(),
            stage:t.stage?? t.type ?? 'requiere',
            note: t.note ?? t.text ?? ''
        }))
        : (history || []))
    const widthPct = Math.max(0, idx) / (STAGES.length - 1) * 100

    return (
        <div className="w-full">
            <div className="relative">
                <div className="absolute left-0 right-0 top-6 h-1 bg-gray-200 rounded-full"></div>
                <div
                    className="absolute left-0 top-6 h-1 bg-bami-yellow rounded-full"
                    style={{
                        width: `${widthPct}%`,
                        transition: `width 1200ms ${EASE}`
                    }}
                    aria-hidden
                />

                {/* Mobile: lista horizontal desplazable */}
                <div className="overflow-x-auto no-scrollbar">
                    <div className="min-w-max flex gap-3 sm:grid sm:grid-cols-5 sm:gap-2 pr-2">
                        {STAGES.map((s, i) => {
                            const Icon = s.icon
                            const isActive = i === idx
                            const isDone = i < idx && stage !== 'alternativa'
                            const isAlt = stage === 'alternativa' && s.key === 'alternativa'
                            const ring =
                                isActive ? 'bg-yellow-50 border-bami-yellow' :
                                    isDone   ? 'bg-emerald-50 border-emerald-300' :
                                        isAlt    ? 'bg-blue-50 border-blue-300' : ''

                            return (
                                <div key={s.key} className="flex flex-col items-center w-16 sm:w-auto">
                                    <div
                                        className={[
                                            'w-10 h-10 grid place-items-center rounded-full border text-gray-700 shrink-0',
                                            ring
                                        ].join(' ')}
                                        title={s.hint}
                                        style={{
                                            transform: isActive ? 'scale(1.06)' : (isDone ? 'scale(1.02)' : 'scale(1)'),
                                            transition: `transform 460ms ${EASE}, background-color 200ms ease, border-color 200ms ease`
                                        }}
                                        aria-current={isActive ? 'step' : undefined}
                                        aria-label={`${s.label}${isActive ? ' (actual)' : ''}`}
                                    >
                                        <Icon size={18} />
                                    </div>
                                    <div className="mt-2 text-[11px] sm:text-xs font-semibold text-center">{s.label}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            <div className="mt-3 sm:mt-4 p-3 bg-gray-50 rounded-xl text-xs text-gray-600">
                <div className="flex items-center gap-2 font-medium">
                    <Clock size={14} /> Línea de tiempo
                </div>
                <ul className="mt-2 max-h-36 sm:max-h-44 overflow-auto pr-1" aria-live="polite">
                    {items?.slice().reverse().map((h, i) => (
                        <li key={i} className="py-1 border-t first:border-t-0">
                            {new Date(h.at).toLocaleString()} · <span className="font-semibold capitalize">{String(h.stage).replace('_',' ')}</span>{' '}
                            {h.note ? `· ${h.note}` : ''}
                        </li>
                    ))}
                    {!items?.length && <li className="py-1">Sin eventos aún.</li>}
                </ul>
            </div>
        </div>
    )
}
