// src/lib/caseStore.js
import { api } from './apiClient'

// Estado local del expediente (UI cache)
const KEY = 'bami_case'
const APPLICANT_KEY = 'bami_applicant'

// Utilidad: emitir eventos a la UI
function emitUpdate(next) {
    window.dispatchEvent(new CustomEvent('bami:caseUpdate', { detail: next }))
}
export function notify(message, type = 'info') {
    window.dispatchEvent(new CustomEvent('bami:notify', { detail: { id: Date.now(), message, type } }))
}

// Get/Set local
export function getCase() {
    try {
        const c = JSON.parse(localStorage.getItem(KEY)) || null
        if (c && !c.id) return null
        return c
    } catch { return null }
}
export function setCase(next) {
    localStorage.setItem(KEY, JSON.stringify(next))
    emitUpdate(next)
    return next
}
export function clearCase() {
    localStorage.removeItem(KEY)
    emitUpdate(null)
}

// Reglas por producto (solo para UI)
export const PRODUCT_RULES = {
    'Tarjeta de Crédito': ['dpi', 'selfie', 'comprobante_domicilio'],
    'Préstamo Personal': ['dpi', 'comprobante_ingresos', 'historial_crediticio'],
    'Hipoteca': ['dpi', 'constancia_ingresos', 'avaluo', 'comprobante_domicilio'],
    'PyME': ['dpi_representante', 'patente', 'estado_cuenta', 'nit'],
}

// Canal preferido (persistimos aparte)
export function setChannel(ch) {
    localStorage.setItem('bami_channel', ch)
    const c = getCase()
    if (c) setCase({ ...c, channel: ch })
}

// ————————————————————————————————————————————————
// Backend: crear expediente, docs, tracker, validar, chat
// ————————————————————————————————————————————————
export async function createNewCase(product, applicant = null) {
    const channel = localStorage.getItem('bami_channel') || 'web'
    const fallbackApplicant = applicant || (() => {
        try { return JSON.parse(localStorage.getItem(APPLICANT_KEY) || 'null') } catch { return null }
    })()
    const res = await api.createLead({ product, applicant: fallbackApplicant, channel })
    const c = normalizeCase(res.case)
    setCase(c)
    notify('Expediente creado')
    return c
}

export async function uploadDocsBackend(docs) {
    const c = getCase()
    if (!c) throw new Error('No hay expediente')
    await api.uploadDocuments({ id: c.id, docs })
    const updated = await refreshTracker()
    notify('Documentos recibidos')
    return updated
}

export async function refreshTracker() {
    const c = getCase()
    if (!c) return null
    const res = await api.getTracker(c.id)
    const nc = normalizeCase(res.case)
    return setCase(nc)
}

export async function validateWithAI() {
    const c = getCase()
    if (!c) throw new Error('No hay expediente')
    const res = await api.validateCase(c.id)
    const nc = normalizeCase(res.case)
    setCase(nc)
    const { result } = res
    const msg = result?.decision === 'aprobado'
        ? '✅ Aprobado. Enviaré contrato y siguientes pasos.'
        : '⚠️ No aprobado. Tengo una alternativa que se ajusta a tu perfil.'
    notify('Resultado de validación disponible')
    return { case: nc, result, message: msg }
}

// ✅ CHAT ahora funciona también sin expediente (warmup)
export async function chatBackend({ message, mode = 'bami' }) {
    const c = getCase()
    const payload = { message, mode }
    if (c?.id) payload.caseId = c.id
    const res = await api.chat(payload)
    if (res?.case) setCase(normalizeCase(res.case))
    return res.reply || ''
}

export function setApplicant(applicant) {
    try { localStorage.setItem(APPLICANT_KEY, JSON.stringify(applicant)) } catch {}
    const c = getCase()
    if (c) setCase({ ...c, applicant })
}

// Helpers
function normalizeCase(srv) {
    if (!srv) return null
    const history = (srv.timeline || []).map(ev => ({
        at: ev.ts || new Date().toISOString(),
        stage: ev.type || 'evento',
        note: ev.text || '',
    }))
    return {
        id: srv.id,
        product: srv.product,
        channel: srv.channel,
        owner: srv.owner,
        stage: srv.stage,
        missing: srv.missing || [],
        ttaHours: srv.percent === 100 ? 0 : 8,
        history,
        timeline: srv.timeline || [],
        applicant: srv.applicant || null,
        percent: srv.percent ?? 0,
    }
}
