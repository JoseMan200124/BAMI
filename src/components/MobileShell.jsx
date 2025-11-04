// src/components/MobileShell.jsx
import React, { useEffect, useRef } from 'react'

/**
 * Overlay de teléfono genérico (por si lo sigues usando en otras pantallas).
 * Para el simulador con tabs se usa BamMobileSimulator.
 */
export default function MobileShell({
                                        open = false,
                                        onClose = () => {},
                                        children,
                                        footerNote = 'Vista simulada de la app BAM — navega por las pestañas y abre “Asistente BAMI”.',
                                    }) {
    const phoneRef = useRef(null)

    useEffect(() => {
        if (!open) return
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const onKey = (e) => e.key === 'Escape' && onClose()
        window.addEventListener('keydown', onKey)
        return () => {
            document.body.style.overflow = prev
            window.removeEventListener('keydown', onKey)
        }
    }, [open, onClose])

    useEffect(() => {
        if (!open) return
        const setVH = () =>
            document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
        setVH()
        window.addEventListener('resize', setVH)
        return () => window.removeEventListener('resize', setVH)
    }, [open])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[2000]">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
            <div className="absolute top-3 right-3 z-[2040]">
                <button onClick={onClose} className="px-3 py-1.5 rounded-full bg-white/95 hover:bg-white shadow text-sm font-medium" aria-label="Cerrar simulador">
                    Cerrar
                </button>
            </div>

            <div className="relative h-full w-full grid place-items-center p-3 sm:p-6 z-[2030]">
                <div
                    ref={phoneRef}
                    className="relative w-[392px] max-w-[92vw]"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDownCapture={(e) => e.stopPropagation()}
                    onTouchStartCapture={(e) => e.stopPropagation()}
                    role="dialog" aria-modal="true" aria-label="Simulador BAM"
                >
                    <div className="relative rounded-[34px] bg-black shadow-2xl border border-black/60 overflow-hidden">
                        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-36 h-6 bg-black rounded-b-3xl z-[2]" />
                        <div className="relative m-[14px] rounded-[26px] bg-white overflow-hidden"
                             style={{ height: 'min(calc(var(--vh, 1vh) * 86), 740px)', isolation: 'isolate' }}>
                            <div className="relative flex flex-col h-full">{children}</div>
                        </div>
                    </div>
                </div>

                {footerNote && (
                    <div className="absolute bottom-2 left-0 right-0 px-3 text-center text-[12px] text-white/80 select-none pointer-events-none">
                        {footerNote}
                    </div>
                )}
            </div>
        </div>
    )
}
