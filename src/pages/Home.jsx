import Hero from '../components/Hero.jsx'
import StepCards from '../components/StepCards.jsx'
import { Link } from 'react-router-dom'


export default function Home(){
    return (
        <>
            <Hero/>
            <section id="que-es" className="section bg-gray-50">
                <div className="max-w-7xl mx-auto px-4">
                    <h2 className="h2 mb-4">¿Cómo funciona?</h2>
                    <p className="text-gray-700 mb-6">Transparencia para el cliente y trazabilidad total para BAM. Menos llamadas repetitivas, más acompañamiento 24/7 con mensajes claros y empáticos.</p>
                    <StepCards/>
                    <div className="mt-8">
                        <Link to="/como-funciona" className="btn btn-dark">Ver detalles</Link>
                    </div>
                </div>
            </section>
        </>
    )
}
