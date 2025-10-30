// src/pages/Leads.jsx
import { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'

export default function Leads(){
    const [data,setData] = useState([])
    const [loading,setLoading] = useState(true)
    const [error,setError] = useState(null)

    useEffect(()=>{(async()=>{
        try{
            const res = await api.adminAnalytics()
            setData(res.leads || [])
        }catch(e){
            setError(e.message)
        }finally{
            setLoading(false)
        }
    })()},[])

    return (
        <section className="section">
            <div className="max-w-7xl mx-auto px-4">
                <h1 className="h1 mb-6">Leads</h1>
                <div className="card overflow-x-auto">
                    {loading ? 'Cargando…' : error ? (
                        <div className="text-red-600">{error}</div>
                    ) : (
                        <table className="min-w-full text-sm">
                            <thead>
                            <tr className="text-left">
                                <th className="py-2 pr-4">ID</th>
                                <th className="pr-4">Producto</th>
                                <th className="pr-4">Etapa</th>
                                <th className="pr-4">Canal</th>
                                <th className="pr-4">Solicitante</th>
                                <th className="pr-4">Faltantes</th>
                                <th>Creado</th>
                            </tr>
                            </thead>
                            <tbody>
                            {data.map((r)=> (
                                <tr key={r.id} className="border-t">
                                    <td className="py-2 pr-4">{r.id}</td>
                                    <td className="pr-4">{r.product}</td>
                                    <td className="pr-4 capitalize">{r.stage}</td>
                                    <td className="pr-4 uppercase">{r.channel}</td>
                                    <td className="pr-4">{r.applicant?.name || '-'}</td>
                                    <td className="pr-4">{r.missing_count}</td>
                                    <td>{new Date(r.created_at).toLocaleString()}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </section>
    )
}
