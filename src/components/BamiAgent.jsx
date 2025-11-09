// src/components/BamiAgent.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Sparkles, MousePointer2, Activity } from 'lucide-react'

/**
 * BAMI Agent — Autopilot minimalista y estable
 * - NO abre el chat.
 * - Simula subida (upload:demo) y lanza la simulación del tracker hasta "aprobado".
 * - Abre el tracker y lo mantiene visible (el uiOrchestrator se encarga de reabrir si se cierra).
 * - Opcional: abre el simulador móvil si quieres reforzar la vista del cliente (no abre chat).
 */

const wait = (ms) => new Promise(r => setTimeout(r, ms))

export default function BamiAgent({ caseData, product, controls }) {
    const [running, setRunning] = useState(false)
    const [log, setLog] = useState([])
    const feedRef = useRef(null)

    const insight = useMemo(() => {
        const p = []
        if (caseData) {
            p.push(`Caso ${caseData.id?.slice(0,6) || 'nuevo'} · ${caseData.product} · etapa: ${caseData.stage}`)
            if ((caseData.missing || []).length) p.push(`Faltan ${caseData.missing.length} doc(s)`)
        } else {
            p.push(`Sin caso activo · producto: ${product || '—'}`)
        }
        return p.join(' | ')
    }, [caseData, product])

    useEffect(() => {
        if (!feedRef.current) return
        feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
    }, [log])

    const add = (t) => setLog((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, t: new Date(), text: t }])

    const simulateTracker = async () => {
        // Señal nativa del tracker
        try {
            window.dispatchEvent(new CustomEvent('tracker:simulate:start', {
                detail: {
                    timeline: [
                        { key: 'recibido',  label: 'Documentos recibidos', delayMs: 600 },
                        { key: 'en_revision', label: 'En revisión (IA/ops)', delayMs: 1100 },
                        { key: 'aprobado',  label: 'Aprobado', delayMs: 900, final: true },
                    ]
                }
            }))
        } catch {}
        // Compatibilidad legacy
        try { window.dispatchEvent(new Event('bami:sim:runTracker')) } catch {}
    }

    const run = async () => {
        if (running) return
        setRunning(true)
        setLog([])

        try {
            add('Autopilot: Iniciando flujo…')

            // (Opcional) Muestra el simulador de app del cliente (NO abre el chat)
            add('Abriendo simulador de App (cliente)…')
            try { controls?.openSimulator?.() } catch {}
            await wait(400)

            // Crear expediente
            add('Creando expediente…')
            await Promise.resolve(controls?.start?.())
            await wait(300)

            // Abrir tracker (y mantenerlo visible, el orquestador lo reabrirá si lo cierran)
            add('Abriendo tracker…')
            try {
                window.dispatchEvent(new Event('bami:agent:openTracker'))
                controls?.openTracker?.()
            } catch {}
            await wait(300)

            // Abrir asistente de subida SIN abrir el chat
            add('Abriendo asistente de subida (sin chat)…')
            await Promise.resolve(controls?.openUploadSilently?.())
            await wait(350)

            // Simular arrastre y subida de archivos (animación visible)
            add('Simulando subida de documentos…')
            try {
                window.dispatchEvent(new Event('upload:demo'))
                window.dispatchEvent(new Event('ui:upload:demo'))
                window.dispatchEvent(new Event('sim:upload:demo'))
            } catch {}
            await wait(1200)

            // Reforzar apertura de tracker y lanzar simulación de avance
            add('Mostrando progreso en tracker → hasta aprobado…')
            try {
                window.dispatchEvent(new Event('bami:agent:showTracker'))
                controls?.openTracker?.()
            } catch {}
            await wait(300)
            await simulateTracker()
            await wait(2000)

            add('Validación automática y métricas listas (vista Ops llena).')
            // (Opcional) puedes acá disparar validaciones si deseas:
            // window.dispatchEvent(new Event('ui:validate'))

            add('Autopilot: Flujo completado.')
        } finally {
            setRunning(false)
        }
    }

    return (
        <>
            {/* Botón flotante del Autopilot */}
            <div
                className="fixed z-[95] right-4 bottom-4 flex flex-col items-end gap-2"
                style={{ pointerEvents: 'auto' }}
                aria-live="polite"
            >
                <div className="rounded-2xl border bg-white shadow-lg w-[300px] max-h-[38vh] overflow-hidden hidden md:flex">
                    <div className="w-1 bg-bami-yellow" />
                    <div className="flex-1 min-w-0">
                        <div className="px-3 py-2 border-b flex items-center gap-2 text-sm font-semibold">
                            <Activity size={16} /> Autopilot · BAMI
                        </div>
                        <div ref={feedRef} className="p-2 space-y-1.5 text-xs overflow-auto leading-5" style={{ maxHeight: '30vh' }}>
                            <div className="text-[11px] text-gray-500">{insight}</div>
                            {log.map(item => (
                                <div key={item.id} className="flex items-start gap-2">
                                    <span className="mt-[3px] w-1.5 h-1.5 rounded-full bg-bami-yellow shrink-0" />
                                    <span className="min-w-0">{item.text}</span>
                                </div>
                            ))}
                            {!log.length && <div className="text-gray-500">Pulsa Autopilot para iniciar la demostración.</div>}
                        </div>
                    </div>
                </div>

                <button
                    onClick={run}
                    disabled={running}
                    className={`btn ${running ? 'opacity-60 cursor-not-allowed' : 'btn-dark'} h-12 px-4 rounded-full shadow-xl inline-flex items-center gap-2`}
                    aria-label="Iniciar Autopilot"
                    title="Iniciar Autopilot"
                >
                    <Bot size={16} />
                    <span>Autopilot</span>
                    <Sparkles size={16} />
                </button>
            </div>

            {/* Cursor sutil fijo (indicador, no interactivo) */}
            <div className="fixed left-4 bottom-4 z-[94] hidden sm:flex items-center gap-2 text-xs text-gray-600">
                <MousePointer2 size={14} />
                <span>El cursor guiado se mostrará durante la demo.</span>
            </div>
        </>
    )
}
