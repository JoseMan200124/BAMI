// src/pages/BamiHub.jsx
import React, { useEffect, useMemo, useState } from 'react'
import CaseTracker from '../components/CaseTracker.jsx'
import BamiChatWidget from '../components/BamiChatWidget.jsx'
import RequestForm from '../components/RequestForm.jsx'
import { PRODUCT_RULES, createNewCase, getCase, notify } from '../lib/caseStore.js'
import BamOpsPanel from '../components/BamOpsPanel.jsx'

export default function BamiHub() {
    // Estado de expediente y producto
    const [c, setC] = useState(getCase())
    const [product, setProduct] = useState('Tarjeta de Crédito')

    // UI overlays
    const [showTracker, setShowTracker] = useState(false)
    const [showOps, setShowOps] = useState(false)
    const [showForm, setShowForm] = useState(false)

    useEffect(() => {
        const onU = (e) => setC(e.detail)
        const onTrackerOpen = () => setShowTracker(true)
        const onTrackerToggle = () => setShowTracker(v => !v)
        const onOpsOpen = () => setShowOps(true)
        const onOpsToggle = () => setShowOps(v => !v)
        const onFormOpen = () => setShowForm(true)

        window.addEventListener('bami:caseUpdate', onU)
        window.addEventListener('ui:tracker:open', onTrackerOpen)
        window.addEventListener('ui:tracker:toggle', onTrackerToggle)
        window.addEventListener('ui:ops:open', onOpsOpen)
        window.addEventListener('ui:ops:toggle', onOpsToggle)
        window.addEventListener('ui:form:open', onFormOpen)
        return () => {
            window.removeEventListener('bami:caseUpdate', onU)
            window.removeEventListener('ui:tracker:open', onTrackerOpen)
            window.removeEventListener('ui:tracker:toggle', onTrackerToggle)
            window.removeEventListener('ui:ops:open', onOpsOpen)
            window.removeEventListener('ui:ops:toggle', onOpsToggle)
            window.removeEventListener('ui:form:open', onFormOpen)
        }
    }, [])

    const start = async () => {
        const cc = await createNewCase(product)
        notify('Expediente creado')
        setC(cc)
        setShowTracker(true)
    }
    const emit = (name) => window.dispatchEvent(new Event(name))

    const nextCTA = useMemo(() => {
        if (!c) return { label: 'Crear expediente', action: () => start() }
        if ((c.missing || []).length > 0) return {
            label: `Subir ${c.missing.length} documento(s)`,
            action: () => { emit('bami:open'); emit('bami:upload') }
        }
        if (c.stage !== 'aprobado') return {
            label: 'Validar con IA',
            action: () => { emit('bami:open'); emit('bami:validate') }
        }
        return { label: 'Hablar con asesor', action: () => { emit('bami:open'); emit('bami:advisor') } }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [c, product])

    return (
        <main className="min-h-screen bg-neutral-50 flex flex-col">
            {/* Topbar (ligero) */}
            <header className="sticky top-0 z-[60] backdrop-blur bg-white/80 border-b">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="text-lg font-extrabold tracking-tight">BAMI · Demo</div>
                        <div className="hidden md:flex items-center gap-2">
                            <select
                                className="border rounded-xl px-3 py-1.5 text-sm"
                                value={product}
                                onChange={(e) => setProduct(e.target.value)}
                                aria-label="Producto"
                            >
                                {Object.keys(PRODUCT_RULES).map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                            <button className="btn btn-dark h-9" onClick={start}>Crear expediente</button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="btn h-9" onClick={() => setShowForm(true)}>Completar datos</button>
                        <button className="btn h-9" onClick={() => setShowTracker(v => !v)}>Tracker</button>
                        <button className="btn h-9" onClick={() => setShowOps(v => !v)}>Ops</button>
                        <button className="btn btn-dark h-9" onClick={nextCTA.action}>{nextCTA.label}</button>
                    </div>
                </div>

                {/* Siguiente paso (barra de ayuda) */}
                <div className="border-t bg-yellow-50/60">
                    <div className="max-w-7xl mx-auto px-4 py-2 text-sm flex items-center justify-between gap-3">
                        <div className="text-gray-700">
                            <span className="text-xs text-gray-600 mr-2">Siguiente paso</span>
                            <b>Te recomendamos: {nextCTA.label}</b>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="btn btn-dark btn-sm" onClick={nextCTA.action}>Continuar</button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Área principal: Chat a pantalla completa */}
            <section className="flex-1">
                <div className="max-w-7xl mx-auto px-0 md:px-4 py-4 md:py-6">
                    <div className="rounded-none md:rounded-2xl border md:shadow-sm overflow-hidden">
                        {/* El chat ocupa casi todo el alto de la vista */}
                        <BamiChatWidget variant="fullscreen" />
                    </div>
                </div>
            </section>

            {/* ——— Drawer superior: Tracker ——— */}
            {showTracker && (
                <div className="fixed inset-0 z-[70]">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowTracker(false)} />
                    <div className="absolute left-1/2 -translate-x-1/2 top-4 w-[95vw] max-w-5xl">
                        <div className="card border shadow-2xl rounded-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
                                <div className="text-sm font-semibold">Seguimiento del expediente</div>
                                <button className="btn" onClick={() => setShowTracker(false)}>Cerrar</button>
                            </div>
                            <div className="p-4">
                                <CaseTracker />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ——— Slide-over derecho: Ops Panel ——— */}
            {showOps && (
                <div className="fixed inset-0 z-[70]">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowOps(false)} />
                    <aside className="absolute right-0 top-0 h-full w-[92vw] sm:w-[560px] bg-white border-l shadow-2xl">
                        <div className="flex items-center justify-between px-4 h-12 border-b bg-gray-50">
                            <div className="text-sm font-semibold">Panel de análisis y leads</div>
                            <button className="btn" onClick={() => setShowOps(false)}>Cerrar</button>
                        </div>
                        <div className="p-4 overflow-auto h-[calc(100%-48px)]">
                            <BamOpsPanel />
                        </div>
                    </aside>
                </div>
            )}

            {/* ——— Modal de datos del solicitante ——— */}
            {showForm && (
                <div className="fixed inset-0 z-[70] grid place-items-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
                    <div className="card w-full max-w-3xl relative z-[71]">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="h3">Completa tus datos</h3>
                            <button className="btn" onClick={() => setShowForm(false)}>Cerrar</button>
                        </div>
                        <RequestForm product={product} onCreated={() => setShowForm(false)} />
                    </div>
                </div>
            )}
        </main>
    )
}
