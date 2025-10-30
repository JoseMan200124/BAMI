export default function HowItWorks(){
    const left = [
        'Transparencia: tracker honesto con tiempos reales',
        'Acompañamiento 24/7: IA dice qué falta y cómo completarlo',
        'Confianza: opción de hablar con una persona a un clic',
        'Humanización: mensajes claros, sin jerga técnica',
        'Velocidad: menos vueltas y tiempos claros',
    ]
    const right = [
        'Trazabilidad total: quién hizo qué y cuándo',
        'Menos tickets de ¿en qué va? y alertas proactivas',
        'Mejora de NPS/CSAT y cuidado de marca',
        'Marca más cercana; consentimiento entendible',
    ]
    return (
        <section className="section">
            <div className="max-w-7xl mx-auto px-4">
                <h1 className="h1 mb-8">¿Cómo funciona?</h1>
                <div className="grid md:grid-cols-2 gap-8">
                    <ul className="card">{left.map((t,i)=>(<li key={i} className="mb-2">• {t}</li>))}</ul>
                    <ul className="card">{right.map((t,i)=>(<li key={i} className="mb-2">• {t}</li>))}</ul>
                </div>
            </div>
        </section>
    )
}
