// src/components/BamiAgentWidget.jsx
import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * BamiAgentWidget
 * - Conecta a /api/stream/:caseId (SSE)
 * - Muestra chips ordenados (scroll) + input fijo abajo
 * - “Typing” del agente
 * - Diseño mobile-friendly con frame en desktop
 *
 * Props:
 *  - caseId (string, requerido)
 */
export default function BamiAgentWidget({ caseId }) {
    const [messages, setMessages] = useState([])
    const [text, setText] = useState('')
    const [sending, setSending] = useState(false)
    const [typing, setTyping] = useState(false)
    const listRef = useRef(null)
    const esMovil = useMemo(() => matchMedia('(max-width: 768px)').matches, [])

    useEffect(() => {
        if (!caseId) return

        // Cargar tracker inicial
        fetch(`/api/tracker/${caseId}`)
            .then(r => r.json())
            .then(() => {}) // no agregamos nada al chat aquí; llega por SSE
            .catch(() => {})

        // Suscribirse a SSE
        const ev = new EventSource(`/api/stream/${caseId}`)
        ev.onmessage = (e) => {
            try {
                const payload = JSON.parse(e.data)
                if (payload?.text) {
                    // Efecto “typing” para mensajes AI
                    if (payload.role === 'ai') {
                        setTyping(true)
                        setTimeout(() => {
                            pushMsg(payload.role, payload.text)
                            setTyping(false)
                        }, 450) // leve delay de escritura
                    } else {
                        pushMsg(payload.role, payload.text)
                    }
                }
            } catch {}
        }
        ev.onerror = () => { /* se reintenta solo */ }
        return () => ev.close()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId])

    const pushMsg = (role, text) => {
        setMessages(prev => [...prev, { id: Date.now() + Math.random(), role, text }])
        // scroll al fondo
        queueMicrotask(() => {
            listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' })
        })
    }

    const send = async () => {
        const msg = text.trim()
        if (!msg || sending) return
        setSending(true)
        setText('')
        try {
            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caseId, message: msg, mode: 'bami' })
            }).then(r => r.json())
        } finally {
            setSending(false)
        }
    }

    const quick = (t) => {
        setText(t)
        // opcional: enviar directo
        // send()
    }

    return (
        <div className="bami-frame">
            <div className="bami-header">
                <div className="bami-dot" />
                <div className="bami-title">
                    <span className="bami-emoji">🤖</span> BAMI
                    <small className="bami-sub">Asistente • {caseId || '—'}</small>
                </div>
            </div>

            <div className="bami-quick">
                {['Préstamo', 'Hipoteca', 'PyME', 'Faltantes', 'Subir docs', 'Validar con IA', 'Hablar con asesor'].map((t) => (
                    <button key={t} className="bami-chip" onClick={() => quick(t)}>
                        {t}
                    </button>
                ))}
            </div>

            <div className="bami-list" ref={listRef}>
                {messages.map(m => (
                    <div key={m.id} className={`bami-bubble ${m.role === 'user' ? 'me' : 'ai'}`}>
                        {m.text}
                    </div>
                ))}
                {typing && (
                    <div className="bami-bubble ai">
                        <span className="bami-typing"><i /><i /><i /></span>
                    </div>
                )}
            </div>

            <div className="bami-composer">
                <input
                    placeholder='Escribe: “tarjeta de crédito”, “crear expediente”…'
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                />
                <button className="bami-send" disabled={sending || !text.trim()} onClick={send}>
                    {sending ? 'Enviando…' : 'Enviar'}
                </button>
            </div>

            {!esMovil && <div className="bami-frame-shadow" />}
        </div>
    )
}
