// src/components/BamMobileSimulator.jsx
import React, { useEffect, useState } from 'react'
import {
    Home, ArrowLeft, Banknote, Send as SendIcon, CreditCard, Landmark, Building2,
    Globe2, Star, Smartphone, Settings, FileText, Shield, BookOpen, MapPin,
    Wallet, UserRoundCog, Grid3X3, Info, MessageSquareMore, X
} from 'lucide-react'
import BamiChatWidget from './BamiChatWidget.jsx'
import CaseTracker from './CaseTracker.jsx'
import BamOpsPanel from './BamOpsPanel.jsx'

/**
 * Simulador visual de la app móvil BAM.
 * Ajustes clave anti-flicker:
 *  - Shell con dimensiones en px (congeladas) y sólo recalculadas en "resize".
 *  - Aislamiento de layout con `contain` + capa propia (`translateZ(0)`).
 *  - Modales internos con maxHeight relativo al shell (no al viewport).
 */
const YELLOW = '#FFD400'
const BG = '#101214'
const CARD = '#1B1D20'
const BORDER = '#2A2E33'
const TEXT = '#EDEFF1'
const MUTED = '#A7AFB7'

// límites del shell
const SHELL_MAX_W = 420
const SHELL_MAX_H = 840
const SHELL_VW   = 0.92   // 92% del viewport
const SHELL_VH   = 0.92   // 92% del viewport

export default function BamMobileSimulator({ open = false, onClose = () => {} }) {
    const [tab, setTab] = useState('gestionar')
    const [screen, setScreen] = useState('root') // root | bami-chat
    const [showTracker, setShowTracker] = useState(false)
    const [showOps, setShowOps] = useState(false)

    // Tamaño CONGELADO del teléfono (en px). Sólo se recalcula en "resize".
    const [shellSize, setShellSize] = useState(() => {
        const w = Math.min(SHELL_MAX_W, Math.round(window.innerWidth * SHELL_VW))
        const h = Math.min(SHELL_MAX_H, Math.round(window.innerHeight * SHELL_VH))
        return { w, h }
    })
    useEffect(() => {
        const recalc = () => {
            const w = Math.min(SHELL_MAX_W, Math.round(window.innerWidth * SHELL_VW))
            const h = Math.min(SHELL_MAX_H, Math.round(window.innerHeight * SHELL_VH))
            setShellSize((prev) => (prev.w !== w || prev.h !== h) ? { w, h } : prev)
        }
        window.addEventListener('resize', recalc, { passive: true })
        return () => window.removeEventListener('resize', recalc)
    }, [])

    // Lock scroll documento
    useEffect(() => {
        if (!open) return
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = prev }
    }, [open])

    // Desactivar flotantes globales mientras esté abierto
    useEffect(() => {
        if (!open) return
        const prev = window.__BAMI_DISABLE_FLOATING__
        window.__BAMI_DISABLE_FLOATING__ = true
        return () => { window.__BAMI_DISABLE_FLOATING__ = prev }
    }, [open])

    // Eventos internos del simulador
    useEffect(() => {
        const hOpenTracker = () => setShowTracker(true)
        const hToggleTracker = () => setShowTracker(v => !v)
        const hCloseTracker = () => {
            if (window.__BAMI_LOCK_TRACKER__ || window.__BAMI_AGENT_ACTIVE__) return
            setShowTracker(false)
        }
        const hOpenOps = () => setShowOps(true)
        const hToggleOps = () => setShowOps(v => !v)
        const hCloseOps = () => setShowOps(false)

        const hOpenChat = () => { setTab('gestionar'); setScreen('bami-chat') }
        const hCloseSim = () => onClose?.()

        window.addEventListener('sim:tracker:open', hOpenTracker)
        window.addEventListener('sim:tracker:toggle', hToggleTracker)
        window.addEventListener('sim:tracker:close', hCloseTracker)
        window.addEventListener('sim:ops:open', hOpenOps)
        window.addEventListener('sim:ops:toggle', hToggleOps)
        window.addEventListener('sim:ops:close', hCloseOps)
        window.addEventListener('sim:open', hOpenChat)
        window.addEventListener('bami:open', hOpenChat)
        window.addEventListener('sim:close', hCloseSim)

        return () => {
            window.removeEventListener('sim:tracker:open', hOpenTracker)
            window.removeEventListener('sim:tracker:toggle', hToggleTracker)
            window.removeEventListener('sim:tracker:close', hCloseTracker)
            window.removeEventListener('sim:ops:open', hOpenOps)
            window.removeEventListener('sim:ops:toggle', hToggleOps)
            window.removeEventListener('sim:ops:close', hCloseOps)
            window.removeEventListener('sim:open', hOpenChat)
            window.removeEventListener('bami:open', hOpenChat)
            window.removeEventListener('sim:close', hCloseSim)
        }
    }, [onClose])

    if (!open) return null

    /** Layout helpers **/
    const PhoneShell = ({ children }) => (
        <div
            data-simulator
            className="relative rounded-[36px] border-[10px] border-black shadow-2xl overflow-hidden z-[4005]"
            style={{
                // ❗️Tamaño Fijo (anti-flicker) + aislamiento del layout
                width: `${shellSize.w}px`,
                height: `${shellSize.h}px`,
                backgroundColor: 'black',
                contain: 'strict',
                willChange: 'transform',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                transition: 'none',
                overflowAnchor: 'none'
            }}
        >
            {/* notch */}
            <div className="absolute top-0 left-0 right-0 h-7 bg-black z-[1]" />
            {/* pantalla */}
            <div
                className="absolute inset-0 pt-7 flex flex-col"
                style={{ backgroundColor: BG, isolation: 'isolate' }}
            >
                {children}
            </div>
        </div>
    )

    const AppHeader = ({ title = 'Bam', showBack = false, onBack }) => (
        <div
            className="shrink-0 h-14 px-4 flex items-center justify-between z-[10]"
            style={{ background: 'linear-gradient(0deg, rgba(20,22,24,1) 0%, rgba(16,18,20,1) 100%)', transition: 'none' }}
        >
            <div className="flex items-center gap-2 text-[15px]" style={{ color: TEXT }}>
                {showBack ? (
                    <button className="p-2 -ml-2 rounded-lg hover:bg-white/10" onClick={onBack} aria-label="Regresar">
                        <ArrowLeft size={20} color={TEXT}/>
                    </button>
                ) : (
                    <div className="w-6 h-6 rounded-sm bg-white grid place-items-center text-black font-bold">B</div>
                )}
                <div className="text-xl font-semibold tracking-tight">Bam</div>
            </div>
            <div className="opacity-80">
                <Smartphone size={18} color={TEXT}/>
            </div>
        </div>
    )

    const SectionTitle = ({ children }) => (
        <div className="px-4 pt-3 pb-2 text-sm" style={{ color: MUTED, transition: 'none' }}>{children}</div>
    )

    const Grid = ({ children }) => (
        <div className="grid grid-cols-2 gap-3 px-4 pb-5">{children}</div>
    )

    const Tile = ({ icon: Icon, label, hint, onClick }) => (
        <button
            onClick={onClick}
            className="p-3 rounded-2xl text-left active:scale-[0.99]"
            style={{
                backgroundColor: CARD,
                border: `1px solid ${BORDER}`,
                color: TEXT,
                transition: 'transform 120ms ease-out, background-color 0ms, color 0ms, border-color 0ms'
            }}
        >
            <div className="w-11 h-11 grid place-items-center rounded-full mb-2" style={{ backgroundColor: '#2A2D31' }}>
                <Icon size={20} color={TEXT}/>
            </div>
            <div className="text-[15px] font-medium">{label}</div>
            {hint && <div className="text-xs mt-0.5" style={{ color: MUTED }}>{hint}</div>}
        </button>
    )

    const TabBtn = ({ id, icon: Icon, label }) => {
        const active = tab === id
        return (
            <button
                onClick={() => { setTab(id); setScreen('root') }}
                className="flex-1 h-14 flex flex-col items-center justify-center text-[11px]"
                style={{
                    color: active ? 'black' : MUTED,
                    backgroundColor: active ? YELLOW : BG,
                    borderTop: `1px solid ${BORDER}`,
                    transition: 'background-color 0ms, color 0ms, border-color 0ms'
                }}
                aria-label={label}
            >
                <Icon size={18} color={active ? 'black' : MUTED}/>
                <div className="mt-1">{label}</div>
            </button>
        )
    }

    /** Pestañas **/
    const Transferir = () => (
        <>
            <SectionTitle>Transferir</SectionTitle>
            <Grid>
                <Tile icon={UserRoundCog} label="A cuentas propias" />
                <Tile icon={Landmark} label="A terceros Bam" />
                <Tile icon={Building2} label="A otros bancos" />
                <Tile icon={Globe2} label="A otro país (Internacionales)" />
                <Tile icon={SendIcon} label="Desde otros bancos" hint="Débito ACH" />
                <Tile icon={Star} label="Gestión de favoritos" />
            </Grid>
        </>
    )

    const Pagar = () => (
        <>
            <SectionTitle>Pagar</SectionTitle>
            <Grid>
                <Tile icon={Grid3X3} label="Servicios" />
                <Tile icon={CreditCard} label="Tarjetas de crédito" />
                <Tile icon={Wallet} label="Préstamos" />
                <Tile icon={Star} label="Gestión de favoritos" />
                <Tile icon={FileText} label="Declaraguate" />
            </Grid>
        </>
    )

    const Mas = () => (
        <>
            <SectionTitle>Más</SectionTitle>
            <Grid>
                <Tile icon={Settings} label="Preferencias y Seguridad" />
                <Tile icon={BookOpen} label="Términos y condiciones" />
                <Tile icon={Shield} label="Políticas de privacidad" />
                <Tile icon={Info} label="Aprende sobre seguridad" />
                <Tile icon={MapPin} label="Agencias" />
            </Grid>
        </>
    )

    const GestionarRoot = () => (
        <>
            <SectionTitle>Gestionar</SectionTitle>
            <div className="px-4 pb-5 grid grid-cols-1 gap-3">
                <Tile
                    icon={MessageSquareMore}
                    label="Asistente BAMI"
                    hint="Chatea y gestiona tu expediente"
                    onClick={() => setScreen('bami-chat')}
                />
                <div className="p-3 rounded-2xl" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                    <div className="text-sm" style={{ color: MUTED }}>Resumen</div>
                    <div className="mt-2 text-[13px]" style={{ color: MUTED }}>
                        Aquí puedes integrar cards reales de productos, estados y recordatorios.
                    </div>
                </div>
            </div>
        </>
    )

    const Inicio = () => (
        <>
            <SectionTitle>Inicio</SectionTitle>
            <div className="px-4 pb-5 space-y-3">
                <div className="p-4 rounded-2xl" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, color: TEXT }}>
                    <div className="text-sm font-medium">Bienvenido 👋</div>
                    <div className="text-[13px] mt-1" style={{ color: MUTED }}>
                        Esta es una vista simulada para validar la integración de BAMI dentro de la app BAM.
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Tile icon={Banknote} label="Ver movimientos" />
                    <Tile icon={CreditCard} label="Tarjetas" />
                </div>
            </div>
        </>
    )

    /** Modales internos (dentro del teléfono) **/
    const InternalModal = ({ title, onClose, children }) => {
        const safeClose = () => {
            if (window.__BAMI_LOCK_TRACKER__ || window.__BAMI_AGENT_ACTIVE__) return
            onClose?.()
        }
        // altura máxima relativa al SHELL (no al viewport)
        const modalMaxH = Math.max(280, Math.floor(shellSize.h * 0.78))
        return (
            <div className="absolute inset-0 z-[45]" style={{ pointerEvents: 'auto' }}>
                <div className="absolute inset-0 bg-black/60" onClick={safeClose} />
                <div className="absolute left-1/2 -translate-x-1/2 top-4 w-[94%]">
                    <div
                        className="rounded-2xl overflow-hidden"
                        style={{ backgroundColor: '#ffffff', color: '#111', border: '1px solid #e5e7eb' }}
                    >
                        <div className="h-12 px-3 flex items-center justify-between border-b bg-gray-50">
                            <div className="text-sm font-semibold">{title}</div>
                            <button onClick={safeClose} className="p-1.5 rounded hover:bg-gray-200" aria-label="Cerrar">
                                <X size={16}/>
                            </button>
                        </div>
                        <div
                            className="overflow-auto p-3 sm:p-4"
                            style={{ maxHeight: `${modalMaxH}px` }}
                        >
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    /** Contenido principal **/
    const ScreenContent = () => {
        const modalOpen = showTracker || showOps

        if (tab === 'gestionar' && screen === 'bami-chat') {
            return (
                <>
                    <AppHeader title="Bam" showBack onBack={() => setScreen('root')} />
                    <div
                        className="relative flex-1 overflow-hidden"
                        style={{ backgroundColor: '#ffffff', color: '#000000' }}
                    >
                        {/* Chat ocupa 100% del alto del teléfono, aislado */}
                        <div
                            className="absolute inset-0"
                            style={{
                                pointerEvents: modalOpen ? 'none' : 'auto',
                                contain: 'layout paint size',
                                willChange: 'transform',
                                transform: 'translateZ(0)'
                            }}
                        >
                            <BamiChatWidget variant="app" disableFloatingTrigger embed />
                        </div>

                        {showTracker && (
                            <InternalModal title="Seguimiento del expediente" onClose={() => setShowTracker(false)}>
                                <CaseTracker active={true} />
                            </InternalModal>
                        )}

                        {showOps && (
                            <InternalModal title="Panel de análisis y leads" onClose={() => setShowOps(false)}>
                                <BamOpsPanel />
                            </InternalModal>
                        )}
                    </div>
                </>
            )
        }

        // Resto de pantallas con barra de pestañas
        return (
            <>
                <AppHeader title="Bam" />
                <div className="flex-1 overflow-auto">
                    {tab === 'inicio' && <Inicio />}
                    {tab === 'transferir' && <Transferir />}
                    {tab === 'pagar' && <Pagar />}
                    {tab === 'gestionar' && <GestionarRoot />}
                    {tab === 'mas' && <Mas />}
                </div>

                {/* Barra de pestañas */}
                <div className="shrink-0 grid grid-cols-5 z-[10]" style={{ backgroundColor: BG }}>
                    <TabBtn id="inicio" icon={Home} label="Inicio" />
                    <TabBtn id="transferir" icon={SendIcon} label="Transferir" />
                    <TabBtn id="pagar" icon={CreditCard} label="Pagar" />
                    <TabBtn id="gestionar" icon={UserRoundCog} label="Gestionar" />
                    <TabBtn id="mas" icon={Grid3X3} label="Más" />
                </div>
            </>
        )
    }

    return (
        <div className="fixed inset-0 z-[4000] bg-black/55 backdrop-blur-sm" style={{ pointerEvents: 'auto' }}>
            {/* Botón cerrar */}
            <button
                onClick={() => {
                    if (window.__BAMI_LOCK_TRACKER__ || window.__BAMI_AGENT_ACTIVE__) return
                    onClose()
                }}
                className="fixed top-4 right-4 z-[4010] px-3 py-1.5 rounded-lg text-sm bg-white text-black hover:bg-gray-100 shadow"
                aria-label="Cerrar vista app"
                style={{ pointerEvents: 'auto' }}
            >
                Cerrar
            </button>

            {/* Centro */}
            <div className="h-full w-full grid place-items-center p-4 pointer-events-none">
                <div className="pointer-events-auto">
                    <PhoneShell>
                        <ScreenContent />
                    </PhoneShell>
                </div>
            </div>

            {/* leyenda */}
            <div className="absolute bottom-4 left-0 right-0 px-4 text-center text-white/85 text-sm z-[4001] pointer-events-none">
                Vista simulada de la app BAM — navega por las pestañas y abre “Asistente BAMI”.
            </div>
        </div>
    )
}
