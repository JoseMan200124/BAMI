import { Navigate, useLocation } from 'react-router-dom'
export default function ProtectedRoute({children}){
    const isAuthed = !!localStorage.getItem('bami_token')
    const { pathname } = useLocation()
    if(!isAuthed) return <Navigate to="/" state={{from: pathname}} replace/>
    return children
}
