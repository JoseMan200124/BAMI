// src/components/BamiAgent.jsx
// Ajuste clave: durante Autopilot se SUPRIME el tracker dentro del simulador para que se vea el “subir documentos”.
// Se controla con window.__BAMI_SUPPRESS_SIM_TRACKER__ y se evita emitir 'sim:tracker:open' mientras corre el Autopilot.

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
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

// ---------- Utilidades DOM ----------
const HUD_ROOT_SELECTOR = '#bami-hud'
const isInsideHUD = (el) => !!el?.closest?.(HUD_ROOT_SELECTOR)

const isVisible = (el) => {
    if (!el) return false
    if (isInsideHUD(el)) return false
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
const normalize = (t) => (t || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ').trim().toLowerCase()

const findByText = (selectors, text) => {
    const goal = normalize(text)
    const nodes = Array.from(document.querySelectorAll(selectors.join(',')))
    return nodes.filter(n => !isInsideHUD(n) && normalize(n.textContent || '').includes(goal))
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
    const push = (el, by) => { if (el && !isInsideHUD(el)) found.push({ el, by }) }

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
    const [open, setOpen] = useState(false)
    const [running, setRunning] = useState(false)
    const [feed, setFeed] = useState([])
    const feedRef = useRef(null)

    // cursor y efectos
    const [cursor, setCursor] = useState({
        show: true,
        x: typeof window !== 'undefined' ? (window.scrollX + 32) : 32,
        y: typeof window !== 'undefined' ? (window.scrollY + 32) : 32,
        clicking: false,
        transition: { type: 'tween', ease: EASE, duration: 0 }
    })
    const [halo, setHalo] = useState(null)
    const [tip, setTip] = useState(null)

    // portal a <body>
    const [portalRoot, setPortalRoot] = useState(null)
    useLayoutEffect(() => {
        let el = document.getElementById('bami-agent-portal')
        if (!el) {
            el = document.createElement('div')
            el.id = 'bami-agent-portal'
            document.body.appendChild(el)
        } else {
            document.body.appendChild(el)
        }
        const styleId = '__bami_portal_style__'
        let st = document.getElementById(styleId)
        if (!st) {
            st = document.createElement('style')
            st.id = styleId
            st.textContent = `
        #bami-agent-portal{position:relative;z-index:${Z.CURSOR+1} !important}
        #bami-hud{z-index:${Z.HUD} !important}
        .bami-cursor-layer{z-index:${Z.CURSOR} !important;opacity:1 !important;visibility:visible !important;pointer-events:none !important;will-change:transform}
      `
            document.head.appendChild(st)
        }
        setPortalRoot(el)
        const mo = new MutationObserver(() => {
            if (!document.body.contains(el)) document.body.appendChild(el)
            document.body.appendChild(el)
        })
        mo.observe(document.body, { childList: true })
        return () => mo.disconnect()
    }, [])

    // Watchdog para cursor
    useEffect(() => {
        const safePutOnScreen = () => {
            setCursor(c => {
                const margin = 24
                const sx = window.scrollX, sy = window.scrollY
                const maxX = sx + window.innerWidth  - margin
                const maxY = sy + window.innerHeight - margin
                let x = c.x, y = c.y
                if (x < sx + margin || x > maxX || y < sy + margin || y > maxY) {
                    x = sx + margin
                    y = sy + margin
                }
                return { ...c, show: true, x, y, transition: { type: 'tween', ease: EASE, duration: 0.0 } }
            })
        }
        const interval = setInterval(safePutOnScreen, 900)
        window.addEventListener('scroll', safePutOnScreen, { passive: true })
        window.addEventListener('resize', safePutOnScreen)
        document.addEventListener('visibilitychange', safePutOnScreen)
        window.bamiForceCursor = safePutOnScreen
        return () => {
            clearInterval(interval)
            window.removeEventListener('scroll', safePutOnScreen)
            window.removeEventListener('resize', safePutOnScreen)
            document.removeEventListener('visibilitychange', safePutOnScreen)
            delete window.bamiForceCursor
        }
    }, [])

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

    const showHalo = async (el, ms=DUR.halo) => {
        if (!el) return
        const r = el.getBoundingClientRect()
        const x = r.left + (window.scrollX || 0)
        const y = r.top + (window.scrollY || 0)
        setHalo({ x, y, w: r.width, h: r.height, key: Date.now() })
        await wait(ms)
        setHalo(null)
    }

    const showTip = async (el, text, keep=1400) => {
        if (!el) return
        const r = el.getBoundingClientRect()
        const rawX = r.left + (window.scrollX || 0) + r.width + 10
        const rawY = r.top + (window.scrollY || 0) + r.height / 2
        const maxX = window.scrollX + window.innerWidth - 260
        const x = Math.min(rawX, maxX)
        const y = Math.max(rawY, window.scrollY + 12)
        setTip({ x, y, text, key: Date.now() })
        await wait(keep)
        setTip(null)
    }

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
        await showHalo(el, DUR.halo)
    }

    const clickEffect = async () => {
        await wait(DUR.settlePause)
        setCursor(c => ({ ...c, clicking: true }))
        await wait(DUR.clickHold)
        setCursor(c => ({ ...c, clicking: false }))
        await wait(DUR.settlePause)
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

    const simulateTracker = (opts={}) => {
        const detail = {
            caseId: (getCase?.()?.id || caseData?.id || 'demo-' + Date.now()),
            timeline: opts.timeline || [
                { key: 'recibido',  label: 'Documentos recibidos', delayMs: 1200 },
                { key: 'validando', label: 'Validación automática', delayMs: 1800 },
                { key: 'aprobado',  label: 'Aprobado',              delayMs: 1500, final: true }
            ]
        }
        window.dispatchEvent(new CustomEvent('tracker:simulate:start', { detail }))
        // Esto dispara la animación en el tracker (componente), pero ya NO abre el panel del simulador
        window.dispatchEvent(new Event('bami:sim:runTracker'))
    }

    // Secuencia del recorrido
    const ROUTE = [
        {
            type: 'click',
            id: 'simular-app-top',
            say: 'Simulamos la App del cliente.',
            targets: { selectors: ['btn-simular-top','[data-agent-id="btn-simular-top"]','.top-actions [data-agent-id="btn-simular-top"]'], texts: ['simular app','simulador'] },
            run: () => controls?.openSimulator?.(),
            success: () => !!document.querySelector('[data-simulator], .simulator-panel'),
            forceSuccessIfRun: true
        },
        {
            type: 'click',
            id: 'crear-expediente',
            say: 'Creamos el expediente.',
            targets: { selectors: ['btn-crear-expediente','[data-agent-id="btn-crear-expediente"]','button#create-expediente'], texts: ['crear expediente','nuevo expediente'] },
            run: () => controls?.start?.(),
            success: () => !!document.querySelector('[data-expediente], .toast-expediente, [data-case-created]'),
            forceSuccessIfRun: true,
            after: async () => {
                // Abrimos tracker SOLO en UI principal (NO en simulador durante Autopilot)
                window.dispatchEvent(new Event('ui:tracker:open'))
                window.dispatchEvent(new Event('bami:agent:openTracker'))
            }
        },
        {
            type: 'click',
            id: 'subir-documentos',
            say: 'Abrimos el asistente de subida de documentos.',
            targets: { selectors: ['btn-recomendado','btn-subir-documentos','[data-agent-id="btn-recomendado"]','[data-agent-id="btn-subir-documentos"]'], texts: ['subir documentos','continuar'] },
            run: () => controls?.openUploadEverywhere?.(),
            success: () => !!document.querySelector('[data-upload-portal],[data-dropzone],.upload-modal'),
            forceSuccessIfRun: true,
            after: async () => {
                // Señales de demo a cualquier uploader/bridge existente
                window.dispatchEvent(new Event('upload:demo'))
                window.dispatchEvent(new Event('ui:upload:demo'))
                window.dispatchEvent(new Event('sim:upload:demo'))

                // Mantener tracker abierto SOLO en escritorio, y avanzar simulación
                setTimeout(() => {
                    window.dispatchEvent(new Event('ui:tracker:open'))
                    window.dispatchEvent(new Event('bami:agent:openTracker'))
                    // NO abrimos el tracker del simulador (se suprime durante Autopilot)
                    simulateTracker()
                }, 900)
            }
        },
        {
            type: 'click',
            id: 'abrir-tracker',
            say: 'Vemos el tracker y cómo avanza etapa por etapa.',
            targets: { selectors: ['btn-tracker-top','[data-agent-id="btn-tracker-top"]','btn-tracker','[data-agent-id="btn-tracker"]'], texts: ['tracker','abrir tracker'] },
            run: () => {
                controls?.openTracker?.()
                window.dispatchEvent(new Event('bami:agent:openTracker'))
                window.dispatchEvent(new Event('bami:sim:runTracker'))
                // NO emitir 'sim:tracker:open' durante Autopilot
                window.__BAMI_LOCK_TRACKER__ = true
            },
            success: () => !!document.querySelector('[data-agent-area="tracker"],[data-tracker-panel],.tracker-panel'),
            forceSuccessIfRun: true
        },
        {
            type: 'focus',
            id: 'focus-bam-ops',
            say: 'Vista para BAM: panel de análisis y leads.',
            targets: { selectors: ['[data-agent-area="panel-bam-ops"]','.ops-panel','.analytics-panel'], texts: ['panel de análisis y leads','panel de analisis y leads'] },
            after: async () => {
                window.dispatchEvent(new Event('sim:ops:open'))
                window.dispatchEvent(new Event('bami:ops:explain'))
            }
        },
        { type: 'speak', id: 'end', say: 'Listo. Flujo presentado de inicio a fin.' }
    ]

    const showTipFor = async (el, text, kind) => {
        logLine(text)
        if (el && (kind === 'focus' || kind === 'click')) await showTip(el, text, 1300)
    }

    const runFocus = async (step) => {
        step?.before?.()
        const target = await waitForTarget({ ...(step.targets || {}), kind: 'focus' })
        if (target) {
            await moveToEl(target)
            await showTipFor(target, step.say, 'focus')
        } else {
            await showTipFor(null, step.say, 'focus')
        }
        await Promise.resolve(step?.after?.())
        return true
    }

    const runClick = async (step) => {
        step?.before?.()
        const target = await waitForTarget({ ...(step.targets || {}), kind: 'click' })
        if (target) {
            await moveToEl(target)
            await showTipFor(target, step.say, 'click')
            await clickEffect()
            try { await Promise.resolve(step.run?.()) } catch {}
            await wait(600)
            if (step.success && step.success()) { await Promise.resolve(step?.after?.()); return true }
            if (step.forceSuccessIfRun && step.run) { await Promise.resolve(step?.after?.()); return true }
            await Promise.resolve(step?.after?.())
            return true
        }
        await showTipFor(null, step.say + ' (simulado)', 'click')
        try { await Promise.resolve(step.run?.()) } catch {}
        await Promise.resolve(step?.after?.())
        await wait(500)
        return true
    }

    const runSpeak = async (step) => { step?.before?.(); logLine(step.say); await Promise.resolve(step?.after?.()); await wait(700); return true }

    const runDemo = async () => {
        if (running) return
        setRunning(true)
        logLine('Iniciando Autopilot…')

        // 🔒 Señales globales para UX
        window.__BAMI_AGENT_ACTIVE__ = true
        window.__BAMI_DISABLE_FLOATING__ = true // desactiva chat flotante
        window.__BAMI_LOCK_TRACKER__ = true     // evita cierre del tracker principal
        // 🚫 Suprimir tracker del simulador para que se vea el "subir documentos"
        window.__BAMI_SUPPRESS_SIM_TRACKER__ = true
        window.dispatchEvent(new Event('sim:tracker:close'))

        // Cursor presente desde el inicio
        try { window.dispatchEvent(new Event('bami:cursor:forceShow')) } catch {}
        window.dispatchEvent(new Event('bami:agent:start'))

        try {
            for (const step of ROUTE) {
                await runStep(step)
                await wait(260)
            }

            // Espera a que el tracker termine (si envía señal); margen de seguridad
            await new Promise(resolve => {
                let done = false
                const h = () => { done = true; window.removeEventListener('bami:tracker:finished', h); resolve() }
                window.addEventListener('bami:tracker:finished', h)
                setTimeout(() => { if (!done) resolve() }, 1800)
            })

            // Inyectar lead “creado por BAMI” en OPS con datos del caso actual
            const cc = getCase?.() || caseData || {}
            window.dispatchEvent(new CustomEvent('bami:ops:ingestLead', {
                detail: {
                    case: {
                        id: cc.id || `C-${Math.floor(Math.random()*900000)+100000}`,
                        product: cc.product || 'Tarjeta de Crédito',
                        channel: cc.channel || 'web',
                        applicant: cc.applicant || { name: 'Cliente BAMI' },
                        stage: 'aprobado'
                    }
                }
            }))

            logLine('Flujo completado.')
        } finally {
            await wait(400)
            setHalo(null); setTip(null)
            setCursor(c => ({ ...c, show: true, clicking: false, transition: { type: 'tween', ease: EASE, duration: 0.8 } }))

            // ⛔ Limpiar bloqueos y restablecer supresión del simulador
            window.__BAMI_LOCK_TRACKER__ = false
            window.__BAMI_SUPPRESS_SIM_TRACKER__ = false
            closeEverything()
            setRunning(false)
            setTimeout(()=>{ window.__BAMI_AGENT_ACTIVE__ = false }, 200)
        }
    }

    const runStep = async (step) => {
        switch (step.type) {
            case 'focus': return runFocus(step)
            case 'click': return runClick(step)
            case 'speak': return runSpeak(step)
            default: return true
        }
    }

    // Insight inicial (una línea)
    useEffect(() => { if (insight) logLine(`🔎 ${insight}`) }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // UI del HUD (botón + feed)
    const hud = (
        <div id="bami-hud" className="fixed right-4 bottom-4 z-[1999980]">
            {/* Botón flotante */}
            <div className="flex flex-col items-end gap-2 mb-2">
                <button
                    onClick={() => setOpen(v=>!v)}
                    className="px-3 py-2 rounded-xl bg-black text-white shadow-lg border border-white/10 flex items-center gap-2 hover:bg-black/90"
                    title="Abrir panel del agente"
                >
                    <Bot size={16}/> BAMI · HUD
                </button>
                <button
                    onClick={running ? undefined : runDemo}
                    className={`px-3 py-2 rounded-xl ${running ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-bami-yellow text-black hover:brightness-95'} shadow-lg border border-black/10 flex items-center gap-2`}
                    title="Autopilot"
                >
                    {running ? <Activity size={16}/> : <Play size={16}/>}
                    {running ? 'Autopilot en curso' : 'Iniciar Autopilot'}
                </button>
            </div>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.2 }}
                        className="w-[360px] max-w-[92vw] rounded-2xl bg-white border shadow-2xl overflow-hidden"
                    >
                        <div className="h-10 px-3 bg-gray-50 border-b flex items-center justify-between">
                            <div className="text-sm font-semibold flex items-center gap-2">
                                <Sparkles size={16}/> Panel del agente
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={running ? undefined : runDemo}
                                    className={`px-2 py-1 rounded-md text-xs ${running ? 'bg-gray-200 text-gray-600' : 'bg-bami-yellow text-black'}`}
                                >
                                    {running ? 'En curso' : 'Autopilot'}
                                </button>
                                <button onClick={()=>setOpen(false)} className="p-1 rounded-md hover:bg-gray-200" aria-label="Cerrar">
                                    <XIcon size={14}/>
                                </button>
                            </div>
                        </div>
                        <div className="p-3 text-xs text-gray-700">
                            <div className="mb-2">
                                <div className="text-[11px] text-gray-500">Contexto</div>
                                <div className="mt-1">{insight || '—'}</div>
                            </div>
                            <div className="text-[11px] text-gray-500 mb-1">Pasos</div>
                            <div ref={feedRef} className="max-h-[220px] overflow-auto rounded-lg border p-2 space-y-1 bg-gray-50">
                                {feed.map(f => (
                                    <div key={f.id} className="flex items-start gap-2">
                                        <span className="mt-[3px]"><MousePointer2 size={12}/></span>
                                        <span className="leading-4">{f.text}</span>
                                    </div>
                                ))}
                                {!feed.length && <div className="text-gray-500">Sin eventos aún.</div>}
                            </div>
                            <div className="mt-2 flex items-center justify-end gap-2">
                                <button onClick={()=>{ setFeed([]) }} className="text-[11px] px-2 py-1 rounded-md border hover:bg-gray-50">Limpiar</button>
                                <button onClick={closeEverything} className="text-[11px] px-2 py-1 rounded-md border hover:bg-gray-50">Cerrar overlays</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cursor visual */}
            <div className="bami-cursor-layer pointer-events-none fixed inset-0" style={{ zIndex: Z.CURSOR }}>
                <motion.div
                    initial={false}
                    animate={{ x: cursor.x, y: cursor.y, opacity: cursor.show ? 1 : 0 }}
                    transition={cursor.transition}
                    className="absolute"
                >
                    <div className="relative">
                        <div className="w-5 h-5 rounded-full bg-black/90 shadow-[0_0_0_2px_rgba(255,255,255,.7)]" />
                    </div>
                </motion.div>
            </div>

            {/* Halo de enfoque */}
            <AnimatePresence>
                {halo && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed pointer-events-none"
                        style={{ left: halo.x, top: halo.y, width: halo.w, height: halo.h, zIndex: Z.HALO }}
                    >
                        <div className="w-full h-full rounded-xl ring-4 ring-bami-yellow/60 ring-offset-2 ring-offset-transparent" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tip flotante */}
            <AnimatePresence>
                {tip && (
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.2 }}
                        className="fixed pointer-events-none max-w-[260px] p-2 rounded-lg bg-black text-white text-xs shadow-xl"
                        style={{ left: tip.x, top: tip.y, zIndex: Z.TIP }}
                    >
                        {tip.text}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )

    if (!portalRoot) return null
    return createPortal(hud, portalRoot)
}
