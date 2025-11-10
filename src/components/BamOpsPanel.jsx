// src/components/BamOpsPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/apiClient'
import ProgressRing from './ProgressRing.jsx'
import { Clock, CheckCircle2, BarChart3, Star, TrendingUp, Info } from 'lucide-react'

const TOKEN_KEY = 'bami_admin_token'
const EASE = 'cubic-bezier(0.22,1,0.36,1)'

function Card({ title, value, hint, children, className = '', explain }) {
    return (
        <div className={`p-4 rounded-2xl border bg-white ${className} flex flex-col min-w-0`}>
            <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="text-xs text-gray-500 truncate" title={title}>{title}</div>
                {explain && (
                    <span
                        className="inline-flex items-center gap-1 text-[11px] text-gray-500 shrink-0"
                        title={explain}
                    >
            <Info size={14} /> Ayuda
          </span>
                )}
            </div>
            <div className="mt-1 text-2xl font-bold leading-tight whitespace-nowrap tabular-nums overflow-hidden text-ellipsis">
                {value}
            </div>
            {hint && (
                <div className="text-xs text-gray-500 mt-1 truncate" title={typeof hint === 'string' ? hint : undefined}>
                    {hint}
                </div>
            )}
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
                                style={{ width: `${pct}%`, backgroundColor: s.color, transition: `width 700ms ${EASE}` }}
                                className="h-full"
                                title={`${s.label}: ${s.value}`}
                            />
                        )
                    })}
                </div>
            </div>

            {/* Leyenda compacta con corte seguro */}
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-1">
                {segments.map((s) => (
                    <div key={s.key} className="flex items-center gap-2 text-[11px] text-gray-600 min-w-0">
            <span
                className="inline-block w-3 h-3 rounded-sm border shrink-0"
                style={{ backgroundColor: s.color, borderColor: '#e5e7eb' }}
            />
                        <span className="truncate flex-1" title={s.label}>{s.label}</span>
                        <span className="ml-2 tabular-nums shrink-0">{s.value}</span>
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

function useCountUp(target = 0, duration = 800) {
    const [val, setVal] = useState(0)
    const rafRef = useRef(null)
    useEffect(() => {
        let start = null
        const from = val
        const to = Number.isFinite(target) ? target : 0
        const step = (ts) => {
            if (start == null) start = ts
            const p = Math.min(1, (ts - start) / duration)
            const eased = 1 - Math.pow(1 - p, 3)
            setVal(Math.round(from + (to - from) * eased))
            if (p < 1) rafRef.current = requestAnimationFrame(step)
        }
        cancelAnimationFrame(rafRef.current || 0)
        rafRef.current = requestAnimationFrame(step)
        return () => cancelAnimationFrame(rafRef.current || 0)
    }, [target]) // eslint-disable-line
    return val
}

function buildDemoData() {
    const total = 260
    const recibido = 104
    const en_revision = 74
    const aprobado = 58
    const alternativa = 24
    const requiere = total - (recibido + en_revision + aprobado + alternativa)

    const leads = Array.from({ length: 28 }).map((_, i) => ({
        id: `L${1500 + i}`,
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
            avg_response_minutes: 46,
            tta_aprob_minutes: 9 * 60 + 20,
            nps: 58
        },
        funnel: { requiere, recibido, en_revision, aprobado, alternativa },
        sla: { avg_minutes: 39, p90_minutes: 78, p95_minutes: 110 },
        csat: { avg: 4.6, responses: 178, promoters: 65, passives: 25, detractors: 10 },
        by_product: {
            'Tarjeta de Crédito': 102,
            'Préstamo Personal': 72,
            'Hipoteca': 44,
            'PyME': 42,
        },
        by_channel: {
            'Web': 128,
            'App': 72,
            'WhatsApp': 38,
            'Sucursal': 22
        },
        leads
    }
}

/** ====== Tarjeta compacta/legible para distribuciones ====== **/
function StatTile({ label, value, hint }) {
    return (
        <div className="p-4 rounded-2xl border bg-white shadow-sm min-h-[128px] flex flex-col justify-between min-w-0">
            <div className="text-sm font-medium text-gray-700 leading-5 break-words truncate" title={label}>
                {label}
            </div>
            <div className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                {value}
            </div>
            {hint && (
                <div className="mt-1 text-[12px] leading-5 text-gray-500 break-words truncate" title={hint}>
                    {hint}
                </div>
            )}
        </div>
    )
}

export default function BamOpsPanel() {
    const [data, setData] = useState(null)
    const [showExplain, setShowExplain] = useState(true)

    const fetchDataOnce = async () => {
        try {
            if (!localStorage.getItem(TOKEN_KEY)) {
                localStorage.setItem(TOKEN_KEY, 'demo')
            }
            const d = await api.adminAnalytics()
            setData(d && typeof d === 'object' ? enhance(d) : buildDemoData())
        } catch {
            setData(buildDemoData())
        }
    }

    const enhance = (d) => {
        const base = buildDemoData()
        return {
            ...base,
            ...d,
            totals: { ...base.totals, ...(d?.totals || {}) },
            funnel: { ...base.funnel, ...(d?.funnel || {}) },
            csat: { ...base.csat, ...(d?.csat || {}) },
            by_product: { ...base.by_product, ...(d?.by_product || {}) },
            by_channel: { ...base.by_channel, ...(d?.by_channel || {}) },
            sla: { ...base.sla, ...(d?.sla || {}) },
            leads: Array.isArray(d?.leads) ? d.leads : base.leads
        }
    }

    useEffect(() => { fetchDataOnce() }, [])

    useEffect(() => {
        const ingest = (e) => {
            const detail = e?.detail || {}
            const leadLike = detail.case || detail.lead || null
            if (!leadLike) return
            setData(prev => {
                const d = prev || buildDemoData()
                const newLead = {
                    id: leadLike.id || `L${Math.floor(Math.random()*9000)+1000}`,
                    product: leadLike.product || 'Tarjeta de Crédito',
                    channel: (leadLike.channel || 'web')?.toUpperCase?.() === 'WEB' ? 'web' : (leadLike.channel || 'web'),
                    applicant: { name: leadLike?.applicant?.name || 'Cliente BAMI' },
                    stage: leadLike.stage || 'aprobado',
                    missing_count: 0,
                    created_at: Date.now()
                }
                const leads = [newLead, ...(d.leads || [])]
                const totals = { ...d.totals }
                totals.cases = (totals.cases || 0) + 1
                totals.aprobados = (totals.aprobados || 0) + (newLead.stage === 'aprobado' ? 1 : 0)
                totals.approval_rate = (totals.aprobados || 0) / Math.max(1, totals.cases || 0)

                const funnel = { ...d.funnel }
                funnel[newLead.stage] = (funnel[newLead.stage] || 0) + 1

                const by_product = { ...(d.by_product || {}) }
                by_product[newLead.product] = (by_product[newLead.product] || 0) + 1

                const by_channel = { ...(d.by_channel || {}) }
                const chKey = (newLead.channel || 'web').replace(/^\w/, c => c.toUpperCase())
                by_channel[chKey] = (by_channel[chKey] || 0) + 1

                return { ...d, totals, funnel, leads, by_product, by_channel }
            })
            setShowExplain(true)
        }
        const toggleExplain = () => setShowExplain(v => !v)
        window.addEventListener('bami:ops:ingestLead', ingest)
        window.addEventListener('bami:ops:explain', toggleExplain)
        return () => {
            window.removeEventListener('bami:ops:ingestLead', ingest)
            window.removeEventListener('bami:ops:explain', toggleExplain)
        }
    }, [])

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
    const p90 = data?.sla?.p90_minutes ?? null
    const p95 = data?.sla?.p95_minutes ?? null
    const csatAvg = data?.csat?.avg ?? null
    const csatN = data?.csat?.responses ?? 0
    const nps = totals?.nps ?? null
    const ttaAprobMin = totals?.tta_aprob_minutes ?? null

    const cuTotal = useCountUp(totalLeads, 700)
    const cuAprob = useCountUp(totals?.aprobados || 0, 700)
    const cuAlt = useCountUp(totals?.alternativas || 0, 700)
    const cuRev = useCountUp(totals?.en_revision || 0, 700)
    const cuPct = useCountUp(Math.round((totals?.approval_rate || 0) * 100), 700)

    const stageSegments = [
        { key: 'requiere', label: 'Requiere', value: funnel?.requiere || 0, color: '#e5e7eb' },
        { key: 'recibido', label: 'Recibido', value: funnel?.recibido || 0, color: '#fde68a' },
        { key: 'en_revision', label: 'En revisión', value: funnel?.en_revision || 0, color: '#86efac' },
        { key: 'aprobado', label: 'Aprobado', value: funnel?.aprobado || 0, color: '#93c5fd' },
        { key: 'alternativa', label: 'Alternativa', value: funnel?.alternativa || 0, color: '#c4b5fd' },
    ]

    const leadsCompact = (data?.leads || []).slice(0, 14)

    return (
        <div className="card" data-agent-area="panel-bam-ops">
            <div className="text-xs text-gray-500 mb-1">Equipo BAM</div>
            <h3 className="h3 mb-2 flex items-center gap-2">
                <img src="/BAMI.svg" alt="BAMI" className="w-5 h-5 rounded-full" />
                <span>Panel de análisis y leads</span>
                <span className="ml-2 text-xs text-gray-500">(demo listo para presentación)</span>
            </h3>

            {/* Indicadores clave */}
            <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">Indicadores clave</div>

                {/* Móvil: carrusel horizontal */}
                <div className="flex gap-3 overflow-x-auto sm:hidden no-scrollbar pb-1">
                    <div className="min-w-[260px]">
                        <Card
                            title="Tiempo prom. de atención"
                            value={fmtMinutesToHM(avgMinutes)}
                            hint={avgMinutes == null ? 'Aún sin datos' : 'Desde primer contacto hasta primera atención'}
                            explain="Tiempo promedio desde que el cliente inicia contacto hasta que recibe su primera atención."
                            className="min-h-[132px]"
                        >
                            <div className="text-[11px] text-gray-500 mt-2 whitespace-nowrap">
                                P90: {fmtMinutesToHM(p90)} · P95: {fmtMinutesToHM(p95)}
                            </div>
                        </Card>
                    </div>

                    <div className="min-w-[260px]">
                        <div className="p-4 rounded-2xl border bg-white min-h-[132px] flex items-center gap-3">
                            <div className="shrink-0">
                                <ProgressRing size={64} stroke={8} value={atendidosPct} label={`${atendidosPct}%`} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs text-gray-500 flex items-center justify-between gap-2">
                                    <span className="truncate" title="% Atendidos vs Generados">% Atendidos vs Generados</span>
                                    <CheckCircle2 size={16} className="text-gray-400 shrink-0" />
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
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-xs text-gray-500 truncate" title="Distribución por etapa">
                                    Distribución por etapa
                                </div>
                                <BarChart3 size={16} className="text-gray-400 shrink-0" />
                            </div>
                            <div className="mt-2">
                                <StackedBar segments={stageSegments} />
                            </div>
                        </div>
                    </div>

                    <div className="min-w-[260px]">
                        <Card
                            title="Satisfacción del cliente (CSAT)"
                            value={csatAvg == null ? '—' : csatAvg.toFixed(1)}
                            hint={csatAvg == null ? 'Conecta tu encuesta post-atención' : `${csatN} respuestas`}
                            explain="Valoración promedio del servicio por parte de los clientes (escala 1–5)."
                            className="min-h-[132px]"
                        >
                            <div className="mt-2 flex items-center gap-3">
                                <Stars value={csatAvg || 0} />
                            </div>
                        </Card>
                    </div>
                </div>

                {/* ≥ sm: auto-fit */}
                <div
                    className="hidden sm:grid gap-3"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
                >
                    <Card
                        title="Tiempo prom. de atención"
                        value={fmtMinutesToHM(avgMinutes)}
                        hint={avgMinutes == null ? 'Aún sin datos' : 'Desde primer contacto hasta primera atención'}
                        explain="Tiempo promedio desde que el cliente inicia contacto hasta que recibe su primera atención."
                        className="min-h-[132px]"
                    >
                        <div className="text-[11px] text-gray-500 mt-2 whitespace-nowrap">
                            P90: {fmtMinutesToHM(p90)} · P95: {fmtMinutesToHM(p95)}
                        </div>
                    </Card>

                    <div className="p-4 rounded-2xl border bg-white min-h-[132px] flex items-center gap-3">
                        <div className="shrink-0">
                            <ProgressRing size={64} stroke={8} value={atendidosPct} label={`${atendidosPct}%`} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs text-gray-500 flex items-center justify-between gap-2">
                                <span className="truncate" title="% Atendidos vs Generados">% Atendidos vs Generados</span>
                                <CheckCircle2 size={16} className="text-gray-400 shrink-0" />
                            </div>
                            <div className="text-sm font-semibold mt-1 truncate">
                                {atendidos}/{totalLeads} atendidos
                            </div>
                            <div className="text-xs text-gray-500 truncate">Leads que ya entraron al flujo</div>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl border bg-white min-h-[132px] flex flex-col">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-xs text-gray-500 truncate" title="Distribución por etapa">
                                Distribución por etapa
                            </div>
                            <BarChart3 size={16} className="text-gray-400 shrink-0" />
                        </div>
                        <div className="mt-2">
                            <StackedBar segments={stageSegments} />
                        </div>
                    </div>

                    <Card
                        title="Satisfacción del cliente (CSAT)"
                        value={csatAvg == null ? '—' : csatAvg.toFixed(1)}
                        hint={csatAvg == null ? 'Conecta tu encuesta post-atención' : `${csatN} respuestas`}
                        explain="Valoración promedio (1–5) posterior a la atención."
                        className="min-h-[132px]"
                    >
                        <div className="mt-2 flex items-center gap-3">
                            <Stars value={csatAvg || 0} />
                        </div>
                    </Card>

                    <Card
                        title="NPS (Net Promoter Score)"
                        value={nps == null ? '—' : `${nps}`}
                        hint="Promotores - Detractores"
                        explain="Medición de lealtad del cliente en -100 a 100, basada en la pregunta '¿Qué tan probable es que nos recomiendes?'."
                        className="min-h-[132px]"
                    />

                    <Card
                        title="Tiempo a aprobación"
                        value={fmtMinutesToHM(ttaAprobMin)}
                        hint="Promedio desde creación hasta 'Aprobado'"
                        explain="Mide cuántas horas/minutos toma, en promedio, aprobar un caso desde que inicia."
                        className="min-h-[132px]"
                    />
                </div>
            </div>

            {/* KPIs resumidos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
                <Card title="Leads totales" value={cuTotal} className="min-h-[104px]" explain="Cantidad de oportunidades generadas en el periodo."/>
                <Card title="Aprobados" value={cuAprob} hint={`Tasa ${cuPct}%`} className="min-h-[104px]" explain="Casos con decisión positiva respecto al total."/>
                <Card title="Alternativa" value={cuAlt} className="min-h-[104px]" explain="Casos a los que se sugiere un producto distinto."/>
                <Card title="En revisión" value={cuRev} className="min-h-[104px]" explain="Casos que están siendo analizados por IA/operaciones."/>
                <Card title="Pend. docs prom." value={(data?.totals?.missing_avg || 0).toFixed(1)} className="min-h-[104px]" explain="Promedio de documentos faltantes por caso."/>
            </div>

            {/* Funnel */}
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <div className="font-semibold mb-2">Funnel</div>
                <div className="space-y-2">
                    {['requiere','recibido','en_revision','aprobado','alternativa'].map((k) => {
                        const v = funnel[k] || 0
                        const max = totals?.cases || 1
                        const pct = Math.round((v / max) * 100)
                        const label = k.replace('_',' ')
                        return (
                            <div key={k}>
                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span className="capitalize truncate" title={label}>{label}</span>
                                    <span className="tabular-nums">{v} · {pct}%</span>
                                </div>
                                <div className="h-2 bg-white border rounded-full overflow-hidden">
                                    <div className="h-full bg-bami-yellow" style={{ width: `${pct}%`, transition: `width 700ms ${EASE}` }} />
                                </div>
                            </div>
                        )
                    })}
                </div>
                {showExplain && (
                    <div className="mt-2 text-[11px] text-gray-500">
                        El funnel muestra el avance acumulado por etapa a partir del total de leads generados.
                    </div>
                )}
            </div>

            {/* Distribuciones */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Leads por producto */}
                <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="font-semibold mb-2">Leads por producto</div>

                    {/* Móvil: tira scrolleable */}
                    <div className="flex sm:hidden gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                        {Object.entries(data?.by_product || {}).map(([p, n]) => (
                            <div key={p} className="min-w-[180px]">
                                <StatTile
                                    label={p}
                                    value={n}
                                    hint={showExplain ? 'Distribución por tipo de producto.' : undefined}
                                />
                            </div>
                        ))}
                        {!Object.keys(data?.by_product || {}).length && (
                            <div className="text-sm text-gray-500">Sin datos.</div>
                        )}
                    </div>

                    {/* ≥ sm: auto-fit */}
                    <div
                        className="hidden sm:grid gap-3"
                        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
                    >
                        {Object.entries(data?.by_product || {}).map(([p, n]) => (
                            <StatTile
                                key={p}
                                label={p}
                                value={n}
                                hint={showExplain ? 'Distribución por tipo de producto.' : undefined}
                            />
                        ))}
                        {!Object.keys(data?.by_product || {}).length && (
                            <div className="text-sm text-gray-500">Sin datos.</div>
                        )}
                    </div>
                </div>

                {/* Leads por canal */}
                <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="font-semibold mb-2">Leads por canal</div>

                    {/* Móvil: tira scrolleable */}
                    <div className="flex sm:hidden gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                        {Object.entries(data?.by_channel || {}).map(([p, n]) => (
                            <div key={p} className="min-w-[180px]">
                                <StatTile
                                    label={p}
                                    value={n}
                                    hint={showExplain ? 'Origen del lead.' : undefined}
                                />
                            </div>
                        ))}
                        {!Object.keys(data?.by_channel || {}).length && (
                            <div className="text-sm text-gray-500">Sin datos.</div>
                        )}
                    </div>

                    {/* ≥ sm: auto-fit */}
                    <div
                        className="hidden sm:grid gap-3"
                        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
                    >
                        {Object.entries(data?.by_channel || {}).map(([p, n]) => (
                            <StatTile
                                key={p}
                                label={p}
                                value={n}
                                hint={showExplain ? 'Origen del lead.' : undefined}
                            />
                        ))}
                        {!Object.keys(data?.by_channel || {}).length && (
                            <div className="text-sm text-gray-500">Sin datos.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Leads recientes */}
            <div className="mt-6">
                <div className="font-semibold mb-2">Leads recientes</div>
                {showExplain && <div className="text-[11px] text-gray-500 mb-2">Lista compacta de los últimos leads generados y su etapa actual.</div>}
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
