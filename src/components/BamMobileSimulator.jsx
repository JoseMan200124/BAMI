// src/components/BamMobileSimulator.jsx
// Simulador de App del cliente con soporte para eventos de Autopilot:
// - sim:open -> abre el simulador
// - sim:upload:demo -> muestra flujo de subir documentos
// - sim:client:openArea -> navega a Área de Cliente
// - sim:client:openProducts -> navega a Mis Productos
// - sim:client:openChat / closeChat -> abre/cierra chat de cliente
// - sim:client:sendMessage {detail:{text}} -> escribe y envía mensaje en el chat
// - sim:tracker:close -> asegura que el tracker interno NO se muestre durante Autopilot
//
// Mantiene aislado el overlay para que los botones externos no queden detrás.

import React, { useEffect, useRef, useState } from 'react'
import {
    Home, Send as SendIcon, MessageSquareMore, X, FileUp, FolderOpen,
    FileText, UserRound, CreditCard, CheckCircle2
} from 'lucide-react'

export default function BamMobileSimulator() {
    const [open, setOpen] = useState(false)
    const [view, setView] = useState('home') // 'home' | 'upload' | 'cliente' | 'productos'
    const [uploading, setUploading] = useState(false)
    const [chatOpen, setChatOpen] = useState(false)
    const [chatInput, setChatInput] = useState('')
    const [chatMsgs, setChatMsgs] = useState([
        { id: 1, from: 'bami', text: '¡Hola! Soy BAMI, ¿en qué puedo ayudarte hoy?' }
    ])
    const shellRef = useRef(null)

    // ---------- Eventos globales para interoperar con el agente ----------
    useEffect(() => {
        const openSim = () => { setOpen(true); setView('home') }
        const uploadDemo = () => { setOpen(true); setView('upload'); runUploadDemo() }
        const openArea = () => { setOpen(true); setView('cliente') }
        const openProducts = () => { setOpen(true); setView('productos') }
        const openChat = () => { setOpen(true); setChatOpen(true); setView('cliente') }
        const closeChat = () => { setChatOpen(false) }
        const closeTrackerInside = () => {
            // si tuvieras un panel interno de tracker en el simulador, aquí lo cierras
            // intencionalmente vacío para cumplir con la supresión
        }
        const blinkChat = () => {
            // simple micro-animación: añadir un puntito temporal
            setChatMsgs(m => [...m, { id: Date.now(), from: 'bami', text: '🔔 Recordatorio: tu expediente sigue avanzando.' }])
            setTimeout(() => {
                setChatMsgs(m => m.length > 1 ? m.slice(0, -1) : m)
            }, 1400)
        }

        const sendMessage = (e) => {
            const text = e?.detail?.text || ''
            if (!text) return
            setOpen(true); setChatOpen(true); setView('cliente')
            // Simular tipeo
            let idx = 0
            setChatInput('')
            const timer = setInterval(() => {
                idx++
                setChatInput(text.slice(0, idx))
                if (idx >= text.length) {
                    clearInterval(timer)
                    setTimeout(() => {
                        handleSend()
                    }, 300)
                }
            }, 35)
        }

        window.addEventListener('sim:open', openSim)
        window.addEventListener('sim:upload:demo', uploadDemo)
        window.addEventListener('sim:client:openArea', openArea)
        window.addEventListener('sim:client:openProducts', openProducts)
        window.addEventListener('sim:client:openChat', openChat)
        window.addEventListener('sim:client:closeChat', closeChat)
        window.addEventListener('sim:tracker:close', closeTrackerInside)
        window.addEventListener('sim:client:blinkChat', blinkChat)
        window.addEventListener('sim:client:sendMessage', sendMessage)

        return () => {
            window.removeEventListener('sim:open', openSim)
            window.removeEventListener('sim:upload:demo', uploadDemo)
            window.removeEventListener('sim:client:openArea', openArea)
            window.removeEventListener('sim:client:openProducts', openProducts)
            window.removeEventListener('sim:client:openChat', openChat)
            window.removeEventListener('sim:client:closeChat', closeChat)
            window.removeEventListener('sim:tracker:close', closeTrackerInside)
            window.removeEventListener('sim:client:blinkChat', blinkChat)
            window.removeEventListener('sim:client:sendMessage', sendMessage)
        }
    }, [])

    // ---------- Demo de subida ----------
    const runUploadDemo = async () => {
        setUploading(true)
        await sleep(700)
        await sleep(800)
        setUploading(false)
    }
    const sleep = (ms) => new Promise(r => setTimeout(r, ms))

    const handleSend = () => {
        const text = chatInput.trim()
        if (!text) return
        const msg = { id: Date.now(), from: 'me', text }
        setChatMsgs(m => [...m, msg])
        setChatInput('')
        // Respuesta automática
        setTimeout(() => {
            setChatMsgs(m => [...m, {
                id: Date.now()+1,
                from: 'bami',
                text: 'Recibido ✅. Tu expediente está en revisión final.'
            }])
        }, 600)
    }

    // ---------- UI ----------
    if (!open) {
        return (
            <div className="fixed right-4 top-4 z-[1999975]">
                <button
                    data-sim-open
                    onClick={() => { setOpen(true); setView('home') }}
                    className="px-3 py-2 rounded-xl bg-white text-gray-800 shadow-lg border hover:bg-gray-50"
                >
                    Abrir Simulador
                </button>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[1999970] flex items-center justify-end pointer-events-none">
            {/* Overlay click-through pero sin tapar controles externos */}
            <div className="absolute inset-0 bg-black/30 pointer-events-auto" onClick={() => setOpen(false)} />

            {/* Shell del teléfono */}
            <div
                ref={shellRef}
                data-simulator
                className="relative pointer-events-auto mr-6 rounded-[28px] w-[360px] h-[720px] bg-white border shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="h-12 px-3 bg-gray-50 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-200" title="Cerrar">
                            <X size={18}/>
                        </button>
                        <span className="font-semibold text-sm">App Cliente · BAM</span>
                    </div>
                    <div className="text-xs text-gray-500">Demo</div>
                </div>

                {/* Nav superior */}
                <div className="h-10 px-3 border-b flex items-center gap-2">
                    <button
                        className={`px-3 py-1.5 rounded-md text-sm border ${view==='home'?'bg-black text-white':'bg-white'}`}
                        onClick={() => setView('home')}
                    >
                        <Home className="inline mr-1" size={14}/> Inicio
                    </button>
                    <button
                        className={`px-3 py-1.5 rounded-md text-sm border ${view==='upload'?'bg-black text-white':'bg-white'}`}
                        onClick={() => { setView('upload'); runUploadDemo() }}
                    >
                        <FileUp className="inline mr-1" size={14}/> Subir
                    </button>
                    <button
                        data-sim-nav="cliente"
                        className={`px-3 py-1.5 rounded-md text-sm border ${view==='cliente'?'bg-black text-white':'bg-white'}`}
                        onClick={() => setView('cliente')}
                    >
                        <UserRound className="inline mr-1" size={14}/> Cliente
                    </button>
                    <button
                        data-sim-nav="productos"
                        className={`px-3 py-1.5 rounded-md text-sm border ${view==='productos'?'bg-black text-white':'bg-white'}`}
                        onClick={() => setView('productos')}
                    >
                        <CreditCard className="inline mr-1" size={14}/> Productos
                    </button>
                </div>

                {/* Contenido */}
                <div className="p-3 h-[calc(720px-88px)] overflow-auto">
                    {view === 'home' && (
                        <div className="space-y-3">
                            <div className="p-3 rounded-xl border bg-gray-50">
                                <div className="text-sm font-semibold mb-1">Resumen</div>
                                <div className="text-xs text-gray-600">Tu estatus general y accesos rápidos.</div>
                                <div className="mt-2 grid grid-cols-3 gap-2">
                                    <div className="p-2 rounded-lg bg-white border text-center">
                                        <div className="text-[10px] text-gray-500">Satisfacción</div>
                                        <div className="text-lg font-bold">95%</div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-white border text-center">
                                        <div className="text-[10px] text-gray-500">Notificaciones</div>
                                        <div className="text-lg font-bold">3</div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-white border text-center">
                                        <div className="text-[10px] text-gray-500">Casos activos</div>
                                        <div className="text-lg font-bold">1</div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 rounded-xl border flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-semibold">Seguimiento rápido</div>
                                    <div className="text-xs text-gray-500">Tu última solicitud está aprobada.</div>
                                </div>
                                <CheckCircle2 className="text-emerald-600" size={20}/>
                            </div>
                        </div>
                    )}

                    {view === 'upload' && (
                        <div className="space-y-3">
                            <div className="p-3 rounded-xl border bg-gray-50">
                                <div className="text-sm font-semibold">Subir documentos</div>
                                <div className="text-xs text-gray-600">Arrastra y suelta o elige archivos.</div>
                                <div className="mt-3 p-6 border-2 border-dashed rounded-xl bg-white text-center">
                                    <FolderOpen className="mx-auto mb-2" size={30}/>
                                    <div className="text-xs text-gray-500">Zona de carga</div>
                                </div>
                                <div className="mt-3">
                                    <button className="px-3 py-1.5 rounded-md bg-black text-white text-sm">
                                        <FileText className="inline mr-1" size={14}/> Elegir archivo
                                    </button>
                                </div>
                            </div>
                            {uploading && (
                                <div className="p-3 rounded-xl border">
                                    <div className="text-sm font-semibold mb-1">Subiendo…</div>
                                    <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
                                        <div className="h-full bg-black animate-pulse" style={{ width: '78%' }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'cliente' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold">Área de Cliente</div>
                                <button
                                    data-sim-chat-open
                                    onClick={() => setChatOpen(true)}
                                    className="px-2 py-1 rounded-md border text-xs"
                                >
                                    <MessageSquareMore className="inline mr-1" size={14}/> Chat
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 rounded-xl border">
                                    <div className="text-[11px] text-gray-500">Mi estado</div>
                                    <div className="text-sm font-semibold">Aprobado</div>
                                </div>
                                <div className="p-3 rounded-xl border">
                                    <div className="text-[11px] text-gray-500">Última actualización</div>
                                    <div className="text-sm font-semibold">Hace 2 min</div>
                                </div>
                            </div>

                            {chatOpen && (
                                <div className="mt-2 rounded-xl border overflow-hidden">
                                    <div className="h-8 px-3 bg-gray-50 border-b flex items-center justify-between">
                                        <div className="text-xs font-semibold">Chat con BAMI</div>
                                        <button onClick={() => setChatOpen(false)} className="p-1 rounded hover:bg-gray-200">
                                            <X size={14}/>
                                        </button>
                                    </div>
                                    <div className="h-[220px] p-2 overflow-auto bg-white">
                                        {chatMsgs.map(m => (
                                            <div key={m.id} className={`mb-2 flex ${m.from==='me' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-xs ${m.from==='me' ? 'bg-black text-white' : 'bg-gray-100'}`}>
                                                    {m.text}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-2 border-t flex items-center gap-2 bg-gray-50">
                                        <input
                                            data-sim-chat-input
                                            value={chatInput}
                                            onChange={(e)=>setChatInput(e.target.value)}
                                            placeholder="Escribe un mensaje…"
                                            className="flex-1 px-3 py-2 rounded-md border text-sm"
                                        />
                                        <button onClick={handleSend} className="px-3 py-2 rounded-md bg-black text-white">
                                            <SendIcon size={14}/>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'productos' && (
                        <div className="space-y-3">
                            <div className="text-sm font-semibold">Mis Productos</div>
                            <div className="rounded-xl border p-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-semibold">Tarjeta de Crédito · Clásica</div>
                                        <div className="text-xs text-gray-500">Límite Q 12,000 · Corte 10 de cada mes</div>
                                    </div>
                                    <CreditCard size={20}/>
                                </div>
                            </div>
                            <div className="rounded-xl border p-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-semibold">Cuenta Ahorro Digital</div>
                                        <div className="text-xs text-gray-500">Saldo Q 2,450</div>
                                    </div>
                                    <CheckCircle2 className="text-emerald-600" size={20}/>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
