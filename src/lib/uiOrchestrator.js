// src/lib/uiOrchestrator.js
// Orquestador del Autopilot + cursor. Seguro contra bloqueos.
//
// Cambios clave anti-freeze:
// - Mutex global: impide que el Autopilot arranque 2 veces a la vez.
// - AbortController para cancelar animaciones/eventos si algo falla.
// - microYield() y safeWaitFor(): ceden control al navegador periódicamente.
// - Límites en escaneos del DOM y timeouts defensivos.
// - Limpieza TOTAL en finally() pase lo que pase.
// - Ya NO abre el tracker al inicio. Lo abre al FINAL, lo cierra y salta a BAM·Ops.

(function () {
    if (window.__BAMI_UI_ORCH_READY__) return
    window.__BAMI_UI_ORCH_READY__ = true

    // ------------------ Estado global del agente ------------------
    const AGENT = {
        running: false,
        abort: null,            // AbortController
        raf: null,              // requestAnimationFrame id
        cursorLayer: null,
        cursorSVG: null,
        cursorPulse: null,
        x: 0,
        y: 0,
    }

    // Último % conocido del caso (para esperas sin depender de UI)
    let LAST_PCT = 0
    window.addEventListener('bami:caseUpdate', (e) => {
        const p = e?.detail?.percent
        if (typeof p === 'number') LAST_PCT = p
    })

    // ------------------ Utilidades ------------------
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const microYield = () => new Promise((r) => requestAnimationFrame(() => r()))
    const norm = (t) => (t || '').toLowerCase().replace(/\s+/g, ' ').trim()

    async function safeWaitFor(fn, { timeout = 2000, every = 80, abortSignal } = {}) {
        const t0 = Date.now()
        while (true) {
            if (abortSignal?.aborted) return null
            const v = fn()
            if (v) return v
            if (Date.now() - t0 >= timeout) return null
            await sleep(every)
            await microYield()
        }
    }

    const isVisible = (el) => {
        if (!el || el.nodeType !== 1) return false
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) return false
        const cs = getComputedStyle(el)
        return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'
    }

    function qAllClickables(limit = 400) {
        // Limitar hard el número de nodos escaneados para evitar bloqueos en UIs gigantes
        const list = document.querySelectorAll(
            'button, a, [role="button"], [data-bami-open], [data-testid], .btn, .MuiButton-root, .ant-btn'
        )
        return Array.prototype.slice.call(list, 0, limit)
    }

    function findByText(candidates, limit = 400) {
        const wanted = candidates.map(norm)
        for (const el of qAllClickables(limit)) {
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

    function findOpsPanel() {
        const n = document.querySelector('[data-agent-area="panel-bam-ops"]')
        return n && isVisible(n) ? n : null
    }

    // ------------------ Cursor seguro ------------------
    const style = document.createElement('style')
    style.textContent = `
    #bami-cursor-layer{pointer-events:none;position:fixed;inset:0;z-index:2147483647 !important}
    #bami-cursor-layer svg{position:absolute;left:0;top:0;transform:translate(-4px,-2px)}
    #bami-cursor-pulse{position:absolute;left:0;top:0;width:2px;height:2px;border-radius:9999px;transform:translate(-1px,-1px);box-shadow:0 0 0 0 rgba(0,0,0,.35)}
  `
    document.head.appendChild(style)

    function ensureCursor() {
        if (AGENT.cursorLayer) return
        AGENT.cursorLayer = document.createElement('div')
        AGENT.cursorLayer.id = 'bami-cursor-layer'
        AGENT.cursorSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        AGENT.cursorSVG.setAttribute('width', '22')
        AGENT.cursorSVG.setAttribute('height', '26')
        AGENT.cursorSVG.setAttribute('viewBox', '0 0 22 26')
        AGENT.cursorSVG.innerHTML = `<path d="M1 1 L1 21 L6 16 L10 25 L14 23 L9 14 L16 14 Z" fill="#000" fill-opacity=".98" stroke="rgba(0,0,0,.65)" stroke-width="1"/>`
        AGENT.cursorPulse = document.createElement('div')
        AGENT.cursorPulse.id = 'bami-cursor-pulse'
        AGENT.cursorLayer.appendChild(AGENT.cursorSVG)
        AGENT.cursorLayer.appendChild(AGENT.cursorPulse)
        document.body.appendChild(AGENT.cursorLayer)
        AGENT.cursorLayer.style.display = 'none'
        setCursor(Math.round(window.innerWidth * 0.05), Math.round(window.innerHeight * 0.12))
    }

    function showCursor() { ensureCursor(); AGENT.cursorLayer.style.display = 'block' }
    function hideCursor() { if (AGENT.cursorLayer) AGENT.cursorLayer.style.display = 'none' }
    function destroyCursor() {
        try { cancelAnimationFrame(AGENT.raf) } catch {}
        AGENT.raf = null
        if (AGENT.cursorLayer?.parentNode) AGENT.cursorLayer.parentNode.removeChild(AGENT.cursorLayer)
        AGENT.cursorLayer = AGENT.cursorSVG = AGENT.cursorPulse = null
    }

    function setCursor(x, y) {
        AGENT.x = x; AGENT.y = y
        if (!AGENT.cursorSVG || !AGENT.cursorPulse) return
        AGENT.cursorSVG.style.left = `${x}px`
        AGENT.cursorSVG.style.top = `${y}px`
        AGENT.cursorPulse.style.left = `${x}px`
        AGENT.cursorPulse.style.top = `${y}px`
    }

    function clickAnim() {
        if (!AGENT.cursorPulse || !AGENT.cursorSVG) return
        AGENT.cursorPulse.animate(
            [{ boxShadow: '0 0 0 0 rgba(0,0,0,.45)' }, { boxShadow: '0 0 0 10px rgba(0,0,0,0)' }],
            { duration: 240, easing: 'ease-out' }
        )
        AGENT.cursorSVG.animate(
            [
                { transform: 'translate(-4px,-2px) scale(1)' },
                { transform: 'translate(-4px,-2px) scale(.96)' },
                { transform: 'translate(-4px,-2px) scale(1)' }
            ],
            { duration: 120 }
        )
    }

    async function moveCursorTo(x, y, duration = 300, { abortSignal } = {}) {
        ensureCursor()
        return new Promise((resolve) => {
            const x0 = AGENT.x, y0 = AGENT.y
            const t0 = performance.now()
            try { cancelAnimationFrame(AGENT.raf) } catch {}
            const step = (t) => {
                if (abortSignal?.aborted) return resolve()
                const k = Math.min(1, (t - t0) / duration)
                // easeInOutQuad
                const ease = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k
                const nx = x0 + (x - x0) * ease
                const ny = y0 + (y - y0) * ease
                setCursor(nx, ny)
                if (k < 1) AGENT.raf = requestAnimationFrame(step)
                else resolve()
            }
            AGENT.raf = requestAnimationFrame(step)
        })
    }

    async function clickAt(x, y, opts = {}) {
        await moveCursorTo(x, y, 240, opts)
        clickAnim()
        const target = document.elementFromPoint(x, y)
        if (target) {
            for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
                target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }))
            }
            try { target.focus?.() } catch {}
            try { target.click?.() } catch {}
        }
    }

    async function clickElement(el, opts = {}) {
        if (!el) return false
        try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }) } catch {}
        await sleep(60)
        const r = el.getBoundingClientRect()
        const x = Math.round(r.left + Math.min(r.width * 0.7, r.width - 4))
        const y = Math.round(r.top + Math.min(r.height * 0.6, r.height - 4))
        await clickAt(x, y, opts)
        return true
    }

    // ------------------ Tracker open/close ------------------
    async function openTracker({ abortSignal } = {}) {
        if (findTrackerContainer()) return true
        const btn =
            document.querySelector('[data-bami-open="tracker"], [data-testid="open-tracker"]') ||
            findByText(['tracker', 'seguimiento del expediente'])
        if (btn) {
            await clickElement(btn, { abortSignal })
        } else {
            try { window.dispatchEvent(new Event('bami:ui:openTracker')) } catch {}
        }
        await microYield()
        // pequeña espera a que monte el modal
        const opened = await safeWaitFor(() => findTrackerContainer(), { timeout: 1200, abortSignal })
        return !!opened
    }

    async function closeTracker({ abortSignal } = {}) {
        const tr = findTrackerContainer()
        if (!tr) return true
        const closeBtn =
            Array.from(tr.querySelectorAll('button, [role="button"], .btn'))
                .find((b) => norm(b.innerText || b.getAttribute('aria-label')) === 'cerrar')
            || findByText(['cerrar'])
        if (closeBtn) {
            await clickElement(closeBtn, { abortSignal })
        } else {
            const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/40, .modal-backdrop, [data-backdrop]')
            if (backdrop) await clickElement(backdrop, { abortSignal })
            else try { window.dispatchEvent(new Event('ui:tracker:close')) } catch {}
        }
        await microYield()
        return !findTrackerContainer()
    }

    // ------------------ Esperas/Señales ------------------
    function waitCasePercentAtLeast(minPct, timeoutMs = 8000, abortSignal) {
        // Si ya llegó, resolvemos de una
        if ((LAST_PCT || 0) >= minPct) return Promise.resolve(true)

        return new Promise((resolve) => {
            const start = Date.now()
            let done = false
            function handler(e) {
                const pct = e?.detail?.percent ?? 0
                LAST_PCT = pct
                if (pct >= minPct) {
                    done = true
                    window.removeEventListener('bami:caseUpdate', handler)
                    resolve(true)
                }
            }
            window.addEventListener('bami:caseUpdate', handler)

            const tick = async () => {
                while (!done) {
                    if (abortSignal?.aborted) break
                    if (Date.now() - start > timeoutMs) break
                    await sleep(120)
                }
                window.removeEventListener('bami:caseUpdate', handler)
                resolve(done)
            }
            tick()
        })
    }

    async function ensureOpsVisible({ abortSignal } = {}) {
        try { window.dispatchEvent(new Event('bami:ui:openOps')) } catch {}
        await sleep(200)
        let tries = 0
        while (!findOpsPanel() && tries < 2 && !abortSignal?.aborted) {
            const btn = findByText(['ops', 'área bam', 'bam ops'])
            if (btn) await clickElement(btn, { abortSignal })
            await sleep(200)
            tries++
        }
        const ops = findOpsPanel()
        if (ops) ops.scrollIntoView({ block: 'center', behavior: 'smooth' })
        return !!ops
    }

    // ------------------ Limpieza ------------------
    async function cleanup() {
        try { window.dispatchEvent(new Event('bami:agent:stop')) } catch {}
        hideCursor()
        destroyCursor()
        try { cancelAnimationFrame(AGENT.raf) } catch {}
        AGENT.raf = null
    }

    // ------------------ Escenario del Autopilot ------------------
    async function runAgentScenario() {
        if (AGENT.running) return // Mutex
        AGENT.running = true
        AGENT.abort = new AbortController()
        const signal = AGENT.abort.signal

        try {
            showCursor()
            await microYield()

            // Recorrido inicial (sin abrir tracker)
            await moveCursorTo(Math.round(innerWidth * 0.22), Math.round(innerHeight * 0.28), 260, { abortSignal: signal })
            await microYield()
            await moveCursorTo(Math.round(innerWidth * 0.72), Math.round(innerHeight * 0.22), 260, { abortSignal: signal })
            clickAnim()
            await sleep(140)

            // Dispara acciones genéricas
            if (!signal.aborted) { try { window.dispatchEvent(new Event('ui:open')) } catch {} }
            if (!signal.aborted) { try { window.dispatchEvent(new Event('ui:validate')) } catch {} }
            if (!signal.aborted) { try { window.dispatchEvent(new Event('ui:advisor')) } catch {} }
            await sleep(240)

            // Abre tracker AL FINAL
            if (!signal.aborted) await openTracker({ abortSignal: signal })

            // Simula avance de tracker (CaseTracker escucha)
            if (!signal.aborted) {
                try { window.dispatchEvent(new CustomEvent('tracker:simulate:start', { detail: { runId: `end-${Date.now()}` } })) } catch {}
            }

            // Espera aprobación (con timeout seguro)
            if (!signal.aborted) await waitCasePercentAtLeast(100, 9000, signal)

            // Pequeño foco dentro del tracker aprobado
            const tr = findTrackerContainer()
            if (!signal.aborted && tr) {
                const r = tr.getBoundingClientRect()
                await moveCursorTo(Math.round(r.left + r.width * 0.80), Math.round(r.top + r.height * 0.20), 250, { abortSignal: signal })
                clickAnim()
                await sleep(150)
            }

            // Cierra tracker
            if (!signal.aborted) await closeTracker({ abortSignal: signal })
            await sleep(160)

            // Cambia a Área Ops
            let opsOk = false
            if (!signal.aborted) opsOk = await ensureOpsVisible({ abortSignal: signal })
            await sleep(160)

            // Simula KPIs + recorrido breve
            if (!signal.aborted && opsOk) {
                try { window.dispatchEvent(new CustomEvent('ops:simulate:start', { detail: { seed: Date.now() } })) } catch {}
                await sleep(120)
                const ops = findOpsPanel()
                if (ops) {
                    const pick = (attr) => ops.querySelector(`[data-ops-kpi="${attr}"]`)
                    const targets = ['requiere', 'recibido', 'en_revision', 'aprobado', 'alternativa', 'sla']
                        .map(pick).filter(Boolean)
                    for (const t of targets) {
                        const r = t.getBoundingClientRect()
                        await moveCursorTo(Math.round(r.left + r.width * 0.8), Math.round(r.top + r.height * 0.5), 220, { abortSignal: signal })
                        clickAnim()
                        await sleep(120)
                        if (signal.aborted) break
                    }
                }
            }
        } catch (err) {
            // swallow pero garantizamos limpieza
            console.error('[Autopilot] error controlado:', err)
        } finally {
            await sleep(220)
            await cleanup()
            AGENT.running = false
            AGENT.abort = null
        }
    }

    // ------------------ Hooks globales ------------------
    window.addEventListener('bami:agent:start', () => {
        if (AGENT.running) return
        runAgentScenario()
    })

    window.addEventListener('bami:agent:cancel', () => {
        try { AGENT.abort?.abort() } catch {}
    })

    window.addEventListener('beforeunload', () => {
        try { AGENT.abort?.abort() } catch {}
    })

    // Utils para consola
    window.BAMI = Object.assign(window.BAMI || {}, {
        runAgentScenario,
        stopAgent: () => { try { AGENT.abort?.abort() } catch {} },
        _openTracker: openTracker,
        _closeTracker: closeTracker,
        _openOps: ensureOpsVisible
    })
})()
