import { useState } from 'react'


export default function LoginDialog({onClose}){
    const [email,setEmail] = useState('')
    const [pwd,setPwd] = useState('')


    const submit=(e)=>{e.preventDefault();
// Mock auth (reemplazar por OAuth/OIDC o backend real)
        if(email && pwd){ localStorage.setItem('bami_token','demo'); onClose(); location.reload() }
    }


    return (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4">
            <form onSubmit={submit} className="card w-full max-w-md">
                <h2 className="h2 mb-4">Iniciar sesión</h2>
                <label className="block mb-2 text-sm">Correo</label>
                <input className="w-full border rounded-xl px-3 py-2 mb-4" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
                <label className="block mb-2 text-sm">Contraseña</label>
                <input className="w-full border rounded-xl px-3 py-2 mb-6" type="password" value={pwd} onChange={e=>setPwd(e.target.value)} required/>
                <div className="flex gap-3 justify-end">
                    <button type="button" className="btn" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-dark" type="submit">Entrar</button>
                </div>
            </form>
        </div>
    )
}
