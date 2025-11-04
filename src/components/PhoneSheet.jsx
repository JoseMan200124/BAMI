// src/components/PhoneSheet.jsx
import React from 'react'

/**
 * Hoja superior (sheet) que vive DENTRO del teléfono.
 */
export default function PhoneSheet({ title, onClose = () => {}, children }) {
    return (
        <div
            className="absolute inset-0 z-[50] bg-black/35"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div
                className="absolute left-0 right-0 bottom-0 bg-white rounded-t-3xl shadow-xl border-t"
                style={{ maxHeight: '88%', minHeight: '40%' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 h-12 border-b bg-gray-50 rounded-t-3xl">
                    <div className="font-semibold text-sm truncate">{title}</div>
                    <button className="btn" onClick={onClose} aria-label="Cerrar hoja">
                        Cerrar
                    </button>
                </div>
                <div className="p-3 sm:p-4 overflow-auto">{children}</div>
            </div>
        </div>
    )
}
