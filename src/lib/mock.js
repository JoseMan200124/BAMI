// MOCK: solo para demo sin backend. Puedes quitarlo al conectar API real.
if (import.meta.env.DEV) {
    const routes = [
        ['GET', '/mock/leads', () => ({ items:[
                {id:'L-0001', product:'Tarjeta de Crédito', stage:'recibido', tta: '2h', owner:'Ana', risk:'bajo'},
                {id:'L-0002', product:'Préstamo Personal', stage:'en revisión', tta: '6h', owner:'Luis', risk:'medio'},
            ]})],
        ['GET', '/mock/clients', () => ({ items:[
                {id:'C-1023', name:'Carlos Pérez', product:'Hipoteca', stage:'aprobado'},
                {id:'C-1055', name:'María Díaz', product:'PyME', stage:'requiere'},
            ]})],
        ['POST', '/mock/files/prevalidate', async (req) => {
            const body = await req.json()
            const { schema, rows } = body
            const errors = []
            rows.forEach((r,idx)=>{ if(!r[schema[0]]) errors.push({row:idx+1, field:schema[0], message:'Campo requerido'}) })
            return ({ ok: errors.length===0, errors })
        }]
    ]


    const originalFetch = window.fetch
    window.fetch = async (url, opts={}) => {
        const u = typeof url === 'string' ? url : url.url
        const method = (opts.method||'GET').toUpperCase()
        const match = routes.find(([m, path]) => m===method && u.endsWith(path))
        if (match) {
            const handler = match[2]
            return new Response(JSON.stringify(await handler(new Request(u,opts))), { status:200, headers:{'Content-Type':'application/json'} })
        }
        return originalFetch(url, opts)
    }
}
