// api/local.js - Consulta do mapa (OpenStreetMap/Overpass) e da população (IBGE) pelo SERVIDOR.
// Vantagens sobre o navegador: tenta mais de um servidor, repete em caso de sobrecarga, identifica o sistema (User-Agent)
// e guarda a lista de municípios/população em memória. Se este endpoint não existir (hospedagem estática), local.js
// consulta direto do navegador. Não é proxy aberto: recebe só { lat, lon, municipio, uf } e monta a consulta aqui.
const LC = require('../local-core.js');
const S = require('./_shared.js');

const OVERPASS = LC.OVERPASS_SERVERS;
const IBGE = 'https://servicodados.ibge.gov.br/api/';
const UA = 'Sitelbra-Cotacao/2.0 (ferramenta interna de cotacao)';
const BR = { latMin: -34, latMax: 6, lonMin: -74.5, lonMax: -33 };
const limited = S.limiter(30);
const munPorUF = {}, popPorMun = {};

async function getJson(url, opts, ms) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms);
    try {
        const r = await fetch(url, Object.assign({ signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } }, opts));
        if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
        return await r.json();
    } finally { clearTimeout(t); }
}
const host = u => u.replace(/^https?:\/\//, '').split('/')[0];
const porque = e => e.name === 'AbortError' ? 'tempo esgotado' : (e.message || 'falhou');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function umServidor(url, lite, ms, lat, lon, erros) {
    try {
        const j = await getJson(url, {
            method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
            body: 'data=' + encodeURIComponent(LC.buildOverpassQuery(lat, lon, lite))
        }, ms);
        return LC.parseOverpass(j);
    } catch (e) { erros.push(`${host(url)}${lite ? ' (reduzida)' : ''}: ${porque(e)}`); throw e; }
}
// Resultado de consultas recentes (10 min): evita repetir a mesma consulta e aliviar os servidores públicos.
const cacheMapa = new Map();
async function mapa(lat, lon) {
    const chave = lat.toFixed(3) + ',' + lon.toFixed(3), hit = cacheMapa.get(chave);
    if (hit && Date.now() - hit.t < 600000) return { dados: hit.dados, erros: [], lite: hit.lite };
    const erros = [];
    // 1) consulta completa em TODOS os servidores ao mesmo tempo; 2) se nenhum responder, a reduzida, também em paralelo
    for (const lite of [false, true]) {
        try {
            const dados = await Promise.any(OVERPASS.map(u => umServidor(u, lite, lite ? 9000 : 14000, lat, lon, erros)));
            cacheMapa.set(chave, { t: Date.now(), dados, lite });
            if (cacheMapa.size > 200) cacheMapa.delete(cacheMapa.keys().next().value);
            return { dados, erros, lite };
        } catch (e) { /* nenhum respondeu: segue */ }
    }
    return { dados: null, erros };
}

async function populacao(nome, uf) {
    if (!nome || !uf) return { dados: null, erro: 'o mapa não informou o município/UF deste endereço' };
    try {
        if (!munPorUF[uf]) munPorUF[uf] = await getJson(`${IBGE}v1/localidades/estados/${encodeURIComponent(uf)}/municipios`, {}, 15000);
        const m = LC.acharMunicipio(munPorUF[uf], nome);
        if (!m) return { dados: null, erro: `município "${nome}" não encontrado na lista do IBGE para ${uf}` };
        if (!popPorMun[m.id]) {
            const pop = LC.parseIbgePopulacao(await getJson(`${IBGE}v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[${m.id}]`, {}, 20000));
            if (!pop) return { dados: null, erro: 'o IBGE não devolveu população para este município' };
            popPorMun[m.id] = pop;
        }
        return { dados: { nome: m.nome, uf, populacao: popPorMun[m.id].populacao, ano: popPorMun[m.id].ano } };
    } catch (e) { return { dados: null, erro: 'IBGE: ' + porque(e) }; }
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return S.send(res, 405, { error: 'Método não permitido.' });
    if (!(await S.authorized(req))) return S.send(res, 401, { error: 'Faça login (aba Rede própria) para usar a análise do local.' });
    if (limited(S.clientIp(req))) return S.send(res, 429, { error: 'Muitas solicitações. Aguarde um minuto.' });
    let b; try { b = await S.readBody(req, 4000); } catch (e) { return S.send(res, 400, { error: 'Requisição inválida.' }); }
    const lat = Number(b && b.lat), lon = Number(b && b.lon);
    if (!(lat >= BR.latMin && lat <= BR.latMax && lon >= BR.lonMin && lon <= BR.lonMax)) return S.send(res, 400, { error: 'Coordenadas fora do Brasil.' });
    const nome = String((b && b.municipio) || '').slice(0, 80), uf = String((b && b.uf) || '').toUpperCase().slice(0, 2);
    const [m, p] = await Promise.all([mapa(lat, lon), populacao(nome, uf)]);
    return S.send(res, 200, { mapa: m.dados, mapaErros: m.erros, mapaReduzido: !!m.lite, municipio: p.dados, ibgeErro: p.erro || null });
};
