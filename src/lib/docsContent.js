export const docs = [
    {
        id: 'as2_as4',
        title: 'AS2/AS4 — Intercambio seguro sobre enlace privado',
        body: `
**Cuándo usarlo:** estándar bancario para lotes con acuse legal (MDN).
<br/><br/>
**Conectividad:** MPLS/Direct Connect/ExpressRoute/Interconnect o VPN IPSec; sin internet.
<br/><br/>
**Setup requerido (ambas partes):**
- Certificados X.509 (firma y cifrado).<br/>
- IDs AS2 (AS2-From/AS2-To), URL privada del partner.<br/>
- Tamaños máximos, ventanas y reintentos; MDN síncrono/asíncrono.
<br/><br/>
**Formato mínimo (CSV):**
\`\`\`csv
lead_id,producto,canal,fecha_evento,doc_hash_sha256
L-0001,tc,web,2025-10-27T18:20:00Z,6b1f...e9
\`\`\`
**Envelope (metadatos JSON opcional dentro del ZIP):**
\`\`\`json
{"batch_id":"2025-10-27-1800","records":100,"hash":"sha256:ab12...","schema":"v1.2"}
\`\`\`
**Flujo de acuse (MDN):**
\`\`\`json
{"mdn":"processed","disposition":"automatic-action/MDN-sent-automatically; processed","messageId":"<...>","timestamp":"2025-10-27T18:21:05Z"}
\`\`\`
**Errores comunes:** firma inválida, certificado expirado, tamaño excedido.
`
    },
    {
        id: 'mft_sftp',
        title: 'MFT/SFTP gestionado — Sin FTP, con auditoría',
        body: `
**Cuándo usarlo:** lotes y documentos (CSV/ZIP/PDF) con controles de plataforma MFT (Axway/IBM Sterling/etc.).
<br/><br/>
**Carpetas estándar:**
- \`/in/leads/\` (entradas BAMI) <br/>
- \`/in/documents/\` (adjuntos cifrados PGP) <br/>
- \`/out/results/\` (salidas del banco)
<br/><br/>
**Nombres de archivo:** \`{batchId}_{yyyyMMddHHmm}_{count}.csv\`
<br/><br/>
**Claves y seguridad:** claves \`ed25519\`, chroot, IP allowlist, antivirus, checksum \`SHA-256\` y PGP opcional.
<br/><br/>
**Plantilla CSV (leads):**
\`\`\`csv
lead_id,producto,telefono,canal,fecha,doc_hash_sha256
L-0001,tc,50255555555,agencia,2025-10-27,6b1f...e9
\`\`\`
**Resultado (BAMI → /out/results/):**
\`\`\`csv
lead_id,case_id,estado,errores
L-0001,C-1055,EN_REVISION,"falta comprobante_domicilio"
\`\`\`
`
    },
    {
        id: 'ibm_mq',
        title: 'IBM MQ — Mensajería H2H (sin API pública)',
        body: `
**Cuándo usarlo:** eventos y near-real-time sin exponer API internet.
<br/><br/>
**Colas acordadas:** \`BAMI.IN.LEADS\` (entrada al banco), \`BAMI.OUT.STATES\` (salida al BAMI).
<br/><br/>
**Mensaje (JSON) con \`correlationId\`:**
\`\`\`json
{
  "messageId":"d3e5-...",
  "correlationId":"L-0001",
  "type":"lead.created",
  "payload":{"lead_id":"L-0001","producto":"tc","canal":"web"},
  "timestamp":"2025-10-27T18:22:00Z"
}
\`\`\`
**Respuesta desde banco (misma \`correlationId\`):**
\`\`\`json
{
  "messageId":"f91a-...",
  "correlationId":"L-0001",
  "type":"case.state",
  "payload":{"case_id":"C-1055","estado":"EN_REVISION"},
  "timestamp":"2025-10-27T18:22:03Z"
}
\`\`\`
**Seguridad:** TLS/mTLS, usuarios/ACL por cola, DLQ, TTL y reintentos.
`
    },
    {
        id: 'conectividad_privada',
        title: 'Conectividad privada — MPLS/VPN + PrivateLink',
        body: `
**Objetivo:** que el tráfico no pase por internet.
<br/><br/>
**Opciones:** MPLS/Direct Connect/ExpressRoute/Interconnect o VPN IPSec site-to-site.<br/>
**End-points privados:** PrivateLink/PSC para exponer servicios de BAMI con IP privada.
<br/><br/>
**Checklist de red:** rangos CIDR, DNS privado, NAT/egress controlado, monitoreo y pruebas de failover.
`
    },
    {
        id: 'edge_agent',
        title: 'BAMI Edge/SDK interno — Procesamiento dentro del banco',
        body: `
**Qué es:** componente de BAMI desplegado **on-prem** que valida, anonimiza y prepara lotes para AS2/MFT o mensajes MQ.
<br/><br/>
**Ventajas:** soberanía de datos, cero API internet, actualización versiónada.
<br/><br/>
**Manifiesto de envío:**
\`\`\`json
{"version":"1.4.0","batch_id":"2025-10-27-1800","records":100,"pii":"minimized"}
\`\`\`
`
    },
    {
        id: 'formatos_validaciones',
        title: 'Formatos y validaciones',
        body: `
**Principio:** datos mínimos (IDs, estado, hashes); PII completa permanece en el banco.
<br/><br/>
**CSV básico:** ver secciones AS2/MFT.
<br/>
**JSON básico (evento):**
\`\`\`json
{"lead_id":"L-0001","estado":"EN_REVISION","motivo":"falta_documento","timestamp":"2025-10-27T18:30:00Z"}
\`\`\`
**Validaciones:** esquema (versionado), unicidad \`lead_id\`, hash documental, fechas ISO-8601, catálogo de estados.
`
    },
    {
        id: 'operacion',
        title: 'Operación, acuses y reintentos',
        body: `
**Acuses:** \`MDN\` en AS2/AS4; \`ACK\` en MQ (consumo OK).
<br/>
**Idempotencia:** \`Idempotency-Key\`/ \`correlationId\` para evitar duplicados.
<br/>
**Reintentos:** exponencial con jitter; DLQ en MQ y reproceso batch para AS2/MFT.
<br/>
**Trazabilidad:** \`x-correlation-id\`, bitácoras firmadas, retención 7–10 años.
`
    },
    {
        id: 'seguridad',
        title: 'Seguridad y cumplimiento',
        body: `
- Tránsito: **TLS 1.2+**, mTLS cuando aplique; cifrado de contenido **PGP** para archivos.<br/>
- Reposo: **AES-256**, claves en **HSM/KMS**, rotación y caducidades.<br/>
- Controles: **AV/DLP**, allowlist, hardening CIS, segregación de ambientes.<br/>
- Datos: minimización, consentimiento, borrado/retención por política, monitoreo continuo y auditorías.
`
    }
];
