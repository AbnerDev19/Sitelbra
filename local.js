// local.js - Interface da "Análise do local (IA)" na aba Cotação.
// Fontes (todas gratuitas, chamadas direto do navegador, sem chave):
//   - Nominatim / OpenStreetMap: endereço -> coordenadas e município
//   - Overpass / OpenStreetMap: o que existe em volta (shopping, aeroporto, galpões, datacenter, uso do solo)
//   - IBGE: população do município (regra "cidade pequena" = menos de 30 mil habitantes)
// A IA (/api/ai, task "local") só redige o parecer sobre esses fatos. Quem aplica os adicionais é a pessoa.
// Depende de: local-core.js, script.js (toast, esc, busy, readOptions, setOptions, setAdv, calculate), ai.js.
(function () {
    const $ = id => document.getElementById(id);
    const LC = window.LocalCore;
    const OVERPASS = LC.OVERPASS_SERVERS;
    const NOM = 'https://nominatim.openstreetmap.org/';
    const IBGE = 'https://servicodados.ibge.gov.br/api/';
    let atual = null;      // última análise (para o botão Aplicar)
    let rodando = false;
    const cacheMun = {};   // UF -> lista de municípios do IBGE

    async function getJson(url, opts, ms) {
        const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms || 20000);
        try {
            const r = await fetch(url, Object.assign({ signal: ctrl.signal }, opts || {}));
            if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
            return await r.json();
        } finally { clearTimeout(t); }
    }
    // Texto legível do motivo de uma falha (aparece em "Detalhes técnicos")
    function porque(e) {
        if (!e) return 'falhou';
        if (e.name === 'AbortError') return 'tempo esgotado';
        if (e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(e.message || '')) return 'sem resposta (conexão, bloqueador de anúncios/antivírus ou proxy da empresa)';
        if (e.status === 429) return 'servidor sobrecarregado (HTTP 429)';
        return e.message || 'falhou';
    }
    const host = u => u.replace(/^https?:\/\//, '').split('/')[0];

    // ---------- 1) PONTO ----------
    async function reverso(lat, lon, zoom) {
        return LC.parseNominatim(await getJson(`${NOM}reverse?format=jsonv2&addressdetails=1&zoom=${zoom}&accept-language=pt-BR&lat=${lat}&lon=${lon}`));
    }
    async function resolverPonto(texto) {
        const c = LC.parseCoords(texto);
        let p;
        if (c) {
            let info = null;
            try { info = await reverso(c.lat, c.lon, 10); } catch (e) { /* segue só com a coordenada */ }
            p = Object.assign({ municipio: '', uf: '', bairro: '', nome: 'Coordenadas informadas' }, info || {}, { lat: c.lat, lon: c.lon, origem: 'coord' });
        } else {
            if (/^\s*-?\d+[.,]\d+\s*[,;]\s*-?\d+[.,]\d+\s*$/.test(texto)) throw new Error('Essas coordenadas estão fora do Brasil ou em formato inválido. Use o formato -15.78, -47.93.');
            const arr = await getJson(`${NOM}search?format=jsonv2&addressdetails=1&limit=1&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(texto)}`);
            p = LC.parseNominatim(arr && arr[0]);
            if (!p) throw new Error('Endereço não encontrado. Tente com cidade/UF ou use as coordenadas.');
            p.origem = 'endereco';
        }
        // O município/UF é essencial para o IBGE: se a busca não trouxe, pergunta de novo pela coordenada.
        if (!p.municipio || !p.uf) {
            try { const r = await reverso(p.lat, p.lon, 10); if (r) { p.municipio = p.municipio || r.municipio; p.uf = p.uf || r.uf; p.bairro = p.bairro || r.bairro; } } catch (e) { /* mantém */ }
        }
        return p;
    }

    // ---------- 2) SERVIDOR (preferido: tenta mais servidores, repete, identifica o sistema) ----------
    async function viaServidor(p) {
        const headers = { 'Content-Type': 'application/json' };
        try { const t = window.SitelbraAuth && await window.SitelbraAuth.token(); if (t) headers.Authorization = 'Bearer ' + t; } catch (e) { /* sem login */ }
        let r;
        try { r = await fetch('/api/local', { method: 'POST', headers, body: JSON.stringify({ lat: p.lat, lon: p.lon, municipio: p.municipio, uf: p.uf }) }); }
        catch (e) { return { indisponivel: 'sem resposta' }; }
        if (r.status === 404 || r.status === 405) return { indisponivel: 'não existe neste endereço (hospedagem estática)' };
        const j = await r.json().catch(() => null);
        if (!r.ok || !j) return { indisponivel: (j && j.error) || 'HTTP ' + r.status };
        return j;
    }

    // ---------- 3) NAVEGADOR (reserva: usa o IP do próprio usuário, que costuma ter cota livre) ----------
    async function mapaNoNavegador(p) {
        const erros = [];
        // completa em todos os servidores ao mesmo tempo; se nenhum responder, a reduzida
        for (const lite of [false, true]) {
            try {
                const dados = await Promise.any(OVERPASS.map(async url => {
                    try {
                        const j = await getJson(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(LC.buildOverpassQuery(p.lat, p.lon, lite)) }, lite ? 12000 : 20000);
                        return LC.parseOverpass(j);
                    } catch (e) { erros.push(`navegador > ${host(url)}${lite ? ' (reduzida)' : ''}: ${porque(e)}`); throw e; }
                }));
                return { dados, erros, lite };
            } catch (e) { /* nenhum respondeu */ }
        }
        return { dados: null, erros };
    }
    const POP_KEY = 'sitelbra.ibge.pop.v1';
    async function populacaoNoNavegador(p) {
        if (!p.municipio || !p.uf) throw new Error('o mapa não informou o município/UF deste endereço');
        if (!cacheMun[p.uf]) cacheMun[p.uf] = await getJson(`${IBGE}v1/localidades/estados/${encodeURIComponent(p.uf)}/municipios`, {}, 30000);
        const m = LC.acharMunicipio(cacheMun[p.uf], p.municipio);
        if (!m) throw new Error(`município "${p.municipio}" não encontrado na lista do IBGE para ${p.uf}`);
        let guardado = {}; try { guardado = JSON.parse(localStorage.getItem(POP_KEY) || '{}'); } catch (e) { /* sem cache */ }
        if (!guardado[m.id]) {
            const pop = LC.parseIbgePopulacao(await getJson(`${IBGE}v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[${m.id}]`, {}, 30000));
            if (!pop) throw new Error('o IBGE não devolveu população para este município');
            guardado[m.id] = pop; try { localStorage.setItem(POP_KEY, JSON.stringify(guardado)); } catch (e) { /* ok */ }
        }
        return { nome: m.nome, uf: p.uf, populacao: guardado[m.id].populacao, ano: guardado[m.id].ano };
    }

    // ---------- FLUXO ----------
    async function analisarLocal() {
        if (rodando) return;
        const texto = $('locEndereco').value.trim(), box = $('locResult');
        if (!texto) { toast('Informe o endereço ou as coordenadas do cliente.', 'err'); $('locEndereco').focus(); return; }
        rodando = true; busy($('btnLocal'), true);
        box.hidden = false; box.innerHTML = '<div class="loc-load">Localizando o endereço…</div>';
        const avisos = [], detalhes = [];
        try {
            const ponto = await resolverPonto(texto);
            box.innerHTML = '<div class="loc-load">Consultando mapa e população (IBGE)… pode levar alguns segundos.</div>';
            let mapa = null, mun = null;
            const srv = await viaServidor(ponto);
            if (srv.indisponivel) detalhes.push('Servidor (/api/local): ' + srv.indisponivel + '. Consultei direto do navegador.');
            else {
                mapa = srv.mapa || null; mun = srv.municipio || null;
                (srv.mapaErros || []).forEach(x => detalhes.push('Servidor > ' + x));
                if (srv.ibgeErro) detalhes.push('Servidor > ' + srv.ibgeErro);
                if (mapa && srv.mapaReduzido) avisos.push('Usei uma consulta reduzida ao mapa: a classificação urbana/rural não foi feita.');
            }
            if (!mapa || !mun) {
                const [rM, rI] = await Promise.allSettled([mapa ? Promise.resolve(null) : mapaNoNavegador(ponto), mun ? Promise.resolve(null) : populacaoNoNavegador(ponto)]);
                if (!mapa && rM.status === 'fulfilled') { mapa = rM.value.dados; rM.value.erros.forEach(x => detalhes.push(x)); if (mapa && rM.value.lite) avisos.push('Usei uma consulta reduzida ao mapa: a classificação urbana/rural não foi feita.'); }
                if (!mun) { if (rI.status === 'fulfilled') mun = rI.value; else detalhes.push('IBGE (navegador): ' + porque(rI.reason)); }
            }
            if (!mapa) avisos.push('O serviço de mapa não respondeu. Os servidores públicos do OpenStreetMap ficam sobrecarregados em alguns horários: tente de novo em 1 ou 2 minutos.');
            if (!mun) avisos.push('Não consegui a população do município no IBGE, então "Cidade pequena" não foi avaliada.');

            const analise = LC.analisar(ponto, mapa, mun, { bairro: ponto.bairro });
            let final = LC.mesclarComIA(analise, null);
            if (analise.sinais.some(s => s.nivel !== 'nenhum')) {
                box.innerHTML = '<div class="loc-load">IA redigindo o parecer…</div>';
                try { final = LC.mesclarComIA(analise, await AI.local(LC.buildFacts(ponto, mun, analise))); }
                catch (e) { avisos.push('A IA não respondeu (' + e.message + '). Abaixo, a análise direta do mapa.'); }
            }
            atual = { ponto, mun, analise, final, texto, avisos, detalhes, falhou: !mapa || !mun };
            definirLocal(false);
            render();
        } catch (e) {
            atual = null;
            box.innerHTML = `<div class="loc-err">${esc(e instanceof TypeError ? 'Não consegui consultar o serviço de endereços (' + porque(e) + ').' : (e.message || 'Não foi possível analisar o local.'))}</div>`;
        } finally { rodando = false; busy($('btnLocal'), false); }
    }

    // Guarda o resumo no estado global; o histórico (script.js) salva junto com a cotação.
    function definirLocal(aplicou, nomesAplicados) {
        if (!atual) return;
        const { ponto, mun, final, texto } = atual;
        window.lastLocal = {
            endereco: texto, municipio: (mun && mun.nome) || ponto.municipio || '', uf: (mun && mun.uf) || ponto.uf || '',
            populacao: mun && mun.populacao != null ? mun.populacao : null,
            sugeridos: final.sugestoes.map(s => s.nome),
            aplicados: aplicou ? nomesAplicados : [],
            em: new Date().toISOString()
        };
    }

    const NIVEL = { forte: 'Indício forte', possivel: 'Possível' };
    const CONF = { alta: 'confiança alta', media: 'confiança média', baixa: 'confiança baixa' };

    function render() {
        const { ponto, mun, analise, final, avisos, detalhes, falhou } = atual, box = $('locResult');
        const local = [ponto.bairro, (mun && mun.nome) || ponto.municipio, (mun && mun.uf) || ponto.uf].filter(Boolean).join(' | ') || 'Local localizado';
        const pop = mun && mun.populacao != null ? `<span class="loc-pop">${mun.populacao.toLocaleString('pt-BR')} hab. (IBGE ${esc(mun.ano || '')})</span>` : '';
        const aprox = ponto.origem === 'coord' ? '' : '<p class="note">Posição aproximada pelo endereço' + (ponto.precisao === 'endereco' ? '.' : ' (só pela rua ou bairro).') + '</p>';
        const sug = final.sugestoes;
        box.innerHTML = `
            <div class="loc-head"><strong>${esc(local)}</strong>${pop}</div>
            ${final.resumo ? `<p class="loc-resumo">${esc(final.resumo)}</p>` : ''}
            ${aprox}
            ${avisos.map(a => `<p class="loc-aviso">${esc(a)}</p>`).join('')}
            ${detalhes && detalhes.length ? `<details class="loc-det"><summary>${falhou ? 'Detalhes técnicos (por que falhou)' : 'Como a consulta foi feita'}</summary><ul>${detalhes.map(d => `<li>${esc(d)}</li>`).join('')}</ul></details>` : ''}
            ${sug.length ? `<div class="loc-list">${sug.map(s => `
                <label class="loc-item ${s.nivel}">
                    <input type="checkbox" data-id="${esc(s.id)}" ${s.nivel === 'forte' && s.id !== 'rural' ? 'checked' : ''}>
                    <span class="loc-main">
                        <span class="loc-nome">${esc(s.nome)}<span class="loc-tag ${s.nivel}">${NIVEL[s.nivel]}</span>${final.iaOk ? `<span class="loc-conf">${CONF[s.confianca] || ''}</span>` : ''}</span>
                        <span class="loc-mot">${esc(s.motivo)}</span>
                        ${s.evidencias.length > 1 ? `<span class="loc-ev">${s.evidencias.slice(1).map(esc).join(' ')}</span>` : ''}
                    </span>
                </label>`).join('')}</div>
                <button type="button" class="btn secondary" id="btnAplicarLocal"><span class="lbl">Aplicar selecionados na cotação</span></button>`
                : (analise.contexto.mapa_consultado
                    ? '<p class="loc-none">O mapa não mostrou indício de nenhum adicional de local neste ponto.</p>'
                    : '<p class="loc-none">O mapa não respondeu, então não dá para sugerir adicionais de local agora. Tente de novo, ou marque os adicionais à mão em "Análise avançada".</p><button type="button" class="btn secondary" id="btnTentarLocal"><span class="lbl">Tentar de novo</span></button>')}
            ${final.conferir.length ? `<ul class="loc-conferir">${final.conferir.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
            <p class="note">Fontes: OpenStreetMap e IBGE. O mapa pode estar incompleto: "sem indício" não significa que o adicional não se aplica. Confira antes de ofertar.${final.iaOk ? ' Parecer redigido por IA a partir desses dados.' : ''}</p>`;
        const b = $('btnAplicarLocal');
        if (b) b.addEventListener('click', aplicar);
        const t = $('btnTentarLocal');
        if (t) t.addEventListener('click', analisarLocal);
    }

    function aplicar() {
        if (!atual) return;
        const ids = [...document.querySelectorAll('#locResult input[data-id]:checked')].map(i => i.dataset.id);
        if (!ids.length) { toast('Marque ao menos um adicional para aplicar.', 'err'); return; }
        setOptions(Object.assign(readOptions(), LC.patchOpts(ids)));
        setAdv(true); calculate();
        const nomes = ids.map(id => LC.ADICIONAIS[id].nome);
        definirLocal(true, nomes);
        const rural = ids.includes('rural') && !(parseFloat($('inputDistancia').value) > 0);
        toast('Aplicado: ' + nomes.join(', ') + '.' + (rural ? ' Informe a distância (zona rural).' : ''));
        if (rural) { $('inputDistancia').focus(); }
    }

    // Ao abrir uma cotação do histórico: mostra o endereço usado (sem refazer a consulta).
    function restore(loc) {
        atual = null; $('locResult').hidden = true; $('locResult').innerHTML = '';
        $('locEndereco').value = loc && loc.endereco ? loc.endereco : '';
    }

    document.addEventListener('DOMContentLoaded', () => {
        $('btnLocal').addEventListener('click', analisarLocal);
        $('locEndereco').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); analisarLocal(); } });
    });
    window.LocalUI = { restore };
})();
