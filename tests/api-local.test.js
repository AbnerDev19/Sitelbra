// Testa api/local.js com fetch simulado: tentativas, espelho, consulta reduzida e validação de entrada.
const handler = require('../api/local.js');
let fails = 0, n = 0; const ok = (name, c, x = '') => { n++; if (!c) { fails++; console.log('FALHA', name, x); } };
const call = async body => { let out; const res = { setHeader() {}, end(t) { out = JSON.parse(t); } };
    await handler({ method: 'POST', headers: {}, body, socket: { remoteAddress: '1.1.1.' + Math.floor(Math.random() * 250) } }, res); return { status: res.statusCode, ...out }; };
const J = (d, status = 200) => ({ ok: status < 400, status, json: async () => d });
const OVER = { elements: [{ type: 'node', id: 1, lat: -15.8, lon: -47.9, tags: { shop: 'mall' } }, { type: 'count', id: 0, tags: { total: '50' } }] };
const IBGE = u => /estados/.test(u) ? J([{ id: 1, nome: 'Xique-Xique' }]) : J([{ resultados: [{ series: [{ serie: { 2025: '9000' } }] }] }]);
(async () => {
    let calls = [];
    global.fetch = async (u, o) => { calls.push(String(u)); if (/overpass-api\.de/.test(u)) return J({}, 429); if (/private\.coffee/.test(u)) return J(OVER); return IBGE(String(u)); };
    let r = await call({ lat: -15.8, lon: -47.9, municipio: 'Xique Xique', uf: 'ba' });
    ok('espelho responde após 429', r.mapa && r.mapa.elementos.length === 1, JSON.stringify(r).slice(0, 200));
    ok('erro do 1º servidor registrado', r.mapaErros.length === 1 && /overpass-api\.de.*429/.test(r.mapaErros[0]), r.mapaErros);
    ok('IBGE ok', r.municipio && r.municipio.populacao === 9000 && r.municipio.uf === 'BA');

    calls = []; global.fetch = async (u, o) => { calls.push(String(u)); if (/overpass/.test(u)) return /is_in/.test(decodeURIComponent(o.body)) ? J({}, 400) : J(OVER); return IBGE(String(u)); };
    r = await call({ lat: -15.8, lon: -47.9, municipio: 'Xique Xique', uf: 'BA' });
    ok('400 -> consulta reduzida no mesmo servidor', r.mapaReduzido === true && r.mapa && calls.filter(c => /overpass-api\.de/.test(c)).length === 2);

    global.fetch = async u => /overpass/.test(u) ? J({}, 504) : J({}, 500);
    r = await call({ lat: -15.8, lon: -47.9, municipio: 'X', uf: 'BA' });
    ok('tudo falha: mapa null com motivos', r.mapa === null && r.mapaErros.length >= 2 && /IBGE/.test(r.ibgeErro), JSON.stringify(r).slice(0, 300));

    global.fetch = async () => { throw new Error('não deveria chamar'); };
    r = await call({ lat: 48.8, lon: 2.3 }); ok('fora do Brasil = 400, sem consultar', r.status === 400);
    r = await call({ lat: 'x', lon: 1 }); ok('entrada inválida = 400', r.status === 400);
    console.log(fails ? fails + ' falha(s)' : `api/local: ${n} verificações OK`); process.exit(fails ? 1 : 0);
})();
