// src/components/BamiAgent.jsx
import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Bot, Sparkles, MousePointer2, Activity, Play, X as XIcon } from 'lucide-react'
import { api } from '../lib/apiClient'

/**
 * BAMI Agent — Autopilot:
 * - Cursor circular propio (oculto por defecto y visible sólo en Autopilot).
 * - Oculta el cursor del sistema (flecha) mientras corre Autopilot.
 * - Spotlight: recorta el overlay para resaltar el objetivo incluso si hay sombreado encima.
 * - No reabre el tracker si el usuario lo cerró.
 */

const EASE = [0.22, 1, 0.36, 1]
const DUR = {
    moveTotal: 1.8,
    preRatio: 0.55,
    settlePause: 380,
    clickHold: 420,
    betweenSteps: 220,
    tip: 1300,
    halo: 800
}

const Z = {
    HUD: 1_999_980,
    HALO: 1_999_985,
    TIP: 1_999_990,
    CURSOR: 2_147_483_646,
    SPOT: 2_000_000
}

const wait = (ms) => new Promise(r => setTimeout(r, ms))
const isInsideHUD = (el) => !!el?.closest?.('#bami-hud')
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
const clickableAncestor = (el) => el?.closest?.('button,[role="button"],a') || el
const normalize = (t) => (t || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()

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
        if (sel.startsWith('btn-')) el = document.querySelector(`[data-agent-id="${sel}"]`)
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

/* -------------------------------- Component -------------------------------- */
export default function BamiAgent({ caseData, product, controls }) {
    const [open, setOpen] = useState(false)
    const [running, setRunning] = useState(false)
    const [feed, setFeed] = useState([])
    const feedRef = useRef(null)

    // Cursor circular — OCULTO hasta iniciar Autopilot
    const [cursor, setCursor] = useState({
        show: false,
        x: (typeof window !== 'undefined' ? (window.scrollX + 32) : 32),
        y: (typeof window !== 'undefined' ? (window.scrollY + 32) : 32),
        clicking: false,
        transition: { type: 'tween', ease: EASE, duration: 0 }
    })

    // Spotlight y halo
    const [halo, setHalo] = useState(null)
    const [spot, setSpot] = useState(null) // {x,y,w,h} para recortar overlay
    const [tip, setTip] = useState(null)

    // Portal raíz y estilos globales (incluye ocultar cursor del sistema)
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
        /* 🔒 Ocultar el cursor de sistema sólo cuando el body tenga esta clase */
        .bami-hide-cursor, .bami-hide-cursor * { cursor: none !important; }
      `
            document.head.appendChild(st)
        }
        setPortalRoot(el)
        return () => {}
    }, [])

    // Watchdog de seguridad del cursor: NO lo muestra si no está corriendo
    useEffect(() => {
        const safePutOnScreen = () => {
            if (!running) return
            setCursor(c => {
                const margin = 24
                const sx = window.scrollX, sy = window.scrollY
                const maxX = sx + window.innerWidth  - margin
                const maxY = sy + window.innerHeight - margin
                let x = c.x, y = c.y
                if (x < sx + margin || x > maxX || y < sy + margin || y > maxY) {
                    x = sx + margin; y = sy + margin
                }
                return { ...c, show: true, x, y, transition: { type: 'tween', ease: EASE, duration: 0.0 } }
            })
        }
        const interval = setInterval(safePutOnScreen, 900)
        window.addEventListener('scroll', safePutOnScreen, { passive: true })
        window.addEventListener('resize', safePutOnScreen)
        document.addEventListener('visibilitychange', safePutOnScreen)
        return () => {
            clearInterval(interval)
            window.removeEventListener('scroll', safePutOnScreen)
            window.removeEventListener('resize', safePutOnScreen)
            document.removeEventListener('visibilitychange', safePutOnScreen)
        }
    }, [running])

    // Métricas demo
    const [metrics, setMetrics] = useState(null)
    useEffect(() => { (async()=>{ try{ setMetrics(await api.adminAnalytics()) }catch{} })() }, [])

    const insight = useMemo(() => {
        const p = []
        if (caseData) {
            p.push(`Caso ${caseData.id?.slice(0,6) || 'nuevo'} · ${caseData.product} · etapa: ${caseData.stage}`)
            if ((caseData.missing || []).length) p.push(`Faltan ${caseData.missing.length} doc(s)`)
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
    useEffect(() => { if (feedRef.current) feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' }) }, [feed])

    // Utilidades visuales
    const showHalo = async (el, ms=DUR.halo) => {
        if (!el) return
        const r = el.getBoundingClientRect()
        const x = r.left + (window.scrollX || 0)
        const y = r.top + (window.scrollY || 0)
        setHalo({ x, y, w: r.width, h: r.height, key: Date.now() })
        await wait(ms)
        setHalo(null)
    }
    const setSpotlightFor = (el) => {
        if (!el) { setSpot(null); return }
        const r = el.getBoundingClientRect()
        const rect = { x: r.left + (window.scrollX || 0), y: r.top + (window.scrollY || 0), w: r.width, h: r.height }
        setSpot(rect)
    }
    const clearSpot = () => setSpot(null)

    const showTipFor = async (el, text) => {
        const r = el?.getBoundingClientRect?.()
        let x = window.scrollX + (r ? (r.left + r.width + 10) : 20)
        let y = window.scrollY + (r ? (r.top + r.height/2) : 20)
        const maxX = window.scrollX + window.innerWidth - 260
        x = Math.min(x, maxX); y = Math.max(y, window.scrollY + 12)
        setTip({ x, y, text, key: Date.now() })
        await wait(DUR.tip)
        setTip(null)
    }

    const moveToEl = async (el, total=DUR.moveTotal) => {
        if (!el) return
        setSpotlightFor(el)             // 🔦 spotlight antes
        await ensureVisible(el)
        const r = el.getBoundingClientRect()
        const finalX = r.left + r.width * 0.5 + (window.scrollX || 0)
        const finalY = r.top + r.height * 0.5 + (window.scrollY || 0)
        const preX = finalX - Math.min(90, r.width * 0.5)
        const preY = finalY - Math.min(60, r.height * 0.4)
        setCursor(c => ({ ...c, show: true }))
        const d1 = Math.max(0.35, total * 0.55)
        setCursor(c => ({ ...c, transition: { type: 'tween', ease: EASE, duration: d1 }, x: preX, y: preY }))
        await wait(d1 * 1000 + 110)
        await wait(DUR.betweenSteps)
        const d2 = Math.max(0.35, total * 0.45)
        setCursor(c => ({ ...c, transition: { type: 'tween', ease: EASE, duration: d2 }, x: finalX, y: finalY }))
        await wait(d2 * 1000 + 110)
        await showHalo(el)
    }

    const clickEffect = async () => {
        await wait(DUR.settlePause)
        setCursor(c => ({ ...c, clicking: true }))
        await wait(DUR.clickHold)
        setCursor(c => ({ ...c, clicking: false }))
        await wait(DUR.settlePause)
    }

    // Limpieza global de overlays comunes
    const closeEverything = () => {
        window.dispatchEvent(new Event('ui:upload:close'))
        window.dispatchEvent(new Event('upload:close'))
        window.dispatchEvent(new Event('ui:form:close'))
        window.dispatchEvent(new Event('sim:tracker:close'))
        window.dispatchEvent(new Event('sim:ops:close'))
        window.dispatchEvent(new Event('sim:close'))
    }

    // Simulación de tracker — NO lo “bloquea”; sólo dispara una vez.
    const simulateTracker = () => {
        const detail = {
            caseId: (caseData?.id || 'demo-' + Date.now()),
            timeline: [
                { key: 'recibido',  label: 'Documentos recibidos', delayMs: 700 },
                { key: 'validando', label: 'Validación automática', delayMs: 1200 },
                { key: 'aprobado',  label: 'Aprobado',              delayMs: 900, final: true }
            ]
        }
        window.dispatchEvent(new CustomEvent('tracker:simulate:start', { detail }))
        window.dispatchEvent(new Event('bami:sim:runTracker'))
    }

    // Ruta de demostración
    const ROUTE = [
        {
            type: 'click',
            id: 'simular-app-top',
            say: 'Simulamos la App del cliente.',
            targets: { selectors: ['[data-agent-id="btn-simular-top"]','[data-agent-id="btn-simular"]'], texts: ['simular app','simulador'] },
            run: () => controls?.openSimulator?.(),
            success: () => !!document.querySelector('[data-simulator], .simulator-panel'),
            forceSuccessIfRun: true
        },
        {
            type: 'click',
            id: 'crear-expediente',
            say: 'Creamos el expediente.',
            targets: { selectors: ['[data-agent-id="btn-crear-expediente"]','button#create-expediente'], texts: ['crear expediente','nuevo expediente'] },
            run: () => controls?.start?.(),
            success: () => !!document.querySelector('[data-expediente], .toast-expediente, [data-case-created]'),
            forceSuccessIfRun: true
        },
        {
            type: 'click',
            id: 'subir-documentos',
            say: 'Abrimos el asistente de subida de documentos.',
            targets: { selectors: ['[data-agent-id="btn-recomendado"]','[data-agent-id="btn-subir-documentos"]'], texts: ['subir documentos','continuar'] },
            run: () => controls?.openUploadEverywhere?.(),
            success: () => !!document.querySelector('[data-upload-portal],[data-dropzone],.upload-modal'),
            forceSuccessIfRun: true,
            after: async () => {
                window.dispatchEvent(new Event('upload:demo'))
                window.dispatchEvent(new Event('ui:upload:demo'))
                window.dispatchEvent(new Event('sim:upload:demo'))
                // Lanzamos simulación del progreso del caso (sin abrir el tracker forzosamente)
                setTimeout(() => simulateTracker(), 700)
            }
        },
        {
            type: 'click',
            id: 'abrir-tracker',
            say: 'Abrimos el tracker para ver el estado completo.',
            targets: { selectors: ['[data-agent-id="btn-tracker-top"]','[data-agent-id="btn-tracker"]'], texts: ['tracker','abrir tracker'] },
            run: () => controls?.openTracker?.(),
            success: () => !!document.querySelector('[data-agent-area="tracker"],[data-tracker-panel],.tracker-panel'),
            forceSuccessIfRun: true
        },
        { type: 'speak', id: 'end', say: 'Listo. Flujo presentado de inicio a fin.' }
    ]

    const runFocus = async (step) => {
        step?.before?.()
        const target = await waitForTarget({ ...(step.targets || {}), kind: 'focus' })
        if (target) {
            setSpotlightFor(target)
            await moveToEl(target)
            await showTipFor(target, step.say)
        } else {
            setSpot(null)
            logLine(step.say)
            await wait(600)
        }
        await Promise.resolve(step?.after?.())
        clearSpot()
        return true
    }
    const runClick = async (step) => {
        step?.before?.()
        const target = await waitForTarget({ ...(step.targets || {}), kind: 'click' })
        if (target) {
            setSpotlightFor(target)
            await moveToEl(target)
            await showTipFor(target, step.say)
            await clickEffect()
            try { await Promise.resolve(step.run?.()) } catch {}
            await wait(600)
            await Promise.resolve(step?.after?.())
        } else {
            setSpot(null)
            logLine(step.say + ' (simulado)')
            try { await Promise.resolve(step.run?.()) } catch {}
            await Promise.resolve(step?.after?.())
            await wait(500)
        }
        clearSpot()
        return true
    }
    const runSpeak = async (step) => { step?.before?.(); logLine(step.say); await Promise.resolve(step?.after?.()); await wait(700); return true }

    const runStep = async (step) => {
        switch (step.type) {
            case 'focus': return runFocus(step)
            case 'click': return runClick(step)
            case 'speak': return runSpeak(step)
            default: return true
        }
    }

    // Insight inicial en feed (una sola vez)
    useEffect(() => { if (insight) logLine(`🔎 ${insight}`) }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const startBodyHideCursor = () => document.body.classList.add('bami-hide-cursor')
    const stopBodyHideCursor = () => document.body.classList.remove('bami-hide-cursor')

    const runDemo = async () => {
        if (running) return
        setRunning(true)
        setFeed([])

        // Señales globales
        window.__BAMI_AGENT_ACTIVE__ = true
        window.__BAMI_DISABLE_FLOATING__ = true

        // Mostrar cursor circular y ocultar flecha del sistema
        startBodyHideCursor()
        setCursor(c => ({ ...c, show: true }))

        try {
            for (const step of ROUTE) { await runStep(step); await wait(260) }
            logLine('Flujo completado.')
        } finally {
            // Restablecer
            clearSpot(); setHalo(null); setTip(null)
            setCursor(c => ({ ...c, show: false, clicking: false, transition: { type: 'tween', ease: EASE, duration: 0.6 } }))
            stopBodyHideCursor()

            // No bloquear tracker ni reabrirlo
            window.__BAMI_AGENT_ACTIVE__ = false
            setRunning(false)
            // Cierra overlays secundarios (pero no forza abrir/cerrar tracker)
            closeEverything()
        }
    }

    /* --------------------------- HUD y capas visuales --------------------------- */
    const hud = (
        <div id="bami-hud" className="fixed right-4 bottom-4 z-[1999980]">
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
                            <button onClick={()=>setOpen(false)} className="p-1 rounded-md hover:bg-gray-200" aria-label="Cerrar">
                                <XIcon size={14}/>
                            </button>
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
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cursor circular — sólo visible en Autopilot */}
            <div className="bami-cursor-layer pointer-events-none fixed inset-0" style={{ zIndex: Z.CURSOR }}>
                <motion.div
                    initial={false}
                    animate={{ x: cursor.x, y: cursor.y, opacity: cursor.show ? 1 : 0 }}
                    transition={cursor.transition}
                    className="absolute"
                >
                    <div className="relative">
                        <div className="w-5 h-5 rounded-full bg-black/90 shadow-[0_0_0_2px_rgba(255,255,255,.7)]" />
                        <AnimatePresence>
                            {cursor.clicking && (
                                <motion.span
                                    initial={{ opacity: 0.45, scale: 0.6 }}
                                    animate={{ opacity: 0, scale: 2.3 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.6, ease: 'ease-out' }}
                                    className="absolute -inset-2 rounded-full border-2 border-black/40"
                                />
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>

            {/* 🔦 Spotlight (4 paneles alrededor del objetivo para recortar el sombreado superior) */}
            <AnimatePresence>
                {spot && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 pointer-events-none"
                        style={{ zIndex: Z.SPOT }}
                    >
                        {/* Paneles oscuros alrededor del rectángulo (x,y,w,h) */}
                        <div className="fixed left-0 top-0 right-0" style={{ height: Math.max(0, spot.y - window.scrollY), background: 'rgba(0,0,0,.45)' }} />
                        <div className="fixed left-0 bottom-0 right-0" style={{ top: spot.y + spot.h, background: 'rgba(0,0,0,.45)' }} />
                        <div className="fixed top-0 bottom-0 left-0" style={{ width: Math.max(0, spot.x - window.scrollX), background: 'rgba(0,0,0,.45)' }} />
                        <div className="fixed top-0 bottom-0" style={{ left: spot.x + spot.w, right: 0, background: 'rgba(0,0,0,.45)' }} />
                        {/* Borde brillante */}
                        <div
                            className="fixed rounded-xl pointer-events-none"
                            style={{
                                left: spot.x, top: spot.y, width: spot.w, height: spot.h,
                                boxShadow: '0 0 0 4px rgba(253,224,71,.8), 0 0 0 10px rgba(253,224,71,.2)'
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Halo extra por si el boton queda justo bajo el sombreado */}
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

            {/* Tip explicativo */}
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
