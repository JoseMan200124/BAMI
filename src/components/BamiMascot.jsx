// src/components/BamiMascot.jsx
import React, { useEffect, useState } from 'react'

/**
 * Mascota BAMI:
 * - Burbuja flotante fija (safe-area) para abrir el chat.
 * - Spotlight opcional (overlay) que oscurece y centra la carita.
 *
 * Eventos:
 *  - click en burbuja => dispatchEvent('bami:open')
 *  - forzar spotlight: window.dispatchEvent(new Event('bami:spotlight'))
 */
export default function BamiMascot({
                                       showSpotlight: externalShow = null,
                                       onCloseSpotlight = () => {},
                                   }) {
    const [showSpotlight, setShowSpotlight] = useState(false)

    useEffect(() => {
        const seen = localStorage.getItem('bami_seen_spotlight_v2') === '1'
        if (!seen && externalShow === null) {
            const t = setTimeout(() => setShowSpotlight(true), 600)
            return () => clearTimeout(t)
        }
    }, [externalShow])

    useEffect(() => {
        const open = () => setShowSpotlight(true)
        window.addEventListener('bami:spotlight', open)
        return () => window.removeEventListener('bami:spotlight', open)
    }, [])

    useEffect(() => {
        if (externalShow !== null) setShowSpotlight(externalShow)
    }, [externalShow])

    useEffect(() => {
        if (!showSpotlight) return
        const onKey = (e) => e.key === 'Escape' && closeSpotlight(true)
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [showSpotlight])

    const openChat = () => window.dispatchEvent(new Event('bami:open'))
    const closeSpotlight = (persist = false) => {
        if (persist) localStorage.setItem('bami_seen_spotlight_v2', '1')
        setShowSpotlight(false)
        onCloseSpotlight?.()
    }

    return (
        <>
            {/* Burbuja flotante */}
            <button
                onClick={openChat}
                className="fixed z-[58] group"
                style={{
                    right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
                    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
                }}
                aria-label="Chatea con BAMI"
            >
                <div className="relative w-16 h-16 rounded-full border shadow-lg bg-white overflow-hidden">
                    <img src="/BAMI.svg" alt="BAMI" className="absolute inset-0 w-full h-full object-contain" loading="lazy"/>
                    <span className="absolute inset-0 rounded-full ring-2 ring-yellow-300/60 group-hover:ring-yellow-400/80 transition" />
                </div>
                <div className="absolute -top-2 -left-2 sm:hidden animate-ping w-20 h-20 rounded-full bg-yellow-300/20 pointer-events-none" />
                <div className="mt-1 text-[11px] text-center w-[4.5rem] text-gray-600">Bami</div>
            </button>

            {/* Spotlight */}
            {showSpotlight && (
                <div
                    className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm grid place-items-center p-4"
                    onClick={() => closeSpotlight(true)}
                    role="dialog" aria-modal="true" aria-label="Conoce a BAMI"
                >
                    <div
                        className="relative w-[72vw] max-w-[260px] aspect-square rounded-full bg-white shadow-2xl border-4 border-yellow-300 overflow-hidden touch-manipulation"
                        onClick={(e) => { e.stopPropagation(); openChat(); closeSpotlight(true) }}
                        title="Abrir chat con BAMI"
                    >
                        <img src="/BAMI.svg" alt="BAMI" className="absolute inset-0 w-full h-full object-contain" />
                    </div>

                    <div className="absolute w-full px-4" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
                        <div className="text-center">
                            <div className="text-white font-semibold text-base sm:text-lg">¡Habla con BAMI!</div>
                            <div className="text-white/90 text-sm mt-1">Toca la carita para abrir el chat</div>
                            <div className="mt-3 flex items-center justify-center gap-2">
                                <button onClick={(e)=>{e.stopPropagation(); openChat(); closeSpotlight(true)}} className="btn btn-dark">Abrir chat</button>
                                <button onClick={(e)=>{e.stopPropagation(); closeSpotlight(true)}} className="btn">No mostrar de nuevo</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
