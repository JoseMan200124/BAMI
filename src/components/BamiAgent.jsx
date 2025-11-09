// src/components/BamiAgent.jsx
// Autopilot con Spotlight anti-overlay + segundo flujo "Cliente en desktop" (chat).
// - Spotlight: crea un "hueco" alrededor del objetivo y lo eleva sobre cualquier overlay.
// - Cliente en desktop: escribe/enfoca chat, envía, pulsa chips, simula subida y valida con IA.

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

/* ------------------------------ Utilidades DOM ------------------------------ */
const HUD_ROOT_SELECTOR = '#bami-hud'
const isInsideHUD = (el) => !!el?.closest?.(HUD_ROOT_SELECTOR)

const isVisible = (el) => {
    if (!el) return false
    if (isInsideHUD(el)) return false
    const cs = window.getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false
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

    // spotlight anti-overlay
    const [spot, setSpot] = useState(null) // {x,y,r}
    const spotlightOn = (el, pad=16) => {
        if (!el) return
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width/2 + (window.scrollX || 0)
        const cy = r.top + r.height/2 + (window.scrollY || 0)
        const rad = Math.sqrt((r.width*r.width + r.height*r.height))/2 + pad
        setSpot({ x: cx, y: cy, r: rad })
    }
    const spotlightOff = () => setSpot(null)

    // eleva objetivo por encima de cualquier overlay/backdrop
    const liftTarget = (el) => {
        if (!el) return () => {}
        const prev = {
            z: el.style.zIndex,
            pos: el.style.position,
            pe: el.style.pointerEvents,
        }
        el.style.position = el.style.position || 'relative'
        el.style.zIndex = String(Z.CURSOR + 2)
        el.style.pointerEvents = 'auto'
        return () => {
            el.style.zIndex = prev.z
            el.style.position = prev.pos
            el.style.pointerEvents = prev.pe
        }
    }

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

    // Watchdog para cursor (que nunca se pierda de la pantalla)
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
        window.dispatchEvent(new Event('bami:sim:runTracker'))
    }

    /* ------------------------------ Autopilot ROUTE ------------------------------ */
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
                window.dispatchEvent(new Event('upload:demo'))
                window.dispatchEvent(new Event('ui:upload:demo'))
                window.dispatchEvent(new Event('sim:upload:demo'))
                setTimeout(() => {
                    window.dispatchEvent(new Event('ui:tracker:open'))
                    window.dispatchEvent(new Event('bami:agent:openTracker'))
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

    /* ------------------------------ Segundo flujo: Cliente en desktop ------------------------------ */
    const runClientFlow = async () => {
        logLine('Ahora, flujo del Cliente en desktop (chat BAMI).')

        // Permitir que el chat ejecute acciones reales
        window.__BAMI_AGENT_ACTIVE__ = false
        window.__BAMI_LOCK_TRACKER__ = false
        window.__BAMI_SUPPRESS_SIM_TRACKER__ = false

        // Asegurar que el chat esté visible/enfocado
        const input = await waitForTarget({
            selectors: ['input[aria-label="Mensaje para BAMI"]'],
            texts: [],
            kind: 'focus',
            timeout: 2500
        })
        if (input) {
            const cleanup = liftTarget(input)
            spotlightOn(input, 18)
            await moveToEl(input, 1.2)
            await showTip(input, 'Escribimos al chat del cliente.', 1200)
            spotlightOff(); cleanup()
        }

        // Type + Send (mensaje real para que procese el widget)
        const typeAndSend = async (text) => {
            const inp = await waitForTarget({ selectors: ['input[aria-label="Mensaje para BAMI"]'], kind:'focus', timeout: 1500 })
            const btn = await waitForTarget({ selectors: ['button[aria-label="Enviar mensaje"]'], kind:'click', timeout: 1500 })
            if (inp && btn) {
                const cleanupIn = liftTarget(inp); const cleanupBtn = liftTarget(btn)
                spotlightOn(inp, 16)
                await moveToEl(inp, 0.9)
                // set value programáticamente + evento input
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
                setter?.call(inp, text)
                inp.dispatchEvent(new Event('input', { bubbles: true }))
                spotlightOff()
                spotlightOn(btn, 16)
                await moveToEl(btn, 0.8)
                await clickEffect()
                btn.click()
                spotlightOff(); cleanupIn(); cleanupBtn()
                await wait(1000)
            } else {
                // fallback: push visual
                window.dispatchEvent(new CustomEvent('ui:msg', { detail: { role: 'user', text } }))
                await wait(800)
            }
        }

        await typeAndSend('Quiero aplicar a tarjeta de crédito')
        await wait(900)

        // Click en acción rápida "Subir docs"
        const clickByText = async (label) => {
            const target = await waitForTarget({
                selectors: [],
                texts: [label],
                kind: 'click',
                timeout: 2000
            })
            if (target) {
                const cleanup = liftTarget(target)
                spotlightOn(target, 16)
                await moveToEl(target, 0.9)
                await clickEffect()
                target.click()
                spotlightOff(); cleanup()
                await wait(900)
                return true
            }
            return false
        }

        await clickByText('Subir docs') || await clickByText('Subir documentos')
        // simular subida también en desktop
        window.dispatchEvent(new Event('ui:upload:demo'))
        await wait(1200)

        // Validar con IA (acciones rápidas)
        await clickByText('Validar IA')
        await wait(1600)

        // Conectar Asesor (acciones rápidas)
        await clickByText('Asesor')
        await wait(1000)

        logLine('Flujo de cliente completado.')
    }

    /* ------------------------------ Runners ------------------------------ */
    const showTipFor = async (el, text, kind) => {
        logLine(text)
        if (el && (kind === 'focus' || kind === 'click')) await showTip(el, text, 1300)
    }

    const runFocus = async (step) => {
        step?.before?.()
        const target = await waitForTarget({ ...(step.targets || {}), kind: 'focus' })
        if (target) {
            const cleanup = liftTarget(target)
            spotlightOn(target)
            await moveToEl(target)
            await showTipFor(target, step.say, 'focus')
            spotlightOff(); cleanup()
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
            const cleanup = liftTarget(target)
            spotlightOn(target)
            await moveToEl(target)
            await showTipFor(target, step.say, 'click')
            await clickEffect()
            try { // click visual + lógica extra del paso
                target.click?.()
                await Promise.resolve(step.run?.())
            } catch {}
            await wait(600)
            if (step.success && step.success()) { await Promise.resolve(step?.after?.()); spotlightOff(); cleanup(); return true }
            if (step.forceSuccessIfRun && step.run) { await Promise.resolve(step?.after?.()); spotlightOff(); cleanup(); return true }
            await Promise.resolve(step?.after?.())
            spotlightOff(); cleanup()
            return true
        }
        await showTipFor(null, step.say + ' (simulado)', 'click')
        try { await Promise.resolve(step.run?.()) } catch {}
        await Promise.resolve(step?.after?.())
        await wait(500)
        return true
    }

    const runSpeak = async (step) => { step?.before?.(); logLine(step.say); await Promise.resolve(step?.after?.()); await wait(700); return true }

    const runStep = async (step) => {
        if (step.type === 'click') return runClick(step)
        if (step.type === 'focus') return runFocus(step)
        return runSpeak(step)
    }

    const runDemo = async () => {
        if (running) return
        setRunning(true)
        logLine('Iniciando Autopilot…')

        // 🔒 Señales globales
        window.__BAMI_AGENT_ACTIVE__ = true
        window.__BAMI_DISABLE_FLOATING__ = true
        window.__BAMI_LOCK_TRACKER__ = true
        window.__BAMI_SUPPRESS_SIM_TRACKER__ = true
        window.dispatchEvent(new Event('sim:tracker:close'))

        try {
            for (const step of ROUTE) {
                await runStep(step)
                await wait(260)
            }

            // Esperar fin de tracker (con margen)
            await new Promise(resolve => {
                let done = false
                const h = () => { done = true; window.removeEventListener('bami:tracker:finished', h); resolve() }
                window.addEventListener('bami:tracker:finished', h)
                setTimeout(() => { if (!done) resolve() }, 1800)
            })

            // Inyectar lead al panel OPS
            try {
                window.dispatchEvent(new CustomEvent('bami:ops:ingestLead', { detail: { case: getCase?.() || null } }))
            } catch {}

            // Cerrar cosas de la primera parte (dejamos tracker visible si quieres)
            // closeEverything()  // si prefieres cerrar todo, descomenta

            // 👉 Arranca flujo de cliente en desktop (chat)
            await runClientFlow()

            logLine('Demo completa.')
        } finally {
            // Reset flags pero mantén cursor visible para próximas demos
            window.__BAMI_AGENT_ACTIVE__ = false
            window.__BAMI_DISABLE_FLOATING__ = false
            window.__BAMI_LOCK_TRACKER__ = false
            window.__BAMI_SUPPRESS_SIM_TRACKER__ = false
            setRunning(false)
        }
    }

    /* ------------------------------ UI / HUD ------------------------------ */
    const ControlBubble = (
        <div className="fixed right-4 bottom-4 z-[1999980]">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setOpen(v => !v)}
                    className="rounded-full shadow-lg border bg-white w-14 h-14 grid place-items-center"
                    aria-label="BAMI"
                    title="BAMI"
                >
                    <img src="/BAMI.svg" alt="BAMI" className="w-10 h-10 rounded-full" />
                </button>
                <button
                    onClick={() => runDemo()}
                    className="hidden sm:inline-flex items-center gap-2 px-3 h-14 rounded-full shadow-lg border bg-black text-white"
                    aria-label="Iniciar Autopilot"
                    title="Iniciar Autopilot"
                >
                    <Play size={16}/> Autopilot
                </button>
            </div>
        </div>
    )

    const Panel = (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="fixed right-4 bottom-24 z-[1999980] w-[min(92vw,380px)] rounded-2xl border bg-white shadow-2xl overflow-hidden"
                >
                    <div className="px-3 py-2 flex items-center justify-between border-b bg-gray-50">
                        <div className="flex items-center gap-2">
                            <img src="/BAMI.svg" alt="BAMI" className="w-5 h-5 rounded-full"/>
                            <div className="font-semibold text-sm">BAMI · Autopilot</div>
                        </div>
                        <button className="p-1 rounded hover:bg-gray-200" onClick={()=>setOpen(false)} aria-label="Cerrar">
                            <XIcon size={16}/>
                        </button>
                    </div>
                    <div className="p-3 text-xs text-gray-600 border-b">
                        <div className="flex items-center gap-2">
                            <Activity size={14}/> <span className="truncate">{insight}</span>
                        </div>
                    </div>
                    <div className="p-0">
                        <div ref={feedRef} className="max-h-64 overflow-auto px-3 py-2 space-y-1.5 text-sm">
                            {feed.map(f => (
                                <div key={f.id} className="text-gray-700">
                                    <span className="text-[11px] text-gray-500 mr-2">{new Date(f.t).toLocaleTimeString()}</span>
                                    {f.text}
                                </div>
                            ))}
                            {!feed.length && <div className="text-gray-500 text-sm">Sin eventos aún.</div>}
                        </div>
                    </div>
                    <div className="p-3 border-t flex items-center justify-between">
                        <button
                            className="btn btn-dark px-3 h-10 rounded-xl inline-flex items-center gap-2"
                            onClick={runDemo}
                            disabled={running}
                        >
                            <Play size={16}/> {running ? 'Ejecutando…' : 'Iniciar Autopilot'}
                        </button>
                        <div className="flex items-center gap-2 text-gray-500 text-xs">
                            <Bot size={14}/> <Sparkles size={14}/>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )

    const CursorLayer = portalRoot && (
        createPortal(
            <div id="bami-hud" className="pointer-events-none">
                {/* Spotlight anti-overlay */}
                <AnimatePresence>
                    {spot && (
                        <motion.div
                            key="spot"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0"
                            style={{
                                zIndex: Z.HUD,
                                background: 'rgba(0,0,0,0.50)',
                                WebkitMaskImage: `radial-gradient(circle ${spot.r}px at ${spot.x}px ${spot.y}px, transparent ${spot.r}px, white ${spot.r}px)`,
                                maskImage: `radial-gradient(circle ${spot.r}px at ${spot.x}px ${spot.y}px, transparent ${spot.r}px, white ${spot.r}px)`,
                                pointerEvents: 'none'
                            }}
                        />
                    )}
                </AnimatePresence>

                {/* Halo */}
                <AnimatePresence>
                    {halo && (
                        <motion.div
                            key={halo.key}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute rounded-xl ring-2 ring-yellow-300"
                            style={{
                                zIndex: Z.HALO,
                                left: halo.x - 4, top: halo.y - 4, width: halo.w + 8, height: halo.h + 8,
                                boxShadow: '0 0 0 6px rgba(255,212,0,0.15)',
                                pointerEvents: 'none'
                            }}
                        />
                    )}
                </AnimatePresence>

                {/* Tip */}
                <AnimatePresence>
                    {tip && (
                        <motion.div
                            key={tip.key}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            transition={{ duration: 0.2 }}
                            className="absolute max-w-[260px] p-2 rounded-lg bg-black text-white text-xs shadow-xl"
                            style={{ zIndex: Z.TIP, left: tip.x, top: tip.y }}
                        >
                            {tip.text}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Cursor */}
                <motion.div
                    className="bami-cursor-layer fixed w-5 h-5 rounded-full"
                    animate={{ x: cursor.x, y: cursor.y }}
                    transition={cursor.transition}
                    style={{ zIndex: Z.CURSOR, translateX: '-50%', translateY: '-50%' }}
                >
                    <div className="relative">
                        <div className="w-5 h-5 rounded-full bg-black shadow-[0_0_0_4px_rgba(0,0,0,0.2)]" />
                        <div className="absolute inset-0 grid place-items-center">
                            <MousePointer2 size={14} className="text-white opacity-90" />
                        </div>
                        <AnimatePresence>
                            {cursor.clicking && (
                                <motion.span
                                    key="ripple"
                                    initial={{ opacity: 0.7, scale: 0.4 }}
                                    animate={{ opacity: 0, scale: 2.1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.9, ease: 'ease-out' }}
                                    className="absolute inset-0 rounded-full border-2 border-yellow-300"
                                />
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>,
            portalRoot
        )
    )

    return (
        <>
            {ControlBubble}
            {Panel}
            {CursorLayer}
        </>
    )
}
