import { useState } from 'react'
import { docs } from '../lib/docsContent.js'


export default function DevDocs(){
    const [active, setActive] = useState(docs[0].id)
    const current = docs.find(d=>d.id===active)
    return (
        <section className="section">
            <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-8">
                <aside className="md:col-span-1">
                    <h1 className="h2 mb-4">Desarrolladores</h1>
                    <nav className="space-y-2">
                        {docs.map(d => (
                            <button key={d.id} onClick={()=>setActive(d.id)} className={`block w-full text-left px-3 py-2 rounded-xl ${active===d.id? 'bg-bami-yellow' : 'hover:bg-gray-100'}`}>{d.title}</button>
                        ))}
                    </nav>
                </aside>
                <article className="md:col-span-3">
                    <div className="card prose max-w-none">
                        <h2 className="h3 mb-4">{current.title}</h2>
                        <div className="prose" dangerouslySetInnerHTML={{__html: current.body
                                .replace(/\n/g,'<br/>')
                                .replace(/`{3}json/g,'<pre class=\'bg-gray-50 p-4 rounded-xl overflow-x-auto text-xs\'><code>')
                                .replace(/`{3}csv/g,'<pre class=\'bg-gray-50 p-4 rounded-xl overflow-x-auto text-xs\'><code>')
                                .replace(/`{3}/g,'</code></pre>')
                                .replace(/`([^`]+)`/g,'<code>$1</code>')
                        }} />
                    </div>
                </article>
            </div>
        </section>
    )
}
