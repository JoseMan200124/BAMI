import { useEffect, useState } from 'react'

export default function Toasts() {
    const [items, setItems] = useState([])

    useEffect(() => {
        const onN = (e) => {
            const it = e.detail
            setItems((cur) => [...cur, it])
            setTimeout(() => setItems((cur) => cur.filter(x => x.id !== it.id)), 3500)
        }
        window.addEventListener('bami:notify', onN)
        return () => window.removeEventListener('bami:notify', onN)
    }, [])

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] space-y-2">
            {items.map(t => (
                <div key={t.id}
                     className="px-4 py-2 rounded-xl shadow-lg border bg-white text-sm">
                    {t.message}
                </div>
            ))}
        </div>
    )
}
