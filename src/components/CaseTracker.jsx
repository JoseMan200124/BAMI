// src/components/CaseTracker.jsx
// Fuerza avance en modo agente, llena línea de tiempo y coopera con el orquestador — ahora más lento y smooth.

import React, { useEffect, useRef, useState } from 'react'
import { getCase, refreshTracker } from '../lib/caseStore.js'
import StageTimeline from './StageTimeline.jsx'
import ProgressRing from './ProgressRing.jsx'

// Instala orquestador (cursor + autopilot + openTracker + lock)
import '../lib/uiOrchestrator.js'

function useGlobalTrackerPolling(active = true) {
    useEffect(() => {
        if (!active) return
        const g = (window.__BAMI_TRACKER_POLL ||= {
            subs: 0, inFlight: false, backoff: 1500, maxBackoff: 15000, timer: null, controller: null,
        })
        g.subs++
        const schedule = () => {
            if (g.subs <= 0) return
            clearTimeout(g.timer)
            g.timer = setTimeout(async () => {
                if (g.subs <= 0) return
                if (g.inFlight) { schedule(); return }
                g.inFlight = true
                g.controller?.abort()
                g.controller = new AbortController()
                try { await refreshTracker({ signal: g.controller.signal }); g.backoff = 1500 }
                catch { g.backoff = Math.min(g.backoff * 1.7, g.maxBackoff) }
                finally { g.inFlight = false; schedule() }
            }, g.backoff)
        }
        if (!g.timer) schedule()
        return () => {
            g.subs = Math.max(0, g.subs - 1)
            if (g.subs === 0) {
                clearTimeout(g.timer); g.timer = null
                g.controller?.abort(); g.controller = null
                g.inFlight = false; g.backoff = 1500
            }
        }
    }, [active])
}

export default function CaseTracker({ active = true }) {
    const [c, setC] = useState(getCase())
    const [sim, setSim] = useState({ on: false, stage: null, percent: null, missing: null })
    const timerRef = useRef(0)
    const watchdogRef = useRef(0)
    const startTsRef = useRef(0)

    // Pausar polling si hay demo
    useGlobalTrackerPolling(active && !sim.on)

    useEffect(() => {
        const onU = (e) => setC(e.detail)
        window.addEventListener('bami:caseUpdate', onU)
        return () => window.removeEventListener('bami:caseUpdate', onU)
    }, [])

    // Empuja al store y a la línea de tiempo
    const pushToStore = (step) => {
        try {
            const now = getCase() || {}
            const entry = { at: Date.now(), stage: step.stage, note: step.log || 'sim' }
            const next = {
                ...now,
                stage: step.stage,
                percent: step.percent,
                missing: step.missing || [],
                history: [...(now.history || []), entry],
                timeline: [...(now.timeline || []), entry],
            }
            window.dispatchEvent(new CustomEvent('bami:caseUpdate', { detail: next }))
        } catch {}
    }

    // ⏱️ Secuencia más lenta para que se note el paso entre etapas
    const stagesSequence = [
        { stage: 'requiere',    percent: 10,  delay: 1800, missing: ['dpi', 'selfie', 'comprobante_domicilio'], log: 'Expediente iniciado.' },
        { stage: 'recibido',    percent: 35,  delay: 2200, missing: ['selfie', 'comprobante_domicilio'],       log: 'Recepción confirmada.' },
        { stage: 'en_revision', percent: 70,  delay: 2600, missing: [],                                        log: 'En revisión operativa.' },
        { stage: 'aprobado',    percent: 100, delay: 2000, missing: [],                                        log: 'Autorizado.' },
    ]

    const runDemoFrom = (startStage) => {
        clearTimeout(timerRef.current)
        const idx0 = stagesSequence.findIndex(s => s.stage === (startStage || 'requiere'))
        const idx = Math.max(0, idx0 === -1 ? 0 : idx0)
        const steps = stagesSequence.slice(idx)
        if (!steps.length) return
        startTsRef.current = Date.now()

        setSim({ on: true, ...steps[0] })
        pushToStore(steps[0])

        let i = 1
        const next = () => {
            if (i >= steps.length) { setSim((s) => ({ ...s, on: false })); return }
            setSim((s) => ({ ...s, ...steps[i] }))
            pushToStore(steps[i])
            timerRef.current = window.setTimeout(next, steps[i].delay)
            i += 1
        }
        timerRef.current = window.setTimeout(next, steps[0].delay)
    }

    // Arranque de demo cuando el orquestador la pida (NO cerramos overlays aquí)
    useEffect(() => {
        const start = () => {
            const current = (getCase() || {}).stage || 'requiere'
            const p = (getCase() || {}).percent || 0
            if (current === 'requiere' && p <= 10) runDemoFrom('requiere')
            else runDemoFrom(current)
            try { window.dispatchEvent(new Event('bami:cursor:forceShow')) } catch {}
        }
        const stop = () => { clearTimeout(timerRef.current); setSim((s) => ({ ...s, on: false })) }

        window.addEventListener('bami:sim:runTracker', start)
        window.addEventListener('bami:agent:openTracker', start)
        window.addEventListener('bami:agent:showTracker', start)
        window.addEventListener('bami:agent:start', start)
        window.addEventListener('bami:sim:stop', stop)

        // Safety: si ya está abierto el modal al montar, arrancamos
        setTimeout(() => {
            const txt = (document.querySelector('[role="dialog"], [data-modal], .modal, .DialogContent')?.innerText || '').toLowerCase()
            if (txt.includes('seguimiento del expediente')) start()
        }, 300)

        return () => {
            window.removeEventListener('bami:sim:runTracker', start)
            window.removeEventListener('bami:agent:openTracker', start)
            window.removeEventListener('bami:agent:showTracker', start)
            window.removeEventListener('bami:agent:start', start)
            window.removeEventListener('bami:sim:stop', stop)
            clearTimeout(timerRef.current)
        }
    }, [])

    // ▶️ Soporte directo a simulación del agente (Recibido → En revisión → Aprobado)
    useEffect(() => {
        const onSim = () => {
            const cur = getCase() || {}
            const startStage = (cur.stage === 'requiere' && (cur.percent || 0) <= 10) ? 'recibido' : cur.stage
            runDemoFrom(startStage || 'recibido')
        }
        window.addEventListener('tracker:simulate:start', onSim)
        return () => window.removeEventListener('tracker:simulate:start', onSim)
    }, [])

    // Watchdog: si el agente está activo y el tracker se queda en 10% > 3s, relanza demo
    useEffect(() => {
        clearInterval(watchdogRef.current)
        watchdogRef.current = window.setInterval(() => {
            if (!window.__BAMI_AGENT_ACTIVE__) return
            const cc = getCase() || {}
            const stage = cc.stage || 'requiere'
            const pct = cc.percent || 0
            const openTxt = (document.querySelector('[data-agent-area="tracker"], [role="dialog"], [data-modal], .modal, .DialogContent')?.innerText || '').toLowerCase()
            const trackerOpen = openTxt.includes('seguimiento del expediente')
            const elapsed = Date.now() - (startTsRef.current || 0)
            if (trackerOpen && (stage === 'requiere' && pct <= 10) && elapsed > 3000) {
                runDemoFrom('recibido')
            }
        }, 800)
        return () => clearInterval(watchdogRef.current)
    }, [])

    if (!c) {
        return (
            <div className="card">
                <div className="flex items-center gap-2 mb-1">
                    <img src="/BAMI.svg" alt="BAMI" className="w-5 h-5 rounded-full" />
                    <div className="text-gray-700 font-semibold">Aún no hay expediente.</div>
                </div>
                <div className="text-sm text-gray-600">Inicia en la sección BAMI y verás aquí todo el progreso.</div>
            </div>
        )
    }

    const stageMap = { requiere: 10, recibido: 35, en_revision: 70, aprobado: 100, alternativa: 70, autorizado: 100 }
    const basePercent = stageMap[c.stage] ?? c.percent ?? 0
    const percent = sim.on && sim.percent != null ? sim.percent : basePercent
    const stage = sim.on && sim.stage ? sim.stage : c.stage
    const missing = sim.on && sim.missing ? sim.missing : c.missing || []
    const ap = c.applicant

    return (
        <div className="card">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                    <div className="text-xs text-gray-500">Expediente</div>
                    <div className="font-bold text-base sm:text-lg truncate">
                        {c.id} · {c.product}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">
                        Canal: <b className="uppercase">{c.channel}</b> · Owner: <b>{c.owner}</b>
                    </div>
                </div>
                <div className="shrink-0">
                    <ProgressRing value={percent} label={`${percent}%`} />
                </div>
            </div>

            <div className="mt-4 sm:mt-6">
                <StageTimeline stage={stage} history={c.history} timeline={c.timeline} />
            </div>

            <div className="mt-4 sm:mt-6 grid gap-3 sm:gap-4 sm:grid-cols-2">
                <div className="p-3 sm:p-4 bg-gray-50 rounded-xl">
                    <div className="font-semibold mb-2">Documentos pendientes</div>
                    {missing.length ? (
                        <div className="flex flex-wrap gap-2">
                            {missing.map((d) => (
                                <span key={d} className="px-2 py-1 rounded-full text-xs bg-white border capitalize">
                  {d.replaceAll('_', ' ')}
                </span>
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm text-emerald-700">No hay faltantes. ¡Podemos pasar a revisión!</div>
                    )}
                </div>

                <div className="p-3 sm:p-4 bg-gray-50 rounded-xl">
                    <div className="font-semibold mb-2">SLA y tiempos</div>
                    <div className="text-sm text-gray-600">
                        TTA estimado: <b>{c.ttaHours ?? 8}h</b>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">El tiempo se ajusta según carga operativa y validaciones.</div>
                </div>
            </div>

            {ap && (
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-xl">
                    <div className="font-semibold mb-2">Solicitante</div>
                    <div className="text-sm text-gray-700">
                        <b>{ap.name}</b> · DPI {ap.dpi} · {ap.email} · {ap.phone}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        Dirección: {ap.address} · Ingresos: Q{ap.income}
                        {ap.businessName ? ` · Negocio: ${ap.businessName}` : ''}
                    </div>
                </div>
            )}
        </div>
    )
}
