// src/pages/BamiHub.jsx
import React, { useEffect, useState } from 'react'
import CaseTracker from '../components/CaseTracker.jsx'
import BamiChatWidget from '../components/BamiChatWidget.jsx'
import RequestForm from '../components/RequestForm.jsx'
import { createNewCase, getCase, notify } from '../lib/caseStore.js'
import BamOpsPanel from '../components/BamOpsPanel.jsx'
import BamMobileSimulator from '../components/BamMobileSimulator.jsx'
import BamiAgent from '../components/BamiAgent.jsx'

export default function BamiHub() {
    const [c, setC] = useState(getCase())
    const [product, setProduct] = useState('Tarjeta de Crédito')

    const [showTracker, setShowTracker]   = useState(false)
    const [showOps, setShowOps]           = useState(false)
    const [showReq, setShowReq]           = useState(false)
    const [showSim, setShowSim]           = useState(false)
    const [showAgentPanel, setShowAgentPanel] = useState(false)

    useEffect(() => {
        const onCase = (e) => setC(e.detail || getCase())
        window.addEventListener('bami:caseUpdate', onCase)
        return () => window.removeEventListener('bami:caseUpdate', onCase)
    }, [])

    const closeAll = (opts = { except: null }) => {
        if (opts.except !== 'tracker') setShowTracker(false)
        if (opts.except !== 'ops')     setShowOps(false)
        if (opts.except !== 'req')     setShowReq(false)
        if (opts.except !== 'sim')     setShowSim(false)
        if (opts.except !== 'agent')   setShowAgentPanel(false)
        // Cierra “la ventanita” (chat/overlays) donde sea que esté
        try {
            window.dispatchEvent(new Event('ui:close'))
            window.dispatchEvent(new Event('upload:close'))
            window.dispatchEvent(new Event('sim:upload:close'))
        } catch {}
    }

    // ✅ Al iniciar demo: cerrar SIEMPRE la pestaña/hoja de Autopilot
    useEffect(() => {
        const onStart = () => {
            closeAll()
            setShowAgentPanel(false)
            // Fuerza ocultar cualquier contenedor que tenga la UI del Autopilot
            requestAnimationFrame(() => {
                const nodes = Array.from(
                    document.querySelectorAll(
                        '[data-autopilot-panel], [data-component="BamiAgent"], [data-bami-agent], [role="dialog"], .sheet, .drawer'
                    )
                )
                nodes.forEach(n => {
                    const txt = (n.innerText || '').toLowerCase()
                    if (txt.includes('autopilot') || txt.includes('iniciar demo') || txt.includes('bami agent')) {
                        n.style.setProperty('display', 'none', 'important')
                        n.style.setProperty('visibility', 'hidden', 'important')
                    }
                })
                // Si hay tabs, activa BAMI para que no quede “seleccionado” Autopilot
                const bamiTab = Array.from(document.querySelectorAll('[role="tab"], [data-tab], .tab'))
                    .find(el => /bami/i.test(el.innerText || el.getAttribute('aria-label') || ''))
                try { bamiTab?.click() } catch {}
            })
        }
        window.addEventListener('bami:agent:start', onStart)
        return () => window.removeEventListener('bami:agent:start', onStart)
    }, [])

    // Atajos útiles
    useEffect(() => {
        const openTracker   = () => { closeAll({}); setShowTracker(true) }
        const toggleTracker = () => setShowTracker(v => !v)
        const toggleOps     = () => setShowOps(v => !v)

        window.addEventListener('ui:openTracker', openTracker)
        window.addEventListener('bami:ui:openTracker', openTracker)
        window.addEventListener('sim:openTracker', openTracker)
        window.addEventListener('ui:tracker:toggle', toggleTracker)
        window.addEventListener('ops:toggle', toggleOps)

        return () => {
            window.removeEventListener('ui:openTracker', openTracker)
            window.removeEventListener('bami:ui:openTracker', openTracker)
            window.removeEventListener('sim:openTracker', openTracker)
            window.removeEventListener('ui:tracker:toggle', toggleTracker)
            window.removeEventListener('ops:toggle', toggleOps)
        }
    }, [])

    // Header: en móvil NO mostramos la segunda barra para que no se amontone
    const PageHeader = (
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
            <div className="px-3 py-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <h1 className="font-semibold">Acompañamiento</h1>
            </div>
            {/* Barra secundaria solo en ≥sm */}
            <div className="hidden sm:block">
                <div className="px-3 pb-2 text-sm text-gray-700">BAMI · Cliente &amp; BAM · Ops</div>
            </div>
        </header>
    )

    return (
        <div className="min-h-[100dvh] bg-gradient-to-b from-yellow-50/70 to-white">
            {PageHeader}

            <main className="max-w-6xl mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Izquierda */}
                <section className="lg:col-span-7 space-y-4">
                    {showSim && <BamMobileSimulator onClose={() => setShowSim(false)} />}

                    {showReq && (
                        <RequestForm
                            product={product}
                            onClose={() => setShowReq(false)}
                            onCreated={() => notify('Solicitud creada')}
                        />
                    )}

                    {/* Chat como panel — siempre limpio en móvil */}
                    <div className="rounded-2xl border shadow-sm overflow-hidden">
                        <BamiChatWidget variant="panel" allowOpsButton={true} />
                    </div>
                </section>

                {/* Derecha */}
                <aside className="lg:col-span-5 space-y-4">
                    {showTracker && (
                        <div className="rounded-2xl border shadow-sm overflow-hidden">
                            <CaseTracker onClose={() => setShowTracker(false)} />
                        </div>
                    )}

                    {showOps && (
                        <div className="rounded-2xl border shadow-sm overflow-hidden">
                            <BamOpsPanel onClose={() => setShowOps(false)} />
                        </div>
                    )}

                    {showAgentPanel && (
                        <div className="rounded-2xl border shadow-sm overflow-hidden" data-autopilot-panel>
                            <BamiAgent onClose={() => setShowAgentPanel(false)} />
                        </div>
                    )}
                </aside>
            </main>
        </div>
    )
}
