export default function Footer(){
    return (
        <footer className="border-t border-gray-100 py-8">
            <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-gray-600">© {new Date().getFullYear()} BAM – BAMI. Hecho con cercanía, transparencia y confianza.</p>
                <div className="text-sm text-gray-600">¿Soporte? <a className="underline" href="#">Hablar con asesor</a></div>
            </div>
        </footer>
    )
}
