// src/lib/apiClient.jsx
// Cliente del frontend hacia tu backend BAMI (REST + SSE)

const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const API_KEY = import.meta.env.VITE_BAMI_API_KEY || import.meta.env.VITE_API_KEY || ''
const ADMIN_TOKEN_KEY = 'bami_admin_token'

function authHeaders(path, headers = {}) {
    const h = { ...headers }
    if (API_KEY && !path.startsWith('/stream')) h['x-api-key'] = API_KEY
    if (path.startsWith('/admin')) {
        const tk = localStorage.getItem(ADMIN_TOKEN_KEY)
        if (tk) h['Authorization'] = `Bearer ${tk}`
    }
    return h
}

function safeJSON(s) { try { return JSON.parse(s) } catch { return {} } }

async function j(path, { method = 'GET', body, headers = {}, ...rest } = {}) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
            ...authHeaders(path, headers),
        },
        body: body && !(body instanceof FormData) ? JSON.stringify(body) : body,
        credentials: 'include',
        ...rest,
    })
    const text = await res.text().catch(() => '')
    const json = text ? safeJSON(text) : {}
    if (!res.ok) {
        const msg = json?.error || json?.message || res.statusText || 'API error'
        throw new Error(msg)
    }
    return json
}

export const api = {
    // ——— Leads / Expediente ———
    async createLead({ product, applicant = null, channel = 'web' }) {
        return j('/ingest/leads', { method: 'POST', body: { product, applicant, channel } })
    },

    async uploadDocuments({ id, docs = [] }) {
        return j('/documents', { method: 'POST', body: { id, docs } })
    },

    async uploadDocumentsForm(formData) {
        const id = formData.get('id')
        if (!id) throw new Error('Falta id del expediente en FormData')
        return j('/documents/upload', { method: 'POST', body: formData })
    },

    async getTracker(id) {
        return j(`/tracker/${encodeURIComponent(id)}`, { method: 'GET' })
    },

    async validateCase(id) {
        return j(`/validate/${encodeURIComponent(id)}`, { method: 'POST' })
    },

    // ✅ chat sin caseId soportado (para warmup)
    async chat({ caseId, message, mode = 'bami' }) {
        const body = { message, mode }
        if (caseId) body.caseId = caseId
        return j('/chat', { method: 'POST', body })
    },

    // ——— Admin panel ———
    async adminLogin({ email, password }) {
        return j('/admin/login', { method: 'POST', body: { email, password } })
    },

    async adminAnalytics() {
        return j('/admin/analytics', { method: 'GET' })
    },

    async adminCases() {
        return j('/admin/cases', { method: 'GET' })
    },
}

export { BASE }
