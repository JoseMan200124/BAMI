import { Link, useLocation } from 'react-router-dom'
import LoginDialog from './LoginDialog.jsx'
import { useState } from 'react'


const NavLink = ({to, children}) => {
    const { pathname } = useLocation()
    const active = pathname === to
    return (
        <Link to={to} className={`px-3 py-2 rounded-xl ${active? 'bg-bami-yellow' : 'hover:bg-gray-100'}`}>{children}</Link>
    )
}


export default function Navbar(){
    const [open, setOpen] = useState(false)
    const isAuthed = !!localStorage.getItem('bami_token')


    const logout = () => { localStorage.removeItem('bami_token'); location.reload() }


    return (
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-100">
            <div className="max-w-7xl mx-auto h-[var(--header-h)] flex items-center justify-between px-4">
                <Link to="/" className="flex items-center gap-2">
                    <img src="/bami-logo.svg" alt="BAMI" className="h-9"/>
                    <span className="font-extrabold">BAMI</span>
                </Link>
                <nav className="hidden md:flex items-center gap-1">
                    <NavLink to="/">Inicio</NavLink>
                    <NavLink to="/como-funciona">¿Cómo funciona?</NavLink>
                    <NavLink to="/mvp">MVP</NavLink>
                    <NavLink to="/flujo">Flujo</NavLink>
                    <NavLink to="/beneficios">Beneficios</NavLink>
                    <NavLink to="/dev">Desarrolladores</NavLink>
                </nav>
                <div className="flex items-center gap-2">
                    {isAuthed ? (
                        <>
                            <Link className="btn btn-dark" to="/leads">Leads</Link>
                            <Link className="btn btn-dark" to="/clientes">Clientes</Link>
                            <button className="btn" onClick={logout}>Salir</button>
                        </>
                    ) : (
                        <button className="btn btn-primary" onClick={()=>setOpen(true)}>Iniciar sesión</button>
                    )}
                </div>
            </div>
            {open && <LoginDialog onClose={()=>setOpen(false)} />}
        </header>
    )
}
