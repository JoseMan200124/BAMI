// src/components/UploadAssistant.jsx
import { useEffect, useState } from 'react'
import { getCase, notify, uploadDocsBackend } from '../lib/caseStore.js'
import { api } from '../lib/apiClient'

export default function UploadAssistant({ open, onClose, onUploaded }) {
    const [c, setC] = useState(getCase())
    const [selected, setSelected] = useState([])   // marcar enviados
    const [files, setFiles] = useState({})         // { docType: File }

    useEffect(() => {
        const onU = (e) => setC(e.detail)
        window.addEventListener('bami:caseUpdate', onU)
        return () => window.removeEventListener('bami:caseUpdate', onU)
    }, [])

    if (!open) return null

    if (!c) {
        return (
            <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-[70]">
                <div className="card w-full max-w-md">
                    <div className="font-semibold">No hay expediente</div>
                    <p className="text-sm text-gray-600">Inicia el proceso desde la página BAMI.</p>
                    <div className="mt-3 text-right"><button className="btn" onClick={onClose}>Cerrar</button></div>
                </div>
            </div>
        )
    }

    const missing = c.missing || []
    const toggle = (doc) => setSelected((prev) => (prev.includes(doc) ? prev.filter((d) => d !== doc) : [...prev, doc]))
    const onFile = (doc, file) => setFiles((f) => ({ ...f, [doc]: file }))

    const submit = async (e) => {
        e.preventDefault()
        try {
            const hasFiles = Object.keys(files).length > 0
            if (hasFiles) {
                // Subida real de archivos (IA los leerá)
                const fd = new FormData()
                fd.append('id', c.id)
                Object.entries(files).forEach(([doc, file]) => {
                    fd.append(doc, file)
                })
                await api.uploadDocumentsForm(fd)

                // La IA comenzará a narrar (SSE)
                window.dispatchEvent(new Event('bami:open'))
                window.dispatchEvent(new CustomEvent('bami:msg', {
                    detail: { role: 'ai', text: 'Recibí tus archivos. Empezaré a leerlos y validarlos paso a paso.' }
                }))
            } else {
                // Solo marcado rápido (simulación)
                await uploadDocsBackend(selected.length ? selected : [])
                window.dispatchEvent(new Event('bami:open'))
                window.dispatchEvent(new CustomEvent('bami:msg', {
                    detail: { role: 'bami', text: 'Gracias. Marqué tus documentos y pasé a revisión.' }
                }))
            }
            onUploaded?.(hasFiles ? Object.keys(files) : selected)
            notify('Documentos enviados')
        } catch {
            notify('No pude subir documentos ahora mismo', 'error')
        } finally {
            onClose?.()
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 z-[70] grid place-items-center p-4">
            <form onSubmit={submit} className="card w-full max-w-lg">
                <h3 className="h3 mb-2">Subida guiada de documentos</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Selecciona archivos para que BAMI los lea (recomendado) o márcalos como enviados.
                </p>

                <div className="space-y-3">
                    {missing.length ? (
                        missing.map((d) => (
                            <div key={d} className="flex flex-col gap-1">
                                <label className="text-sm font-medium capitalize">{d.replaceAll('_',' ')}</label>
                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={(e) => onFile(d, e.target.files?.[0])}
                                    className="block w-full text-sm"
                                />
                                <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                                    <input type="checkbox" checked={selected.includes(d)} onChange={() => toggle(d)} />
                                    Marcar como enviado (sin archivo)
                                </label>
                            </div>
                        ))
                    ) : (
                        <div className="text-sm text-emerald-700">No hay documentos pendientes.</div>
                    )}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" className="btn" onClick={onClose}>Cancelar</button>
                    <button type="submit" className="btn btn-dark">Enviar</button>
                </div>
            </form>
        </div>
    )
}
