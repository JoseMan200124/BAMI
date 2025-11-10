// src/components/BamiChatWidget.jsx
import React, { useEffect, useRef, useState, useLayoutEffect } from 'react'
import UploadAssistant from './UploadAssistant.jsx'
import TypingDots from './TypingDots.jsx'
import MessageBubble from './MessageBubble.jsx'
import {
    createNewCase, getCase, notify, setChannel,
    chatBackend, validateWithAI, refreshTracker, PRODUCT_RULES
} from '../lib/caseStore.js'
import { Bot, Headphones, Sparkles, Send, BarChart2, LayoutDashboard, X } from 'lucide-react'
import ProgressRing from './ProgressRing.jsx'

/** — NLP simple y utilidades — **/
const PRODUCT_SYNONYMS = {
    'Tarjeta de Crédito': ['tarjeta de credito','tarjeta de crédito','tarjeta','tc','visa','mastercard','master card'],
    'Préstamo Personal': ['prestamo','préstamo','prestamo personal','préstamo personal','credifacil','credi facil','credito personal','crédito personal','credito','crédito'],
    'Hipoteca': ['hipoteca','credito hipotecario','crédito hipotecario','hipotecario'],
    'PyME': ['pyme','pymes','credito pyme','crédito pyme','empresarial','negocio','empresa','mipyme'],
}
function detectProduct(text){
    const t = text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'')
    for (const [product, arr] of Object.entries(PRODUCT_SYNONYMS)){
        for (const kw of arr){
            const k = kw.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'')
            const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`, 'i')
            if (re.test(t)) return product
        }
    }
    return null
}
function parseIntent(text){
    const t = text.toLowerCase()
    const wantCreateVerb = /(crear|abrir|iniciar|empezar|generar)/.test(t)
    const mentionCase = /(expediente|proceso|solicitud)/.test(t)
    const wantApply = /(aplicar|solicitar|tramitar|quiero|obtener|necesito|me interesa)/.test(t) || (wantCreateVerb && (mentionCase || true))
    const askStatus = /(en que va|estado|estatus|seguimiento|como va|cómo va|mi solicitud)/.test(t)
    const askDocs = /(requisit|document|papeler[ií]a|papeleria)/.test(t)
    const askTimes = /(tiempo|sla|tarda|tardara|tardará|cu[aá]nto tarda|cuanto tarda)/.test(t)
    const wantUpload = /(subir|cargar|adjuntar|enviar).*(doc|archivo|dpi|constancia|pdf|foto)/.test(t)
    const wantAdvisor = /(asesor|humano|hablar|llamar|llamada|agente)/.test(t)
    const validate = /(validar|validaci[oó]n|verificar)/.test(t)
    const product = detectProduct(text)

    if (wantApply && product) return { action: 'create_case', product }
    if (wantApply && !product) return { action: 'create_case', product: null }
    if (askStatus) return { action: 'ask_status' }
    if (askDocs) return { action: 'ask_requirements', product }
    if (askTimes) return { action: 'ask_times' }
    if (wantUpload) return { action: 'upload_docs' }
    if (wantAdvisor) return { action: 'advisor' }
    if (validate) return { action: 'validate' }
    if (product) return { action: null, product }
    return { action: null, product: null }
}

/** — Estilos globales para dock + burbujas de marca — **/
const BrandStyles = (
    <style
        dangerouslySetInnerHTML={{
            __html: `
@keyframes bami-pop { 0% { opacity: 0; transform: translateY(8px) scale(.98) } 100% { opacity: 1; transform: translateY(0) scale(1) } }
@keyframes bami-ring { 0% { transform: scale(1); opacity:.45 } 70% { opacity:.15 } 100% { transform: scale(1.35); opacity:0 } }

/* Botón dock (flotante) */
.bami-dock-glow::before{
  content:'';
  position:absolute; inset:-12px;
  border-radius:9999px;
  background: radial-gradient(40% 40% at 50% 60%, rgba(251,191,36,.30), transparent 70%);
  filter: blur(12px);
  z-index:-1;
}
.bami-dock-pulse{
  position:absolute; inset:0; border-radius:9999px;
  box-shadow: 0 0 0 2px rgba(250,204,21,.55) inset;
  animation: bami-ring 1800ms ease-out infinite;
  pointer-events:none;
}

/* Burbujas ricas con avatar grande a la izquierda */
.bami-speech { display:flex; align-items:flex-end; gap:.75rem; }
.bami-speech .bami-avatar{
  position:relative; width:60px; height:60px; border-radius:9999px;
  background: white; box-shadow: 0 6px 18px rgba(0,0,0,.10);
  border: 1px solid rgba(0,0,0,.06);
}
.bami-speech .bami-avatar .ring{
  position:absolute; inset:-6px; border-radius:9999px;
  background: radial-gradient(50% 50% at 70% 30%, rgba(253,230,138,.65), rgba(251,191,36,.25) 60%, transparent 65%);
  filter: blur(6px); pointer-events:none;
}
.bami-speech .bami-bubble{
  position:relative; background:#f6f7f9; border:1px solid rgba(0,0,0,.05);
  border-radius:18px; padding:12px 12px 10px;
  max-width: calc(100% - 72px);  /* deja espacio al avatar */
  box-shadow: 0 6px 12px rgba(15,23,42,.06);
}
.bami-speech .bami-bubble::before{
  content:''; position:absolute; left:-6px; bottom:16px; width:12px; height:12px;
  background:#f6f7f9; transform:rotate(45deg);
  border-left:1px solid rgba(0,0,0,.06); border-bottom:1px solid rgba(0,0,0,.06);
}
.bami-speech .bami-chip{
  display:inline-flex; align-items:center; gap:.35rem;
  font-weight:600; font-size:12px; color:#374151;
  background:white; border:1px solid rgba(0,0,0,.06);
  padding:.2rem .5rem; border-radius:9999px; margin-bottom:.35rem;
  box-shadow: 0 2px 6px rgba(0,0,0,.05);
}
.bami-notch {
  position:absolute; width:14px; height:14px; background:#fff;
  transform: rotate(45deg);
  bottom:-7px; right:28px;
  border-left:1px solid rgba(0,0,0,.05);
  border-bottom:1px solid rgba(0,0,0,.05);
  box-shadow: 0 3px 8px rgba(0,0,0,.06);
}

/* Estabilidad de scroll */
.bami-stable, .bami-stable * { transition: none !important; animation: none !important; }
.bami-stable .bami-no-anchoring { overflow-anchor: none; }
.bami-stable .bami-scroll { scrollbar-gutter: stable; }
`}}
    />
)

/** — Avatar-base grande + burbuja “speech” — **/
function BamiSpeech({ title, subtitle, children }){
    return (
        <div className="bami-speech">
            {/* Avatar grande */}
            <div className="bami-avatar">
                <span className="ring" aria-hidden />
                <img
                    src="/BAMI.svg"
                    alt="BAMI"
                    className="w-full h-full object-contain p-2.5"
                    draggable={false}
                />
            </div>

            {/* Bubble alineada con notch */}
            <div className="bami-bubble">
                <div className="bami-chip">
                    <img src="/BAMI.svg" alt="" className="w-4 h-4 object-contain rounded-full" />
                    BAMI
                </div>
                {title && <div className="font-semibold">{title}</div>}
                {subtitle && <div className="text-xs text-gray-600 mt-0.5">{subtitle}</div>}
                {children}
            </div>
        </div>
    )
}

/** — Contenido reutilizable dentro de la bubble — **/
function Chips({ items, onAction, asButtons=false }){
    const norm = items.map(it => typeof it === 'string' ? { label: it, value: it } : it)
    return (
        <div className="flex flex-wrap gap-2 mt-2">
            {norm.map(({label, value}, idx)=>(
                asButtons ? (
                    <button
                        key={idx}
                        type="button"
                        onClick={()=>onAction?.(value)}
                        className="px-3 py-1.5 text-xs rounded-full border bg-white whitespace-nowrap hover:bg-gray-50"
                    >
                        {label}
                    </button>
                ) : (
                    <span key={idx} className="px-2 py-1 text-xs rounded-full border bg-white whitespace-nowrap">
            {label}
          </span>
                )
            ))}
        </div>
    )
}

function RichListMessage({ payload, onAction }){
    const { title, subtitle, kind='tags', items=[], asButtons=false } = payload || {}
    return (
        <BamiSpeech title={title} subtitle={subtitle}>
            {kind === 'tags' && <Chips items={items} onAction={onAction} asButtons={false}/>}
            {kind === 'chips' && <Chips items={items} onAction={onAction} asButtons={asButtons}/>}
            {kind === 'bullets' && (
                <ul className="mt-2 list-disc pl-5 text-[13px] sm:text-sm text-gray-700">
                    {items.map((t,i)=><li key={i}>{t}</li>)}
                </ul>
            )}
        </BamiSpeech>
    )
}

export default function BamiChatWidget({
                                           variant='floating',
                                           disableFloatingTrigger=false,
                                           allowOpsButton=false,
                                           embed=false,     // si vive dentro del simulador
                                       }) {
    const [open,setOpen] = useState(variant==='panel' || variant==='fullscreen' || variant==='app')
    const [messages,setMessages] = useState([])
    const [showUpload,setShowUpload] = useState(false)
    const [mode,setMode] = useState('bami')
    const [typing,setTyping] = useState(false)
    const [advisorConnected,setAdvisorConnected] = useState(false)
    const [advisorQueue,setAdvisorQueue] = useState(3)
    const [c,setC] = useState(getCase())

    const inputRef = useRef(null)
    const listRef = useRef(null)
    const footerRef = useRef(null)
    const sseRef = useRef(null)
    const greetedOnce = useRef(false)
    const [bodyPad, setBodyPad] = useState(88)

    // Alto footer dinámico
    useLayoutEffect(() => {
        const el = footerRef.current
        if (!el) return
        let frame = null
        let lastH = -1
        const ro = new ResizeObserver((entries) => {
            const cr = entries[0]?.contentRect
            if (!cr) return
            const h = Math.round(cr.height)
            if (Math.abs(h - lastH) < 2) return
            lastH = h
            if (frame) cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                setBodyPad(Math.max(72, h + 8))
            })
        })
        ro.observe(el)
        return () => { if (frame) cancelAnimationFrame(frame); ro.disconnect() }
    }, [])

    // Prefijo dinámico: si el simulador está abierto, forzamos 'sim'
    const basePrefix = embed ? 'sim' : 'ui'
    const getPrefix = () => (typeof window!=='undefined' && window.__BAMI_SIM_OPEN__ ? 'sim' : basePrefix)
    const ev = (name) => new Event(`${getPrefix()}:${name}`)

    const push=(role,text)=>setMessages(m=>[...m,{id:Date.now()+Math.random(),role,text}])
    const pushRich=(payload)=>setMessages(m=>[...m,{id:Date.now()+Math.random(),role:'bami',type:'rich',payload}])

    const scrollBottom=()=>{ requestAnimationFrame(()=>{ listRef.current?.scrollTo({ top:listRef.current.scrollHeight, behavior:'auto' }) }) }
    useEffect(scrollBottom,[messages,typing])

    useEffect(()=>{ const onU=(e)=>setC(e.detail); window.addEventListener('bami:caseUpdate',onU); return ()=>window.removeEventListener('bami:caseUpdate',onU) },[])

    // Suscripciones (compatibles con embed)
    useEffect(()=>{
        const openChat = ()=>{ if (window.__BAMI_AGENT_ACTIVE__===true) return; setOpen(true) }
        const closeChat = ()=>{ setOpen(false); setShowUpload(false) }
        const openUpload = ()=>{ setOpen(true); setShowUpload(true); push('bami','Abrí el asistente de subida de documentos.') }
        const runValidate = async()=>{ if (window.__BAMI_AGENT_ACTIVE__===true) { return } ; setOpen(true); await validateAI(true) }
        const callAdvisor = ()=>{ if (window.__BAMI_AGENT_ACTIVE__===true) return; setOpen(true); connectAdvisor() }
        const pushMsg = (e)=>{ if (window.__BAMI_AGENT_ACTIVE__===true) return; setOpen(true); push(e.detail?.role||'bami', e.detail?.text||'') }

        const prefixes = embed ? ['sim'] : ['ui','bami','sim']
        const allEvents = [
            ['open', openChat],
            ['close', closeChat],
            ['upload', openUpload],
            ['validate', runValidate],
            ['advisor', callAdvisor],
            ['msg', pushMsg],
        ]
        prefixes.forEach(p => allEvents.forEach(([n,fn]) => window.addEventListener(`${p}:${n}`, fn)))
        return ()=> { prefixes.forEach(p => allEvents.forEach(([n,fn]) => window.removeEventListener(`${p}:${n}`, fn))) }
    },[embed])

    // SSE cuando hay case y el chat está abierto
    useEffect(()=>{
        if(!open || !getCase()?.id){ if(sseRef.current){ sseRef.current.close(); sseRef.current=null } ; return }
        const caseId=getCase().id
        const base=(import.meta.env.VITE_API_URL || '/api').replace(/\/$/,'')
        const url=`${base}/stream/${caseId}`
        if(sseRef.current){ sseRef.current.close(); sseRef.current=null }
        const es=new EventSource(url); sseRef.current=es
        es.onmessage=(ev)=>{ try{ const data=JSON.parse(ev.data); const role=data.role||'bami'; const text=data.text||''; if(text) push(role,text) } catch{} }
        es.onerror=()=>{ es.close(); sseRef.current=null }
        return ()=>{ es.close(); sseRef.current=null }
    },[open,c?.id])

    const greet=()=>{
        push('bami', 'Hola, soy BAMI 🤝 Puedo acompañarte en tu solicitud.')
        const cur=getCase()
        if (!cur) {
            pushRich({
                title: 'Acciones rápidas',
                subtitle: 'Toca un comando o escribe con tus palabras',
                kind: 'chips',
                asButtons: true,
                items: [
                    { label: 'Nuevo expediente', value: 'nuevo' },
                    { label: 'Ver requisitos', value: 'requisitos' },
                    { label: 'Tiempos', value: 'tiempos' },
                    { label: 'Subir documentos', value: 'subir documentos' },
                ]
            })
        } else {
            push('bami', `Tu expediente ${cur.id} (${cur.product}) está en ${cur.stage}.`)
        }
    }
    useEffect(()=>{
        if (open && !greetedOnce.current){
            greetedOnce.current = true
            greet()
        }
    },[open])

    const processInput = async (val)=>{
        const t = val.toLowerCase()
        if (t==='tracker') { window.dispatchEvent(ev('tracker:open')); return }
        if (t==='nuevo' || t==='sí' || t==='si') return newCase('Tarjeta de Crédito')
        if (t.includes('falta') || t.includes('pendiente')) return askMissing()
        if (t.includes('subir') || t.includes('document')) return openUploadManual()
        if (t.includes('valid')) return validateAI()
        if (t.includes('asesor') || t.includes('humano')) return connectAdvisor()

        const { action, product } = parseIntent(val)
        const detectedProduct = product || detectProduct(val)

        if (detectedProduct && (!action || action === 'product_info')) return newCase(detectedProduct)

        if (action === 'create_case' && !detectedProduct) {
            window.dispatchEvent(new Event('bami:clientflow:start'))
            window.dispatchEvent(new Event('bami:clientflow:ensureClientVisible'))
            push('bami','Perfecto, ¿para qué producto deseas aplicar?')
            pushRich({
                title: 'Elige un producto',
                kind: 'chips',
                asButtons: true,
                items: [
                    { label: 'Tarjeta de Crédito', value: 'Tarjeta de Crédito' },
                    { label: 'Préstamo Personal', value: 'Préstamo Personal' },
                    { label: 'Hipoteca', value: 'Hipoteca' },
                    { label: 'PyME', value: 'PyME' },
                ]
            })
            return
        }

        if (action === 'create_case' && detectedProduct) return newCase(detectedProduct)

        if (action === 'ask_requirements') {
            window.dispatchEvent(new Event('bami:clientflow:start'))
            window.dispatchEvent(new Event('bami:clientflow:ensureClientVisible'))
            const p = detectedProduct || (getCase()?.product ?? 'Tarjeta de Crédito')
            const req = PRODUCT_RULES[p] || []
            pushRich({
                title: `Requisitos para ${p}`,
                kind: 'tags',
                items: req.map(r=>r.replaceAll('_',' '))
            })
            pushRich({
                title: '¿Abrimos tu expediente?',
                kind: 'chips',
                asButtons: true,
                items: [{label: `Aplicar a ${p}`, value: `aplicar ${p}`}]
            })
            return
        }

        if (action === 'ask_times') {
            window.dispatchEvent(new Event('bami:clientflow:ensureClientVisible'))
            push('bami', 'El tiempo típico de análisis es **8–24h hábiles**. Puedo iniciar tu expediente cuando me indiques el producto.')
            return
        }

        if (action === 'upload_docs') return openUploadManual()
        if (action === 'advisor') return connectAdvisor()
        if (action === 'validate') return validateAI()

        try{
            setTyping(true)
            const apiMode = (mode==='advisor') ? 'asesor' : (mode==='ai' ? 'ia' : mode)
            const reply = await chatBackend({ message: val, mode: apiMode })
            setTyping(false)
            const role = mode==='advisor' ? 'advisor' : (mode==='ai' ? 'ai' : 'bami')
            push(role, reply)
        } catch {
            setTyping(false)
            push('bami', localWarmupReply(val))
        }
    }
    const sendText = async (val)=>{
        const v=(val||'').trim()
        if(!v) return
        push('user',v)
        await processInput(v)
    }

    const handleSend=async(e)=>{
        e?.preventDefault()
        const val=(inputRef.current?.value || '').trim()
        if(!val) return
        inputRef.current.value=''
        push('user',val)
        await processInput(val)
    }

    function localWarmupReply(userText=''){
        const {action,product}=parseIntent(userText)
        if(action==='create_case' && product){ return `Puedo abrir tu expediente para **${product}** desde aquí. ¿Confirmas que iniciemos ahora? Escribe **"nuevo"** o **"sí"**.` }
        if(action==='ask_requirements'){ const p=product || 'Tarjeta de Crédito'; const req=PRODUCT_RULES[p]?.map(r=>r.replaceAll('_', ' ')).join(', ') || 'requisitos básicos'; return `Para **${p}** se requiere: ${req}. Si gustas, puedo abrir tu expediente; dime “aplicar a ${p}”.` }
        if(action==='ask_times') return 'El tiempo típico de análisis es **8–24h hábiles**, sujeto a carga y validaciones.'
        if(action==='advisor') return 'Puedo conectarte con un asesor humano en cualquier momento. Escribe **asesor** para iniciar.'
        return ['Puedo crear tu expediente, mostrar **requisitos** y **tiempos**, abrir **subida de documentos** o conectarte con un **asesor**.','¿Qué deseas hacer?'].join('\n')
    }

    const startClientFlowSignals = () => {
        window.dispatchEvent(new Event('bami:clientflow:start'))
        window.dispatchEvent(new Event('bami:clientflow:ensureClientVisible'))
    }

    const newCase=async(product='Tarjeta de Crédito')=>{
        startClientFlowSignals()
        const cc=await createNewCase(product, getCase()?.applicant || null)
        notify('Expediente creado')
        push('user',`Iniciar expediente de ${product}`)
        setTimeout(()=>{
            push('bami',`Listo, abrí el expediente ${cc.id} para **${product}**.`)
            const req=PRODUCT_RULES[product] || []
            if (req.length){
                pushRich({
                    title: `Requisitos para ${product}`,
                    subtitle: 'Puedes subirlos cuando quieras',
                    kind: 'tags',
                    items: req.map(r=>r.replaceAll('_',' '))
                })
            }
            pushRich({
                title: '¿Qué sigue?',
                kind: 'chips',
                asButtons: true,
                items: [
                    { label: 'Subir documentos', value: 'subir documentos' },
                    { label: 'Ver tracker', value: 'tracker' },
                ]
            })
            window.dispatchEvent(ev('upload'))
            window.dispatchEvent(ev('tracker:open'))
        },150)
    }

    const askMissing=async()=>{
        startClientFlowSignals()
        const current=getCase()
        if(!current) return push('bami','Aún no hay expediente. Escribe **“nuevo”** o dime el producto (ej. “tarjeta de crédito”).')
        await refreshTracker()
        const fresh=getCase()
        push('user','¿Qué me falta?')
        if (fresh.missing?.length){
            pushRich({
                title: 'Documentos pendientes',
                kind: 'tags',
                items: fresh.missing.map(d=>d.replaceAll('_',' '))
            })
            pushRich({
                title: '¿Deseas subirlos ahora?',
                kind: 'chips',
                asButtons: true,
                items: [{label: 'Subir ahora', value: 'subir documentos'}]
            })
        } else {
            push('bami','No tienes faltantes. ¡Vamos a revisión!')
        }
        window.dispatchEvent(ev('tracker:open'))
    }

    const openUploadManual=()=>{
        startClientFlowSignals()
        if(!getCase()) return push('bami','Primero creo tu expediente. Dime el producto.')
        push('user','Subir documentos')
        setShowUpload(true)
    }

    const afterUpload=async()=>{
        push('bami','📥 Recibí tus archivos. Estoy analizando con IA…')
        await refreshTracker()
        window.dispatchEvent(ev('tracker:open'))
    }

    const validateAI=async(silent=false)=>{
        startClientFlowSignals()
        if(!getCase()) return push('bami','Crea tu expediente primero con “nuevo” o dime el producto.')
        setMode('ai'); if(!silent) push('user','Validar con IA'); setTyping(true)
        const steps=['🔍 Revisando legibilidad de archivos…','🛡️ Confirmando identidad y seguridad…','📈 Evaluando reglas del producto…','✨ Calculando score y explicabilidad…']
        for (let i=0;i<steps.length;i++){ push('ai',steps[i]); await new Promise(r=>setTimeout(r,600)) } // eslint-disable-line no-await-in-loop
        try{ const {message}=await validateWithAI(); setTyping(false); push('ai',`Resultado: ${message}`); await refreshTracker(); window.dispatchEvent(ev('tracker:open')) }
        catch{ setTyping(false); push('ai','No pude completar la validación ahora mismo. ¿Probamos otra vez o te conecto con un asesor?'); notify('Error al validar','error') }
    }

    const connectAdvisor=()=>{
        startClientFlowSignals()
        setMode('advisor')
        push('user','Hablar con un asesor')
        setTyping(true)
        setAdvisorConnected(false)
        setAdvisorQueue(3)
        const it=setInterval(()=>setAdvisorQueue(q => (q > 1 ? q - 1 : q)),800)
        setTimeout(()=>{
            clearInterval(it)
            setTyping(false)
            setAdvisorConnected(true)
            push('advisor','¡Hola! Soy Sofía, tu asesora. ¿Me confirmas tu DPI para verificar el expediente?')
            window.dispatchEvent(ev('tracker:open'))
        },2400)
    }
    const endAdvisor=()=>{ setAdvisorConnected(false); push('advisor','Gracias por contactarnos. Cierro el chat, pero puedes volver cuando quieras.') }
    const changeChannel=(ch)=>{ setChannel(ch); push('bami',`Continuaremos por ${ch.toUpperCase()} sin perder el progreso.`) }

    /** UI encabezado / mini tracker **/
    const HeaderTab=({id,icon:Icon,children})=>(
        <button onClick={()=>setMode(id)} className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm ${mode===id?'bg-white shadow':'hover:bg-white/60'}`}>
            <Icon size={16}/> {children}
        </button>
    )

    const MiniTrackerBar=()=>{
        const cur=getCase(); if(!cur) return null
        const stageMap={requiere:10,recibido:35,en_revision:70,aprobado:100,alternativa:70}
        const pct=stageMap[cur.stage] ?? cur.percent ?? 0
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
                    <button className="btn btn-dark btn-sm" onClick={()=>window.dispatchEvent(ev('tracker:open'))}>Ver detalle</button>
                </div>
            </div>
        )
    }

    // Header responsive
    const ControlStrip = ({ compact = false }) => (
        <div className={`flex items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
            <HeaderTab id="bami" icon={Bot}>BAMI</HeaderTab>
            <HeaderTab id="ai" icon={Sparkles}>IA</HeaderTab>
            <HeaderTab id="advisor" icon={Headphones}>Asesor</HeaderTab>
            <button
                className={`ml-0.5 border rounded-md ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'} inline-flex items-center gap-1`}
                onClick={()=>window.dispatchEvent(ev('tracker:toggle'))}
                title="Tracker"
                aria-label="Abrir tracker"
            >
                <BarChart2 size={14}/><span className="hidden sm:inline">Tracker</span>
            </button>
            {allowOpsButton && (
                <button className="hidden sm:inline-flex border rounded-md px-2.5 py-1.5 items-center gap-1"
                        onClick={()=>window.dispatchEvent(ev('ops:toggle'))} title="Panel Ops" aria-label="Abrir panel de análisis">
                    <LayoutDashboard size={14}/> <span className="hidden sm:inline">Ops</span>
                </button>
            )}
            <select className="hidden sm:block ml-2 border rounded-md px-2 py-1"
                    defaultValue={typeof window!=='undefined' ? (localStorage.getItem('bami_channel') || 'web') : 'web'}
                    onChange={(e)=>changeChannel(e.target.value)} aria-label="Canal">
                <option value="web">Web</option>
                <option value="app">App</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sucursal">Sucursal</option>
                <option value="callcenter">Call Center</option>
            </select>
        </div>
    )

    const ChatHeader=(
        <div className="flex flex-col">
            <div className="px-2.5 sm:px-3 py-2 bg-bami-yellow/60">
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <div className="font-semibold text-sm sm:text-base truncate">Acompañamiento</div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                        <ControlStrip />
                    </div>
                </div>
                <div className="sm:hidden mt-1 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <div className="flex items-center gap-1.5 min-w-max pr-1">
                        <ControlStrip compact />
                    </div>
                </div>
            </div>
            <MiniTrackerBar/>
        </div>
    )

    const ChatBody=(
        <div
            ref={listRef}
            className="bami-scroll bami-no-anchoring flex-1 min-h-0 overflow-auto p-2.5 sm:p-3 space-y-3 bg-white overscroll-contain"
            aria-live="polite"
            aria-label="Mensajes del chat"
            style={{ paddingBottom: bodyPad }}
        >
            {messages.map(m => (
                m.type === 'rich'
                    ? <RichListMessage key={m.id} payload={m.payload} onAction={sendText}/>
                    : <MessageBubble key={m.id} role={m.role} text={m.text} />
            ))}
            {typing && <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-gray-100"><TypingDots/></div>}
            {mode==='advisor' && !advisorConnected && <div className="text-xs text-gray-600">En cola para asesor… Quedan <b>{advisorQueue}</b> por delante.</div>}
        </div>
    )

    const QuickActions=(
        <div className="px-2 pt-2">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 snap-x">
                {[
                    ['TC', ()=>newCase('Tarjeta de Crédito')],
                    ['Préstamo', ()=>newCase('Préstamo Personal')],
                    ['Hipoteca', ()=>newCase('Hipoteca')],
                    ['PyME', ()=>newCase('PyME')],
                    ['Faltantes', askMissing],
                    ['Subir docs', openUploadManual],
                    ['Validar IA', ()=>validateAI()],
                    [advisorConnected?'Finalizar':'Asesor', advisorConnected? endAdvisor : connectAdvisor],
                ].map(([label,fn])=>(
                    <button key={label} type="button" onClick={fn}
                            className="px-3 py-1.5 text-xs rounded-full border bg-white whitespace-nowrap hover:bg-gray-50 snap-start">
                        {label}
                    </button>
                ))}
                <button type="button" onClick={()=>window.dispatchEvent(ev('tracker:open'))}
                        className="px-3 py-1.5 text-xs rounded-full border bg-white whitespace-nowrap hover:bg-gray-50 snap-start">
                    Tracker
                </button>
            </div>
        </div>
    )

    const ChatInputRow=(
        <div className="p-2 grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-9 flex gap-2">
                <input
                    ref={inputRef}
                    className="flex-1 border rounded-xl px-3 h-12 text-sm sm:text-base"
                    placeholder='Escribe: “tarjeta de crédito”, “crear expediente de hipoteca”, “subir documentos”…'
                    aria-label="Mensaje para BAMI"
                    inputMode="text"
                />
            </div>
            <div className="sm:col-span-3 flex">
                <button
                    className="btn btn-dark text-xs sm:text-sm px-3 h-12 w-full sm:min-w-[100px] rounded-xl inline-flex items-center justify-center gap-1"
                    onClick={handleSend}
                    aria-label="Enviar mensaje"
                >
                    <Send size={14}/> Enviar
                </button>
            </div>
        </div>
    )

    const ChatFooter=(
        <div
            ref={footerRef}
            className="border-t bg-gray-50 sticky bottom-0 z-[3]"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)' }}
            data-sticky-footer
        >
            {QuickActions}
            <form onSubmit={handleSend} className="border-t">{ChatInputRow}</form>
        </div>
    )

    // Alturas por variante
    const baseH_app = 'calc(var(--vh, 1vh) * 86 - 0px)'
    const baseH_full = 'calc((var(--vh, 1vh) * 100) - 160px)'

    const containerStyle =
        embed
            ? { height: '100%' }
            : (variant==='app'
                ? { height: baseH_app, minHeight: 420 }
                : (variant==='fullscreen' ? { height: baseH_full, minHeight: 420 }
                    : (variant==='panel' ? { height: 520 } : { height: 520 })))

    const ChatWindow=(
        <div
            className="bami-stable relative min-h-0 flex flex-col h-full w-full"
            style={{ ...containerStyle, contain: 'layout paint size', transform: 'translateZ(0)' }}
        >
            {BrandStyles}
            {ChatHeader}
            {ChatBody}
            {ChatFooter}
        </div>
    )

    /** Variantes no flotantes **/
    if(variant==='panel'){
        return (<>
            {BrandStyles}
            <div className="rounded-2xl border shadow-sm overflow-hidden">{ChatWindow}</div>
            <UploadAssistant open={showUpload} onClose={()=>setShowUpload(false)} onUploaded={afterUpload} context={embed?'phone':'overlay'}/>
        </>)
    }
    if(variant==='fullscreen' || variant==='app'){
        return (<>
            {BrandStyles}
            <div className="rounded-none sm:rounded-none overflow-hidden h-full">{ChatWindow}</div>
            <UploadAssistant open={showUpload} onClose={()=>setShowUpload(false)} onUploaded={afterUpload} context={embed?'phone':'overlay'}/>
        </>)
    }

    /** — Floating rediseñado: dock grande + chat emergente con notch — **/
    const disableFloating = disableFloatingTrigger || (typeof window!=='undefined' && window.__BAMI_DISABLE_FLOATING__===true)
    if(disableFloating){
        return (<>
            {BrandStyles}
            <UploadAssistant open={showUpload} onClose={()=>setShowUpload(false)} onUploaded={afterUpload} context={embed?'phone':'overlay'}/>
        </>)
    }

    const DOCK = { size: 84 }
    const rightOffset = 'calc(env(safe-area-inset-right, 0px) + 16px)'
    const bottomOffset = 'calc(env(safe-area-inset-bottom, 0px) + 16px)'

    return (
        <>
            {BrandStyles}

            {/* Dock grande */}
            <button
                onClick={()=>setOpen(v=>!v)}
                aria-label={open ? 'Cerrar chat BAMI' : 'Abrir chat BAMI'}
                aria-expanded={open}
                className="fixed z-[60] group"
                style={{ right: rightOffset, bottom: bottomOffset, width: DOCK.size, height: DOCK.size }}
            >
                <span className="absolute inset-0 bami-dock-glow" aria-hidden />
                <span className="relative w-full h-full grid place-items-center rounded-full bg-gradient-to-tr from-amber-300 to-yellow-500 p-[3px] shadow-xl border border-yellow-200/70">
          <span className="relative w-full h-full rounded-full bg-white grid place-items-center overflow-hidden">
            <span className="absolute inset-0 rounded-full blur-2xl opacity-25 bg-amber-200" aria-hidden />
            <img src="/BAMI.svg" alt="" className="relative w-[70%] h-[70%] object-contain" draggable={false}/>
            <span className="bami-dock-pulse" aria-hidden />
            <span className="absolute right-1.5 bottom-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden />
          </span>
        </span>
                <span className="sr-only">Chat con BAMI</span>
            </button>

            {/* Ventana emergente */}
            {open && (
                <div
                    className="fixed z-[60] bg-white rounded-2xl shadow-2xl border overflow-hidden"
                    style={{
                        right: `calc(${rightOffset})`,
                        bottom: `calc(${bottomOffset} + ${DOCK.size + 14}px)`,
                        width: 'min(92vw, 420px)',
                        animation: 'bami-pop 160ms ease-out'
                    }}
                    role="dialog"
                    aria-label="Ventana de chat BAMI"
                >
                    <span className="bami-notch" aria-hidden />
                    <button
                        onClick={()=>setOpen(false)}
                        className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-black/5 transition"
                        aria-label="Cerrar chat"
                        title="Cerrar"
                    >
                        <X size={16} />
                    </button>
                    {ChatWindow}
                </div>
            )}

            <UploadAssistant
                open={showUpload}
                onClose={()=>setShowUpload(false)}
                onUploaded={afterUpload}
                context={embed?'phone':'overlay'}
            />
        </>
    )
}
