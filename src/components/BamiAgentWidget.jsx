// src/components/BamiChatWidget.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getCase, createNewCase, notify } from '../lib/caseStore.js'
import TypingDots from './TypingDots.jsx'

/**
 * BamiChatWidget
 * - Mantiene el diseño limpio (chips en carrusel, input fijo y botón cómodo)
 * - Modo Agente: narra pasos, observa /api/admin/analytics y reacciona a eventos del Hub
 * - Se conecta a SSE (/api/stream/:id) para recibir mensajes del backend
 *
 * Props:
 *   - variant: 'fullscreen' | 'mobile'  (ajusta alturas)
 *   - disableFloatingTrigger: boolean   (ignorado aquí, conservado por compatibilidad)
 *   - allowOpsButton: boolean           (ignorado aquí, compatibilidad)
 */
export default function BamiChatWidget({ variant = 'fullscreen' }) {
    const [messages, setMessages] = useState([])
    const [text, setText] = useState('')
    const [sending, setSending] = useState(false)
    const [typing, setTyping] = useState(false)
    const [caseId, setCaseId] = useState(() => getCase()?.id || '')
    const [missing, setMissing] = useState(() => getCase()?.missing || [])
    const [stage, setStage] = useState(() => getCase()?.stage || 'requiere')
    const listRef = useRef(null)

    const frameH = useMemo(() => variant === 'mobile' ? 'calc(100svh - 140px)' : 'calc(100svh - 240px)', [variant])
    const isReady = !!caseId

    // --- util ---
    const push = (role, text) => {
        setMessages(v => [...v, { id: Date.now() + Math.random(), role, text }])
        queueMicrotask(() => listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' }))
    }

    const say = async (txt) => {
        push('ai', txt)
        try {
            if (!caseId) return
            await fetch('/api/agent/say', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caseId, text: txt })
            })
        } catch { /* best-effort */ }
    }

    // --- Case updates desde el store ---
    useEffect(() => {
        const onU = (e) => {
            const c = e.detail
            setCaseId(c?.id || '')
            setMissing(c?.missing || [])
            setStage(c?.stage || 'requiere')
        }
        window.addEventListener('bami:caseUpdate', onU)
        return () => window.removeEventListener('bami:caseUpdate', onU)
    }, [])

    // --- SSE: escuchar publicaciones del backend ---
    useEffect(() => {
        if (!caseId) return
        const ev = new EventSource(`/api/stream/${caseId}`)
        ev.onmessage = (e) => {
            try {
                const payload = JSON.parse(e.data)
                if (payload?.text) {
                    setTyping(true)
                    setTimeout(() => {
                        push(payload.role || 'ai', payload.text)
                        setTyping(false)
                    }, 250)
                }
            } catch {}
        }
        ev.onerror = () => { /* reintentos de EventSource */ }
        return () => ev.close()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId])

    // --- Observador de Analytics para narración (cada 10s) ---
    useEffect(() => {
        let prev = null
        let t = null
        const poll = async () => {
            try {
                const r = await fetch('/api/admin/analytics').then(r => r.json())
                if (!r?.totals || !r?.funnel) return
                const snapshot = {
                    cases: r.totals.cases,
                    aprobados: r.totals.aprobados,
                    en_revision: r.totals.en_revision,
                    alternativas: r.totals.alternativas,
                    rate: Number(r.totals.approval_rate || 0).toFixed(2),
                    funnel: r.funnel
                }
                // narrar solo si cambia algo relevante
                const changed =
                    !prev ||
                    prev.cases !== snapshot.cases ||
                    prev.aprobados !== snapshot.aprobados ||
                    prev.en_revision !== snapshot.en_revision ||
                    prev.alternativas !== snapshot.alternativas

                if (changed && caseId) {
                    const msg = [
                        '📊 **Ops** — actualización:',
                        `Casos: ${snapshot.cases} · En revisión: ${snapshot.en_revision} · Aprobados: ${snapshot.aprobados} · Alternativa: ${snapshot.alternativas}`,
                        `Embudo → Requiere ${snapshot.funnel.requiere ?? 0} / Recibido ${snapshot.funnel.recibido ?? 0} / En revisión ${snapshot.funnel.en_revision ?? 0} / Aprobado ${snapshot.funnel.aprobado ?? 0} / Alternativa ${snapshot.funnel.alternativa ?? 0}`,
                        `Tasa de aprobación: ${Math.round(Number(snapshot.rate) * 100)}%`
                    ].join('\n')
                    say(msg)
                }
                prev = snapshot
            } catch { /* silencioso */ }
            t = setTimeout(poll, 10_000)
        }
        poll()
        return () => { if (t) clearTimeout(t) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId])

    // --- Reacciona a eventos del Hub para dar guía/narración ---
    useEffect(() => {
        const onTrackerOpen = () => say('🛰️ Abrí el **tracker** para que veas el avance por etapas.')
        const onUpload = () => say('📥 Abriendo subida guiada. Recuerda: DPI, selfie y comprobante de domicilio legibles.')
        const onValidate = () => say('🔍 Validando con IA. Esto tarda unos segundos; te aviso el resultado.')
        const onAdvisor = () => say('📞 Te conecto con una persona asesora. Te notifico por app/WhatsApp cuando responda.')

        window.addEventListener('ui:tracker:open', onTrackerOpen)
        window.addEventListener('ui:upload', onUpload)
        window.addEventListener('ui:validate', onValidate)
        window.addEventListener('ui:advisor', onAdvisor)
        window.addEventListener('sim:tracker:open', onTrackerOpen)
        window.addEventListener('sim:upload', onUpload)
        window.addEventListener('sim:validate', onValidate)
        window.addEventListener('sim:advisor', onAdvisor)
        return () => {
            window.removeEventListener('ui:tracker:open', onTrackerOpen)
            window.removeEventListener('ui:upload', onUpload)
            window.removeEventListener('ui:validate', onValidate)
            window.removeEventListener('ui:advisor', onAdvisor)
            window.removeEventListener('sim:tracker:open', onTrackerOpen)
            window.removeEventListener('sim:upload', onUpload)
            window.removeEventListener('sim:validate', onValidate)
            window.removeEventListener('sim:advisor', onAdvisor)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId])

    // --- Envío normal al backend (chat orquestado) ---
    const send = async () => {
        const msg = text.trim()
        if (!msg) return
        setText('')
        push('user', msg)
        setSending(true)
        try {
            if (!caseId) {
                // crea expediente on-demand si el usuario escribe y aún no hay case
                const cc = await createNewCase('Tarjeta de Crédito')
                setCaseId(cc.id)
                setMissing(cc.missing || [])
                setStage(cc.stage)
                notify('Expediente creado automáticamente')
            }
            const resp = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caseId: caseId || getCase()?.id, message: msg, mode: 'bami' })
            }).then(r => r.json()).catch(() => ({}))
            if (resp?.reply) push('ai', resp.reply)
        } finally {
            setSending(false)
        }
    }

    // --- Acciones rápidas (modo agente) ---
    const quick = async (k) => {
        if (k === 'crear') {
            if (caseId) return say('Ya tengo un expediente activo. ¿Subimos documentos o validamos?')
            const cc = await createNewCase('Tarjeta de Crédito')
            setCaseId(cc.id); setMissing(cc.missing || []); setStage(cc.stage)
            notify('Expediente creado'); say(`Abrí el expediente **${cc.id}** para Tarjeta de Crédito.`)
            return
        }
        if (!caseId) return say('Primero necesito un expediente. Toca “Crear expediente”.')

        if (k === 'docs') {
            const curMissing = (missing || getCase()?.missing || [])
            const pick = curMissing.slice(0, 3)
            if (!pick.length) return say('No veo faltantes. Puedo pasar a **Validar con IA**.')
            await fetch('/api/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: caseId, docs: pick })
            })
            say(`📥 Marqué como recibidos: ${pick.join(', ')}.`)
            return
        }
        if (k === 'validar') {
            window.dispatchEvent(new Event('ui:validate'))
            const r = await fetch(`/api/validate/${caseId}`, { method: 'POST' }).then(r => r.json()).catch(() => null)
            if (r?.result?.decision) {
                say(r.result.decision === 'aprobado'
                    ? '✅ Resultado de IA: **Aprobado**. Preparando siguientes pasos.'
                    : '🔁 Resultado de IA: **Alternativa**. Te propongo otra opción acorde a tu perfil.')
            }
            return
        }
        if (k === 'tracker') {
            window.dispatchEvent(new Event('ui:tracker:open'))
            return
        }
        if (k === 'asesor') {
            window.dispatchEvent(new Event('ui:advisor'))
            say('Listo. Pasé tu caso a un asesor. Te aviso apenas responda.')
            return
        }
    }

    const chips = [
        { k: 'crear', t: 'Crear expediente' },
        { k: 'docs', t: 'Subir documentos' },
        { k: 'validar', t: 'Validar con IA' },
        { k: 'tracker', t: 'Ver tracker' },
        { k: 'asesor', t: 'Hablar con asesor' },
    ]

    return (
        <div className="flex flex-col h-[calc(100svh-180px)] sm:h-[calc(100svh-220px)]">
            {/* header compacto */}
            <div className="px-3 sm:px-4 py-2 border-b bg-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <img src="/BAMI.svg" alt="BAMI" className="w-6 h-6 rounded-full ring-1 ring-yellow-300" />
                    <div className="font-semibold">BAMI</div>
                    {isReady
                        ? <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-0.5">Agente activo</span>
                        : <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">Sin expediente</span>}
                </div>
                <div className="text-xs text-gray-500">Etapa: <b className="text-gray-700">{stage?.replace('_',' ') || '—'}</b></div>
            </div>

            {/* chips ordenados */}
            <div className="flex gap-2 px-3 py-2 border-b overflow-x-auto bg-white scroll-smooth">
                {chips.map(ch => (
                    <button key={ch.k}
                            onClick={() => quick(ch.k)}
                            className="px-3 py-1.5 rounded-full border bg-gray-50 text-sm whitespace-nowrap hover:bg-gray-100">
                        {ch.t}
                    </button>
                ))}
            </div>

            {/* lista de mensajes */}
            <div ref={listRef}
                 className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white p-3 sm:p-4"
                 style={{ height: frameH }}>
                {messages.map(m => (
                    <div key={m.id}
                         className={`max-w-[82%] md:max-w-[70%] rounded-2xl px-3 py-2 text-[15px] leading-snug mb-2 ${m.role === 'user'
                             ? 'ml-auto bg-gray-100 text-gray-900 rounded-br-md'
                             : 'bg-black text-white rounded-bl-md'}`}>
                        {m.text}
                    </div>
                ))}
                {typing && (
                    <div className="max-w-[82%] md:max-w-[70%] bg-black text-white rounded-2xl rounded-bl-md px-3 py-2 inline-flex items-center gap-2">
                        <TypingDots />
                    </div>
                )}
            </div>

            {/* composer fijo */}
            <div className="sticky bottom-0 bg-white border-t p-2 sm:p-3">
                <div className="flex items-center gap-2">
                    <input
                        className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
                        placeholder='Escribe: “tarjeta de crédito”, “subir documentos”, “validar con IA”…'
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey ? send() : null}
                    />
                    <button
                        onClick={send}
                        disabled={!text.trim() || sending}
                        className="h-10 px-4 rounded-xl bg-yellow-400 hover:bg-yellow-500 disabled:opacity-60 font-semibold">
                        {sending ? 'Enviando…' : 'Enviar'}
                    </button>
                </div>
            </div>
        </div>
    )
}
