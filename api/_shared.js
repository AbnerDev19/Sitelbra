// api/_shared.js - utilidades comuns às funções em api/ (arquivo com "_" no início não vira rota na Vercel).
async function authorized(req) {
    if (process.env.REQUIRE_AUTH !== '1') return true;
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!m || !process.env.FIREBASE_API_KEY) return false;
    try {
        const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(process.env.FIREBASE_API_KEY), {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: m[1] }) });
        const j = await r.json().catch(() => ({}));
        return r.ok && Array.isArray(j.users) && j.users.length > 0;
    } catch (e) { return false; }
}
function send(res, status, obj) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(obj));
}
function limiter(max) {
    const hits = new Map();
    return ip => { const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 60000); a.push(now); hits.set(ip, a); return a.length > max; };
}
async function readBody(req, maxBytes) {
    if (req.body && typeof req.body === 'object') return req.body;
    let raw = typeof req.body === 'string' ? req.body : '';
    if (!raw) raw = await new Promise((resolve, reject) => {
        let size = 0; const chunks = [];
        req.on('data', c => { size += c.length; if (size > maxBytes) { reject(new Error('grande')); req.destroy(); } else chunks.push(c); });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
    return JSON.parse(raw || '{}');
}
const clientIp = req => (req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'local').toString().split(',')[0].trim();
module.exports = { authorized, send, limiter, readBody, clientIp };
