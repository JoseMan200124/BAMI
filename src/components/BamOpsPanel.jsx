// src/components/BamOpsPanel.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient'

const TOKEN_KEY = 'bami_admin_token'

function Card({ title, value, hint }) {
    return (
        <div className="p-4 rounded-2xl border bg-white">
            <div className="text-xs text-gray-500">{title}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
            {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
        </div>
    )
}

export default function BamOpsPanel() {
    const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || '')
    const [email, setEmail] = useState('prueba@correo.com')
    const [password, setPassword] = useState('12345')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [data, setData] = useState(null)

    const logged = !!token

    const fetchData = async () => {
        if (!logged) return
        try {
            const d = await api.adminAnalytics()
            setData(d)
        } catch {
            setToken('')
            localStorage.removeItem(TOKEN_KEY)
        }
    }

    useEffect(() => {
        fetchData()
        let t
        if (logged) t = setInterval(fetchData, 10000)
        return () => t && clearInterval(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logged])

    const login = async (e) => {
        e.preventDefault()
        setLoading(true); setError('')
        try {
            const res = await api.adminLogin({ email, password })
            localStorage.setItem(TOKEN_KEY, res.token)
            setToken(res.token)
        } catch {
            setError('Credenciales inválidas')
        } finally { setLoading(false) }
    }

    const logout = () => {
        localStorage.removeItem(TOKEN_KEY)
        setToken('')
        setData(null)
    }

    const funnel = useMemo(() => data?.funnel || {}, [data])

    return (
        <div className="card">
            <div className="text-xs text-gray-500 mb-1">Equipo BAM</div>
            <h3 className="h3 mb-2 flex items-center gap-2">
                <img src="/BAMI.svg" alt="BAMI" className="w-5 h-5 rounded-full" />
                <span>Panel de análisis y leads</span>
            </h3>
            {!logged ? (
                <form onSubmit={login} className="grid sm:grid-cols-3 gap-3">
                    <input className="border rounded-xl px-3 py-2" value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo" />
                    <input className="border rounded-xl px-3 py-2" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" />
                    <button className="btn btn-dark" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar'}</button>
                    {error && <div className="sm:col-span-3 text-sm text-red-600">{error}</div>}
                    <div className="sm:col-span-3 text-xs text-gray-500">Solo para demo. Correo: <b>prueba@correo.com</b> · Contraseña: <b>12345</b></div>
                </form>
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">Sesión iniciada para análisis. Datos se actualizan cada 10s.</div>
                        <button className="btn" onClick={logout}>Cerrar sesión</button>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
                        <Card title="Leads totales" value={data?.totals?.cases ?? 0} />
                        <Card title="Aprobados" value={data?.totals?.aprobados ?? 0} hint={`Tasa ${(data?.totals?.approval_rate*100||0).toFixed(0)}%`} />
                        <Card title="Alternativa" value={data?.totals?.alternativas ?? 0} />
                        <Card title="En revisión" value={data?.totals?.en_revision ?? 0} />
                        <Card title="Pend. docs prom." value={(data?.totals?.missing_avg||0).toFixed(1)} />
                    </div>

                    {/* Funnel */}
                    <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                        <div className="font-semibold mb-2">Funnel</div>
                        <div className="space-y-2">
                            {['requiere','recibido','en_revision','aprobado','alternativa'].map(k => {
                                const v = funnel[k] || 0
                                const max = data?.totals?.cases || 1
                                const pct = Math.round((v / max) * 100)
                                return (
                                    <div key={k}>
                                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                                            <span className="capitalize">{k.replace('_',' ')}</span><span>{v} · {pct}%</span>
                                        </div>
                                        <div className="h-2 bg-white border rounded-full overflow-hidden">
                                            <div className="h-full bg-bami-yellow" style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Por producto */}
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

                    {/* Leads recientes */}
                    <div className="mt-6">
                        <div className="font-semibold mb-2">Leads recientes</div>
                        <div className="overflow-auto -mx-2 sm:mx-0">
                            <table className="min-w-[620px] sm:min-w-full text-sm mx-2 sm:mx-0">
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
                                {(data?.leads || []).map(row => (
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
                                {!data?.leads?.length && (
                                    <tr><td colSpan="7" className="py-6 text-center text-gray-500">Aún no hay leads.</td></tr>
                                )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
