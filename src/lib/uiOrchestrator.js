// src/lib/uiOrchestrator.js
// Orquestador del Agente (Autopilot) SIN cursor programático.
// - Abre el Tracker y lo mantiene abierto con un "candado".
// - Lanza la simulación del tracker (eventos a CaseTracker).
// - No dibuja ningún cursor ni hace animaciones de puntero.

(function () {
    if (window.__BAMI_UI_ORCH_READY__) return
    window.__BAMI_UI_ORCH_READY__ = true

    // -------------------------------------------------------
    // Utilidades
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
    // ⚠️ Cursor programático eliminado
    // -------------------------------------------------------
    // Se mantienen funciones "stub" para no romper llamadas existentes.
    async function moveCursorTo() { /* no-op */ }
    function clickAnim() { /* no-op */ }
    async function clickAt() { /* no-op */ }

    async function clickElement(el) {
        if (!el) return false
        try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }) } catch {}
        await sleep(80)
        try { el.focus?.() } catch {}
        try { el.click?.() } catch {}
        // Por compatibilidad, también disparamos eventos básicos
        try {
            const r = el.getBoundingClientRect()
            const x = Math.round(r.left + r.width / 2)
            const y = Math.round(r.top + r.height / 2)
            for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
                el.dispatchEvent(
                    new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y })
                )
            }
        } catch {}
        return true
    }

    // -------------------------------------------------------
    // Cierre de overlays que ESTORBAN (excluye el tracker)
    // -------------------------------------------------------
    function closeFloatersExceptTracker() {
        const tracker = findTrackerContainer()
        const floats = Array.from(
            document.querySelectorAll(
                '[role="dialog"], [data-modal], .modal, .sheet, .drawer, .overlay, .backdrop, .DialogOverlay, .ant-modal-wrap, .MuiDialog-root'
            )
        )
        for (const f of floats) {
            if (tracker && (tracker === f || f.contains(tracker))) continue // no cerrar ni su contenedor
            if (!isVisible(f)) continue
            // intenta botón de cerrar
            const btn = f.querySelector(
                '[data-close],[data-dismiss],[aria-label="Cerrar"],[aria-label="Close"],.btn-close,button.close'
            )
            if (btn) {
                try { btn.click() } catch {}
            }
            // si sigue visible, ocúltalo sin tocar el tracker
            const cs = getComputedStyle(f)
            if (cs.display !== 'none') {
                f.style.setProperty('display', 'none', 'important')
                f.style.setProperty('visibility', 'hidden', 'important')
                f.setAttribute('data-bami-orch-hidden', 'true')
            }
        }
    }

    // -------------------------------------------------------
    // Abrir y "clavar" el Tracker
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
        // Observa desaparición del tracker y lo reabre
        const root = document.body
        trackerObserver = new MutationObserver(() => {
            if (!trackerLock) return
            const exists = !!findTrackerContainer()
            if (!exists) {
                // reabrir suavemente
                openTracker(true).catch(() => {})
            }
        })
        trackerObserver.observe(root, { childList: true, subtree: true })
    }

    async function openTracker(silent = false) {
        closeFloatersExceptTracker()
        // si ya está, listo
        if (findTrackerContainer()) return true

        // candidatos por atributo o texto
        const btn =
            document.querySelector('[data-bami-open="tracker"], [data-testid="open-tracker"]') ||
            findByText(['abrir tracker', 'seguimiento del expediente', 'tracker'])

        // fallback: tabs superiores que digan "Tracker"
        const tab = findByText(['tracker'])

        const target = btn || tab
        if (target) {
            if (!silent) {
                // mantenemos compatibilidad con API previa (no visualiza nada)
                await moveCursorTo(0, 0, 0)
            }
            await clickElement(target)
            await sleep(220)
        } else {
            // evento para que tu app lo abra si lo escucha
            try { window.dispatchEvent(new Event('bami:ui:openTracker')) } catch {}
            await sleep(300)
        }

        // Si aún no aparece, intentamos de nuevo por texto
        if (!findTrackerContainer()) {
            const again = findByText(['abrir tracker', 'seguimiento del expediente', 'tracker'])
            if (again) { await clickElement(again); await sleep(240) }
        }

        return !!findTrackerContainer()
    }

    // -------------------------------------------------------
    // Escenario del Agente
    // -------------------------------------------------------
    async function runAgentScenario() {
        window.__BAMI_AGENT_ACTIVE__ = true

        // 1) Abrir tracker y clavar
        await openTracker(true)
        setTrackerLock(true)

        // 2) Lanzar simulación del tracker (múltiples disparos por seguridad)
        for (let i = 0; i < 3; i++) {
            try { window.dispatchEvent(new Event('bami:sim:runTracker')) } catch {}
            await sleep(250)
        }

        // 3) Si hay botón "Subir documentos (sim)" lo clicamos antes de la simulación
        const uploadBtn =
            document.querySelector('[data-bami-upload-sim]') ||
            findByText(['subir documentos (sim)', 'subir documentos', 'simular subida'])
        if (uploadBtn) {
            if (!inViewport(uploadBtn)) { try { uploadBtn.scrollIntoView({ block: 'center' }) } catch {} }
            await clickElement(uploadBtn)
            await sleep(400)
            try { window.dispatchEvent(new Event('bami:sim:runTracker')) } catch {}
        }

        // 4) (Antes movíamos el cursor por la UI; eliminado)
        clickAnim() // no-op para compatibilidad
    }

    // -------------------------------------------------------
    // Enganches globales
    // -------------------------------------------------------
    window.addEventListener('bami:agent:start', runAgentScenario)
    window.addEventListener('bami:agent:openTracker', () => { openTracker(true) })
    window.addEventListener('bami:agent:showTracker', () => { openTracker(true) })
    // Evento legacy para “forzar mostrar cursor” — ahora no hace nada.
    window.addEventListener('bami:cursor:forceShow', () => { /* no-op */ })
    window.addEventListener('beforeunload', () => setTrackerLock(false))

    // API útil para pruebas en consola (sin cursor)
    window.BAMI = Object.assign(window.BAMI || {}, {
        openTracker,
        runAgentScenario
    })
})()
