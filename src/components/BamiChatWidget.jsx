// src/components/BamiChatWidget.jsx
import React, { useEffect, useRef, useState } from 'react'
import UploadAssistant from './UploadAssistant.jsx'
import TypingDots from './TypingDots.jsx'
import MessageBubble from './MessageBubble.jsx'
import {
    createNewCase, getCase, notify, setChannel,
    chatBackend, validateWithAI, refreshTracker, PRODUCT_RULES
} from '../lib/caseStore.js'
import { Bot, Headphones, Sparkles, Send, BarChart2, LayoutDashboard } from 'lucide-react'
import ProgressRing from './ProgressRing.jsx'

/** ————————————————————————————————————————————————
 *  NLP SIMPLE EN FE: INTENCIÓN + PRODUCTO (sin dependencias)
 *  ———————————————————————————————————————————————— */
const PRODUCT_SYNONYMS = {
    'Tarjeta de Crédito': [
        'tarjeta de credito', 'tarjeta de crédito', 'tarjeta', 'tc', 'visa', 'mastercard', 'master card', 'credito de tarjeta'
    ],
    'Préstamo Personal': [
        'prestamo', 'préstamo', 'prestamo personal', 'préstamo personal', 'credifacil', 'credi facil',
        'credito personal', 'crédito personal', 'credito', 'crédito'
    ],
    'Hipoteca': [
        'hipoteca', 'credito hipotecario', 'crédito hipotecario', 'hipotecario'
    ],
    'PyME': [
        'pyme', 'pymes', 'credito pyme', 'crédito pyme', 'empresarial', 'negocio', 'empresa', 'mipyme'
    ],
}

function detectProduct(text) {
    const t = text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    for (const [product, arr] of Object.entries(PRODUCT_SYNONYMS)) {
        for (const kw of arr) {
            const k = kw.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
            const regex = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
            if (regex.test(t)) return product
        }
    }
    return null
}

function parseIntent(text) {
    const t = text.toLowerCase()
    const wantApply = /(aplicar|solicitar|tramitar|quiero|obtener|necesito|me interesa)/.test(t)
    const askStatus = /(en que va|estado|estatus|seguimiento|como va|cómo va|mi solicitud)/.test(t)
    const askDocs = /(requisit|document|papeler[ií]a|papeleria)/.test(t)
    const askTimes = /(tiempo|sla|tarda|tardara|tardará|cu[aá]nto tarda|cuanto tarda)/.test(t)
    const wantUpload = /(subir|cargar|adjuntar|enviar).*(doc|archivo|dpi|constancia|pdf|foto)/.test(t)
    const wantAdvisor = /(asesor|humano|hablar|llamar|llamada|agente)/.test(t)
    const validate = /(validar|validaci[oó]n|verificar)/.test(t)

    const product = detectProduct(text)

    if (wantApply && product) return { action: 'create_case', product }
    if (wantApply) return { action: 'create_case', product: null }
    if (askStatus) return { action: 'ask_status' }
    if (askDocs) return { action: 'ask_requirements', product }
    if (askTimes) return { action: 'ask_times' }
    if (wantUpload) return { action: 'upload_docs' }
    if (wantAdvisor) return { action: 'advisor' }
    if (validate) return { action: 'validate' }
    return { action: null, product }
}

export default function BamiChatWidget({ variant = 'floating' }) {
    const [open, setOpen] = useState(variant === 'panel' || variant === 'fullscreen')
    const [messages, setMessages] = useState([])
    const [showUpload, setShowUpload] = useState(false)
    const [mode, setMode] = useState('bami') // 'bami' | 'ai' | 'advisor'
    const [typing, setTyping] = useState(false)
    const [advisorConnected, setAdvisorConnected] = useState(false)
    const [advisorQueue, setAdvisorQueue] = useState(3)
    const [c, setC] = useState(getCase())
    const inputRef = useRef(null)
    const listRef = useRef(null)
    const sseRef = useRef(null)

    useEffect(() => {
        const onU = (e) => setC(e.detail)
        window.addEventListener('bami:caseUpdate', onU)
        return () => window.removeEventListener('bami:caseUpdate', onU)
    }, [])

    useEffect(() => {
        const openChat = () => setOpen(true)
        const openUpload = () => { setOpen(true); setShowUpload(true); push('bami', 'Abrí el asistente de subida de documentos.') }
        const runValidate = async () => { setOpen(true); await validateAI(true) }
        const callAdvisor = () => { setOpen(true); connectAdvisor() }
        const pushMsg = (e) => { setOpen(true); push(e.detail?.role || 'bami', e.detail?.text || '') }

        window.addEventListener('bami:open', openChat)
        window.addEventListener('bami:upload', openUpload)
        window.addEventListener('bami:validate', runValidate)
        window.addEventListener('bami:advisor', callAdvisor)
        window.addEventListener('bami:msg', pushMsg)
        return () => {
            window.removeEventListener('bami:open', openChat)
            window.removeEventListener('bami:upload', openUpload)
            window.removeEventListener('bami:validate', runValidate)
            window.removeEventListener('bami:advisor', callAdvisor)
            window.removeEventListener('bami:msg', pushMsg)
        }
    }, [])

    const push = (role, text) => setMessages((m) => [...m, { id: Date.now() + Math.random(), role, text }])

    const scrollBottom = () => {
        requestAnimationFrame(() => {
            listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
        })
    }
    useEffect(scrollBottom, [messages, typing])

    const greet = () => {
        const who = 'BAMI'
        push('bami', `Hola, soy ${who} 🤝 Puedo acompañarte en tu solicitud.`)
        const cur = getCase()
        if (!cur) {
            push('bami', [
                'Dime con tus palabras qué necesitas: *“quiero aplicar a tarjeta de crédito”*, *“requisitos de hipoteca”*, *“¿en qué va mi solicitud?”*…',
                'También puedes escribir: **nuevo**, **requisitos**, **tiempos**, **subir documentos**.'
            ].join('\n'))
        } else {
            push('bami', `Tu expediente ${cur.id} (${cur.product}) está en ${cur.stage}.`)
        }
    }
    useEffect(() => { if (open && messages.length === 0) greet() }, [open]) // eslint-disable-line

    // SSE narración IA (solo si hay expediente)
    useEffect(() => {
        if (!open || !getCase()?.id) {
            if (sseRef.current) { sseRef.current.close(); sseRef.current = null }
            return
        }
        const caseId = getCase().id
        const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
        const url = `${base}/stream/${caseId}`
        if (sseRef.current) { sseRef.current.close(); sseRef.current = null }
        const es = new EventSource(url)
        sseRef.current = es
        es.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data)
                const role = data.role || 'bami'
                const text = data.text || ''
                if (text) push(role, text)
            } catch {}
        }
        es.onerror = () => { es.close(); sseRef.current = null }
        return () => { es.close(); sseRef.current = null }
    }, [open, c?.id])

    /** Acciones rápidas **/
    const newCase = async (product = 'Tarjeta de Crédito') => {
        const cc = await createNewCase(product, getCase()?.applicant || null)
        notify('Expediente creado')
        push('user', `Iniciar expediente de ${product}`)
        setTimeout(() => {
            push('bami', `Listo, abrí el expediente ${cc.id} para **${product}**.`)
            const req = PRODUCT_RULES[product]?.map(r => r.replaceAll('_',' ')).join(', ') || 'requisitos básicos'
            push('bami', `Para este producto se requiere: ${req}. Cuando tengas tus documentos, escribe **“subir documentos”** o usa el botón.`)
            window.dispatchEvent(new Event('bami:upload'))
            window.dispatchEvent(new Event('ui:tracker:open'))
        }, 150)
    }

    const askMissing = async () => {
        const current = getCase()
        if (!current) return push('bami', 'Aún no hay expediente. Escribe **“nuevo”** o dime el producto (ej. “aplicar a tarjeta de crédito”).')
        await refreshTracker()
        const fresh = getCase()
        push('user', '¿Qué me falta?')
        push('bami', fresh.missing?.length ? `Faltan: ${fresh.missing.join(', ')}.` : 'No tienes faltantes. ¡Vamos a revisión!')
        window.dispatchEvent(new Event('ui:tracker:open'))
    }

    const openUploadManual = () => {
        if (!getCase()) return push('bami', 'Primero creo tu expediente. Dime el producto (ej. “aplicar a tarjeta de crédito”).')
        push('user', 'Subir documentos'); setShowUpload(true)
    }

    const afterUpload = async () => {
        push('bami', '📥 Recibí tus archivos. Voy leyendo lo que enviaste…')
        await refreshTracker()
        push('bami', 'Si quieres, puedo **validar con IA** para darte un resultado preliminar.')
        window.dispatchEvent(new Event('ui:tracker:open'))
    }

    const validateAI = async (silent = false) => {
        if (!getCase()) return push('bami', 'Crea tu expediente primero con “nuevo” o dime el producto.')
        setMode('ai'); if (!silent) push('user', 'Validar con IA'); setTyping(true)
        const steps = [
            '🔍 Revisando legibilidad de archivos…',
            '🛡️ Confirmando identidad y seguridad…',
            '📈 Evaluando reglas del producto…',
            '✨ Calculando score y explicabilidad…',
        ]
        for (let i = 0; i < steps.length; i++) {
            push('ai', steps[i])
            // eslint-disable-next-line no-await-in-loop
            await new Promise(r => setTimeout(r, 600))
        }
        try {
            const { message } = await validateWithAI()
            setTyping(false)
            push('ai', `Resultado: ${message}`)
            await refreshTracker()
            window.dispatchEvent(new Event('ui:tracker:open'))
        } catch {
            setTyping(false)
            push('ai', 'No pude completar la validación ahora mismo. ¿Probamos otra vez o te conecto con un asesor?')
            notify('Error al validar', 'error')
        }
    }

    const connectAdvisor = () => {
        setMode('advisor'); push('user', 'Hablar con un asesor')
        setTyping(true); setAdvisorConnected(false); setAdvisorQueue(3)
        const interval = setInterval(() => setAdvisorQueue(q => (q > 1 ? q - 1 : q)), 800)
        setTimeout(() => {
            clearInterval(interval); setTyping(false); setAdvisorConnected(true)
            push('advisor', '¡Hola! Soy Sofía, tu asesora. ¿Me confirmas tu DPI para verificar el expediente?')
            window.dispatchEvent(new Event('ui:tracker:open'))
        }, 2400)
    }
    const endAdvisor = () => { setAdvisorConnected(false); push('advisor', 'Gracias por contactarnos. Cierro el chat, pero puedes volver cuando quieras.') }
    const changeChannel = (ch) => { setChannel(ch); push('bami', `Continuaremos por ${ch.toUpperCase()} sin perder el progreso.`) }

    // Fallback local: respuestas útiles cuando el backend no conteste
    function localWarmupReply(userText = '') {
        const { action, product } = parseIntent(userText)
        if (action === 'create_case' && product) {
            return `Puedo abrir tu expediente para **${product}** desde aquí. ¿Confirmas que iniciemos ahora? Escribe **"nuevo"** o **"sí"**.`
        }
        if (action === 'ask_requirements') {
            const p = product || 'Tarjeta de Crédito'
            const req = PRODUCT_RULES[p]?.map(r => r.replaceAll('_',' ')).join(', ') || 'requisitos básicos'
            return `Para **${p}** se requiere: ${req}. Si gustas, puedo abrir tu expediente; dime “aplicar a ${p}”.`
        }
        if (action === 'ask_times') return 'El tiempo típico de análisis es **8–24h hábiles**, sujeto a carga y validaciones.'
        if (action === 'advisor') return 'Puedo conectarte con un asesor humano en cualquier momento. Escribe **asesor** para iniciar.'
        return [
            'Puedo crear tu expediente (ej. “aplicar a tarjeta de crédito”), mostrar **requisitos**, **tiempos**, abrir **subida de documentos**, o conectarte con un **asesor**.',
            '¿Qué deseas hacer?'
        ].join('\n')
    }

    /** Input libre con backend + orquestación local */
    const handleSend = async (e) => {
        e?.preventDefault()
        const val = (inputRef.current?.value || '').trim()
        if (!val) return
        push('user', val); inputRef.current.value = ''

        // 1) Intención local inmediata (para UX ágil)
        const t = val.toLowerCase()
        if (t === 'nuevo' || t === 'sí' || t === 'si') return newCase('Tarjeta de Crédito')
        if (t.includes('falta') || t.includes('pendiente')) return askMissing()
        if (t.includes('subir') || t.includes('document')) return openUploadManual()
        if (t.includes('valid')) return validateAI()
        if (t.includes('asesor') || t.includes('humano')) return connectAdvisor()

        const { action, product } = parseIntent(val)

        // Crear expediente directo cuando el usuario lo pide con producto
        if (action === 'create_case' && product) {
            return newCase(product)
        }
        // Pide crear pero sin producto → ofrezco opciones
        if (action === 'create_case' && !product) {
            push('bami', 'Perfecto, ¿para qué producto deseas aplicar? Elige una opción o escríbela:')
            push('bami', '• Tarjeta de Crédito\n• Préstamo Personal\n• Hipoteca\n• PyME')
            return
        }
        if (action === 'ask_requirements') {
            const p = product || (getCase()?.product ?? 'Tarjeta de Crédito')
            const req = PRODUCT_RULES[p]?.map(r => r.replaceAll('_',' ')).join(', ') || 'requisitos básicos'
            push('bami', `Para **${p}** se requiere: ${req}. ¿Deseas que abra tu expediente ahora?`)
            return
        }
        if (action === 'ask_times') {
            push('bami', 'El tiempo típico de análisis es **8–24h hábiles**. Puedo iniciar tu expediente cuando me indiques el producto.')
            return
        }
        if (action === 'upload_docs') return openUploadManual()
        if (action === 'advisor') return connectAdvisor()
        if (action === 'validate') return validateAI()

        // 2) Si nada de lo anterior aplicó, consulto al backend
        try {
            setTyping(true)
            const apiMode = (mode === 'advisor') ? 'asesor' : (mode === 'ai' ? 'ia' : mode)
            const reply = await chatBackend({ message: val, mode: apiMode })
            setTyping(false)
            const role = mode === 'advisor' ? 'advisor' : mode === 'ai' ? 'ai' : 'bami'
            push(role, reply)
        } catch {
            setTyping(false)
            // 3) Fallback útil
            const warm = localWarmupReply(val)
            push('bami', warm)
        }
    }

    // —— UI ——
    const HeaderTab = ({ id, icon: Icon, children }) => (
        <button
            onClick={() => setMode(id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm ${mode === id ? 'bg-white shadow' : 'hover:bg-white/60'}`}
        >
            <Icon size={16} /> {children}
        </button>
    )

    // Mini barra de estado (cuando hay expediente)
    const MiniTrackerBar = () => {
        const cur = getCase()
        if (!cur) return null
        const stageMap = { requiere: 10, recibido: 35, en_revision: 70, aprobado: 100, alternativa: 70 }
        const pct = stageMap[cur.stage] ?? cur.percent ?? 0
        return (
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-b bg-white">
                <div className="flex items-center gap-3 overflow-hidden">
                    <ProgressRing size={36} stroke={6} value={pct} label={`${pct}%`} />
                    <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{cur.id} · {cur.product}</div>
                        <div className="text-xs text-gray-600 truncate">Estado: <b className="capitalize">{cur.stage.replace('_',' ')}</b> · Canal: <b className="uppercase">{cur.channel}</b></div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button className="btn btn-dark btn-sm" onClick={() => window.dispatchEvent(new Event('ui:tracker:open'))}>Ver detalle</button>
                </div>
            </div>
        )
    }

    const ChatHeader = (
        <div className="flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 bg-bami-yellow/60">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <div className="font-semibold">Acompañamiento</div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <HeaderTab id="bami" icon={Bot}>BAMI</HeaderTab>
                    <HeaderTab id="ai" icon={Sparkles}>IA</HeaderTab>
                    <HeaderTab id="advisor" icon={Headphones}>Asesor</HeaderTab>

                    {/* Accesos rápidos a Tracker / Ops */}
                    <button
                        className="ml-2 border rounded-md px-2 py-1 inline-flex items-center gap-1"
                        onClick={() => window.dispatchEvent(new Event('ui:tracker:toggle'))}
                        title="Tracker"
                        aria-label="Abrir tracker"
                    >
                        <BarChart2 size={14}/> Tracker
                    </button>
                    <button
                        className="border rounded-md px-2 py-1 inline-flex items-center gap-1"
                        onClick={() => window.dispatchEvent(new Event('ui:ops:toggle'))}
                        title="Panel Ops"
                        aria-label="Abrir panel de análisis"
                    >
                        <LayoutDashboard size={14}/> Ops
                    </button>

                    <select
                        className="ml-2 border rounded-md px-2 py-1"
                        defaultValue={localStorage.getItem('bami_channel') || 'web'}
                        onChange={(e) => changeChannel(e.target.value)}
                    >
                        <option value="web">Web</option>
                        <option value="app">App</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="sucursal">Sucursal</option>
                        <option value="callcenter">Call Center</option>
                    </select>
                </div>
            </div>

            {/* Mini tracker si hay expediente */}
            <MiniTrackerBar />
        </div>
    )

    const ChatBody = (
        <div ref={listRef} className="flex-1 overflow-auto p-3 space-y-3 bg-white">
            {messages.map(m => <MessageBubble key={m.id} role={m.role} text={m.text} />)}
            {typing && (
                <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-gray-100">
                    <TypingDots />
                </div>
            )}
            {mode === 'advisor' && !advisorConnected && (
                <div className="text-xs text-gray-600">En cola para asesor… Quedan <b>{advisorQueue}</b> por delante.</div>
            )}
        </div>
    )

    const QuickActions = (
        <div className="px-2 pt-2">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                <button type="button" onClick={() => newCase('Tarjeta de Crédito')} className="px-3 py-1.5 text-xs rounded-full border bg-white whitespace-nowrap hover:bg-gray-50">TC</button>
                <button type="button" onClick={() => newCase('Préstamo Personal')} className="px-3 py-1.5 text-xs rounded-full border bg-white whitespace-nowrap hover:bg-gray-50">Préstamo</button>
                <button type="button" onClick={() => newCase('Hipoteca')} className="px-3 py-1.5 text-xs rounded-full border bg-white whitespace-nowrap hover:bg-gray-50">Hipoteca</button>
                <button type="button" onClick={() => newCase('PyME')} className="px-3 py-1.5 text-xs rounded-full border bg-white whitespace-nowrap hover:bg-gray-50">PyME</button>
                <button type="button" onClick={askMissing} className="px-3 py-1.5 text-xs rounded-full border bg-white whitespace-nowrap hover:bg-gray-50">Faltantes</button>
                <button type="button" onClick={openUploadManual} className="px-3 py-1.5 text-xs rounded-full border bg-white whitespace-nowrap hover:bg-gray-50">Subir docs</button>
                <button type="button" onClick={() => validateAI()} className="px-3 py-1.5 text-xs rounded-full border bg-white whitespace-nowrap hover:bg-gray-50">Validar IA</button>
                {!advisorConnected ? (
                    <button type="button" onClick={connectAdvisor} className="px-3 py-1.5 text-xs rounded-full border bg-white whitespace-nowrap hover:bg-gray-50">Asesor</button>
                ) : (
                    <button type="button" onClick={endAdvisor} className="px-3 py-1.5 text-xs rounded-full border bg-white whitespace-nowrap hover:bg-gray-50">Finalizar</button>
                )}
                <button type="button" onClick={() => window.location.assign('/bami')} className="px-3 py-1.5 text-xs rounded-full border bg-white whitespace-nowrap hover:bg-gray-50">Tracker</button>
            </div>
        </div>
    )

    const ChatInputRow = (
        <div className="p-2 grid grid-cols-12 gap-2">
            <div className="col-span-9 sm:col-span-9 flex gap-2">
                <input
                    ref={inputRef}
                    className="flex-1 border rounded-xl px-3 h-12 text-sm"
                    placeholder='Dime: “aplicar a tarjeta de crédito”, “requisitos de hipoteca”, “subir documentos”…'
                    aria-label="Mensaje para BAMI"
                />
            </div>
            <div className="col-span-3 sm:col-span-3 flex justify-end">
                <button
                    className="btn btn-dark text-xs px-3 h-12 min-w-[100px] rounded-xl flex items-center justify-center gap-1"
                    onClick={handleSend}
                    aria-label="Enviar mensaje"
                >
                    <Send size={14}/> Enviar
                </button>
            </div>
        </div>
    )

    const ChatFooter = (
        <div className="border-t bg-gray-50 sticky bottom-0">
            {QuickActions}
            <form onSubmit={handleSend} className="border-t">
                {ChatInputRow}
            </form>
        </div>
    )

    // — Alturas según variante —
    const containerHeight =
        variant === 'fullscreen'
            ? 'h-[calc(100vh-180px)] md:h-[calc(100vh-160px)]'
            : (variant === 'panel' ? 'h-[520px]' : 'h-[520px]')

    const ChatWindow = (
        <div className={`flex flex-col ${containerHeight}`}>
            {ChatHeader}
            {ChatBody}
            {ChatFooter}
        </div>
    )

    if (variant === 'panel') {
        return (
            <>
                <div className="rounded-2xl border shadow-sm overflow-hidden">{ChatWindow}</div>
                <UploadAssistant open={showUpload} onClose={() => setShowUpload(false)} onUploaded={afterUpload} />
            </>
        )
    }
    if (variant === 'fullscreen') {
        return (
            <>
                {/* Full width panel */}
                <div className="rounded-none md:rounded-none overflow-hidden">{ChatWindow}</div>
                <UploadAssistant open={showUpload} onClose={() => setShowUpload(false)} onUploaded={afterUpload} />
            </>
        )
    }
    // Floating widget (legacy)
    return (
        <>
            <button
                onClick={() => setOpen(v => !v)}
                className="fixed bottom-4 right-4 z-[55] rounded-full shadow-lg border bg-bami-yellow w-14 h-14 grid place-items-center"
                aria-label="Abrir chat BAMI"
            >
                <span className="text-xl">🤖</span>
            </button>
            {open && (
                <div className="fixed bottom-20 right-4 z-[56] w-[380px] max-w-[90vw] bg-white rounded-2xl shadow-2xl border overflow-hidden">
                    {ChatWindow}
                </div>
            )}
            <UploadAssistant open={showUpload} onClose={() => setShowUpload(false)} onUploaded={afterUpload} />
        </>
    )
}
