export default function StepCards(){
    const steps = [
        {title:'Elige producto',desc:'Web/App/sucursal/WhatsApp.'},
        {title:'Sube datos',desc:'Guiado y validado.'},
        {title:'IA valida',desc:'BAMI explica decisiones.'},
        {title:'Seguimiento',desc:'Tracker claro en tiempo real.'},
        {title:'Resultado o alternativa',desc:'Siempre una opción.'},
    ]
    return (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {steps.map((s,i)=> (
                <div key={i} className="card">
                    <div className="h3 mb-2">{s.title}</div>
                    <p className="text-gray-600">{s.desc}</p>
                </div>
            ))}
        </div>
    )}
