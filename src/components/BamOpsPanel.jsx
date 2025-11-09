// src/components/BamOpsPanel.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient'
import ProgressRing from './ProgressRing.jsx'
import { Clock, CheckCircle2, BarChart3, Star, TrendingUp } from 'lucide-react'

const TOKEN_KEY = 'bami_admin_token'

/* ------------------------------ UI helpers ------------------------------ */
function Card({ title, value, hint, children, className = '' }) {
    return (
        <div className={`p-4 rounded-2xl border bg-white ${className}`}>
            <div className="text-xs text-gray-500">{title}</div>
            <div className="mt-1 text-2xl font-bold leading-tight">{value}</div>
            {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
            {children}
        </div>
    )
}

function Pill({ children, color = 'default' }) {
    const colorMap = {
        default: 'bg-gray-100 text-gray-700 border-gray-200',
        requiere: 'bg-gray-100 text-gray-700 border-gray-200',
        recibido: 'bg-yellow-50 text-yellow-800 border-yellow-200',
        en_revision: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        aprobado: 'bg-blue-50 text-blue-800 border-blue-200',
        alternativa: 'bg-violet-50 text-violet-800 border-violet-200',
    }
    return (
        <span className={'px-2 py-0.5 rounded-full text-xs border ' + (colorMap[color] || colorMap.default)}>
      {children}
    </span>
    )
}

function StackedBar({ segments }) {
    const total = Math.max(1, segments.reduce((a, b) => a + (b.value || 0), 0))
    return (
        <div className="w-full">
            <div className="h-3 w-full rounded-full overflow-hidden border bg-white">
                <div className="flex h-full w-full">
                    {segments.map((s) => {
                        const pct = ((s.value || 0) / total) * 100
                        return (
                            <div
                                key={s.key}
                                style={{ width: `${pct}%`, backgroundColor: s.color }}
                                className="h-full"
                                title={`${s.label}: ${s.value}`}
                            />
                        )
                    })}
                </div>
            </div>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-1">
                {segments.map((s) => (
                    <div key={s.key} className="flex items-center gap-2 text-[11px] text-gray-600">
                        <span className="inline-block w-3 h-3 rounded-sm border" style={{ backgroundColor: s.color, borderColor: '#e5e7eb' }} />
                        <span className="truncate">{s.label}</span>
                        <span className="ml-auto tabular-nums">{s.value}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function Stars({ value = 0, size = 16 }) {
    const full = Math.floor(value)
    const half = value - full >= 0.5
    return (
        <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
                <Star
                    key={i}
                    size={size}
                    className={
                        i < full
                            ? 'text-yellow-500 fill-yellow-500'
                            : i === full && half
                                ? 'text-yellow-500 fill-yellow-300'
                                : 'text-gray-300'
                    }
                />
            ))}
        </div>
    )
}

function fmtMinutesToHM(min) {
    if (min == null) return '—'
    const m = Math.round(min)
    const h = Math.floor(m / 60)
    const mm = m % 60
    return h > 0 ? `${h}h ${mm}m` : `${mm}m`
}

/* ------------------------------ Demo data ------------------------------ */
function buildDemoData() {
    // números coherentes y “llenos”
    const total = 240
    const recibido = 96
    const en_revision = 72
    const aprobado = 52
    const alternativa = 20
    const requiere = total - (recibido + en_revision + aprobado + alternativa)

    const leads = Array.from({ length: 22 }).map((_, i) => ({
        id: `L${(1000 + i)}`,
        product: ['Tarjeta de Crédito', 'Préstamo Personal', 'Hipoteca', 'PyME'][i % 4],
        channel: ['web', 'app', 'whatsapp', 'sucursal'][i % 4],
        applicant: { name: ['María','Luis','Karla','Diego','Sofía','Jorge'][i % 6] + ' ' + ['Pérez','Gómez','López','Ramírez'][i % 4] },
        stage: ['requiere','recibido','en_revision','aprobado','alternativa'][i % 5],
        missing_count: (i % 3),
        created_at: Date.now() - i * 3600_000
    }))

    return {
        totals: {
            cases: total,
            aprobados: aprobado,
            alternativas: alternativa,
            en_revision,
            approval_rate: aprobado / Math.max(1, total),
            missing_avg: 1.2,
            avg_response_minutes: 48
        },
        funnel: { requiere, recibido, en_revision, aprobado, alternativa },
        sla: { avg_minutes: 37 },
        csat: { avg: 4.5, responses: 132 },
        by_product: {
            'Tarjeta de Crédito': 96,
            'Préstamo Personal': 72,
            'Hipoteca': 36,
            'PyME': 36,
        },
        leads
    }
}

/* ------------------------------ Normalizador de snapshots externos ------------------------------ */
// Convierte un snapshot recibido por `BAMI:OPS_SNAPSHOT` (p.ej. desde uiOrchestrator)
// al formato que usa este panel.
function normalizeOpsSnapshot(s) {
    // Si ya viene en el formato del panel, úsalo tal cual
    if (s && s.totals && s.funnel) return s

    // Formato alterno esperado:
    // {
    //   leadsTotales, aprobados, alternativa, enRevision, pendientesProm,
    //   atendidos, generados,
    //   distEtapas: { requiere, recibido, enRevision, aprobado, alternativa }
    // }
    const total = s?.leadsTotales ?? 0
    const aprobado = s?.aprobados ?? 0
    const alternativa = s?.alternativa ?? 0
    const en_revision = s?.enRevision ?? 0
    const recibido = s?.distEtapas?.recibido ?? 0
    const requiere = s?.distEtapas?.requiere ?? Math.max(0, total - (recibido + en_revision + aprobado + alternativa))

    const by_product = {
        'Tarjeta de Crédito': Math.round(total * 0.4),
        'Préstamo Personal': Math.round(total * 0.3),
        'Hipoteca': Math.round(total * 0.15),
        'PyME': total - (Math.round(total * 0.4) + Math.round(total * 0.3) + Math.round(total * 0.15)),
    }

    return {
        totals: {
            cases: total,
            aprobados: aprobado,
            alternativas: alternativa,
            en_revision,
            approval_rate: total ? (aprobado / total) : 0,
            missing_avg: s?.pendientesProm ?? 1.0,
            avg_response_minutes: 48,
        },
        funnel: { requiere, recibido, en_revision, aprobado, alternativa },
        sla: { avg_minutes: 37 },
        csat: { avg: 4.6, responses: 120 },
        by_product,
        leads: Array.from({ length: Math.min(total, 22) }).map((_, i) => ({
            id: `L${(2000 + i)}`,
            product: Object.keys(by_product)[i % 4],
            channel: ['web','app','whatsapp','sucursal'][i % 4],
            applicant: { name: ['María','Luis','Karla','Diego','Sofía','Jorge'][i % 6] + ' ' + ['Pérez','Gómez','López','Ramírez'][i % 4] },
            stage: ['requiere','recibido','en_revision','aprobado','alternativa'][i % 5],
            missing_count: (i % 3),
            created_at: Date.now() - i * 3600_000
        })),
    }
}

/* ------------------------------ Main panel ------------------------------ */
export default function BamOpsPanel() {
    // Autologin DEMO: nunca pedimos credenciales
    const [data, setData] = useState(null)

    const fetchDataOnce = async () => {
        try {
            if (!localStorage.getItem(TOKEN_KEY)) {
                localStorage.setItem(TOKEN_KEY, 'demo')
            }
            const d = await api.adminAnalytics()
            // Si el backend responde bien, úsalo; si no, demo.
            setData(d && typeof d === 'object' ? d : buildDemoData())
        } catch {
            setData(buildDemoData())
        }
    }

    useEffect(() => {
        // Solo una vez para evitar “flicker” y cumplir “mostrar una vez”
        fetchDataOnce()
    }, [])

    // Permite que Autopilot "inyecte" un snapshot y llene todo al iniciar
    useEffect(() => {
        const onSnap = (ev) => {
            const snap = ev?.detail || window.__BAMI_OPS_SNAPSHOT
            if (!snap) return
            setData(normalizeOpsSnapshot(snap))
        }
        window.addEventListener('BAMI:OPS_SNAPSHOT', onSnap)
        if (window.__BAMI_OPS_SNAPSHOT) onSnap({ detail: window.__BAMI_OPS_SNAPSHOT })
        return () => window.removeEventListener('BAMI:OPS_SNAPSHOT', onSnap)
    }, [])

    // -------- Derivados ----------
    const totals = useMemo(() => data?.totals || {}, [data])
    const funnel = useMemo(() => data?.funnel || {}, [data])

    const totalLeads = totals?.cases || 0
    const atendidos =
        (funnel?.recibido || 0) +
        (funnel?.en_revision || 0) +
        (funnel?.aprobado || 0) +
        (funnel?.alternativa || 0)
    const atendidosPct = totalLeads ? Math.round((atendidos * 100) / totalLeads) : 0

    const avgMinutes = data?.sla?.avg_minutes ?? data?.totals?.avg_response_minutes ?? null
    const csatAvg = data?.csat?.avg ?? null
    const csatN = data?.csat?.responses ?? 0

    const stageSegments = [
        { key: 'requiere', label: 'Requiere', value: funnel?.requiere || 0, color: '#e5e7eb' },
        { key: 'recibido', label: 'Recibido', value: funnel?.recibido || 0, color: '#fde68a' },
        { key: 'en_revision', label: 'En revisión', value: funnel?.en_revision || 0, color: '#86efac' },
        { key: 'aprobado', label: 'Aprobado', value: funnel?.aprobado || 0, color: '#93c5fd' },
        { key: 'alternativa', label: 'Alternativa', value: funnel?.alternativa || 0, color: '#c4b5fd' },
    ]

    const leadsCompact = (data?.leads || []).slice(0, 14)

    return (
        <div className="card">
            <div className="text-xs text-gray-500 mb-1">Equipo BAM</div>
            <h3 className="h3 mb-2 flex items-center gap-2">
                <img src="/BAMI.svg" alt="BAMI" className="w-5 h-5 rounded-full" />
                <span>Panel de análisis y leads</span>
                <span className="ml-2 text-xs text-gray-500">(demo listo para presentación)</span>
            </h3>

            {/* =================== Indicadores clave =================== */}
            <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">Indicadores clave</div>

                {/* Móvil: carrusel horizontal */}
                <div className="flex gap-3 overflow-x-auto sm:hidden no-scrollbar pb-1">
                    <div className="min-w-[260px]">
                        <div className="p-4 rounded-2xl border bg-white min-h-[132px] flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-gray-500">Tiempo prom. de atención</div>
                                <Clock size={16} className="text-gray-400" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{fmtMinutesToHM(avgMinutes)}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {avgMinutes == null ? 'Aún sin datos' : 'Desde primer contacto hasta primera atención'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="min-w-[260px]">
                        <div className="p-4 rounded-2xl border bg-white min-h-[132px] flex items-center gap-3">
                            <div className="shrink-0">
                                <ProgressRing size={64} stroke={8} value={atendidosPct} label={`${atendidosPct}%`} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs text-gray-500 flex items-center justify-between">
                                    <span>% Atendidos vs Generados</span>
                                    <CheckCircle2 size={16} className="text-gray-400" />
                                </div>
                                <div className="text-sm font-semibold mt-1 truncate">
                                    {atendidos}/{totalLeads} atendidos
                                </div>
                                <div className="text-xs text-gray-500 truncate">Leads que ya entraron al flujo</div>
                            </div>
                        </div>
                    </div>

                    <div className="min-w-[260px]">
                        <div className="p-4 rounded-2xl border bg-white min-h-[132px] flex flex-col">
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-gray-500">Distribución por etapa</div>
                                <BarChart3 size={16} className="text-gray-400" />
                            </div>
                            <div className="mt-2">
                                <StackedBar segments={stageSegments} />
                            </div>
                        </div>
                    </div>

                    <div className="min-w-[260px]">
                        <div className="p-4 rounded-2xl border bg-white min-h-[132px] flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-gray-500">Satisfacción del cliente</div>
                                <TrendingUp size={16} className="text-gray-400" />
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                <Stars value={csatAvg || 0} />
                                <div className="text-lg font-bold">{csatAvg == null ? '—' : csatAvg.toFixed(1)}</div>
                            </div>
                            <div className="text-xs text-gray-500">{csatAvg == null ? 'Conecta tu encuesta post-atención' : `${csatN} respuestas`}</div>
                        </div>
                    </div>
                </div>

                {/* ≥ sm: auto-fit */}
                <div
                    className="hidden sm:grid gap-3"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
                >
                    <div className="p-4 rounded-2xl border bg-white min-h-[132px] flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-500">Tiempo prom. de atención</div>
                            <Clock size={16} className="text-gray-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{fmtMinutesToHM(avgMinutes)}</div>
                            <div className="text-xs text-gray-500 mt-1">
                                {avgMinutes == null ? 'Aún sin datos' : 'Desde primer contacto hasta primera atención'}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl border bg-white min-h-[132px] flex items-center gap-3">
                        <div className="shrink-0">
                            <ProgressRing size={64} stroke={8} value={atendidosPct} label={`${atendidosPct}%`} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs text-gray-500 flex items-center justify-between">
                                <span>% Atendidos vs Generados</span>
                                <CheckCircle2 size={16} className="text-gray-400" />
                            </div>
                            <div className="text-sm font-semibold mt-1 truncate">
                                {atendidos}/{totalLeads} atendidos
                            </div>
                            <div className="text-xs text-gray-500 truncate">Leads que ya entraron al flujo</div>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl border bg-white min-h-[132px] flex flex-col">
                        <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-500">Distribución por etapa</div>
                            <BarChart3 size={16} className="text-gray-400" />
                        </div>
                        <div className="mt-2">
                            <StackedBar segments={stageSegments} />
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl border bg-white min-h-[132px] flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-500">Satisfacción del cliente</div>
                            <TrendingUp size={16} className="text-gray-400" />
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <Stars value={csatAvg || 0} />
                            <div className="text-lg font-bold">{csatAvg == null ? '—' : csatAvg.toFixed(1)}</div>
                        </div>
                        <div className="text-xs text-gray-500">
                            {csatAvg == null ? 'Conecta tu encuesta post-atención' : `${csatN} respuestas`}
                        </div>
                    </div>
                </div>
            </div>

            {/* KPIs resumidos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
                <Card title="Leads totales" value={totals?.cases ?? 0} className="min-h-[104px]" />
                <Card title="Aprobados" value={totals?.aprobados ?? 0} hint={`Tasa ${(totals?.approval_rate * 100 || 0).toFixed(0)}%`} className="min-h-[104px]" />
                <Card title="Alternativa" value={totals?.alternativas ?? 0} className="min-h-[104px]" />
                <Card title="En revisión" value={totals?.en_revision ?? 0} className="min-h-[104px]" />
                <Card title="Pend. docs prom." value={(totals?.missing_avg || 0).toFixed(1)} className="min-h-[104px]" />
            </div>

            {/* Funnel */}
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <div className="font-semibold mb-2">Funnel</div>
                <div className="space-y-2">
                    {['requiere','recibido','en_revision','aprobado','alternativa'].map((k) => {
                        const v = funnel[k] || 0
                        const max = totals?.cases || 1
                        const pct = Math.round((v / max) * 100)
                        return (
                            <div key={k}>
                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span className="capitalize">{k.replace('_',' ')}</span>
                                    <span>{v} · {pct}%</span>
                                </div>
                                <div className="h-2 bg-white border rounded-full overflow-hidden">
                                    <div className="h-full bg-bami-yellow" style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Etapa actual de cada lead (lista compacta) */}
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <div className="font-semibold mb-2">Etapa actual de cada lead</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {leadsCompact.map((row) => (
                        <div key={row.id} className="p-3 rounded-xl border bg-white flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{row.applicant?.name || row.id}</div>
                                <div className="text-xs text-gray-500 truncate">{row.product} · <span className="uppercase">{row.channel}</span></div>
                            </div>
                            <Pill color={row.stage}>{row.stage.replace('_',' ')}</Pill>
                        </div>
                    ))}
                    {!leadsCompact.length && <div className="text-sm text-gray-500">Sin datos.</div>}
                </div>
            </div>

            {/* Leads por producto */}
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <div className="font-semibold mb-2">Leads por producto</div>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {Object.entries(data?.by_product || {}).map(([p, n]) => (
                        <div key={p} className="p-3 rounded-xl border bg-white">
                            <div className="text-xs text-gray-500">{p}</div>
                            <div className="text-xl font-bold">{n}</div>
                        </div>
                    ))}
                    {!Object.keys(data?.by_product || {}).length && <div className="text-sm text-gray-500">Sin datos.</div>}
                </div>
            </div>

            {/* Leads recientes (tabla) */}
            <div className="mt-6">
                <div className="font-semibold mb-2">Leads recientes</div>
                <div className="overflow-auto -mx-2 sm:mx-0">
                    <table className="min-w-[680px] sm:min-w-full text-sm mx-2 sm:mx-0">
                        <thead>
                        <tr className="text-left text-gray-500">
                            <th className="py-2 pr-3">ID</th>
                            <th className="py-2 pr-3">Producto</th>
                            <th className="py-2 pr-3">Canal</th>
                            <th className="py-2 pr-3">Solicitante</th>
                            <th className="py-2 pr-3">Etapa</th>
                            <th className="py-2 pr-3">Faltantes</th>
                            <th className="py-2 pr-3">Creado</th>
                        </tr>
                        </thead>
                        <tbody>
                        {(data?.leads || []).map((row) => (
                            <tr key={row.id} className="border-t">
                                <td className="py-2 pr-3 font-mono">{row.id}</td>
                                <td className="py-2 pr-3">{row.product}</td>
                                <td className="py-2 pr-3 uppercase">{row.channel}</td>
                                <td className="py-2 pr-3">{row.applicant?.name || '-'}</td>
                                <td className="py-2 pr-3 capitalize">{row.stage.replace('_',' ')}</td>
                                <td className="py-2 pr-3">{row.missing_count}</td>
                                <td className="py-2 pr-3">{new Date(row.created_at).toLocaleString()}</td>
                            </tr>
                        ))}
                        {!((data?.leads || []).length) && (
                            <tr><td colSpan="7" className="py-6 text-center text-gray-500">Sin datos (modo demo).</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
