import { motion } from 'framer-motion'


export default function Hero(){
    return (
        <section className="section">
            <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-10 items-center px-4">
                <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:.4}}>
                    <h1 className="h1">¿QUÉ ES <span className="inline-block bg-bami-yellow px-4 -rotate-2 rounded-xl">BAMI?</span></h1>
                    <p className="mt-6 text-xl text-gray-700 leading-8">No es un robot ni solo una app, es <strong>tu compañero curioso y confiable</strong> dentro del BAM, que hace cada experiencia <strong>más humana, cercana y divertida</strong>.</p>
                    <div className="mt-8 flex gap-3">
                        <a href="#que-es" className="btn btn-dark">Conocer más</a>
                        <a href="/dev" className="btn btn-primary">Conectar a BAMI</a>
                    </div>
                </motion.div>
                <motion.img initial={{opacity:0,scale:.95}} animate={{opacity:1,scale:1}} transition={{duration:.4}} src="/bami-logo.svg" alt="BAMI" className="w-64 mx-auto"/>
            </div>
        </section>
    )
}
