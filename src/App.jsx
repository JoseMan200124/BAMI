import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import HowItWorks from './pages/HowItWorks.jsx'
import MVP from './pages/MVP.jsx'
import Flow from './pages/Flow.jsx'
import Benefits from './pages/Benefits.jsx'
import Leads from './pages/Leads.jsx'
import Clients from './pages/Clients.jsx'
import DevDocs from './pages/DevDocs.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

// BAMI
import BamiHub from './pages/BamiHub.jsx'
import BamiChatWidget from './components/BamiChatWidget.jsx'
import Toasts from './components/Toasts.jsx'

export default function App(){
    const { pathname } = useLocation()
    const showFloatingChat = pathname !== '/bami' // ⟵ evita duplicar chat

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/como-funciona" element={<HowItWorks />} />
                    <Route path="/mvp" element={<MVP />} />
                    <Route path="/flujo" element={<Flow />} />
                    <Route path="/beneficios" element={<Benefits />} />
                    <Route path="/dev" element={<DevDocs />} />
                    <Route path="/bami" element={<BamiHub />} />
                    <Route path="/leads" element={<ProtectedRoute><Leads/></ProtectedRoute>} />
                    <Route path="/clientes" element={<ProtectedRoute><Clients/></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
            <Footer />
            {showFloatingChat && <BamiChatWidget />}  {/* ⟵ solo fuera de /bami */}
            <Toasts />
        </div>
    )
}
