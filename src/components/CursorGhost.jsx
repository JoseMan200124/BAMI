// src/components/CursorGhost.jsx
// Cursor super-ligero, siempre visible y por encima de cualquier overlay.
// No crea loops pesados: un único requestAnimationFrame y sólo repinta si cambian coords.

import { useEffect, useRef } from 'react'

export default function CursorGhost() {
    const elRef = useRef(null)
    const rafRef = useRef(0)
    const lastRef = useRef({ x: -1, y: -1 })
    const targetRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })

    useEffect(() => {
        // Creamos el elemento directamente en <body> para evitar stacking contexts del árbol de React
        const el = document.createElement('div')
        el.id = 'bami-cursor-ghost'
        el.setAttribute(
            'style',
            [
                // Posicionamiento y stacking
                'position:fixed',
                'left:0',
                'top:0',
                'transform:translate3d(-9999px,-9999px,0)',
                'z-index:2147483647', // arriba de todo
                'pointer-events:none',
                // Apariencia (círculo blanco con borde oscuro)
                'width:16px',
                'height:16px',
                'border-radius:9999px',
                'background:rgba(255,255,255,.95)',
                'border:2px solid rgba(0,0,0,.8)',
                'box-shadow:0 2px 8px rgba(0,0,0,.35)',
                // Estabilidad visual
                'will-change:transform',
                'transition:opacity .12s ease',
                'opacity:1',
                'visibility:visible',
                'mix-blend-mode:normal',
                // Previene que cualquier CSS global lo oculte
                'contain:layout style paint',
                'backface-visibility:hidden',
            ].join(';')
        )
        document.body.appendChild(el)
        elRef.current = el

        // Mover objetivo (no pintamos aquí para no saturar la UI)
        const onMove = (e) => {
            const t = 'touches' in e ? e.touches[0] : e
            targetRef.current.x = t.clientX
            targetRef.current.y = t.clientY
        }

        // Garantiza visibilidad y z-index al abrir modales/overlays
        const forceTop = () => {
            if (!el.parentElement) document.body.appendChild(el)
            el.style.zIndex = '2147483647'
            el.style.opacity = '1'
            el.style.visibility = 'visible'
        }

        window.addEventListener('mousemove', onMove, { passive: true })
        window.addEventListener('touchmove', onMove, { passive: true })
        window.addEventListener('bami:cursor:forceShow', forceTop)
        document.addEventListener('focusin', forceTop)
        document.addEventListener('click', forceTop)

        // Bucle de animación: un único rAF y sólo actualiza si cambió la posición
        const tick = () => {
            const el = elRef.current
            if (el && !document.hidden) {
                const { x, y } = targetRef.current
                const { x: lx, y: ly } = lastRef.current
                if (x !== lx || y !== ly) {
                    el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
                    lastRef.current = { x, y }
                }
            }
            rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)

        // Arrancamos forzando visibilidad
        forceTop()

        return () => {
            cancelAnimationFrame(rafRef.current)
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('touchmove', onMove)
            window.removeEventListener('bami:cursor:forceShow', forceTop)
            document.removeEventListener('focusin', forceTop)
            document.removeEventListener('click', forceTop)
            el.remove()
        }
    }, [])

    return null
}
