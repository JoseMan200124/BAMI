// src/lib/uiOrchestrator.js
// Orquestador del Agente (Autopilot) + Cursor programático.
// Cambios:
// - Ya NO abre el tracker al inicio; lo abre SOLO al final para demostrar el avance visible.
// - Al terminar: oculta y desmonta el cursor (failsafe) y libera cualquier lock.
// - Botón Cerrar del tracker funciona porque no usamos locks durante el flujo.
// - Mantiene un "CaseTracker" oculto (montado por BamiHub) que escucha eventos de simulación.

(function () {
    if (window.__BAMI_UI_ORCH_READY__) return
    window.__BAMI_UI_ORCH_READY__ = true

    // -------------------------------------------------------
    // Utils
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
    // Cursor programático (SVG). Oculto por defecto.
    // -------------------------------------------------------
    let raf = null
    let layer = null
    let svg = null
    let pulse = null
    let cx = 0, cy = 0

    const style = document.createElement('style')
    style.textContent = `
      #bami-cursor-layer{pointer-events:none;position:fixed;inset:0;z-index:2147483647 !important}
      #bami-cursor-layer svg{position:absolute;left:0;top:0;transform:translate(-4px,-2px)}
      #bami-cursor-pulse{position:absolute;left:0;top:0;width:2px;height:2px;border-radius:9999px;transform:translate(-1px,-1px);box-shadow:0 0 0 0 rgba(0,0,0,.35)}
    `
    document.head.appendChild(style)

    function ensureCursorLayer() {
        if (layer) return
        layer = document.createElement('div')
        layer.id = 'bami-cursor-layer'
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('width', '22')
        svg.setAttribute('height', '26')
        svg.setAttribute('viewBox', '0 0 22 26')
        svg.innerHTML = `<path d="M1 1 L1 21 L6 16 L10 25 L14 23 L9 14 L16 14 Z" fill="#000" fill-opacity=".98" stroke="rgba(0,0,0,.65)" stroke-width="1"/>`
        pulse = document.createElement('div')
        pulse.id = 'bami-cursor-pulse'
        layer.appendChild(svg)
        layer.appendChild(pulse)
        document.body.appendChild(layer)
        layer.style.display = 'none'
        setCursor(Math.round(window.innerWidth * 0.05), Math.round(window.innerHeight * 0.12))
    }

    function showCursor() {
        ensureCursorLayer()
        layer.style.display = 'block'
    }
    function hideCursor() {
        if (layer) layer.style.display = 'none'
    }
    function destroyCursor() {
        try { cancelAnimationFrame(raf) } catch {}
        raf = null
        if (layer?.parentNode) layer.parentNode.removeChild(layer)
        layer = svg = pulse = null
    }

    function setCursor(x, y) {
        cx = x; cy = y
        if (!svg || !pulse) return
        svg.style.left = `${x}px`
        svg.style.top = `${y}px`
        pulse.style.left = `${x}px`
        pulse.style.top = `${y}px`
    }

    function clickAnim() {
        if (!pulse || !svg) return
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
        ensureCursorLayer()
        return new Promise((resolve) => {
            const x0 = cx, y0 = cy
            const t0 = performance.now()
            cancelAnimationFrame(raf)
            const step = (t) => {
                const k = Math.min(1, (t - t0) / duration)
                const ease = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k
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
    // Abrir tracker (solo cuando lo pidamos al final)
    // -------------------------------------------------------
    async function openTracker() {
        if (findTrackerContainer()) return true
        // botón o pestaña probable
        const btn =
            document.querySelector('[data-bami-open="tracker"], [data-testid="open-tracker"]') ||
            findByText(['tracker', 'seguimiento del expediente'])
        const target = btn
        if (target) {
            const r = target.getBoundingClientRect()
            await moveCursorTo(r.left + r.width / 2, r.top + r.height / 2, 360)
            await clickElement(target)
            await sleep(260)
        } else {
            // fallback por evento (BamiHub lo escucha)
            try { window.dispatchEvent(new Event('bami:ui:openTracker')) } catch {}
            await sleep(320)
        }
        // 2º intento
        if (!findTrackerContainer()) {
            const again = findByText(['tracker', 'seguimiento del expediente'])
            if (again) { await clickElement(again); await sleep(260) }
        }
        return !!findTrackerContainer()
    }

    // -------------------------------------------------------
    // Esperar a que el caso alcance cierto porcentaje
    // -------------------------------------------------------
    function waitCasePercentAtLeast(minPct, timeoutMs = 10000) {
        return new Promise((resolve) => {
            const start = Date.now()
            let done = false

            function handler(e) {
                const pct = e?.detail?.percent ?? 0
                if (pct >= minPct) {
                    done = true
                    window.removeEventListener('bami:caseUpdate', handler)
                    resolve(true)
                }
            }
            window.addEventListener('bami:caseUpdate', handler)

            const t = setInterval(() => {
                if (done) { clearInterval(t); return }
                if (Date.now() - start > timeoutMs) {
                    window.removeEventListener('bami:caseUpdate', handler)
                    clearInterval(t)
                    resolve(false)
                }
            }, 200)
        })
    }

    // -------------------------------------------------------
    // Autopilot scenario
    // -------------------------------------------------------
    async function finishAgentCleanup() {
        // Libera flags y limpia cursor (failsafe)
        window.__BAMI_AGENT_ACTIVE__ = false
        window.__BAMI_LOCK_TRACKER__ = false
        try { window.dispatchEvent(new Event('bami:agent:stop')) } catch {}
        hideCursor()
        destroyCursor()
    }

    async function runAgentScenario() {
        window.__BAMI_AGENT_ACTIVE__ = true
        window.__BAMI_LOCK_TRACKER__ = false // no bloqueamos el tracker nunca durante el flujo
        showCursor()

        // Recorrido de arranque (sin abrir tracker)
        await moveCursorTo(Math.round(innerWidth * 0.22), Math.round(innerHeight * 0.28), 360)
        await moveCursorTo(Math.round(innerWidth * 0.72), Math.round(innerHeight * 0.22), 360)
        clickAnim()
        await sleep(200)

        // *** NO abrimos el tracker aquí ***
        // Lanzamos cualquier acción del flujo (simulaciones de subida/validación si existen).
        // El CaseTracker oculto (montado en BamiHub) escuchará estos eventos cuando el tracker no esté abierto.
        try { window.dispatchEvent(new Event('ui:open')) } catch {}
        try { window.dispatchEvent(new Event('ui:validate')) } catch {}
        try { window.dispatchEvent(new Event('ui:advisor')) } catch {}

        // Antes de abrir el tracker queremos que se vea el AVANCE dentro del tracker,
        // así que disparamos la simulación justo ANTES de mostrarlo.
        // Partimos del 10% típico ("requiere") y dejamos que CaseTracker avance 35 → 70 → 100 ya visible.
        await sleep(350) // breve pausa "humana"

        // Abrimos el tracker al FINAL
        await openTracker()

        // Ahora que el tracker es visible, simulamos el avance visible
        for (let i = 0; i < 2; i++) {
            try { window.dispatchEvent(new CustomEvent('tracker:simulate:start', { detail: { runId: `end-${Date.now()}-${i}` } })) } catch {}
            await sleep(120)
        }

        // Esperamos a que llegue a 100% (aprobado) para demostrarlo
        await waitCasePercentAtLeast(100, 12000)

        // Pequeño “scan” con el cursor por el tracker ya aprobado
        const tr = findTrackerContainer()
        if (tr) {
            const r = tr.getBoundingClientRect()
            await moveCursorTo(Math.round(r.left + r.width * 0.82), Math.round(r.top + r.height * 0.18), 360)
            await moveCursorTo(Math.round(r.left + r.width * 0.60), Math.round(r.top + r.height * 0.65), 360)
            clickAnim()
        }

        // Fin: ocultamos cursor y limpiamos (ahora sí se puede cerrar el tracker)
        await sleep(400)
        await finishAgentCleanup()
    }

    // -------------------------------------------------------
    // Global hooks
    // -------------------------------------------------------
    window.addEventListener('bami:agent:start', runAgentScenario)
    window.addEventListener('bami:agent:end', finishAgentCleanup)
    window.addEventListener('bami:agent:cancel', finishAgentCleanup)
    window.addEventListener('beforeunload', finishAgentCleanup)

    // Utils para consola
    window.BAMI = Object.assign(window.BAMI || {}, {
        runAgentScenario,
        stopAgent: finishAgentCleanup,
        _openTracker: openTracker,
        _showCursor: showCursor,
        _hideCursor: hideCursor,
    })
})()
