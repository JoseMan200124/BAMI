import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Bot, Sparkles, MousePointer2, Activity, File, CheckCircle2 } from 'lucide-react'
import { api } from '../lib/apiClient'

/**
 * BAMI Agent — Autopilot silencioso + animación de subida + tracker al final.
 * - NO abre el HUD al ejecutar Autopilot (silent).
 * - Muestra overlay de "subida de archivos" simulado.
 * - Abre el Tracker solo al final, lo hace avanzar a Aprobado y luego lo cierra.
 * - Mantiene el cursor animado, pero se oculta al terminar.
 * - Sin loops del MutationObserver (fix congelamiento).
 */

const EASE = [0.22, 1, 0.36, 1]
const DUR = {
    moveTotal: 1.6,
    preRatio: 0.55,
    settlePause: 420,
    clickHold: 420,
    ripple: 900,
    halo: 700,
    betweenSteps: 220,
}

const Z = {
    HUD: 1999980,
    HALO: 1999985,
    TIP: 1999990,
    CURSOR: 2147483646,
    OVERLAY: 2147483647
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

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
const normalize = (t) =>
    (t || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()

const findByText = (selectors, text) => {
    const goal = normalize(text)
    const nodes = Array.from(document.querySelectorAll(selectors.join(',')))
    return nodes.filter((n) => !isInsideHUD(n) && normalize(n.textContent || '').includes(goal))
}

const score = (el, boostText = false) => {
    let s = 0
    if (isVisible(el)) s += 6
    if (!isDisabled(el)) s += 3
    if (el?.tagName?.toLowerCase() === 'button') s += 3
    if (el?.getAttribute?.('role') === 'button') s += 2
    if (boostText) s += 1
    return s
}

const queryBestTarget = ({ selectors = [], texts = [], kind = 'click' }) => {
    const found = []
    const push = (el, by) => {
        if (el && !isInsideHUD(el)) found.push({ el, by })
    }

    for (const sel of selectors) {
        let el = null
        if (sel.startsWith('btn-')) el = findByDataId(sel)
        else if (sel.startsWith('[data-agent-id=')) el = document.querySelector(sel)
        else el = document.querySelector(sel)
        push(el, 'selector')
    }

    if (texts.length) {
        const clickables = ['button', 'a', '[role="button"]']
        const any = ['*']
        const list =
            kind === 'focus'
                ? texts.flatMap((t) => findByText(any, t))
                : texts.flatMap((t) => findByText(clickables, t).map(clickableAncestor))
        for (const el of list) push(el, 'text')
    }

    if (!found.length) return null
    let best = null, bestScore = -Infinity
    for (const f of found) {
        const el = kind === 'click' ? clickableAncestor(f.el) : f.el
        const sc = score(el, f.by === 'text')
        if (sc > bestScore) { best = el; bestScore = sc }
    }
    return best
}

const waitForTarget = async ({ selectors = [], texts = [], timeout = 1200, kind = 'click' }) => {
    const now = queryBestTarget({ selectors, texts, kind })
    if (now) return now
    const start = performance.now()
    while (performance.now() - start < timeout) {
        await wait(80)
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

// ---------- Componente ----------
export default function BamiAgent({ caseData, product, controls }) {
    const [open, setOpen] = useState(false)
    const [running, setRunning] = useState(false)
    const [feed, setFeed] = useState([])
    const feedRef = useRef(null)

    // cursor y efectos
    const [cursor, setCursor] = useState({
        show: true,
        x: typeof window !== 'undefined' ? window.scrollX + 32 : 32,
        y: typeof window !== 'undefined' ? window.scrollY + 32 : 32,
        clicking: false,
        transition: { type: 'tween', ease: EASE, duration: 0 },
    })
    const [halo, setHalo] = useState(null)
    const [tip, setTip] = useState(null)

    // overlay de subida simulada
    const [uploadOverlay, setUploadOverlay] = useState({ visible: false, items: [] })

    // portal a <body> con estilo y observer sin loops
    const [portalRoot, setPortalRoot] = useState(null)
    useLayoutEffect(() => {
        let el = document.getElementById('bami-agent-portal')
        if (!el) {
            el = document.createElement('div')
            el.id = 'bami-agent-portal'
            document.body.appendChild(el)
        } else {
            if (el.parentNode !== document.body || document.body.lastElementChild !== el) {
                document.body.appendChild(el)
            }
        }

        const styleId = '__bami_portal_style__'
        let st = document.getElementById(styleId)
        if (!st) {
            st = document.createElement('style')
            st.id = styleId
            st.textContent = `
        #bami-agent-portal{position:relative;z-index:${Z.CURSOR + 1} !important}
        #bami-hud{z-index:${Z.HUD} !important}
        .bami-cursor-layer{z-index:${Z.CURSOR} !important;opacity:1 !important;visibility:visible !important;pointer-events:none !important;will-change:transform}
      `
            document.head.appendChild(st)
        }
        setPortalRoot(el)

        const mo = new MutationObserver(() => {
            if (el.parentNode !== document.body || document.body.lastElementChild !== el) {
                mo.disconnect()
                requestAnimationFrame(() => {
                    if (el.parentNode !== document.body || document.body.lastElementChild !== el) {
                        document.body.appendChild(el)
                    }
                    mo.observe(document.body, { childList: true })
                })
            }
        })
        mo.observe(document.body, { childList: true })
        return () => mo.disconnect()
    }, [])

    // Watchdog del cursor (ligero)
    useEffect(() => {
        const safePutOnScreen = () => {
            setCursor((c) => {
                const margin = 24
                const sx = window.scrollX, sy = window.scrollY
                const maxX = sx + window.innerWidth - margin
                const maxY = sy + window.innerHeight - margin
                let x = c.x, y = c.y
                if (x < sx + margin || x > maxX || y < sy + margin || y > maxY) {
                    x = sx + margin
                    y = sy + margin
                }
                return { ...c, show: true, x, y, transition: { type: 'tween', ease: EASE, duration: 0.0 } }
            })
        }
        const onScroll = () => safePutOnScreen()
        const onResize = () => safePutOnScreen()
        const onVisibility = () => safePutOnScreen()
        const interval = setInterval(safePutOnScreen, 1200)
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onResize)
        document.addEventListener('visibilitychange', onVisibility)
        window.bamiForceCursor = safePutOnScreen
        return () => {
            clearInterval(interval)
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onResize)
            document.removeEventListener('visibilitychange', onVisibility)
            delete window.bamiForceCursor
        }
    }, [])

    // métricas demo
    const [metrics, setMetrics] = useState(null)
    const fetchMetrics = async () => {
        try { setMetrics(await api.adminAnalytics()) } catch {}
    }
    useEffect(() => { fetchMetrics() }, [])

    // insight compacto (solo para feed interno)
    const insight = useMemo(() => {
        const p = []
        if (caseData) {
            p.push(`Caso ${caseData.id?.slice(0, 6) || 'nuevo'} · ${caseData.product} · etapa: ${caseData.stage}`)
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

    // feed helpers
    const logLine = (text) =>
        setFeed((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, t: new Date(), text }])
    useEffect(() => {
        if (!feedRef.current) return
        feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
    }, [feed])

    // efectos visuales
    const showHalo = async (el, ms = DUR.halo) => {
        if (!el) return
        const r = el.getBoundingClientRect()
        const x = r.left + (window.scrollX || 0)
        const y = r.top + (window.scrollY || 0)
        setHalo({ x, y, w: r.width, h: r.height, key: Date.now() })
        await wait(ms)
        setHalo(null)
    }

    const showTip = async (el, text, keep = 1100) => {
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

    const moveToEl = async (el, total = DUR.moveTotal) => {
        if (!el) return
        await ensureVisible(el)
        const r = el.getBoundingClientRect()
        const finalX = r.left + r.width * 0.5 + (window.scrollX || 0)
        const finalY = r.top + r.height * 0.5 + (window.scrollY || 0)
        const preX = finalX - Math.min(90, r.width * 0.5)
        const preY = finalY - Math.min(60, r.height * 0.4)

        setCursor((c) => ({ ...c, show: true }))
        const d1 = Math.max(0.35, total * DUR.preRatio)
        setCursor((c) => ({ ...c, transition: { type: 'tween', ease: EASE, duration: d1 }, x: preX, y: preY }))
        await wait(d1 * 1000 + 110)
        await wait(DUR.betweenSteps)
        const d2 = Math.max(0.35, total * (1 - DUR.preRatio))
        setCursor((c) => ({ ...c, transition: { type: 'tween', ease: EASE, duration: d2 }, x: finalX, y: finalY }))
        await wait(d2 * 1000 + 110)
        await showHalo(el, DUR.halo)
    }

    const clickEffect = async () => {
        await wait(DUR.settlePause)
        setCursor((c) => ({ ...c, clicking: true }))
        await wait(DUR.clickHold)
        setCursor((c) => ({ ...c, clicking: false }))
        await wait(DUR.settlePause)
    }

    // ---------- helpers de limpieza ----------
    const closeEverything = () => {
        window.dispatchEvent(new Event('ui:upload:close'))
        window.dispatchEvent(new Event('upload:close'))
        window.dispatchEvent(new Event('ui:tracker:close'))
        window.dispatchEvent(new Event('ui:form:close'))
        window.dispatchEvent(new Event('sim:tracker:close'))
        window.dispatchEvent(new Event('sim:ops:close'))
        window.dispatchEvent(new Event('sim:close'))
    }

    // ---------- Simulación del tracker (no abre UI aquí) ----------
    const simulateTracker = (opts = {}) => {
        const detail = {
            caseId: caseData?.id || 'demo-' + Date.now(),
            timeline: opts.timeline || [
                { key: 'recibido', label: 'Documentos recibidos', delayMs: 700 },
                { key: 'validando', label: 'Validación automática', delayMs: 1100 },
                { key: 'aprobado', label: 'Aprobado', delayMs: 900, final: true },
            ],
        }
        window.dispatchEvent(new CustomEvent('tracker:simulate:start', { detail }))
        window.dispatchEvent(new Event('bami:sim:runTracker'))
    }

    // ---------- Overlay de subida simulada ----------
    const startUploadOverlay = async () => {
        // 3 "archivos" con progreso individual
        const files = [
            { name: 'DPI.pdf',     p: 0 },
            { name: 'Constancia.pdf', p: 0 },
            { name: 'Factura.pdf', p: 0 },
        ]
        setUploadOverlay({ visible: true, items: files })
        // animación escalonada
        for (let step = 0; step <= 100; step += 5) {
            await wait(90)
            setUploadOverlay((prev) => ({
                visible: true,
                items: prev.items.map((it, i) => ({
                    ...it,
                    p: Math.min(100, step + i * 8) // desfase por archivo
                }))
            }))
        }
        await wait(300)
        setUploadOverlay({ visible: false, items: [] })
    }

    // ---------- Ruta ----------
    const ROUTE = [
        {
            type: 'focus',
            id: 'focus-product-pill',
            say: 'Seleccionando producto: Tarjeta de Crédito.',
            targets: {
                selectors: [
                    '[data-agent-id="pill-product"]',
                    '[data-agent-id="pill-tarjeta"]',
                    '.segmented [data-active]',
                    '.segmented',
                ],
                texts: ['tarjeta de crédito', 'tarjeta de credito'],
            },
        },
        {
            type: 'click',
            id: 'simular-app-top',
            say: 'Simulamos la App del cliente.',
            targets: {
                selectors: ['btn-simular-top', '[data-agent-id="btn-simular-top"]', '.top-actions [data-agent-id="btn-simular-top"]'],
                texts: ['simular app', 'simulador'],
            },
            run: () => controls?.openSimulator?.(),
            success: () => !!document.querySelector('[data-simulator], .simulator-panel'),
            forceSuccessIfRun: true,
        },
        {
            type: 'click',
            id: 'crear-expediente',
            say: 'Creamos el expediente.',
            targets: {
                selectors: ['btn-crear-expediente', '[data-agent-id="btn-crear-expediente"]', 'button#create-expediente'],
                texts: ['crear expediente', 'nuevo expediente'],
            },
            run: () => controls?.start?.(),
            success: () => !!document.querySelector('[data-expediente], .toast-expediente, [data-case-created]'),
            forceSuccessIfRun: true,
        },
        {
            type: 'click',
            id: 'subir-documentos',
            say: 'Abrimos el asistente de subida de documentos.',
            targets: {
                selectors: ['btn-recomendado', 'btn-subir-documentos', '[data-agent-id="btn-recomendado"]', '[data-agent-id="btn-subir-documentos"]'],
                texts: ['subir documentos', 'subir 3 documento', 'continuar'],
            },
            run: () => controls?.openUploadEverywhere?.(),
            success: () => !!document.querySelector('[data-upload-portal],[data-dropzone],.upload-modal'),
            forceSuccessIfRun: true,
            after: async () => {
                // Señales demo + overlay de subida
                window.dispatchEvent(new Event('upload:demo'))
                window.dispatchEvent(new Event('ui:upload:demo'))
                window.dispatchEvent(new Event('sim:upload:demo'))
                await startUploadOverlay()
                // lanzar simulación de tracker
                simulateTracker()
            },
        },
        {
            type: 'focus',
            id: 'focus-bam-ops',
            say: 'Vista para BAM: panel de análisis y leads.',
            before: () => {
                closeEverything()
                window.dispatchEvent(new Event('bami:ui:openOps'))
                // simular KPIs en Ops (una sola vez)
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('ops:simulate:start', { detail: { seed: Date.now() } }))
                }, 150)
            },
            targets: {
                selectors: ['[data-agent-area="panel-bam-ops"]', '.ops-panel', '.analytics-panel'],
                texts: ['panel de análisis y leads', 'panel de analisis y leads'],
            },
        },
        {
            type: 'click',
            id: 'abrir-tracker-final',
            say: 'Abrimos el tracker para ver el avance final.',
            targets: {
                selectors: ['btn-tracker-top', '[data-agent-id="btn-tracker-top"]', 'btn-tracker', '[data-agent-id="btn-tracker"]'],
                texts: ['tracker', 'abrir tracker'],
            },
            run: () => {
                window.dispatchEvent(new Event('ui:tracker:open'))
                try { controls?.openTracker?.() } catch {}
                window.dispatchEvent(new Event('bami:agent:openTracker'))
                window.dispatchEvent(new Event('bami:sim:runTracker'))
            },
            success: () => !!document.querySelector('[data-agent-area="tracker"],[data-tracker-panel],.tracker-panel'),
            forceSuccessIfRun: true,
        },
        {
            type: 'click',
            id: 'cerrar-tracker',
            say: 'Cerramos el tracker.',
            targets: { selectors: ['[data-agent-area="tracker"] button', 'button.btn'], texts: ['cerrar'] },
            run: () => window.dispatchEvent(new Event('ui:tracker:close')),
            forceSuccessIfRun: true,
        },
        { type: 'speak', id: 'end', say: 'Listo. Flujo presentado de inicio a fin.' },
    ]

    // ---------- Ejecutores ----------
    const showTipFor = async (el, text, kind) => {
        // feed interno (no visible si HUD cerrado)
        logLine(text)
        if (el && (kind === 'focus' || kind === 'click')) await showTip(el, text, 1000)
    }

    const runFocus = async (step) => {
        try {
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
        } catch { return true }
    }

    const runClick = async (step) => {
        try {
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
        } catch { return true }
    }

    const runSpeak = async (step) => {
        step?.before?.()
        logLine(step.say)
        await Promise.resolve(step?.after?.())
        await wait(600)
        return true
    }

    const runStep = async (step) => {
        switch (step.type) {
            case 'focus': return runFocus(step)
            case 'click': return runClick(step)
            case 'speak': return runSpeak(step)
            default: return true
        }
    }

    // Autopilot SILENCIOSO: no muestra HUD ni lo abre
    const runDemoSilent = async () => {
        if (running) return
        setOpen(false)            // asegurar HUD cerrado
        setRunning(true)
        window.dispatchEvent(new Event('bami:agent:start'))
        try {
            for (const step of ROUTE) {
                await runStep(step)
                await wait(240)
            }
        } finally {
            await wait(240)
            setHalo(null)
            setTip(null)
            setCursor((c) => ({ ...c, show: false, clicking: false, transition: { type: 'tween', ease: EASE, duration: 0.5 } }))
            setRunning(false)
            setOpen(false)
        }
    }

    // Listener global para lanzar Autopilot desde fuera sin abrir HUD
    useEffect(() => {
        const onAuto = () => runDemoSilent()
        window.addEventListener('agent:autopilot', onAuto)
        return () => window.removeEventListener('agent:autopilot', onAuto)
    }, []) // eslint-disable-line

    // Evitar múltiples instancias activas
    useEffect(() => {
        if (window.__BAMI_AGENT_ACTIVE__) return
        window.__BAMI_AGENT_ACTIVE__ = true
        return () => { window.__BAMI_AGENT_ACTIVE__ = false }
    }, [])

    // Insight inicial (solo feed)
    useEffect(() => { if (insight) logLine(`🔎 ${insight}`) }, [insight])

    // ---------- UI base ----------
    const Trigger = (
        <div className="fixed right-4 bottom-4 z-[4015]">
            <button
                aria-label="Abrir BAMI Agent"
                onClick={() => setOpen((v) => !v)}
                className="rounded-full shadow-xl ring-1 ring-yellow-300 bg-white hover:scale-105 transition p-2 grid place-items-center"
            >
                <img src="/BAMI.svg" alt="BAMI Agent" className="w-12 h-12" />
            </button>
        </div>
    )

    const HudInPortal = portalRoot && createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    id="bami-hud"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 18 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="md:right-4 md:bottom-24 md:left-auto md:w-[min(460px,92vw)] md:max-h-[min(76vh,680px)] md:rounded-2xl md:shadow-2xl md:border md:bg-white md:overflow-hidden w-screen left-0 bottom-0 bg-white fixed"
                    style={{ boxShadow: '0 -12px 40px rgba(0,0,0,.18)', zIndex: Z.HUD }}
                >
                    <div className="md:rounded-2xl md:border md:bg-white overflow-hidden">
                        {/* Header */}
                        <div className="h-12 px-3 flex items-center justify-between border-b bg-yellow-50">
                            <div className="flex items-center gap-2">
                                <Bot size={18} className="text-yellow-600" />
                                <div className="font-semibold">BAMI · Agente</div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Autopilot SILENCIOSO: cierra HUD y ejecuta */}
                                <button onClick={runDemoSilent} disabled={running} className="btn btn-sm" title="Autopilot">
                                    <Sparkles size={14} className="mr-1" />
                                    {running ? 'En curso…' : 'Autopilot'}
                                </button>
                                <button className="btn btn-sm" onClick={() => setOpen(false)}>Cerrar</button>
                            </div>
                        </div>

                        {/* Insight */}
                        <div className="px-3 py-2 border-b bg-gray-50 text-[13px] text-gray-700 flex items-center gap-2">
                            <Activity size={16} className="text-gray-500" />
                            <div className="truncate">{insight || '—'}</div>
                        </div>

                        {/* Feed */}
                        <div ref={feedRef} className="max-h-[60vh] md:max-h-[48vh] overflow-auto p-3 space-y-2 bg-white">
                            {feed.length === 0 && (
                                <div className="text-sm text-gray-500">Aún sin mensajes. Inicia el Autopilot.</div>
                            )}
                            {feed.map((m) => (
                                <div key={m.id} className="p-3 rounded-xl border bg-white text-[14px] leading-5 whitespace-pre-wrap break-words shadow-sm">
                                    <div className="text-[11px] text-gray-500">{m.t.toLocaleTimeString()}</div>
                                    <div className="mt-1">{m.text}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        portalRoot
    )

    const HaloInPortal = portalRoot && createPortal(
        <AnimatePresence>
            {halo && (
                <motion.div
                    key={`halo-${halo.key}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="fixed inset-0 pointer-events-none"
                    style={{ zIndex: Z.HALO }}
                >
                    <div
                        className="absolute rounded-2xl"
                        style={{
                            left: halo.x - 10,
                            top: halo.y - 10,
                            width: halo.w + 20,
                            height: halo.h + 20,
                            boxShadow: '0 0 0 9999px rgba(0,0,0,0.25), 0 0 0 2px rgba(255, 212, 0, 0.75)',
                            borderRadius: 14,
                            pointerEvents: 'none',
                        }}
                    />
                </motion.div>
            )}
        </AnimatePresence>,
        portalRoot
    )

    const TipInPortal = portalRoot && createPortal(
        <AnimatePresence>
            {tip && (
                <motion.div
                    key={`tip-${tip.key}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="pointer-events-none fixed"
                    style={{ left: tip.x, top: tip.y, maxWidth: 240, zIndex: Z.TIP }}
                >
                    <div className="px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-900 text-xs shadow-lg border border-yellow-300 whitespace-pre-wrap break-words">
                        {tip.text}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        portalRoot
    )

    // Overlay de subida (solo durante simulación)
    const UploadOverlay = portalRoot && createPortal(
        <AnimatePresence>
            {uploadOverlay.visible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-black/35 grid place-items-center p-4"
                    style={{ zIndex: Z.OVERLAY }}
                >
                    <div className="w-full max-w-md rounded-2xl border shadow-xl bg-white p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <File size={18} className="text-yellow-600" />
                            <div className="font-semibold">Subiendo documentos…</div>
                        </div>
                        <div className="space-y-3">
                            {uploadOverlay.items.map((it) => (
                                <div key={it.name}>
                                    <div className="text-xs text-gray-600 mb-1">{it.name}</div>
                                    <div className="h-2 rounded-full bg-gray-100 border overflow-hidden">
                                        <div
                                            className="h-full bg-yellow-400"
                                            style={{ width: `${it.p}%`, transition: 'width .18s ease' }}
                                        />
                                    </div>
                                    <div className="text-[11px] text-gray-500 mt-1">{it.p}%</div>
                                </div>
                            ))}
                        </div>
                        {uploadOverlay.items.every((i) => i.p >= 100) && (
                            <div className="mt-3 text-sm text-emerald-700 flex items-center gap-2">
                                <CheckCircle2 size={16} /> ¡Listo! Documentos cargados.
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        portalRoot
    )

    const CursorInPortal = portalRoot && createPortal(
        <AnimatePresence>
            {cursor.show && (
                <motion.div
                    className="bami-cursor-layer pointer-events-none fixed"
                    style={{ zIndex: Z.CURSOR, opacity: 1, visibility: 'visible' }}
                    initial={false}
                    animate={{ x: cursor.x, y: cursor.y }}
                    transition={cursor.transition}
                >
                    <div className="relative -translate-x-3 -translate-y-3">
                        <MousePointer2
                            size={28}
                            style={{
                                color: '#111',
                                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
                                opacity: 1,
                            }}
                        />
                        <AnimatePresence>
                            {cursor.clicking && (
                                <motion.div
                                    key="ring"
                                    initial={{ opacity: 0.45, scale: 0 }}
                                    animate={{ opacity: 0, scale: 2.4 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: DUR.ripple / 1000, ease: EASE }}
                                    className="absolute left-1/2 top-1/2 w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-yellow-400"
                                    style={{ pointerEvents: 'none' }}
                                />
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        portalRoot
    )

    return (
        <>
            {/* Botón flotante del Agente (puedes ocultarlo si quieres que el acceso sea solo por evento) */}
            <div className="fixed right-4 bottom-4 z-[4015]">
                {Trigger}
            </div>

            {HudInPortal}
            {HaloInPortal}
            {TipInPortal}
            {UploadOverlay}
            {CursorInPortal}
        </>
    )
}
