// src/lib/uiOrchestrator.js
// Orquestador de Autopilot: cursor virtual (oculto por defecto), abrir/animar/cerrar tracker
// y push de KPI's simulados al panel de OPS. NO oculta el cursor real del usuario.

(function initBamiOrchestrator() {
    if (window.__BAMI_ORCH_READY) return;
    window.__BAMI_ORCH_READY = true;

    const TRACKER_ANIM_MS = 5200; // más lento y smooth
    const KPI_ANIM_MS = 1600;

    // -------------------------
    // Cursor virtual (oculto hasta iniciar Autopilot)
    // -------------------------
    const CURSOR_ID = "bami-fake-cursor";
    let fakeCursor = document.getElementById(CURSOR_ID);
    if (!fakeCursor) {
        fakeCursor = document.createElement("div");
        fakeCursor.id = CURSOR_ID;
        // Estilos: punto negro simple. Importante: NO escondemos el cursor real del SO.
        Object.assign(fakeCursor.style, {
            position: "fixed",
            top: "0px",
            left: "0px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: "black",
            boxShadow: "0 0 0 3px rgba(0,0,0,0.15)",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 999999,
            transition: "transform 300ms cubic-bezier(.22,.61,.36,1)",
            opacity: "0",        // oculto por defecto
        });
        document.body.appendChild(fakeCursor);
    }

    function showFakeCursor() {
        fakeCursor.style.opacity = "1";
    }
    function hideFakeCursor() {
        fakeCursor.style.opacity = "0";
    }
    function moveFakeCursorTo(el, pad = 8) {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const x = r.left + Math.min(r.width - pad, Math.max(pad, r.width * 0.5));
        const y = r.top + Math.min(r.height - pad, Math.max(pad, r.height * 0.5));
        fakeCursor.style.transform = `translate(${x}px, ${y}px)`;
    }

    // -------------------------
    // Helpers DOM robustos
    // -------------------------
    const byText = (txt) =>
        Array.from(document.querySelectorAll("button, a, [role='button']"))
            .find((b) => b.textContent && b.textContent.trim().toLowerCase().includes(txt));

    function clickIfExists(el) {
        if (el) el.click();
    }

    function findOpenTrackerButton() {
        // botones comunes para abrir el tracker en tu UI
        return (
            document.querySelector("[data-open-tracker]") ||
            byText("abrir tracker") ||
            byText("tracker")
        );
    }

    function findCloseTrackerButton() {
        // botón Cerrar del modal de tracker
        return (
            document.querySelector("[data-close-tracker]") ||
            byText("cerrar")
        );
    }

    // -------------------------
    // Animación del tracker (CaseTracker.jsx escuchará este evento)
    // -------------------------
    function animateTrackerSlow() {
        window.dispatchEvent(
            new CustomEvent("BAMI:TRACKER_ANIMATE", {
                detail: { duration: TRACKER_ANIM_MS, closeWhenDone: true },
            })
        );
    }

    // -------------------------
    // Snapshot de KPI's OPS
    // -------------------------
    function pushOpsSnapshot() {
        // Valores simulados para visualizar el panel OPS lleno
        const snapshot = {
            leadsTotales: 18,
            aprobados: 9,
            alternativa: 1,
            enRevision: 6,
            pendientesProm: 3.0,
            atendidos: 17,          // para % atendidos vs generados
            generados: 18,
            distEtapas: {
                requiere: 9,
                recibido: 2,
                enRevision: 6,
                aprobado: 1,
                alternativa: 1,
            },
            kpiAnimMs: KPI_ANIM_MS,
        };
        window.__BAMI_OPS_SNAPSHOT = snapshot;
        window.dispatchEvent(new CustomEvent("BAMI:OPS_SNAPSHOT", { detail: snapshot }));
    }

    // -------------------------
    // Secuencia principal de Autopilot
    // -------------------------
    async function startAutopilotSequence() {
        if (window.__BAMI_AUTOPILOT_RUNNING) return;
        window.__BAMI_AUTOPILOT_RUNNING = true;

        // Mostrar cursor virtual (sin ocultar el real)
        showFakeCursor();

        // 1) Abrir tracker
        const btnOpen = findOpenTrackerButton();
        if (btnOpen) {
            moveFakeCursorTo(btnOpen);
            await wait(350);
            clickIfExists(btnOpen);
        }

        // 2) Animar tracker (lento + smooth) y cerrarlo al concluir
        animateTrackerSlow();

        // 3) En paralelo, preparar y empujar KPIs para el panel OPS
        pushOpsSnapshot();

        // 4) Ocultar cursor virtual cuando terminemos la fase inicial
        await wait(TRACKER_ANIM_MS + 400);
        hideFakeCursor();

        // Importante: NO reabrir el tracker al final (petición del usuario)
        window.__BAMI_AUTOPILOT_RUNNING = false;
    }

    // -------------------------
    // Hook al botón "Iniciar Autopilot"
    // -------------------------
    function wireStartButton() {
        // Soporte amplio por texto o data-attr
        const tryFind = () =>
            document.querySelector("[data-autopilot-start]") || byText("iniciar autopilot");

        const btn = tryFind();
        if (!btn) return; // aún no existe en el DOM
        if (btn.__BAMI_WIRED) return;

        btn.__BAMI_WIRED = true;
        btn.addEventListener("click", (ev) => {
            // Evitar que se abran otros elementos como el chat durante el arranque
            ev.preventDefault();
            ev.stopPropagation();
            startAutopilotSequence();
            // Notificar a otros componentes que el Autopilot inició
            window.dispatchEvent(new CustomEvent("BAMI:AUTOPILOT_START"));
        });
    }

    // Observador de DOM para cablear el botón apenas exista
    const mo = new MutationObserver(() => wireStartButton());
    mo.observe(document.documentElement, { childList: true, subtree: true });
    // intento inmediato
    wireStartButton();

    // Utilidad
    function wait(ms) {
        return new Promise((res) => setTimeout(res, ms));
    }

    // Exponer mínimamente para depuración manual si lo necesitas
    window.__BAMI_debug = Object.assign(window.__BAMI_debug || {}, {
        startAutopilotSequence,
        pushOpsSnapshot,
    });
})();
