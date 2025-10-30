export default function MVP(){
    const bam = [
        'Tablero de leads end‑to‑end con tiempos y motivos',
        'Reglas simples por etapa (qué validar, cuándo escalar, a quién asignar)',
        'Playbook de atención humanizada (scripts y cartas de decisión)',
        'KPIs: conversión, T2A, % abandono, % casos sin escalamiento',
        'Integración omnicanal (Web, App, WhatsApp, sucursal, call center) sobre el mismo expediente',
    ]
    const cli = [
        'Tracker visible por etapas (requiere / recibido / en revisión / aprobado)',
        'Notificaciones en Web, App y WhatsApp',
        'Omnicanal continuo; mismo expediente en todos los canales',
        'Subida guiada de documentos con validación básica',
        'Tono humanizado + “Hablar con asesor” siempre presente',
    ]
    return (
        <section className="section">
            <div className="max-w-7xl mx-auto px-4">
                <h1 className="h1 mb-8">Alcance del MVP</h1>
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="card"><h3 className="h3 mb-2">BAM</h3><ul>{bam.map((t,i)=>(<li key={i} className="mb-2">• {t}</li>))}</ul></div>
                    <div className="card"><h3 className="h3 mb-2">Cliente</h3><ul>{cli.map((t,i)=>(<li key={i} className="mb-2">• {t}</li>))}</ul></div>
                </div>
            </div>
        </section>
    )
}
