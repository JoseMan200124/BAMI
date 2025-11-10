// src/components/UploadAssistant.jsx
import React, { useEffect, useRef, useState } from 'react'
import { X, UploadCloud, FileText, Loader2 } from 'lucide-react'
import {api} from "../lib/apiClient.js";
import { getCase, refreshTracker, notify } from '../lib/caseStore.js'

/**
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onUploaded: () => Promise<void> | void
 *  - context: 'overlay' | 'phone'
 *
 * Ahora soporta:
 *  - Eventos '...:upload:close' para cerrar desde fuera.
 *  - Evento '...:upload:demo' para simular drag&drop + subida (modo Autopilot).
 */
export default function UploadAssistant({ open, onClose, onUploaded, context = 'overlay' }) {
    const [dragOver, setDragOver] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [sentCount, setSentCount] = useState(0)
    const [error, setError] = useState('')
    const inputRef = useRef(null)

    useEffect(() => {
        if (!open) {
            setDragOver(false)
            setUploading(false)
            setSentCount(0)
            setError('')
        }
    }, [open])

    // Listeners para cerrar/simular
    useEffect(() => {
        if (!open) return

        const closeAll = () => onClose?.()

        const demo = async () => {
            // simula arrastre
            setDragOver(true)
            await new Promise(r => setTimeout(r, 650))
            setDragOver(false)

            // simula “subiendo…”
            setUploading(true)
            setError('')
            await new Promise(r => setTimeout(r, 900))

            // “enviados N archivos”
            const n = 2 + Math.floor(Math.random() * 3)
            setUploading(false)
            setSentCount(n)
            try { await refreshTracker() } catch {}
            onUploaded?.()
            notify(`Enviados ${n} archivo(s). Analizando con IA…`)
        }

        const eventsClose = ['upload:close', 'ui:upload:close', 'sim:upload:close']
        const eventsDemo = ['upload:demo', 'ui:upload:demo', 'sim:upload:demo']

        eventsClose.forEach(e => window.addEventListener(e, closeAll))
        eventsDemo.forEach(e => window.addEventListener(e, demo))

        return () => {
            eventsClose.forEach(e => window.removeEventListener(e, closeAll))
            eventsDemo.forEach(e => window.removeEventListener(e, demo))
        }
    }, [open, onClose, onUploaded])

    if (!open) return null

    const current = getCase()
    const caseId = current?.id

    const doUpload = async (fileList) => {
        if (!caseId) {
            notify('Primero crea un expediente', 'error')
            return
        }
        const files = Array.from(fileList || []).slice(0, 12)
        if (!files.length) return

        try {
            setUploading(true)
            setError('')

            const fd = new FormData()
            fd.append('id', caseId)
            files.forEach((f) => fd.append('files', f, f.name))

            await api.uploadDocumentsForm(fd) // backend inicia lectura + validación
            setSentCount(files.length)
            await refreshTracker()
            onUploaded?.()
            notify(`Enviados ${files.length} archivo(s). Analizando con IA…`)
        } catch (e) {
            setError(e?.message || 'Error al subir archivos')
            notify('No se pudieron subir los archivos', 'error')
        } finally {
            setUploading(false)
        }
    }

    const onPick = (e) => doUpload(e.target.files)
    const onDrop = (e) => {
        e.preventDefault()
        setDragOver(false)
        doUpload(e.dataTransfer.files)
    }

    const wrapperClass =
        context === 'phone'
            ? 'absolute inset-0 z-[46]'
            : 'fixed inset-0 z-[80]'

    const Backdrop = () => (
        <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            aria-hidden
        />
    )

    return (
        <div className={wrapperClass} style={{ pointerEvents: 'auto' }}>
            <Backdrop />
            <div className="absolute left-1/2 -translate-x-1/2 top-4 w-[94%] max-w-3xl">
                <div className="bg-white rounded-2xl border shadow-2xl overflow-hidden">
                    <div className="h-12 px-3 sm:px-4 flex items-center justify-between border-b bg-gray-50">
                        <div className="text-sm sm:text-base font-semibold flex items-center gap-2">
                            <FileText size={16} /> Subir documentos
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-md hover:bg-gray-200"
                            aria-label="Cerrar"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="p-3 sm:p-4">
                        <div
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={onDrop}
                            className={[
                                'rounded-2xl border-2 border-dashed grid place-items-center text-center px-4 py-10 transition',
                                dragOver ? 'bg-yellow-50 border-yellow-400' : 'bg-gray-50 border-gray-300'
                            ].join(' ')}
                            data-dropzone
                        >
                            <div className="flex flex-col items-center gap-2 max-w-md">
                                <UploadCloud />
                                <div className="text-sm">
                                    Arrastra y suelta PDFs, imágenes o documentos aquí
                                </div>
                                <div className="text-xs text-gray-600">
                                    o selecciona desde tu dispositivo
                                </div>
                                <div className="mt-2">
                                    <button
                                        type="button"
                                        className="btn btn-dark btn-sm"
                                        onClick={() => inputRef.current?.click()}
                                    >
                                        Elegir archivos
                                    </button>
                                    <input
                                        ref={inputRef}
                                        type="file"
                                        multiple
                                        hidden
                                        onChange={onPick}
                                        accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.tiff,.tif"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 sm:mt-4 text-xs text-gray-600">
                            Al subir, **leeré y validaré automáticamente** con IA (no hace falta confirmar).
                            Verás el progreso y observaciones en el chat.
                        </div>

                        {uploading && (
                            <div className="mt-3 flex items-center gap-2 text-sm">
                                <Loader2 className="animate-spin" size={16} />
                                Subiendo…
                            </div>
                        )}
                        {sentCount > 0 && !uploading && (
                            <div className="mt-3 text-sm text-emerald-700">
                                {sentCount} archivo(s) enviados. Analizando con IA…
                            </div>
                        )}
                        {error && (
                            <div className="mt-3 text-sm text-red-600">
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="px-3 sm:px-4 py-3 border-t bg-gray-50 text-xs text-gray-700">
                        Expediente: <b>{current?.id || '—'}</b> · Producto: <b>{current?.product || '—'}</b>
                    </div>
                </div>
            </div>
        </div>
    )
}
