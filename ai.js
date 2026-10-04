// ai.js - Cliente da IA. NENHUMA chave fica no navegador: as chamadas vão para /api/ai (api/ai.js),
// que lê GEMINI_API_KEY de variável de ambiente no servidor.
window.AI = (function () {
    async function run(task, dados) {
        let resp;
        try {
            const headers = { 'Content-Type': 'application/json' };
            try { const t = window.SitelbraAuth && await window.SitelbraAuth.token(); if (t) headers.Authorization = 'Bearer ' + t; } catch (e) { /* sem login */ }
            resp = await fetch('/api/ai', {
                method: 'POST',
                headers,
                body: JSON.stringify({ task, dados })
            });
        } catch (e) {
            throw new Error('Não foi possível falar com o serviço de IA. Abra o sistema pelo servidor (npm start) e confira a conexão.');
        }
        let json = null;
        try { json = await resp.json(); } catch (e) { /* resposta sem JSON */ }
        if (!resp.ok || !json || !json.text) {
            const msg = (json && json.error) ||
                (resp.status === 404 ? 'O serviço de IA não está disponível neste endereço. Veja o README (seção IA).' : 'A IA não respondeu. Tente novamente em instantes.');
            throw new Error(msg);
        }
        return json.text;
    }
    return { melhorar: d => run('melhorar', d), analisar: d => run('analisar', d), rede: d => run('rede', d) };
})();
