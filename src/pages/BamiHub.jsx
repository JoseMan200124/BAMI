// src/pages/BamiHub.jsx
import React, { useEffect, useMemo, useState } from 'react'
import CaseTracker from '../components/CaseTracker.jsx'
import BamiChatWidget from '../components/BamiChatWidget.jsx'
import RequestForm from '../components/RequestForm.jsx'
import { PRODUCT_RULES, createNewCase, getCase, notify } from '../lib/caseStore.js'
import BamOpsPanel from '../components/BamOpsPanel.jsx'
import BamiMascot from '../components/BamiMascot.jsx'
import BamMobileSimulator from '../components/BamMobileSimulator.jsx'

export default function BamiHub() {
    const [c, setC] = useState(getCase())
    const [product, setProduct] = useState('Tarjeta de Crédito')

    const [showTracker, setShowTracker] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [showSpotlight, setShowSpotlight] = useState(null)

    const [showMobile, setShowMobile] = useState(false)
    const [viewMode, setViewMode] = useState('both') // both | client | ops

    useEffect(() => {
        window.__BAMI_DISABLE_FLOATING__ = true
        return () => { delete window.__BAMI_DISABLE_FLOATING__ }
    }, [])

    useEffect(() => {
        const setVH = () =>
            document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
        setVH()
        window.addEventListener('resize', setVH)
        return () => window.removeEventListener('resize', setVH)
    }, [])

    useEffect(() => {
        const onU = (e) => setC(e.detail)

        const onTrackerOpen = () => setShowTracker(true)
        const onTrackerToggle = () => setShowTracker(v => !v)
        const onFormOpen = () => setShowForm(true)
        const onSpot = () => setShowSpotlight(true)

        const onSimTrackerOpen = () => setShowTracker(true)
        const onSimTrackerToggle = () => setShowTracker(v => !v)

        window.addEventListener('bami:caseUpdate', onU)

        window.addEventListener('ui:tracker:open', onTrackerOpen)
        window.addEventListener('ui:tracker:toggle', onTrackerToggle)
        window.addEventListener('ui:form:open', onFormOpen)
        window.addEventListener('ui:showMascotSpotlight', onSpot)

        window.addEventListener('sim:tracker:open', onSimTrackerOpen)
        window.addEventListener('sim:tracker:toggle', onSimTrackerToggle)

        return () => {
            window.removeEventListener('bami:caseUpdate', onU)

            window.removeEventListener('ui:tracker:open', onTrackerOpen)
            window.removeEventListener('ui:tracker:toggle', onTrackerToggle)
            window.removeEventListener('ui:form:open', onFormOpen)
            window.removeEventListener('ui:showMascotSpotlight', onSpot)

            window.removeEventListener('sim:tracker:open', onSimTrackerOpen)
            window.removeEventListener('sim:tracker:toggle', onSimTrackerToggle)
        }
    }, [])

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

    // Disparador robusto del modal de subida (envía ui:upload, sim:upload y upload:open)
    const openUploadEverywhere = () => {
        const prefix = showMobile ? 'sim' : 'ui'
        window.dispatchEvent(new Event(`${prefix}:open`))
        window.dispatchEvent(new Event(`${prefix}:upload`))
        window.dispatchEvent(new Event('upload:open')) // canal neutro
    }

    const nextCTA = useMemo(() => {
        if (!c) return { label: 'Crear expediente', action: () => start() }
        if ((c.missing || []).length > 0)
            return { label: `Subir ${c.missing.length} documento(s)`, action: () => openUploadEverywhere() }
        if (c.stage !== 'aprobado')
            return { label: 'Validar con IA', action: () => { const p = showMobile ? 'sim' : 'ui'; window.dispatchEvent(new Event(`${p}:validate`)) } }
        return { label: 'Hablar con asesor', action: () => { const p = showMobile ? 'sim' : 'ui'; window.dispatchEvent(new Event(`${p}:advisor`)) } }
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
                        <button className="btn btn-sm" onClick={() => setShowMobile(true)}>Simular App</button>
                    </div>
                </div>
                <BamiChatWidget variant="fullscreen" disableFloatingTrigger allowOpsButton={false} />
            </section>

            {/* OPS */}
            <aside className="rounded-2xl border shadow-sm overflow-hidden bg-white flex flex-col">
                <div className="px-3 sm:px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
                    <div className="font-semibold">Área BAM · Ops</div>
                    <div className="flex items-center gap-2">
                        <button className="btn btn-sm" onClick={() => setShowTracker(true)}>Abrir tracker</button>
                        <button className="btn btn-sm" onClick={() => setShowForm(true)}>Nuevo caso</button>
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
                        <div className="text-base sm:text-lg font-extrabold tracking-tight truncate">BAMI · Cliente & BAM · Ops</div>
                    </div>

                    <div className="hidden sm:flex items-center justify-end gap-2 gap-y-2 flex-wrap overflow-x-auto">
                        <select
                            className="border rounded-xl px-3 py-1.5 text-sm"
                            value={product}
                            onChange={(e) => setProduct(e.target.value)}
                            aria-label="Producto"
                        >
                            {Object.keys(PRODUCT_RULES).map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>

                        <div className="hidden lg:flex items-center gap-1 border rounded-xl p-1">
                            {[
                                ['both', 'Ambos'],
                                ['client', 'Cliente'],
                                ['ops', 'BAM Ops'],
                            ].map(([v, l]) => (
                                <button key={v}
                                        onClick={() => setViewMode(v)}
                                        className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === v ? 'bg-black text-white' : 'hover:bg-gray-50'}`}>
                                    {l}
                                </button>
                            ))}
                        </div>

                        <button className="btn h-9 px-3" onClick={() => setShowMobile(true)}>Simular App</button>
                        <button className="btn btn-dark h-9" onClick={start}>Crear expediente</button>
                        <button className="btn h-9 px-3" onClick={() => setShowTracker(true)}>Tracker</button>
                        <button className="btn h-9 px-3" onClick={reopen}>Reabrir</button>
                        <button className="btn btn-dark h-9 px-3" onClick={nextCTA.action}>{nextCTA.label}</button>
                    </div>
                </div>

                {/* CTA + móvil */}
                <div className="border-t bg-yellow-50/70">
                    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-gray-700">
                            <span className="text-xs text-gray-600 mr-2">Siguiente paso</span>
                            <b>Te recomendamos: {nextCTA.label}</b>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="flex sm:hidden grow">
                                <select
                                    className="border rounded-xl px-3 py-1.5 text-sm w-full"
                                    value={product}
                                    onChange={(e) => setProduct(e.target.value)}
                                    aria-label="Producto"
                                >
                                    {Object.keys(PRODUCT_RULES).map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>

                            <div className="flex lg:hidden items-center gap-1 border rounded-xl p-1">
                                {[
                                    ['both', 'Ambos'],
                                    ['client', 'Cliente'],
                                    ['ops', 'BAM Ops'],
                                ].map(([v, l]) => (
                                    <button key={v}
                                            onClick={() => setViewMode(v)}
                                            className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === v ? 'bg-black text-white' : 'hover:bg-gray-50'}`}>
                                        {l}
                                    </button>
                                ))}
                            </div>

                            <button className="btn btn-dark btn-sm shrink-0" onClick={nextCTA.action}>Continuar</button>
                            <button className="btn btn-sm shrink-0 sm:hidden" onClick={() => setShowTracker(true)}>Tracker</button>
                            <button className="btn btn-sm shrink-0 sm:hidden" onClick={() => setShowMobile(true)}>Simular App</button>
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
                                    <button className="btn btn-sm" onClick={() => setShowMobile(true)}>Simular App</button>
                                    <button className="btn btn-dark btn-sm" onClick={openUploadEverywhere}>Subir documentos</button>
                                </div>
                            </div>
                            <BamiChatWidget variant="fullscreen" disableFloatingTrigger allowOpsButton={false} />
                        </section>
                    )}

                    {viewMode === 'ops' && (
                        <aside className="rounded-2xl border shadow-sm overflow-hidden bg-white">
                            <div className="px-3 sm:px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
                                <div className="font-semibold">Área BAM · Ops</div>
                                <div className="flex items-center gap-2">
                                    <button className="btn btn-sm" onClick={() => setShowTracker(true)}>Abrir tracker</button>
                                    <button className="btn btn-sm" onClick={() => setShowForm(true)}>Nuevo caso</button>
                                </div>
                            </div>
                            <div className="p-3 sm:p-4">
                                <BamOpsPanel />
                            </div>
                        </aside>
                    )}
                </div>
            </section>

            {/* Simulador móvil */}
            {showMobile && (
                <BamMobileSimulator open={showMobile} onClose={() => setShowMobile(false)} />
            )}

            {/* MODALES DESKTOP */}
            {showTracker && !showMobile && (
                <div className="fixed inset-0 z-[70]">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowTracker(false)} />
                    <div className="absolute left-1/2 -translate-x-1/2 top-2 sm:top-4 w-[96vw] max-w-5xl">
                        <div className="card border shadow-2xl rounded-2xl overflow-hidden max-h-[90svh]">
                            <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-gray-50 border-b">
                                <div className="flex items-center gap-2 text-sm font-semibold">
                                    <img src="/BAMI.svg" alt="BAMI" className="w-5 h-5 rounded-full" />
                                    <span>Seguimiento del expediente</span>
                                </div>
                                <button className="btn" onClick={() => setShowTracker(false)}>Cerrar</button>
                            </div>
                            <div className="p-3 sm:p-4 overflow-auto">
                                <CaseTracker active={true} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

            <BamiMascot showSpotlight={showSpotlight} onCloseSpotlight={() => setShowSpotlight(false)} />
        </main>
    )
}
