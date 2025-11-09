// src/components/BamOpsPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
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
            <span
                className="inline-block w-3 h-3 rounded-sm border"
                style={{ backgroundColor: s.color, borderColor: '#e5e7eb' }}
            />
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

/* --------------------------- Simulación Autopilot --------------------------- */
// PRNG seedable y utilidades
function makeRng(seed) {
    let s = (seed >>> 0) || 1
    return () => {
        // Park–Miller (minimal standard), 31-bit
        s = (s * 48271) % 0x7fffffff
        return (s & 0x7fffffff) / 0x7fffffff
    }
}

function pick(rand, arr) {
    return arr[Math.floor(rand() * arr.length)]
}

function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n))
}

/**
 * Genera un snapshot de datos de OPS con tendencia positiva conforme avanza `tick`.
 * Mantiene mismas claves/estructuras que usa tu UI.
 */
function genSimData(seed = Date.now(), tick = 0) {
    const rng = makeRng(seed + tick * 1013)
    const p = clamp(tick / 10, 0, 1) // progreso 0→1

    const total = 120 + Math.floor(rng() * 60) + Math.floor(p * 40)
    const aprob = Math.round((0.15 + 0.35 * p) * total)
    const enrev = Math.round((0.22 + 0.10 * p) * total)
    const alt = Math.round((0.08 + 0.05 * p) * total)
    const rec = Math.round((0.20 - 0.05 * p) * total)
    let req = total - (aprob + enrev + alt + rec)
    if (req < 0) { req = 0 }

    const approvalRate = (aprob / Math.max(1, aprob + alt))
    const missingAvg = clamp(1.4 - 1.2 * p + rng() * 0.2, 0.1, 1.7)
    const avgMinutes = Math.round(clamp(75 - 38 * p + rng() * 10, 18, 90))
    const csatAvg = Number(clamp(3.9 + 0.7 * p + (rng() - 0.5) * 0.2, 3.8, 4.9).toFixed(1))
    const csatN = 60 + Math.floor(p * 120) + Math.floor(rng() * 40)

    // Leads simulados
    const products = ['Tarjeta de Crédito', 'Préstamo Personal', 'Hipoteca', 'PyME']
    const channels = ['WEB', 'APP', 'SUCURSAL']
    const stagePool = [
        ...Array(req).fill('requiere'),
        ...Array(rec).fill('recibido'),
        ...Array(enrev).fill('en_revision'),
        ...Array(aprob).fill('aprobado'),
        ...Array(alt).fill('alternativa'),
    ]

    const names = ['María', 'Carlos', 'Sofía', 'Diego', 'Ana', 'Luis', 'Lucía', 'Jorge', 'Paola', 'Daniel']
    const leadsCount = Math.min(stagePool.length, 40)
    const now = Date.now()
    const leads = Array.from({ length: leadsCount }).map((_, i) => {
        const st = stagePool[Math.floor(rng() * stagePool.length)] || 'requiere'
        return {
            id: `C-${60000 + i}`,
            product: pick(rng, products),
            channel: pick(rng, channels),
            applicant: { name: pick(rng, names) },
            stage: st,
            missing_count: st === 'aprobado' ? 0 : (rng() < 0.5 ? 1 : 2),
            created_at: new Date(now - Math.floor(rng() * 1000 * 60 * 240)).toISOString(),
        }
    })

    const by_product = products.reduce((acc, p) => {
        acc[p] = leads.filter((l) => l.product === p).length
        return acc
    }, {})

    return {
        totals: {
            cases: total,
            aprobados: aprob,
            alternativas: alt,
            en_revision: enrev,
            missing_avg: missingAvg,
            approval_rate: approvalRate,
            avg_response_minutes: avgMinutes,
        },
        funnel: {
            requiere: req,
            recibido: rec,
            en_revision: enrev,
            aprobado: aprob,
            alternativa: alt,
        },
        sla: { avg_minutes: avgMinutes },
        csat: { avg: csatAvg, responses: csatN },
        leads,
        by_product,
    }
}

/* ------------------------------ Main panel ------------------------------ */
export default function BamOpsPanel() {
    // Autologin DEMO: nunca pedimos credenciales
    const [data, setData] = useState(null)

    // refs para control de polling y simulación (sin cambiar tu lógica)
    const pollRef = useRef(null)
    const simRef = useRef({ on: false, seed: 0, tick: 0, timer: null })

    const fetchData = async () => {
        try {
            // Si está corriendo la simulación, no sobreescribimos
            if (simRef.current.on) return

            // Garantiza que exista un token demo para clientes que lo lean del localStorage
            if (!localStorage.getItem(TOKEN_KEY)) {
                localStorage.setItem(TOKEN_KEY, 'demo')
            }
            const d = await api.adminAnalytics()
            if (!simRef.current.on) setData(d)
        } catch {
            // Si el backend requiere token real, mostramos el panel en modo demo (sin datos)
            if (!simRef.current.on) setData(null)
        }
    }

    useEffect(() => {
        fetchData()
        pollRef.current = setInterval(fetchData, 10000)
        return () => {
            clearInterval(pollRef.current)
            clearInterval(simRef.current.timer)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ---- Handler de simulación para Autopilot ----
    useEffect(() => {
        const startSim = (seed) => {
            if (simRef.current.on) return
            // pausa el polling real
            clearInterval(pollRef.current)

            simRef.current.on = true
            simRef.current.seed = seed || Date.now()
            simRef.current.tick = 0

            // primer frame
            setData(genSimData(simRef.current.seed, simRef.current.tick))

            // interval de avance suave
            simRef.current.timer = setInterval(() => {
                if (!simRef.current.on) return
                simRef.current.tick += 1
                setData(genSimData(simRef.current.seed, simRef.current.tick))
                // detener después de ~8s
                if (simRef.current.tick >= 11) {
                    clearInterval(simRef.current.timer)
                    simRef.current.on = false
                    // reanudar polling real sin pisar de inmediato
                    pollRef.current = setInterval(fetchData, 10000)
                }
            }, 700)
        }

        const onSim = (e) => startSim(e?.detail?.seed || Date.now())
        window.addEventListener('ops:simulate:start', onSim)
        return () => {
            window.removeEventListener('ops:simulate:start', onSim)
        }
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
        <div className="card" data-agent-area="panel-bam-ops">
            <div className="text-xs text-gray-500 mb-1">Equipo BAM</div>
            <h3 className="h3 mb-2 flex items-center gap-2">
                <img src="/BAMI.svg" alt="BAMI" className="w-5 h-5 rounded-full" />
                <span>Panel de análisis y leads</span>
            </h3>

            {/* =================== Indicadores clave =================== */}
            <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">Indicadores clave</div>

                {/* Móvil: carrusel horizontal */}
                <div className="flex gap-3 overflow-x-auto sm:hidden no-scrollbar pb-1">
                    <div className="min-w-[260px]">
                        <div
                            className="p-4 rounded-2xl border bg-white min-h-[132px] flex flex-col justify-between"
                            data-ops-kpi="sla"
                        >
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
                            <div className="text-xs text-gray-500">
                                {csatAvg == null ? 'Conecta tu encuesta post-atención' : `${csatN} respuestas`}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ≥ sm: auto-fit */}
                <div className="hidden sm:grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                    <div className="p-4 rounded-2xl border bg-white min-h-[132px] flex flex-col justify-between" data-ops-kpi="sla">
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
                <Card
                    title="Aprobados"
                    value={totals?.aprobados ?? 0}
                    hint={`Tasa ${(totals?.approval_rate * 100 || 0).toFixed(0)}%`}
                    className="min-h-[104px]"
                />
                <Card title="Alternativa" value={totals?.alternativas ?? 0} className="min-h-[104px]" />
                <Card title="En revisión" value={totals?.en_revision ?? 0} className="min-h-[104px]" />
                <Card title="Pend. docs prom." value={(totals?.missing_avg || 0).toFixed(1)} className="min-h-[104px]" />
            </div>

            {/* Funnel */}
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <div className="font-semibold mb-2">Funnel</div>
                <div className="space-y-2">
                    {['requiere', 'recibido', 'en_revision', 'aprobado', 'alternativa'].map((k) => {
                        const v = funnel[k] || 0
                        const max = totals?.cases || 1
                        const pct = Math.round((v / max) * 100)
                        return (
                            <div key={k} data-ops-kpi={k}>
                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span className="capitalize">{k.replace('_', ' ')}</span>
                                    <span>
                    {v} · {pct}%
                  </span>
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
                                <div className="text-xs text-gray-500 truncate">
                                    {row.product} · <span className="uppercase">{row.channel}</span>
                                </div>
                            </div>
                            <Pill color={row.stage}>{row.stage.replace('_', ' ')}</Pill>
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
                                <td className="py-2 pr-3 capitalize">{row.stage.replace('_', ' ')}</td>
                                <td className="py-2 pr-3">{row.missing_count}</td>
                                <td className="py-2 pr-3">{new Date(row.created_at).toLocaleString()}</td>
                            </tr>
                        ))}
                        {!((data?.leads || []).length) && (
                            <tr>
                                <td colSpan="7" className="py-6 text-center text-gray-500">
                                    Sin datos (modo demo).
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
