// src/lib/uiOrchestrator.js
// Orquestador del Agente. Al iniciar demo: cerramos “ventanitas” y
// cualquier panel Autopilot visible. Sin cursor circular.

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
        Array.from(document.querySelectorAll('button, a, [role="button"], [data-bami-open], [data-testid], .btn, .MuiButton-root, .ant-btn'))

    function findByText(cands) {
        const wanted = cands.map(norm)
        for (const el of qAllClickables()) {
            if (!isVisible(el)) continue
            const t = norm(el.getAttribute('aria-label') || el.innerText || el.textContent || '')
            if (t && wanted.some((w) => t.includes(w))) return el
        }
        return null
    }

    function findTrackerContainer() {
        const nodes = Array.from(
            document.querySelectorAll('[role="dialog"], [data-modal], .modal, .DialogContent, .MuiDialog-paper, .ant-modal, .ant-modal-content, .sheet, .drawer')
        )
        for (const n of nodes) {
            if (!isVisible(n)) continue
            const txt = norm(n.innerText || '')
            if (txt.includes('seguimiento del expediente')) return n
        }
        return null
    }

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

    function closeFloatersExceptTracker() {
        const tracker = findTrackerContainer()
        const floats = Array.from(
            document.querySelectorAll('[role="dialog"], [data-modal], .modal, .sheet, .drawer, .overlay, .backdrop, .DialogOverlay, .ant-modal-wrap, .MuiDialog-root')
        )
        for (const f of floats) {
            if (tracker && (tracker === f || f.contains(tracker))) continue
            if (!isVisible(f)) continue
            const btn = f.querySelector('[data-close],[data-dismiss],[aria-label="Cerrar"],[aria-label="Close"],.btn-close,button.close')
            if (btn) { try { btn.click(); continue } catch {} }
            const cs = getComputedStyle(f)
            if (cs.display !== 'none') {
                f.style.setProperty('display', 'none', 'important')
                f.style.setProperty('visibility', 'hidden', 'important')
                f.setAttribute('data-bami-orch-hidden', 'true')
            }
        }
    }

    // 🔒 Mantener tracker abierto si se cierra por error
    let trackerLock = false
    let trackerObserver = null
    function setTrackerLock(on) {
        trackerLock = !!on
        if (!on) { trackerObserver?.disconnect?.(); trackerObserver = null; return }
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
        const btn = document.querySelector('[data-bami-open="tracker"], [data-testid="open-tracker"]') || findByText(['abrir tracker', 'seguimiento del expediente', 'tracker'])
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
            tracker.querySelector('[aria-label="Cerrar"], [aria-label="Close"], [data-close], [data-dismiss], .btn-close, button.close') || findByText(['cerrar'])
        if (closeBtn) {
            try { closeBtn.click(); await sleep(150); return !findTrackerContainer() } catch {}
        }
        try {
            tracker.style.setProperty('display', 'none', 'important')
            tracker.style.setProperty('visibility', 'hidden', 'important')
        } catch {}
        await sleep(60)
        return !findTrackerContainer()
    }

    function forceCloseAutopilotPanels() {
        // Cierra cualquier UI del Autopilot y selecciona la pestaña BAMI si existe
        const nodes = Array.from(
            document.querySelectorAll('[data-autopilot-panel], [data-component="BamiAgent"], [data-bami-agent], [role="dialog"], .sheet, .drawer')
        )
        nodes.forEach(n => {
            const txt = (n.innerText || '').toLowerCase()
            if (txt.includes('autopilot') || txt.includes('iniciar demo') || txt.includes('bami agent')) {
                n.style.setProperty('display', 'none', 'important')
                n.style.setProperty('visibility', 'hidden', 'important')
            }
        })
        const bamiTab = Array.from(document.querySelectorAll('[role="tab"], [data-tab], .tab'))
            .find(el => /bami/i.test(el.innerText || el.getAttribute('aria-label') || ''))
        try { bamiTab?.click() } catch {}
    }

    // === Escenario del Agente ===
    async function runAgentScenario() {
        window.__BAMI_AGENT_ACTIVE__ = true

        // 0) Cierra “ventanitas” y pestaña Autopilot al iniciar
        try {
            window.dispatchEvent(new Event('ui:close'))
            window.dispatchEvent(new Event('ui:upload:close'))
            window.dispatchEvent(new Event('upload:close'))
            window.dispatchEvent(new Event('sim:upload:close'))
        } catch {}
        forceCloseAutopilotPanels()
        closeFloatersExceptTracker()

        // 1) Abrir tracker y fijarlo
        await openTracker(true)
        setTrackerLock(true)

        // 2) Simular avance
        for (let i = 0; i < 3; i++) {
            try { window.dispatchEvent(new Event('bami:sim:runTracker')) } catch {}
            await sleep(240)
        }

        // 3) Simulación de subida de documentos (opcional)
        const uploadBtn = document.querySelector('[data-bami-upload-sim]') || findByText(['subir documentos (sim)', 'subir documentos', 'simular subida'])
        if (uploadBtn) {
            const r = uploadBtn.getBoundingClientRect()
            await clickAt(r.left + r.width / 2, r.top + r.height / 2, uploadBtn)
            await sleep(360)
            try { window.dispatchEvent(new Event('bami:sim:runTracker')) } catch {}
        }

        // 4) Finaliza
        setTrackerLock(false)
        await closeTracker()

        // 5) Arranca flujo cliente en escritorio
        window.__BAMI_AGENT_ACTIVE__ = false
        try {
            window.dispatchEvent(new Event('bami:clientflow:ensureClientVisible'))
            window.dispatchEvent(new Event('bami:clientflow:start'))
            window.dispatchEvent(new Event('ui:open'))
            window.dispatchEvent(new CustomEvent('ui:msg', { detail: { role: 'bami', text: '✅ Autopilot finalizado. Probemos el flujo como cliente: escribe “tarjeta de crédito”, “subir documentos” o “tracker”.' }}))
        } catch {}
    }

    function stopAgentScenario() {
        window.__BAMI_AGENT_ACTIVE__ = false
        setTrackerLock(false)
        closeTracker()
    }

    window.addEventListener('bami:agent:start', runAgentScenario)
    window.addEventListener('bami:agent:stop',  stopAgentScenario)
    window.addEventListener('bami:agent:openTracker', () => openTracker(true))
    window.addEventListener('bami:agent:showTracker', () => openTracker(true))

    window.BAMI = Object.assign(window.BAMI || {}, {
        openTracker,
        closeTracker,
        runAgentScenario,
        stopAgentScenario
    })
})()
