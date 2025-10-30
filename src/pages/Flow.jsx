export default function Flow(){
    const steps = ['Elige producto','Sube datos','IA valida','Seguimiento','Resultado o alternativa']
    return (
        <section className="section">
            <div className="max-w-7xl mx-auto px-4">
                <h1 className="h1 mb-8">Flujo del cliente</h1>
                <ol className="grid md:grid-cols-5 gap-4">
                    {steps.map((s,i)=>(
                        <li key={i} className="card">
                            <div className="text-4xl font-extrabold mb-2">{i+1}</div>
                            <div className="h3">{s}</div>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    )
}
