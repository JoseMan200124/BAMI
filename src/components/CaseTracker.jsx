// src/components/CaseTracker.jsx
import React, { useEffect, useState } from 'react'
import { getCase, refreshTracker } from '../lib/caseStore.js'
import StageTimeline from './StageTimeline.jsx'
import ProgressRing from './ProgressRing.jsx'

export default function CaseTracker() {
    const [c, setC] = useState(getCase())

    useEffect(() => {
        const onU = (e) => setC(e.detail)
        window.addEventListener('bami:caseUpdate', onU)
        return () => window.removeEventListener('bami:caseUpdate', onU)
    }, [])

    useEffect(() => {
        let t
        const tick = async () => {
            if (getCase()) await refreshTracker()
            t = setTimeout(tick, 4000)
        }
        tick()
        return () => clearTimeout(t)
    }, [])

    if (!c) {
        return (
            <div className="card">
                <div className="text-gray-700 font-semibold mb-1">Aún no hay expediente.</div>
                <div className="text-sm text-gray-600">
                    Inicia en la sección BAMI y verás aquí todo el progreso.
                </div>
            </div>
        )
    }

    const stageMap = { requiere: 10, recibido: 35, en_revision: 70, aprobado: 100, alternativa: 70 }
    const percent = stageMap[c.stage] ?? c.percent ?? 0
    const missing = c.missing || []
    const ap = c.applicant

    return (
        <div className="card">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                    <div className="text-xs text-gray-500">Expediente</div>
                    <div className="font-bold text-base sm:text-lg truncate">{c.id} · {c.product}</div>
                    <div className="text-xs sm:text-sm text-gray-600">
                        Canal: <b className="uppercase">{c.channel}</b> · Owner: <b>{c.owner}</b>
                    </div>
                </div>
                <div className="shrink-0">
                    <ProgressRing value={percent} label={`${percent}%`} />
                </div>
            </div>

            <div className="mt-4 sm:mt-6">
                <StageTimeline stage={c.stage} history={c.history} timeline={c.timeline} />
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
                    <div className="text-xs text-gray-500 mt-1">
                        El tiempo se ajusta según carga operativa y validaciones.
                    </div>
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
