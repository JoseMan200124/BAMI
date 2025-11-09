// src/lib/uiOrchestrator.js
// Orquestador del Agente (Autopilot) + Cursor programático (SVG).
// - Cursor AHORA está OCULTO por defecto; aparece sólo durante Autopilot y se oculta al terminar.
// - Lock del tracker se libera automáticamente al finalizar para permitir cerrar e interactuar.
// - Bridge de eventos: también dispara `tracker:simulate:start` para que CaseTracker avance.

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
        return r.top >= 0 && r.left >= 0 && r.bottom <= (window.innerHeight || document.documentElement.clientHeight) && r.right <= (window.innerWidth || document.documentElement.clientWidth)
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
    // Capa de CURSOR programático (SVG negro)
    // -------------------------------------------------------
    const style = document.createElement('style')
    style.textContent = `
    #bami-cursor-layer{pointer-events:none;position:fixed;inset:0;z-index:2147483647 !important}
    #bami-cursor-layer svg{position:absolute;left:0;top:0;transform:translate(-4px,-2px)}
    #bami-cursor-pulse{position:absolute;left:0;top:0;width:2px;height:2px;border-radius:9999px;transform:translate(-1px,-1px);box-shadow:0 0 0 0 rgba(0,0,0,.35)}
  `
    document.head.appendChild(style)

    const layer = document.createElement('div')
    layer.id = 'bami-cursor-layer'
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '22')
    svg.setAttribute('height', '26')
    svg.setAttribute('viewBox', '0 0 22 26')
    svg.innerHTML = `<path d="M1 1 L1 21 L6 16 L10 25 L14 23 L9 14 L16 14 Z" fill="#000" fill-opacity=".98" stroke="rgba(0,0,0,.65)" stroke-width="1"/>`
    const pulse = document.createElement('div')
    pulse.id = 'bami-cursor-pulse'
    layer.appendChild(svg)
    layer.appendChild(pulse)
    document.body.appendChild(layer)

    // 🔒 Oculto por defecto: sólo se muestra durante el Autopilot
    layer.style.display = 'none'
    const showCursor = () => { layer.style.display = 'block' }
    const hideCursor = () => { layer.style.display = 'none' }

    let cx = Math.round(window.innerWidth * 0.05)
    let cy = Math.round(window.innerHeight * 0.1)
    let raf
    function setCursor(x, y) {
        cx = x
        cy = y
        svg.style.left = `${x}px`
        svg.style.top = `${y}px`
        pulse.style.left = `${x}px`
        pulse.style.top = `${y}px`
    }
    setCursor(cx, cy)

    function clickAnim() {
        pulse.animate(
            [{ boxShadow: '0 0 0 0 rgba(0,0,0,.45)' }, { boxShadow: '0 0 0 10px rgba(0,0,0,0)' }],
            { duration: 280, easing: 'ease-out' }
        )
        svg.animate(
            [{ transform: 'translate(-4px,-2px) scale(1)' }, { transform: 'translate(-4px,-2px) scale(.96)' }, { transform: 'translate(-4px,-2px) scale(1)' }],
            { duration: 140 }
        )
    }

    async function moveCursorTo(x, y, duration = 420) {
        return new Promise((resolve) => {
            const x0 = cx, y0 = cy
            const t0 = performance.now()
            cancelAnimationFrame(raf)
            const step = (t) => {
                const k = Math.min(1, (t - t0) / duration)
                const ease = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k // easeInOutQuad
                const nx = x0 + (x - x0) * ease
                const ny = y0 + (y - y0) * ease
                setCursor(nx, ny)
                if (k < 1) raf = requestAnimationFrame(step)
                else resolve()
            }
            raf = requestAnimationFrame(step)
        })
    }

    async function clickAt(x, y) {
        await moveCursorTo(x, y, 260)
        clickAnim()
        const target = document.elementFromPoint(x, y)
        if (target) {
            for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
                target.dispatchEvent(
                    new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y })
                )
            }
            try { target.focus?.() } catch {}
            try { target.click?.() } catch {}
        }
    }

    async function clickElement(el) {
        if (!el) return false
        try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }) } catch {}
        await sleep(80)
        const r = el.getBoundingClientRect()
        const x = Math.round(r.left + Math.min(r.width * 0.7, r.width - 4))
        const y = Math.round(r.top + Math.min(r.height * 0.6, r.height - 4))
        await clickAt(x, y)
        return true
    }

    // -------------------------------------------------------
    // Cierre de overlays que ESTORBAN (excluye el tracker)
    // -------------------------------------------------------
    function closeFloatersExceptTracker() {
        const tracker = findTrackerContainer()
        const floats = Array.from(
            document.querySelectorAll('[role="dialog"], [data-modal], .modal, .sheet, .drawer, .overlay, .backdrop, .DialogOverlay, .MuiDialog-root')
        )
        for (const f of floats) {
            if (tracker && (tracker === f || f.contains(tracker))) continue // no cerrar ni su contenedor
            if (!isVisible(f)) continue
            // intenta botón de cerrar
            const btn = f.querySelector('[data-close],[data-dismiss],[aria-label="Cerrar"],[aria-label="Close"],.btn-close,button.close')
            if (btn) { try { btn.click() } catch {} }
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
        // reflejamos en global para que la UI pueda consultarlo
        window.__BAMI_LOCK_TRACKER__ = trackerLock
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
                openTracker(true).catch(() => {})
            }
        })
        trackerObserver.observe(root, { childList: true, subtree: true })
    }

    async function openTracker(silent = false) {
        closeFloatersExceptTracker()
        if (findTrackerContainer()) return true

        // candidatos por atributo o texto
        const btn =
            document.querySelector('[data-bami-open="tracker"], [data-testid="open-tracker"]') ||
            findByText(['abrir tracker', 'seguimiento del expediente', 'tracker'])

        const tab = findByText(['tracker'])
        const target = btn || tab

        if (target) {
            if (!silent) {
                const r = target.getBoundingClientRect()
                await moveCursorTo(r.left + r.width / 2, r.top + r.height / 2, 380)
            }
            await clickElement(target)
            await sleep(220)
        } else {
            // 🔁 Fallback: pedimos a la app que lo abra (BamiHub ahora escucha 'bami:ui:openTracker')
            try { window.dispatchEvent(new Event('bami:ui:openTracker')) } catch {}
            await sleep(300)
        }

        // Segundo intento si aún no aparece
        if (!findTrackerContainer()) {
            const again = findByText(['abrir tracker', 'seguimiento del expediente', 'tracker'])
            if (again) { await clickElement(again); await sleep(240) }
        }

        return !!findTrackerContainer()
    }

    // -------------------------------------------------------
    // Bridge de simulación para CaseTracker
    // -------------------------------------------------------
    // Si otro módulo emite bami:sim:runTracker, reenviamos al canal que CaseTracker sí escucha.
    window.addEventListener('bami:sim:runTracker', () => {
        try {
            window.dispatchEvent(new CustomEvent('tracker:simulate:start', { detail: { runId: `bridge-${Date.now()}` } }))
        } catch {}
    })

    // -------------------------------------------------------
    // Escenario del Agente
    // -------------------------------------------------------
    async function finishAgent() {
        setTrackerLock(false)
        window.__BAMI_AGENT_ACTIVE__ = false
        hideCursor()
        try { window.dispatchEvent(new Event('bami:agent:stop')) } catch {}
    }

    async function runAgentScenario() {
        window.__BAMI_AGENT_ACTIVE__ = true
        showCursor()

        // movimiento inicial para que SIEMPRE se vea el cursor sólo durante Autopilot
        await moveCursorTo(Math.round(innerWidth * 0.25), Math.round(innerHeight * 0.25), 360)
        await moveCursorTo(Math.round(innerWidth * 0.70), Math.round(innerHeight * 0.20), 360)

        // 1) Abrir tracker y clavar
        await openTracker(false)
        setTrackerLock(true)

        // 2) Lanzar simulación del tracker (en ambos canales)
        for (let i = 0; i < 2; i++) {
            try { window.dispatchEvent(new CustomEvent('tracker:simulate:start', { detail: { runId: `orch-${Date.now()}-${i}` } })) } catch {}
            try { window.dispatchEvent(new Event('bami:sim:runTracker')) } catch {}
            await sleep(250)
        }

        // 3) Si hay botón "Subir documentos (sim)" lo clicamos
        const uploadBtn =
            document.querySelector('[data-bami-upload-sim]') ||
            findByText(['subir documentos (sim)', 'subir documentos', 'simular subida'])
        if (uploadBtn) {
            if (!inViewport(uploadBtn)) { try { uploadBtn.scrollIntoView({ block: 'center' }) } catch {} }
            await clickElement(uploadBtn)
            await sleep(400)
            try { window.dispatchEvent(new Event('bami:sim:runTracker')) } catch {}
            try { window.dispatchEvent(new CustomEvent('tracker:simulate:start', { detail: { runId: `orch-retry-${Date.now()}` } })) } catch {}
        }

        // 4) Pequeño recorrido del cursor por la UI
        const scanPoints = [
            [innerWidth * 0.85, innerHeight * 0.30],
            [innerWidth * 0.65, innerHeight * 0.60],
            [innerWidth * 0.40, innerHeight * 0.55],
        ]
        for (const [x, y] of scanPoints) await moveCursorTo(Math.round(x), Math.round(y), 420)
        clickAnim()

        // ✅ Fin del Autopilot: liberamos candado y ocultamos cursor
        await sleep(400)
        await finishAgent()
    }

    // -------------------------------------------------------
    // Enganches globales
    // -------------------------------------------------------
    window.addEventListener('bami:agent:start', runAgentScenario)
    window.addEventListener('bami:agent:openTracker', () => { openTracker(false) })
    window.addEventListener('bami:agent:showTracker', () => { openTracker(false) })
    window.addEventListener('bami:agent:stop', () => { /* alias externo */ })
    window.addEventListener('bami:agent:end', () => { /* alias externo */ finishAgent() })
    window.addEventListener('bami:agent:cancel', () => { finishAgent() })

    window.addEventListener('bami:cursor:forceShow', () => {
        showCursor()
        setCursor(cx + 0.01, cy + 0.01) // “nudge” para asegurar repintado
    })
    window.addEventListener('beforeunload', () => setTrackerLock(false))

    // API útil para consola
    window.BAMI = Object.assign(window.BAMI || {}, {
        openTracker,
        runAgentScenario,
        stopAgent: finishAgent,
        _cursorMoveTo: moveCursorTo,
        _cursorClickAt: clickAt,
        _lockTracker: setTrackerLock,
        _showCursor: showCursor,
        _hideCursor: hideCursor,
    })
})()
