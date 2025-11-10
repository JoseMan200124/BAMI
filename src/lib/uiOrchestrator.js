// src/lib/uiOrchestrator.js
// Orquestador del Agente SIN cursor circular y SIN ocultar el cursor nativo.
// - Se eliminó el círculo celeste por completo.
// - Nunca se oculta el cursor real del sistema.
// - El Tracker se abre durante el flujo (si aplica) y se CIERRA al finalizar,
//   evitando que se reabra automáticamente (se desactiva el lock antes de cerrarlo).
// - Al FINAL del Autopilot, se lanza un mini flujo “como cliente” en escritorio:
//   abre el chat, muestra un mensaje guía y deja listo para continuar.

(function () {
    if (window.__BAMI_UI_ORCH_READY__) return
    window.__BAMI_UI_ORCH_READY__ = true

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const norm = (t) => (t || '').toLowerCase().replace(/\s+/g, ' ').trim()

    const isVisible = (el) => {
        if (!el || el.nodeType !== 1) return false
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) return false
        const cs = getComputedStyle(el)
        return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'
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

    // (sin cursor visual) timing helpers
    async function moveCursorTo(_x, _y, duration = 200) { await sleep(duration) }
    async function clickAt(x, y, targetEl = null) {
        await moveCursorTo(x, y, 160)
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

    // Cierre de overlays que estorban (excluye el tracker)
    function closeFloatersExceptTracker() {
        const tracker = findTrackerContainer()
        const floats = Array.from(
            document.querySelectorAll(
                '[role="dialog"], [data-modal], .modal, .sheet, .drawer, .overlay, .backdrop, .DialogOverlay, .ant-modal-wrap, .MuiDialog-root'
            )
        )
        for (const f of floats) {
            if (tracker && (tracker === f || f.contains(tracker))) continue
            if (!isVisible(f)) continue
            const btn = f.querySelector(
                '[data-close],[data-dismiss],[aria-label="Cerrar"],[aria-label="Close"],.btn-close,button.close'
            )
            if (btn) { try { btn.click(); continue } catch {} }
            const cs = getComputedStyle(f)
            if (cs.display !== 'none') {
                f.style.setProperty('display', 'none', 'important')
                f.style.setProperty('visibility', 'hidden', 'important')
                f.setAttribute('data-bami-orch-hidden', 'true')
            }
        }
    }

    // Tracker lock
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
            if (!exists) { openTracker(true).catch(() => {}) }
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
            if (!silent) {
                const r = target.getBoundingClientRect()
                await clickAt(r.left + r.width / 2, r.top + r.height / 2, target)
            } else {
                try { target.click?.() } catch {}
            }
            await sleep(200)
        } else {
            try { window.dispatchEvent(new Event('bami:ui:openTracker')) } catch {}
            await sleep(260)
        }

        if (!findTrackerContainer()) {
            const again = findByText(['abrir tracker', 'seguimiento del expediente', 'tracker'])
            if (again) { try { again.click?.() } catch {} ; await sleep(220) }
        }
        return !!findTrackerContainer()
    }

    async function closeTracker() {
        const tracker = findTrackerContainer()
        if (!tracker) return false
        const closeBtn =
            tracker.querySelector(
                '[aria-label="Cerrar"], [aria-label="Close"], [data-close], [data-dismiss], .btn-close, button.close'
            ) || findByText(['cerrar'])
        if (closeBtn) {
            try {
                closeBtn.click()
                await sleep(150)
                return !findTrackerContainer()
            } catch {}
        }
        try {
            tracker.style.setProperty('display', 'none', 'important')
            tracker.style.setProperty('visibility', 'hidden', 'important')
        } catch {}
        await sleep(60)
        return !findTrackerContainer()
    }

    // Escenario del Agente (Autopilot)
    async function runAgentScenario() {
        window.__BAMI_AGENT_ACTIVE__ = true

        // 1) Abrir tracker y fijarlo durante el flujo (si existe)
        await openTracker(true)
        setTrackerLock(true)

        // 2) Disparar simulación del tracker (avance de etapas)
        for (let i = 0; i < 3; i++) {
            try { window.dispatchEvent(new Event('bami:sim:runTracker')) } catch {}
            await sleep(240)
        }

        // 3) Simulación de subida de documentos (opcional si hay botón)
        const uploadBtn =
            document.querySelector('[data-bami-upload-sim]') ||
            findByText(['subir documentos (sim)', 'subir documentos', 'simular subida'])
        if (uploadBtn) {
            const r = uploadBtn.getBoundingClientRect()
            await clickAt(r.left + r.width / 2, r.top + r.height / 2, uploadBtn)
            await sleep(360)
            try { window.dispatchEvent(new Event('bami:sim:runTracker')) } catch {}
        }

        // 4) FIN del flujo: desactivar lock y CERRAR tracker (no debe quedar abierto).
        setTrackerLock(false)
        await closeTracker()

        // 5) Arrancar mini flujo de CLIENTE en escritorio:
        //    - Marcamos fin del autopilot ANTES de emitir eventos, para que el chat los acepte.
        window.__BAMI_AGENT_ACTIVE__ = false
        try {
            // Enfocar área cliente en la UI
            window.dispatchEvent(new Event('bami:clientflow:ensureClientVisible'))
            window.dispatchEvent(new Event('bami:clientflow:start'))
            // Abrir chat y dejar un mensaje guía
            window.dispatchEvent(new Event('ui:open'))
            window.dispatchEvent(new CustomEvent('ui:msg', { detail: { role: 'bami', text: '✅ Autopilot finalizado. Ahora probemos juntos el flujo como cliente. Puedes escribir “tarjeta de crédito”, “subir documentos” o “tracker”.' }}))
        } catch {}
    }

    function stopAgentScenario() {
        window.__BAMI_AGENT_ACTIVE__ = false
        setTrackerLock(false)
        closeTracker()
    }

    // Enganches públicos
    window.addEventListener('bami:agent:start', runAgentScenario)
    window.addEventListener('bami:agent:stop', stopAgentScenario)
    window.addEventListener('bami:agent:openTracker', () => openTracker(true))
    window.addEventListener('bami:agent:showTracker', () => openTracker(true))

    // API dev
    window.BAMI = Object.assign(window.BAMI || {}, {
        openTracker,
        closeTracker,
        runAgentScenario,
        stopAgentScenario,
        moveCursorTo,
        clickAt
    })
})()
