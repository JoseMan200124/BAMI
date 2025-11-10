// src/components/BamiAgent.jsx
// Ajuste clave: al terminar el Autopilot inicial, se dispara runClientChatFlow()
// para mostrar un segundo flujo "como cliente" en el chat de BAMI (escritorio).
// Se resetean las banderas globales para permitir que el chat se abra y reciba mensajes.

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Sparkles, MousePointer2, Activity, Play, X as XIcon } from 'lucide-react'
import { api } from '../lib/apiClient'
import { getCase } from '../lib/caseStore.js'

const EASE = [0.22, 1, 0.36, 1]
const DUR = {
    moveTotal: 1.8,
    preRatio: 0.55,
    settlePause: 380,
    clickHold: 420,
    ripple: 900,
    halo: 800,
    betweenSteps: 220,
}

const Z = {
    HUD:  1_999_980,
    HALO: 1_999_985,
    TIP:  1_999_990,
    CURSOR: 2_147_483_646,
}

const wait = (ms) => new Promise(r => setTimeout(r, ms))

/* ---------- Utilidades DOM ---------- */
const isVisible = (el) => {
    if (!el) return false
    const cs = window.getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return false
    const vw = window.innerWidth, vh = window.innerHeight, m = 8
    if (r.right < -m || r.bottom < -m || r.left > vw + m || r.top > vh + m) return false
    return true
}
const isDisabled = (el) => el?.disabled || el?.getAttribute?.('aria-disabled') === 'true'
const findByDataId = (id) => document.querySelector(`[data-agent-id="${id}"]`)
const clickableAncestor = (el) => el?.closest?.('button,[role="button"],a') || el
const normalize = (t) => (t || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()

const findByText = (selectors, text) => {
    const goal = normalize(text)
    const nodes = Array.from(document.querySelectorAll(selectors.join(',')))
    return nodes.filter(n => normalize(n.textContent || '').includes(goal))
}

const score = (el, boostText=false) => {
    let s = 0
    if (isVisible(el)) s += 6
    if (!isDisabled(el)) s += 3
    if (el?.tagName?.toLowerCase() === 'button') s += 3
    if (el?.getAttribute?.('role') === 'button') s += 2
    if (boostText) s += 1
    return s
}

const queryBestTarget = ({ selectors=[], texts=[], kind='click' }) => {
    const found = []
    const push = (el, by) => { if (el) found.push({ el, by }) }

    for (const sel of selectors) {
        let el = null
        if (sel.startsWith('btn-')) el = findByDataId(sel)
        else if (sel.startsWith('[data-agent-id=')) el = document.querySelector(sel)
        else el = document.querySelector(sel)
        push(el, 'selector')
    }

    if (texts.length) {
        const clickables = ['button','a','[role="button"]']
        const any = ['*']
        const list = (kind === 'focus')
            ? texts.flatMap(t => findByText(any, t))
            : texts.flatMap(t => findByText(clickables, t).map(clickableAncestor))
        for (const el of list) push(el, 'text')
    }

    if (!found.length) return null
    let best = null, bestScore = -Infinity
    for (const f of found) {
        const el = (kind === 'click') ? clickableAncestor(f.el) : f.el
        const sc = score(el, f.by === 'text')
        if (sc > bestScore) { best = el; bestScore = sc }
    }
    return best
}

const waitForTarget = async ({ selectors=[], texts=[], timeout=1600, kind='click' }) => {
    const now = queryBestTarget({ selectors, texts, kind })
    if (now) return now
    const start = performance.now()
    while (performance.now() - start < timeout) {
        await wait(100)
        const again = queryBestTarget({ selectors, texts, kind })
        if (again) return again
    }
    return null
}

const ensureVisible = async (el) => {
    if (!el) return
    if (!isVisible(el)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
        await wait(520)
    }
}

/* ------------------------------ Componente ------------------------------ */
export default function BamiAgent({ caseData, product, controls }) {
    const [open, setOpen] = useState(true)
    const [running, setRunning] = useState(false)
    const [feed, setFeed] = useState([])
    const feedRef = useRef(null)

    // cursor
    const [cursor, setCursor] = useState({
        show: false,
        x: typeof window !== 'undefined' ? (window.scrollX + 32) : 32,
        y: typeof window !== 'undefined' ? (window.scrollY + 32) : 32,
        clicking: false,
        transition: { type: 'tween', ease: EASE, duration: 0 }
    })

    // métricas demo (no crítico)
    const [metrics, setMetrics] = useState(null)
    const fetchMetrics = async () => { try { setMetrics(await api.adminAnalytics()) } catch {} }
    useEffect(() => { fetchMetrics() }, [])

    const insight = useMemo(() => {
        const p = []
        const cc = getCase?.() || caseData
        if (cc) {
            p.push(`Caso ${cc.id?.slice(0,6) || 'nuevo'} · ${cc.product} · etapa: ${cc.stage}`)
            if ((cc.missing || []).length) p.push(`Faltan ${cc.missing.length} doc(s)`)
        } else {
            p.push(`Sin caso activo · producto: ${product || '—'}`)
        }
        if (metrics?.totals) {
            const t = metrics.totals
            p.push(`Leads: ${t.cases} · Aprobados: ${t.aprobados} · En revisión: ${t.en_revision}`)
        }
        return p.join(' | ')
    }, [caseData, product, metrics])

    const logLine = (text) => setFeed(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, t: new Date(), text }])
    useEffect(() => {
        if (!feedRef.current) return
        feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
    }, [feed])

    /* ===== Helpers de movimiento/click visual ===== */
    const moveToEl = async (el, total=DUR.moveTotal) => {
        if (!el) return
        await ensureVisible(el)
        const r = el.getBoundingClientRect()
        const finalX = r.left + r.width * 0.5 + (window.scrollX || 0)
        const finalY = r.top + r.height * 0.5 + (window.scrollY || 0)
        const preX = finalX - Math.min(90, r.width * 0.5)
        const preY = finalY - Math.min(60, r.height * 0.4)

        setCursor(c => ({ ...c, show: true }))
        const d1 = Math.max(0.35, total * DUR.preRatio)
        setCursor(c => ({ ...c, transition: { type: 'tween', ease: EASE, duration: d1 }, x: preX, y: preY }))
        await wait(d1 * 1000 + 110)
        await wait(DUR.betweenSteps)
        const d2 = Math.max(0.35, total * (1 - DUR.preRatio))
        setCursor(c => ({ ...c, transition: { type: 'tween', ease: EASE, duration: d2 }, x: finalX, y: finalY }))
        await wait(d2 * 1000 + 110)
    }

    const clickEffect = async () => {
        await wait(DUR.settlePause)
        setCursor(c => ({ ...c, clicking: true }))
        await wait(DUR.clickHold)
        setCursor(c => ({ ...c, clicking: false }))
        await wait(DUR.settlePause)
    }

    const runFocus = async (step) => {
        step?.before?.()
        const target = await waitForTarget({ ...(step.targets || {}), kind: 'focus' })
        if (target) {
            await moveToEl(target)
            logLine(step.say)
        } else {
            logLine(step.say)
        }
        await Promise.resolve(step?.after?.())
        return true
    }

    const runClick = async (step) => {
        step?.before?.()
        const target = await waitForTarget({ ...(step.targets || {}), kind: 'click' })
        if (target) {
            await moveToEl(target)
            logLine(step.say)
            await clickEffect()
            try { await Promise.resolve(step.run?.()) } catch {}
            await wait(600)
            await Promise.resolve(step?.after?.())
            return true
        }
        // fallback simulado
        logLine(step.say + ' (simulado)')
        try { await Promise.resolve(step.run?.()) } catch {}
        await Promise.resolve(step?.after?.())
        await wait(500)
        return true
    }

    const runSpeak = async (step) => { step?.before?.(); logLine(step.say); await Promise.resolve(step?.after?.()); await wait(700); return true }
    const runStep = async (s) => {
        if (s.type === 'click') return runClick(s)
        if (s.type === 'focus') return runFocus(s)
        return runSpeak(s)
    }

    const closeEverything = () => {
        window.dispatchEvent(new Event('ui:upload:close'))
        window.dispatchEvent(new Event('upload:close'))
        window.dispatchEvent(new Event('ui:tracker:close'))
        window.dispatchEvent(new Event('ui:form:close'))
        window.dispatchEvent(new Event('sim:tracker:close'))
        window.dispatchEvent(new Event('sim:ops:close'))
        window.dispatchEvent(new Event('sim:close'))
    }

    // ---- RUTA DEL AUTOPILOT (primer acto) ----
    const ROUTE = [
        {
            type: 'click',
            id: 'simular-app-top',
            say: 'Simulamos la App del cliente.',
            targets: { selectors: ['btn-simular-top','[data-agent-id="btn-simular-top"]'], texts: ['simular app','simulador'] },
            run: () => controls?.openSimulator?.()
        },
        {
            type: 'click',
            id: 'crear-expediente',
            say: 'Creamos el expediente.',
            targets: { selectors: ['btn-crear-expediente','[data-agent-id="btn-crear-expediente"]'], texts: ['crear expediente','nuevo expediente'] },
            run: () => controls?.start?.(),
            after: async () => {
                // Abrimos tracker SOLO en UI principal (NO en simulador durante Autopilot)
                window.dispatchEvent(new Event('ui:tracker:open'))
            }
        },
        {
            type: 'click',
            id: 'subir-documentos',
            say: 'Abrimos el asistente de subida de documentos.',
            targets: { selectors: ['btn-recomendado','[data-agent-id="btn-recomendado"]','[data-agent-id="btn-subir-documentos"]'], texts: ['subir documentos','continuar'] },
            run: () => controls?.openUploadEverywhere?.(),
            after: async () => {
                // ✅ Corrección: si el simulador está abierto, asegurar upload DENTRO del simulador
                // Cierra cualquier upload de escritorio, abre en simulador y ejecuta la demo allí.
                window.dispatchEvent(new Event('ui:upload:close'))
                window.dispatchEvent(new Event('upload:close'))
                window.dispatchEvent(new Event('sim:open'))
                await wait(120)
                window.dispatchEvent(new Event('sim:upload'))
                window.dispatchEvent(new Event('sim:upload:demo'))
                // mantener tracker visible en UI principal sin abrir overlays del simulador
                setTimeout(() => window.dispatchEvent(new Event('ui:tracker:open')), 900)
            }
        },
        {
            type: 'click',
            id: 'abrir-tracker',
            say: 'Vemos el tracker y cómo avanza etapa por etapa.',
            targets: { selectors: ['btn-tracker-top','[data-agent-id="btn-tracker-top"]','btn-tracker','[data-agent-id="btn-tracker"]'], texts: ['tracker','abrir tracker'] },
            run: () => controls?.openTracker?.()
        },
        {
            type: 'focus',
            id: 'focus-bam-ops',
            say: 'Vista para BAM: panel de análisis y leads.',
            targets: { selectors: ['[data-agent-area="panel-bam-ops"]'], texts: ['panel de análisis y leads'] },
            after: async () => {
                window.dispatchEvent(new Event('sim:ops:open'))
                window.dispatchEvent(new Event('bami:ops:explain'))
            }
        },
        { type: 'speak', id: 'end', say: 'Listo. Flujo presentado de inicio a fin.' }
    ]

    // ---- NUEVO: segundo acto — flujo de cliente en el chat (escritorio) ----
    const runClientChatFlow = async () => {
        try {
            // Asegurar que la UI muestre el área de Cliente (chat)
            window.dispatchEvent(new Event('bami:clientflow:ensureClientVisible'))
            await wait(250)

            // Abrimos el chat y dejamos que BAMI se presente (greet interno del widget)
            window.dispatchEvent(new Event('ui:open'))
            await wait(900)

            const send = (role, text) =>
                window.dispatchEvent(new CustomEvent('ui:msg', { detail: { role, text } }))

            // Cliente escribe su intención
            send('user', 'Hola BAMI 👋')
            await wait(900)
            send('user', `Quiero aplicar a ${product || 'Tarjeta de Crédito'}`)
            await wait(700)

            // Creamos el expediente desde controles (refleja en tracker y chat)
            await Promise.resolve(controls?.start?.())
            await wait(600)

            // Abre asistente de subida + demo de arrastre/envío (en escritorio en este 2º acto)
            window.dispatchEvent(new Event('ui:upload'))
            window.dispatchEvent(new Event('upload:demo'))
            await wait(1600)

            // Validación con IA (el widget cambia a pestaña IA y muestra pasos)
            window.dispatchEvent(new Event('ui:validate'))
            await wait(3200)

            // Cliente pide asesor humano (el widget cambia a pestaña Asesor)
            send('user', '¿Me puede apoyar un asesor humano?')
            window.dispatchEvent(new Event('ui:advisor'))
            await wait(2600)

            // Abrimos tracker de detalle desde el chat
            window.dispatchEvent(new Event('ui:tracker:open'))
            await wait(1000)

            send('user', 'Perfecto, gracias 🙌')
            logLine('Flujo de cliente en chat finalizado.')
        } catch (e) {
            logLine('No se pudo completar el flujo de cliente en chat (demo).')
        }
    }

    // ---- Secuencia principal del Autopilot + encadenar el flujo de cliente ----
    const runDemo = async () => {
        if (running) return
        setRunning(true)
        logLine('Iniciando Autopilot…')

        // 🔒 Señales globales (bloquean aperturas indeseadas durante Autopilot)
        window.__BAMI_AGENT_ACTIVE__ = true
        window.__BAMI_DISABLE_FLOATING__ = true
        window.__BAMI_LOCK_TRACKER__ = true
        window.__BAMI_SUPPRESS_SIM_TRACKER__ = true

        try {
            for (const step of ROUTE) {
                await runStep(step)
                await wait(260)
            }

            // Esperar un poco a que el tracker “termine” visualmente
            await wait(1200)

            // Inyectar lead en OPS (demo) con datos del caso actual
            const cc = getCase?.() || caseData || {}
            window.dispatchEvent(new CustomEvent('bami:ops:ingestLead', { detail: { case: {
                        id: cc.id || `C${Math.floor(Math.random()*900000)+100000}`,
                        product: cc.product || product || 'Tarjeta de Crédito',
                        channel: cc.channel || 'web',
                        applicant: cc.applicant || { name: 'Cliente BAMI' },
                        stage: cc.stage || 'aprobado'
                    }}}))

            // ✅ Cerrar simulador y sus modales ANTES de pasar al flujo "cliente"
            closeEverything()                 // cierra ui+sim overlays
            controls?.closeSimulator?.()      // redundante por si el simulador controla su estado
            await wait(400)

            // 🔓 Liberar banderas para permitir UI normal de escritorio
            window.__BAMI_LOCK_TRACKER__ = false
            window.__BAMI_SUPPRESS_SIM_TRACKER__ = false
            window.__BAMI_AGENT_ACTIVE__ = false
            window.__BAMI_DISABLE_FLOATING__ = false

            logLine('Mostrando ahora el flujo “como cliente” en el chat…')
            await wait(600)
            await runClientChatFlow()
        } catch (e) {
            logLine('El Autopilot se interrumpió.')
        } finally {
            setRunning(false)
        }
    }

    /* ================== UI del globo/launcher del Agente ================== */
    return (
        <>
            {/* Lanzador / Estado */}
            <div className="fixed right-4 bottom-4 z-[2000000]">
                <div className="flex items-end gap-3">
                    {/* Panel de estado / feed */}
                    {open && (
                        <div className="w-[280px] max-w-[80vw] rounded-2xl border shadow-lg bg-white overflow-hidden">
                            <div className="px-3 py-2 border-b flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Bot size={16} />
                                    <div className="text-sm font-semibold">BAMI Autopilot</div>
                                </div>
                                <button className="p-1 rounded hover:bg-gray-100" onClick={() => setOpen(false)} aria-label="Cerrar panel">
                                    <XIcon size={14}/>
                                </button>
                            </div>
                            <div ref={feedRef} className="max-h-[180px] overflow-auto text-xs px-3 py-2 space-y-1">
                                <div className="text-[11px] text-gray-500">{insight}</div>
                                {feed.map(line => (
                                    <div key={line.id} className="leading-relaxed">
                                        <span className="text-gray-400 mr-1">•</span>{line.text}
                                    </div>
                                ))}
                                {!feed.length && <div className="text-gray-500">Pulsa “Iniciar demo”.</div>}
                            </div>
                            <div className="px-3 py-2 border-t flex items-center gap-2">
                                <button
                                    className="btn btn-dark btn-sm"
                                    onClick={runDemo}
                                    disabled={running}
                                >
                                    <Play size={14} className="mr-1" /> Iniciar demo
                                </button>
                                <button
                                    className="btn btn-sm"
                                    onClick={() => {
                                        closeEverything()
                                        window.__BAMI_LOCK_TRACKER__ = false
                                        window.__BAMI_SUPPRESS_SIM_TRACKER__ = false
                                        window.__BAMI_AGENT_ACTIVE__ = false
                                        window.__BAMI_DISABLE_FLOATING__ = false
                                        logLine('Señales reiniciadas y UI cerrada.')
                                    }}
                                >
                                    Reset UI
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Botón flotante para abrir/cerrar el panel */}
                    <button
                        className="rounded-full w-14 h-14 grid place-items-center shadow-2xl border bg-white"
                        onClick={() => setOpen(v => !v)}
                        aria-label="Abrir panel del Agente"
                    >
                        {running ? <Activity className="animate-pulse" /> : <Sparkles />}
                    </button>
                </div>
            </div>

            {/* Cursor demo (mínimo visual) */}
            <AnimatePresence>
                {cursor.show && (
                    <motion.div
                        initial={false}
                        animate={{ x: cursor.x, y: cursor.y }}
                        transition={cursor.transition}
                        className="fixed z-[2147483646] pointer-events-none"
                        style={{ translateX: '-50%', translateY: '-50%' }}
                    >
                        <div className="relative">
                            <MousePointer2 className="drop-shadow" />
                            {cursor.clicking && (
                                <span className="absolute -inset-3 rounded-full border-2 border-black/30 animate-ping" />
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
