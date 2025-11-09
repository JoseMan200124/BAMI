// src/lib/uiOrchestrator.js
// Orquestador del Agente con CURSOR CIRCULAR controlado por Autopilot.
// - El cursor circular está OCULTO por defecto.
// - Se muestra únicamente al recibir `bami:agent:start` y oculta el cursor nativo.
// - Se vuelve a ocultar con `bami:agent:stop`.
// - Mantiene la lógica para abrir/“clavar” el Tracker y disparar la simulación.
// - Incluye utilidades de movimiento y animación de click (opcional) para futuros pasos.

(function () {
    if (window.__BAMI_UI_ORCH_READY__) return
    window.__BAMI_UI_ORCH_READY__ = true

    // -------------------------------------------------------
    // Estilos inyectados (cursor circular + ocultar cursor nativo)
    // -------------------------------------------------------
    const STYLE_ID = 'bami-ui-orchestrator-styles'
    if (!document.getElementById(STYLE_ID)) {
        const st = document.createElement('style')
        st.id = STYLE_ID
        st.textContent = `
      .bami-hide-native-cursor, .bami-hide-native-cursor * {
        cursor: none !important;
      }
      #bami-circle-cursor {
        position: fixed;
        top: 0;
        left: 0;
        width: 28px;
        height: 28px;
        border-radius: 9999px;
        border: 2px solid var(--bami-cursor-color, #06b6d4); /* cian */
        box-shadow: 0 0 0 1px rgba(0,0,0,.06);
        transform: translate(-9999px, -9999px);
        pointer-events: none;
        opacity: 0;
        z-index: 2147483647; /* por encima de todo */
        transition:
          opacity 160ms ease,
          transform 180ms cubic-bezier(.22,.61,.36,1);
      }
      #bami-circle-cursor.is-visible {
        opacity: 1;
      }
      #bami-circle-cursor::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 9999px;
        transform: scale(1);
        opacity: 0;
        border: 6px solid var(--bami-cursor-color, #06b6d4);
        transition: transform 280ms ease, opacity 280ms ease;
      }
      #bami-circle-cursor.is-clicking::after {
        transform: scale(1.6);
        opacity: .35;
      }
    `
        document.head.appendChild(st)
    }

    // -------------------------------------------------------
    // Estado y utilidades básicas
    // -------------------------------------------------------
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const norm = (t) => (t || '').toLowerCase().replace(/\s+/g, ' ').trim()

    const isVisible = (el) => {
        if (!el || el.nodeType !== 1) return false
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) return false
        const cs = getComputedStyle(el)
        return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'
    }

    const inViewport = (el) => {
        const r = el.getBoundingClientRect()
        return (
            r.top >= 0 &&
            r.left >= 0 &&
            r.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            r.right <= (window.innerWidth || document.documentElement.clientWidth)
        )
    }

    const qAllClickables = () =>
        Array.from(
            document.querySelectorAll(
                'button, a, [role="button"], [data-bami-open], [data-testid], .btn, .MuiButton-root, .ant-btn'
            )
        )

    function findByText(candidates) {
        const wanted = candidates.map(norm)
        for (const el of qAllClickables()) {
            if (!isVisible(el)) continue
            const t = norm(el.getAttribute('aria-label') || el.innerText || el.textContent || '')
            if (!t) continue
            if (wanted.some((w) => t.includes(w))) return el
        }
        return null
    }

    function findTrackerContainer() {
        const nodes = Array.from(
            document.querySelectorAll(
                '[role="dialog"], [data-modal], .modal, .DialogContent, .MuiDialog-paper, .ant-modal, .ant-modal-content, .sheet, .drawer'
            )
        )
        for (const n of nodes) {
            if (!isVisible(n)) continue
            const txt = norm(n.innerText || '')
            if (txt.includes('seguimiento del expediente')) return n
        }
        return null
    }

    // -------------------------------------------------------
    // CURSOR CIRCULAR (oculto por defecto, visible en Autopilot)
    // -------------------------------------------------------
    const cursorEl = document.createElement('div')
    cursorEl.id = 'bami-circle-cursor'
    document.body.appendChild(cursorEl)

    let cursorVisible = false
    let lastMouse = { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) }

    // Guardamos posición del mouse (para colocar el cursor circular al activarlo)
    window.addEventListener('mousemove', (e) => {
        lastMouse = { x: e.clientX, y: e.clientY }
    }, { passive: true })

    function showCircleCursor(on) {
        cursorVisible = !!on
        if (cursorVisible) {
            // situar en la última posición conocida del mouse
            setCursorPosition(lastMouse.x, lastMouse.y)
            cursorEl.classList.add('is-visible')
            document.body.classList.add('bami-hide-native-cursor') // ocultar cursor nativo
        } else {
            cursorEl.classList.remove('is-visible', 'is-clicking')
            document.body.classList.remove('bami-hide-native-cursor')
            // enviar fuera de pantalla para no “parpadear”
            cursorEl.style.transform = 'translate(-9999px, -9999px)'
        }
    }

    function setCursorPosition(x, y) {
        const size = 28 // px, debe coincidir con CSS
        cursorEl.style.transform = `translate(${Math.round(x - size / 2)}px, ${Math.round(y - size / 2)}px)`
    }

    async function moveCursorTo(x, y, duration = 250) {
        if (!cursorVisible) return
        // Usamos transición CSS ya declarada
        setCursorPosition(x, y)
        await sleep(duration)
    }

    function clickAnim() {
        if (!cursorVisible) return
        cursorEl.classList.add('is-clicking')
        // Quitar luego de un pequeño tiempo
        setTimeout(() => cursorEl.classList.remove('is-clicking'), 220)
    }

    async function clickAt(x, y, targetEl = null) {
        await moveCursorTo(x, y, 220)
        clickAnim()
        // Disparar eventos nativos en el elemento centrado (o en targetEl si se provee)
        try {
            const el = targetEl || document.elementFromPoint(x, y)
            if (el) {
                for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
                    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }))
                }
                el.focus?.()
            }
        } catch {}
    }

    // -------------------------------------------------------
    // Cierre de overlays que estorban (excluye el tracker)
    // -------------------------------------------------------
    function closeFloatersExceptTracker() {
        const tracker = findTrackerContainer()
        const floats = Array.from(
            document.querySelectorAll(
                '[role="dialog"], [data-modal], .modal, .sheet, .drawer, .overlay, .backdrop, .DialogOverlay, .ant-modal-wrap, .MuiDialog-root'
            )
        )
        for (const f of floats) {
            if (tracker && (tracker === f || f.contains(tracker))) continue // no cerrar el tracker ni su contenedor
            if (!isVisible(f)) continue
            const btn = f.querySelector(
                '[data-close],[data-dismiss],[aria-label="Cerrar"],[aria-label="Close"],.btn-close,button.close'
            )
            if (btn) {
                try { btn.click() } catch {}
            }
            const cs = getComputedStyle(f)
            if (cs.display !== 'none') {
                f.style.setProperty('display', 'none', 'important')
                f.style.setProperty('visibility', 'hidden', 'important')
                f.setAttribute('data-bami-orch-hidden', 'true')
            }
        }
    }

    // -------------------------------------------------------
    // Abrir y “clavar” el Tracker
    // -------------------------------------------------------
    let trackerLock = false
    let trackerObserver = null

    function setTrackerLock(on) {
        trackerLock = !!on
        if (!on) {
            trackerObserver?.disconnect?.()
            trackerObserver = null
            return
        }
        const root = document.body
        trackerObserver = new MutationObserver(() => {
            if (!trackerLock) return
            const exists = !!findTrackerContainer()
            if (!exists) {
                openTracker(true).catch(() => {})
            }
        })
        trackerObserver.observe(root, { childList: true, subtree: true })
    }

    async function openTracker(silent = false) {
        closeFloatersExceptTracker()
        if (findTrackerContainer()) return true

        const btn =
            document.querySelector('[data-bami-open="tracker"], [data-testid="open-tracker"]') ||
            findByText(['abrir tracker', 'seguimiento del expediente', 'tracker'])

        const tab = findByText(['tracker'])
        const target = btn || tab

        if (target) {
            if (!silent && cursorVisible) {
                const r = target.getBoundingClientRect()
                await clickAt(r.left + r.width / 2, r.top + r.height / 2, target)
            } else {
                try { target.click?.() } catch {}
            }
            await sleep(220)
        } else {
            try { window.dispatchEvent(new Event('bami:ui:openTracker')) } catch {}
            await sleep(300)
        }

        if (!findTrackerContainer()) {
            const again = findByText(['abrir tracker', 'seguimiento del expediente', 'tracker'])
            if (again) { try { again.click?.() } catch {}; await sleep(240) }
        }
        return !!findTrackerContainer()
    }

    // -------------------------------------------------------
    // Escenario del Agente (Autopilot)
    // -------------------------------------------------------
    async function runAgentScenario() {
        window.__BAMI_AGENT_ACTIVE__ = true

        // Mostrar cursor circular y ocultar cursor nativo SOLO al iniciar Autopilot
        showCircleCursor(true)

        // 1) Abrir tracker y fijarlo
        await openTracker(true)
        setTrackerLock(true)

        // 2) Disparar simulación del tracker
        for (let i = 0; i < 3; i++) {
            try { window.dispatchEvent(new Event('bami:sim:runTracker')) } catch {}
            await sleep(250)
        }

        // 3) Simulación de “subir documentos”, si existe botón
        const uploadBtn =
            document.querySelector('[data-bami-upload-sim]') ||
            findByText(['subir documentos (sim)', 'subir documentos', 'simular subida'])
        if (uploadBtn) {
            const r = uploadBtn.getBoundingClientRect()
            if (cursorVisible) {
                await clickAt(r.left + r.width / 2, r.top + r.height / 2, uploadBtn)
            } else {
                try { uploadBtn.click?.() } catch {}
            }
            await sleep(400)
            try { window.dispatchEvent(new Event('bami:sim:runTracker')) } catch {}
        }

        // (Opcional) puedes ocultar el cursor al terminar el flujo automático:
        // showCircleCursor(false)
    }

    function stopAgentScenario() {
        window.__BAMI_AGENT_ACTIVE__ = false
        setTrackerLock(false)
        showCircleCursor(false) // ocultar el cursor circular y restaurar el cursor nativo
    }

    // -------------------------------------------------------
    // Enganches de eventos públicos
    // -------------------------------------------------------
    window.addEventListener('bami:agent:start', runAgentScenario)
    window.addEventListener('bami:agent:stop', stopAgentScenario)
    window.addEventListener('bami:agent:openTracker', () => { openTracker(true) })
    window.addEventListener('bami:agent:showTracker', () => { openTracker(true) })

    // Compatibilidad/diagnóstico
    window.addEventListener('bami:cursor:forceShow', () => showCircleCursor(true))
    window.addEventListener('bami:cursor:forceHide', () => showCircleCursor(false))
    window.addEventListener('beforeunload', () => {
        setTrackerLock(false)
        showCircleCursor(false)
    })

    // API útil para consola/desarrollo
    window.BAMI = Object.assign(window.BAMI || {}, {
        openTracker,
        runAgentScenario,
        stopAgentScenario,
        showCircleCursor,
        moveCursorTo,
        clickAt,
        clickAnim
    })
})()
