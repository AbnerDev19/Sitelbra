// dev-server.js - Servidor local sem dependências: serve o site e a rota /api/ai.
//   GEMINI_API_KEY=sua_chave node server.js     (ou use um arquivo .env, ver .env.example)
const http = require('http'), fs = require('fs'), path = require('path');

// Carrega .env simples (KEY=VALUE), sem dependências
try {
    fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
        const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
} catch (e) { /* sem .env */ }

const aiHandler = require('./api/ai.js');
const localHandler = require('./api/local.js');
const PORT = process.env.PORT || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon' };
// Só arquivos públicos do front-end, na raiz. Nunca .env, api/, tests/ ou dev-server.js.
const PUBLICO = /^\/[A-Za-z0-9_-]+\.(html|css|js|svg|png|jpg|jpeg|ico)$/;

http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (url === '/api/ai') return aiHandler(req, res);
    if (url === '/api/local') return localHandler(req, res);
    const file = url === '/' ? '/index.html' : url;
    if (!PUBLICO.test(file) || file === '/dev-server.js') { res.statusCode = 404; return res.end('Não encontrado'); }
    fs.readFile(path.join(__dirname, file), (err, data) => {
        if (err) { res.statusCode = 404; return res.end('Não encontrado'); }
        res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
        res.end(data);
    });
}).listen(PORT, () => console.log(`Sitelbra em http://localhost:${PORT}  |  IA: ${process.env.GEMINI_API_KEY ? 'configurada' : 'SEM GEMINI_API_KEY (botões de IA ficam indisponíveis)'}`));
