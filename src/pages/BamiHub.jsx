// src/pages/BamiHub.jsx
import React, { useEffect, useMemo, useState } from 'react'
import CaseTracker from '../components/CaseTracker.jsx'
import BamiChatWidget from '../components/BamiChatWidget.jsx'
import RequestForm from '../components/RequestForm.jsx'
import { PRODUCT_RULES, createNewCase, getCase, notify } from '../lib/caseStore.js'
import BamOpsPanel from '../components/BamOpsPanel.jsx'
import BamMobileSimulator from '../components/BamMobileSimulator.jsx'
import BamiAgent from '../components/BamiAgent.jsx'

export default function BamiHub() {
    const [c, setC] = useState(getCase())
    const [product, setProduct] = useState('Tarjeta de Crédito')

    const [showTracker, setShowTracker] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [showMobile, setShowMobile] = useState(false)
    const [viewMode, setViewMode] = useState('both') // both | client | ops

    // Manejar vh móvil
    useEffect(() => {
        const setVH = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
        setVH()
        window.addEventListener('resize', setVH)
        return () => window.removeEventListener('resize', setVH)
    }, [])

    useEffect(() => {
        const onU = (e) => setC(e.detail)

        // 🚫 Respeta el cierre del usuario
        const onTrackerOpen = () => {
            const userClosed = window.__BAMI_USER_CLOSED_TRACKER__
            // Si el usuario cerró hace menos de 2.5s y NO está el Autopilot activo, no lo reabrimos
            if (userClosed && (Date.now() - userClosed < 2500) && !window.__BAMI_AGENT_ACTIVE__) return
            setShowTracker(true)
        }
        const onTrackerToggle = () => setShowTracker(v => !v)
        const onTrackerClose = () => setShowTracker(false)

        const onFormOpen = () => setShowForm(true)
        const onSimClose = () => setShowMobile(false)

        const onCloseAll = () => {
            setShowTracker(false)
            setShowForm(false)
            setShowMobile(false)
            window.dispatchEvent(new Event('ui:upload:close'))
            window.dispatchEvent(new Event('upload:close'))
            window.dispatchEvent(new Event('sim:tracker:close'))
            window.dispatchEvent(new Event('sim:ops:close'))
        }

        window.addEventListener('bami:caseUpdate', onU)
        window.addEventListener('ui:tracker:open', onTrackerOpen)
        window.addEventListener('ui:tracker:toggle', onTrackerToggle)
        window.addEventListener('ui:tracker:close', onTrackerClose)
        window.addEventListener('ui:form:open', onFormOpen)
        window.addEventListener('ui:sim:close', onSimClose)
        window.addEventListener('ui:closeAll', onCloseAll)

        return () => {
            window.removeEventListener('bami:caseUpdate', onU)
            window.removeEventListener('ui:tracker:open', onTrackerOpen)
            window.removeEventListener('ui:tracker:toggle', onTrackerToggle)
            window.removeEventListener('ui:tracker:close', onTrackerClose)
            window.removeEventListener('ui:form:open', onFormOpen)
            window.removeEventListener('ui:sim:close', onSimClose)
            window.removeEventListener('ui:closeAll', onCloseAll)
        }
    }, [])

    // Acciones
    const start = async () => {
        const cc = await createNewCase(product)
        notify('Expediente creado')
        setC(cc); setShowTracker(true)
    }
    const reopen = async () => {
        const prevApplicant = getCase()?.applicant || null
        const cc = await createNewCase(product, prevApplicant)
        notify('Proceso reabierto')
        setC(cc); setShowTracker(true)
    }

    // ⛔ En Autopilot no abrimos el chat flotante
    const openUploadEverywhere = () => {
        const prefix = showMobile ? 'sim' : 'ui'
        const isAutopilot = typeof window !== 'undefined' && window.__BAMI_AGENT_ACTIVE__ === true
        if (!isAutopilot) {
            window.dispatchEvent(new Event(`${prefix}:open`))
        }
        window.dispatchEvent(new Event(`${prefix}:upload`))
        window.dispatchEvent(new Event('upload:open'))
    }

    const validateEverywhere = () => {
        const p = showMobile ? 'sim' : 'ui'
        window.dispatchEvent(new Event(`${p}:validate`))
    }
    const advisorEverywhere = () => {
        const p = showMobile ? 'sim' : 'ui'
        window.dispatchEvent(new Event(`${p}:advisor`))
    }

    const nextCTA = useMemo(() => {
        if (!c) return { id: 'create', label: 'Crear expediente', action: () => start() }
        if ((c.missing || []).length > 0)
            return { id: 'upload', label: `Subir ${c.missing.length} documento(s)`, action: () => openUploadEverywhere() }
        if (c.stage !== 'aprobado')
            return { id: 'validate', label: 'Validar con IA', action: () => validateEverywhere() }
        return { id: 'advisor', label: 'Hablar con asesor', action: () => advisorEverywhere() }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [c, product, showMobile])

    const DesktopTwoColumns = (
        <div className="grid lg:grid-cols-2 gap-4">
            {/* CLIENTE */}
            <section className="rounded-2xl border shadow-sm overflow-hidden bg-white">
                <div className="px-3 sm:px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="/BAMI.svg" alt="BAMI" className="w-6 h-6 rounded-full ring-1 ring-yellow-300" />
                        <h2 className="font-semibold">Área Cliente · BAMI</h2>
                    </div>
                    <div className="hidden md:flex items-center gap-2">
                        <button
                            data-agent-id="btn-simular"
                            className="btn btn-sm whitespace-nowrap"
                            onClick={() => {
                                setShowMobile(true)
                                setTimeout(() => window.dispatchEvent(new Event('sim:open')), 80)
                            }}
                        >
                            Simular App
                        </button>
                    </div>
                </div>
                <BamiChatWidget variant="fullscreen" disableFloatingTrigger={true} allowOpsButton={false} />
            </section>

            {/* OPS */}
            <aside
                data-agent-area="panel-bam-ops"
                className="rounded-2xl border shadow-sm overflow-hidden bg-white flex flex-col"
            >
                <div className="px-3 sm:px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
                    <div className="font-semibold">Área BAM · Ops</div>
                    <div className="flex items-center gap-2">
                        <button
                            data-agent-id="btn-tracker"
                            className="btn btn-sm whitespace-nowrap"
                            onClick={() => setShowTracker(true)}
                        >
                            Abrir tracker
                        </button>
                        <button className="btn btn-sm whitespace-nowrap" onClick={() => setShowForm(true)}>Nuevo caso</button>
                    </div>
                </div>
                <div className="p-3 sm:p-4 overflow-auto" style={{ height: 'calc(100svh - 240px)' }}>
                    <BamOpsPanel />
                </div>
            </aside>
        </div>
    )

    return (
        <main className="min-h-[100svh] bg-neutral-50 flex flex-col">
            {/* HEADER */}
            <header className="sticky top-0 z-[60] backdrop-blur bg-white/85 border-b">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <img src="/BAMI.svg" alt="BAMI" className="w-6 h-6 rounded-full ring-1 ring-yellow-300 shrink-0" />
                        <div className="text-base sm:text-lg font-extrabold tracking-tight truncate">
                            BAMI · Cliente & BAM · Ops
                        </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 flex-nowrap overflow-x-auto whitespace-nowrap pl-2" style={{ scrollbarWidth: 'none' }}>
                        <select
                            className="border rounded-xl px-3 py-1.5 text-sm"
                            value={product}
                            onChange={(e) => setProduct(e.target.value)}
                            aria-label="Producto"
                        >
                            {Object.keys(PRODUCT_RULES).map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>

                        <div className="flex items-center gap-1 border rounded-xl p-1">
                            {[
                                ['both', 'Ambos'],
                                ['client', 'Cliente'],
                                ['ops', 'BAM Ops'],
                            ].map(([v, l]) => (
                                <button
                                    key={v}
                                    onClick={() => setViewMode(v)}
                                    className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === v ? 'bg-black text-white' : 'hover:bg-gray-50'}`}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2 flex-nowrap">
                            <button
                                data-agent-id="btn-simular-top"
                                className="btn h-9 px-3 whitespace-nowrap"
                                onClick={() => {
                                    setShowMobile(true)
                                    setTimeout(() => window.dispatchEvent(new Event('sim:open')), 80)
                                }}
                            >
                                Simular App
                            </button>

                            <button
                                data-agent-id="btn-crear-expediente"
                                className="btn btn-dark h-9 whitespace-nowrap"
                                onClick={start}
                            >
                                Crear expediente
                            </button>

                            <button
                                data-agent-id="btn-tracker-top"
                                className="btn h-9 px-3 whitespace-nowrap"
                                onClick={() => setShowTracker(true)}
                            >
                                Tracker
                            </button>

                            <button
                                data-agent-id="btn-reabrir"
                                className="btn h-9 px-3 whitespace-nowrap"
                                onClick={reopen}
                            >
                                Reabrir
                            </button>
                        </div>
                    </div>
                </div>

                {/* Franja recomendación */}
                <div className="border-t bg-yellow-50/70">
                    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 text-sm flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-gray-700 min-w-0">
                            <span className="text-xs text-gray-600 mr-2">Siguiente paso</span>
                            <b className="whitespace-nowrap">Te recomendamos: {nextCTA.label}</b>
                        </div>
                        <div className="flex items-center gap-2 flex-nowrap">
                            <button
                                data-agent-id="btn-recomendado"
                                className="btn btn-dark btn-sm shrink-0 whitespace-nowrap"
                                onClick={nextCTA.action}
                            >
                                {nextCTA.label}
                            </button>
                            <button
                                data-agent-id="btn-continuar"
                                className="btn btn-sm shrink-0 whitespace-nowrap"
                                onClick={nextCTA.action}
                            >
                                Continuar
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* CONTENIDO */}
            <section className="flex-1">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-6">
                    {viewMode === 'both' && (<>{DesktopTwoColumns}</>)}
                    {viewMode === 'client' && (
                        <section className="rounded-2xl border shadow-sm overflow-hidden bg-white">
                            <div className="px-3 sm:px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <img src="/BAMI.svg" alt="BAMI" className="w-6 h-6 rounded-full ring-1 ring-yellow-300" />
                                    <h2 className="font-semibold">Área Cliente · BAMI</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        data-agent-id="btn-simular-client"
                                        className="btn btn-sm whitespace-nowrap"
                                        onClick={() => {
                                            setShowMobile(true)
                                            setTimeout(() => window.dispatchEvent(new Event('sim:open')), 80)
                                        }}
                                    >
                                        Simular App
                                    </button>
                                    <button className="btn btn-dark btn-sm whitespace-nowrap" onClick={openUploadEverywhere}>
                                        Subir documentos
                                    </button>
                                </div>
                            </div>
                            <BamiChatWidget variant="fullscreen" disableFloatingTrigger={true} allowOpsButton={false} />
                        </section>
                    )}
                    {viewMode === 'ops' && (
                        <aside data-agent-area="panel-bam-ops" className="rounded-2xl border shadow-sm overflow-hidden bg-white">
                            <div className="px-3 sm:px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
                                <div className="font-semibold">Área BAM · Ops</div>
                                <div className="flex items-center gap-2">
                                    <button className="btn btn-sm whitespace-nowrap" onClick={() => setShowTracker(true)}>Abrir tracker</button>
                                    <button className="btn btn-sm whitespace-nowrap" onClick={() => setShowForm(true)}>Nuevo caso</button>
                                </div>
                            </div>
                            <div className="p-3 sm:p-4"><BamOpsPanel /></div>
                        </aside>
                    )}
                </div>
            </section>

            {/* Simulador */}
            {showMobile && (
                <BamMobileSimulator open={showMobile} onClose={() => setShowMobile(false)} />
            )}

            {/* MODAL Tracker */}
            {showTracker && !showMobile && (
                <div className="fixed inset-0 z-[70]">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => { window.__BAMI_USER_CLOSED_TRACKER__ = Date.now(); setShowTracker(false) }}
                    />
                    <div className="absolute left-1/2 -translate-x-1/2 top-2 sm:top-4 w-[96vw] max-w-5xl">
                        <div className="card border shadow-2xl rounded-2xl overflow-hidden max-h-[90svh]">
                            <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-gray-50 border-b">
                                <div className="flex items-center gap-2 text-sm font-semibold">
                                    <img src="/BAMI.svg" alt="BAMI" className="w-5 h-5 rounded-full" />
                                    <span>Seguimiento del expediente</span>
                                </div>
                                <button className="btn" onClick={() => { window.__BAMI_USER_CLOSED_TRACKER__ = Date.now(); setShowTracker(false) }}>Cerrar</button>
                            </div>
                            <div className="p-3 sm:p-4 overflow-auto">
                                <CaseTracker active={true} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL Form */}
            {showForm && !showMobile && (
                <div className="fixed inset-0 z-[70] grid place-items-center p-3 sm:p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
                    <div className="card w-full max-w-3xl relative z-[71] max-h-[90svh] overflow-auto">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="h3 flex items-center gap-2">
                                <img src="/BAMI.svg" alt="BAMI" className="w-6 h-6 rounded-full" />
                                <span>Completa tus datos</span>
                            </h3>
                            <button className="btn" onClick={() => setShowForm(false)}>Cerrar</button>
                        </div>
                        <RequestForm product={product} onCreated={() => setShowForm(false)} />
                    </div>
                </div>
            )}

            {/* HUD del agente */}
            <BamiAgent
                caseData={c}
                product={product}
                controls={{
                    start,
                    reopen,
                    openUploadEverywhere,
                    validateEverywhere,
                    advisorEverywhere,
                    openTracker: () => setShowTracker(true),
                    openSimulator: () => { setShowMobile(true); setTimeout(() => window.dispatchEvent(new Event('sim:open')), 80) },
                }}
            />
        </main>
    )
}
