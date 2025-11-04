// src/components/RequestForm.jsx
import React, { useState } from 'react'
import { createNewCase, getCase, notify, PRODUCT_RULES, setApplicant } from '../lib/caseStore.js'

export default function RequestForm({ product, onCreated }) {
    const existing = getCase()
    const [p] = useState(product)
    const [form, setForm] = useState({
        name: existing?.applicant?.name || '',
        dpi: existing?.applicant?.dpi || '',
        phone: existing?.applicant?.phone || '',
        email: existing?.applicant?.email || '',
        income: existing?.applicant?.income || '',
        address: existing?.applicant?.address || '',
        businessName: existing?.applicant?.businessName || '',
    })
    const [errors, setErrors] = useState({})
    const requiredDocs = PRODUCT_RULES[p] || []

    const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

    const validate = () => {
        const e = {}
        if (!form.name) e.name = 'Requerido'
        if (!form.dpi || form.dpi.length < 6) e.dpi = 'DPI inválido'
        if (!form.phone) e.phone = 'Requerido'
        if (!form.email || !form.email.includes('@')) e.email = 'Correo inválido'
        if (!form.income) e.income = 'Requerido'
        if (!form.address) e.address = 'Requerido'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const submit = async (e) => {
        e.preventDefault()
        if (!validate()) return

        setApplicant(form)
        const c = await createNewCase(p, form)
        notify('Datos recibidos. Requisitos generados según producto.')

        setTimeout(() => {
            // eventos de UI (no simulador)
            window.dispatchEvent(new Event('ui:open'))
            window.dispatchEvent(new Event('ui:upload'))
            window.dispatchEvent(new Event('ui:tracker:open'))
        }, 150)

        onCreated?.(c)
    }

    return (
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
                <label className="text-sm">Nombre completo</label>
                <input className="w-full border rounded-xl px-3 py-2 text-base" name="name" value={form.name} onChange={onChange} autoComplete="name" />
                {errors.name && <div className="text-xs text-red-600 mt-1">{errors.name}</div>}
            </div>
            <div>
                <label className="text-sm">DPI</label>
                <input className="w-full border rounded-xl px-3 py-2 text-base" name="dpi" value={form.dpi} onChange={onChange} inputMode="numeric" autoComplete="off" />
                {errors.dpi && <div className="text-xs text-red-600 mt-1">{errors.dpi}</div>}
            </div>
            <div>
                <label className="text-sm">Teléfono</label>
                <input className="w-full border rounded-xl px-3 py-2 text-base" name="phone" value={form.phone} onChange={onChange} type="tel" inputMode="tel" autoComplete="tel" />
                {errors.phone && <div className="text-xs text-red-600 mt-1">{errors.phone}</div>}
            </div>
            <div>
                <label className="text-sm">Email</label>
                <input className="w-full border rounded-xl px-3 py-2 text-base" name="email" value={form.email} onChange={onChange} type="email" inputMode="email" autoComplete="email" />
                {errors.email && <div className="text-xs text-red-600 mt-1">{errors.email}</div>}
            </div>
            <div>
                <label className="text-sm">Ingresos mensuales (Q)</label>
                <input className="w-full border rounded-xl px-3 py-2 text-base" name="income" value={form.income} onChange={onChange} type="number" inputMode="numeric" />
                {errors.income && <div className="text-xs text-red-600 mt-1">{errors.income}</div>}
            </div>
            <div>
                <label className="text-sm">Dirección</label>
                <input className="w-full border rounded-xl px-3 py-2 text-base" name="address" value={form.address} onChange={onChange} autoComplete="street-address" />
                {errors.address && <div className="text-xs text-red-600 mt-1">{errors.address}</div>}
            </div>
            {p === 'PyME' && (
                <div className="md:col-span-2">
                    <label className="text-sm">Nombre del negocio (PyME)</label>
                    <input className="w-full border rounded-xl px-3 py-2 text-base" name="businessName" value={form.businessName} onChange={onChange} />
                </div>
            )}

            <div className="md:col-span-2 mt-1 sm:mt-2 p-3 sm:p-4 bg-gray-50 rounded-xl">
                <div className="text-sm font-semibold mb-2">Requisitos para {p}</div>
                <div className="flex flex-wrap gap-2">
                    {requiredDocs.map((r) => (
                        <span key={r} className="px-2 py-1 rounded-full text-xs bg-white border capitalize">
              {r.replaceAll('_', ' ')}
            </span>
                    ))}
                </div>
            </div>

            <div className="md:col-span-2 flex justify-end">
                <button className="btn btn-dark w-full sm:w-auto">Guardar y continuar</button>
            </div>
        </form>
    )
}
