// src/components/CaseTracker.jsx
// Secuencia visible: requiere (10) → recibido (35) → en_revision (70) → aprobado (100).
// Blindajes anti-freeze: no permite simulaciones en paralelo ni timers huérfanos.

import React, { useEffect, useRef, useState } from 'react'
import { getCase, refreshTracker } from '../lib/caseStore.js'
import StageTimeline from './StageTimeline.jsx'
import ProgressRing from './ProgressRing.jsx'
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
    const runningRef = useRef(false)
    const lastPercentRef = useRef(0)

    useGlobalTrackerPolling(active && !sim.on)

    useEffect(() => {
        const onU = (e) => setC(e.detail)
        window.addEventListener('bami:caseUpdate', onU)
        return () => window.removeEventListener('bami:caseUpdate', onU)
    }, [])

    const pushToStore = (step) => {
        try {
            const now = getCase() || {}
            const curPct = now.percent ?? 0
            const newPct = step.percent ?? curPct
            if (newPct < curPct) return

            const entry = { at: Date.now(), stage: step.stage, note: step.log || 'sim' }
            const next = {
                ...now,
                stage: step.stage,
                percent: newPct,
                missing: step.missing ?? now.missing ?? [],
                history: [...(now.history || []), entry],
                timeline: [...(now.timeline || []), entry],
            }
            lastPercentRef.current = newPct
            window.dispatchEvent(new CustomEvent('bami:caseUpdate', { detail: next }))
        } catch {}
    }

    const stagesSequence = [
        { stage: 'requiere',    percent: 10,  delay: 420,  missing: ['dpi', 'selfie', 'comprobante_domicilio'], log: 'Expediente iniciado.' },
        { stage: 'recibido',    percent: 35,  delay: 640,  missing: ['selfie', 'comprobante_domicilio'],       log: 'Recepción confirmada.' },
        { stage: 'en_revision', percent: 70,  delay: 820,  missing: [],                                        log: 'En revisión operativa.' },
        { stage: 'aprobado',    percent: 100, delay: 620,  missing: [],                                        log: 'Autorizado.' },
    ]

    const runDemo = () => {
        if (runningRef.current) return
        clearTimeout(timerRef.current)

        const startIdx = Math.max(0, stagesSequence.findIndex(s => (c?.percent ?? 0) < s.percent))
        const steps = stagesSequence.slice(startIdx)
        if (!steps.length) return

        runningRef.current = true
        setSim({ on: true, ...steps[0] })
        pushToStore(steps[0])

        let i = 1
        const next = () => {
            if (i >= steps.length) {
                setSim(s => ({ ...s, on: false }))
                runningRef.current = false
                return
            }
            setSim(s => ({ ...s, ...steps[i] }))
            pushToStore(steps[i])
            timerRef.current = window.setTimeout(next, steps[i].delay)
            i++
        }
        timerRef.current = window.setTimeout(next, steps[0].delay)
    }

    useEffect(() => {
        const onSim = (e) => { runDemo() }
        window.addEventListener('tracker:simulate:start', onSim)
        return () => {
            window.removeEventListener('tracker:simulate:start', onSim)
            clearTimeout(timerRef.current)
            runningRef.current = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [c?.percent])

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
    const percent = sim.on && sim.percent != null ? sim.percent : Math.max(basePercent, lastPercentRef.current || 0)
    const stage = sim.on && sim.stage ? sim.stage : c.stage
    const missing = sim.on && sim.missing ? sim.missing : c.missing || []
    const ap = c.applicant

    return (
        <div className="card" data-agent-area="tracker">
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
