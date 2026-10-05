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
    const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
    const NOM = 'https://nominatim.openstreetmap.org/';
    const IBGE = 'https://servicodados.ibge.gov.br/api/';
    let atual = null;      // última análise (para o botão Aplicar)
    let rodando = false;
    const cacheMun = {};   // UF -> lista de municípios do IBGE

    async function getJson(url, opts, ms) {
        const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms || 20000);
        try {
            const r = await fetch(url, Object.assign({ signal: ctrl.signal }, opts || {}));
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return await r.json();
        } finally { clearTimeout(t); }
    }

    // ---------- 1) PONTO ----------
    async function resolverPonto(texto) {
        const c = LC.parseCoords(texto);
        if (c) {
            let info = null;
            try { info = LC.parseNominatim(await getJson(`${NOM}reverse?format=jsonv2&addressdetails=1&zoom=14&accept-language=pt-BR&lat=${c.lat}&lon=${c.lon}`)); } catch (e) { /* segue só com a coordenada */ }
            return Object.assign({ municipio: '', uf: '', bairro: '', nome: 'Coordenadas informadas' }, info || {}, { lat: c.lat, lon: c.lon, origem: 'coord' });
        }
        if (/^\s*-?\d+[.,]\d+\s*[,;]\s*-?\d+[.,]\d+\s*$/.test(texto)) throw new Error('Essas coordenadas estão fora do Brasil ou em formato inválido. Use o formato -15.78, -47.93.');
        const arr = await getJson(`${NOM}search?format=jsonv2&addressdetails=1&limit=1&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(texto)}`);
        const p = LC.parseNominatim(arr && arr[0]);
        if (!p) throw new Error('Endereço não encontrado. Tente com cidade/UF ou use as coordenadas.');
        return Object.assign(p, { origem: 'endereco' });
    }

    // ---------- 2) MAPA ----------
    async function consultarMapa(p) {
        const body = 'data=' + encodeURIComponent(LC.buildOverpassQuery(p.lat, p.lon));
        let ultimo = null;
        for (const url of OVERPASS) {
            try { return LC.parseOverpass(await getJson(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }, 30000)); }
            catch (e) { ultimo = e; }
        }
        throw ultimo || new Error('mapa indisponível');
    }

    // ---------- 3) IBGE ----------
    async function consultarPopulacao(p) {
        if (!p.municipio || !p.uf) return null;
        if (!cacheMun[p.uf]) cacheMun[p.uf] = await getJson(`${IBGE}v1/localidades/estados/${encodeURIComponent(p.uf)}/municipios`);
        const m = LC.acharMunicipio(cacheMun[p.uf], p.municipio);
        if (!m) return null;
        const pop = LC.parseIbgePopulacao(await getJson(`${IBGE}v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[${m.id}]`));
        return { nome: m.nome, uf: p.uf, populacao: pop ? pop.populacao : null, ano: pop ? pop.ano : null };
    }

    // ---------- FLUXO ----------
    async function analisarLocal() {
        if (rodando) return;
        const texto = $('locEndereco').value.trim(), box = $('locResult');
        if (!texto) { toast('Informe o endereço ou as coordenadas do cliente.', 'err'); $('locEndereco').focus(); return; }
        rodando = true; busy($('btnLocal'), true);
        box.hidden = false; box.innerHTML = '<div class="loc-load">Localizando o endereço…</div>';
        const avisos = [];
        try {
            const ponto = await resolverPonto(texto);
            box.innerHTML = '<div class="loc-load">Consultando mapa e população (IBGE)…</div>';
            const [rMapa, rIbge] = await Promise.allSettled([consultarMapa(ponto), consultarPopulacao(ponto)]);
            const mapa = rMapa.status === 'fulfilled' ? rMapa.value : null;
            const mun = rIbge.status === 'fulfilled' ? rIbge.value : null;
            if (!mapa) avisos.push('O serviço de mapa não respondeu. A análise ficou só com a população do município. Tente novamente em instantes.');
            if (!mun) avisos.push('Não consegui a população do município no IBGE, então "Cidade pequena" não foi avaliada.');

            const analise = LC.analisar(ponto, mapa, mun, { bairro: ponto.bairro });
            let final = LC.mesclarComIA(analise, null);
            if (analise.sinais.some(s => s.nivel !== 'nenhum')) {
                box.innerHTML = '<div class="loc-load">IA redigindo o parecer…</div>';
                try { final = LC.mesclarComIA(analise, await AI.local(LC.buildFacts(ponto, mun, analise))); }
                catch (e) { avisos.push('A IA não respondeu (' + e.message + '). Abaixo, a análise direta do mapa.'); }
            }
            atual = { ponto, mun, analise, final, texto, avisos };
            definirLocal(false);
            render();
        } catch (e) {
            atual = null;
            box.innerHTML = `<div class="loc-err">${esc(e.message || 'Não foi possível analisar o local.')}</div>`;
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
        const { ponto, mun, analise, final, avisos } = atual, box = $('locResult');
        const local = [ponto.bairro, (mun && mun.nome) || ponto.municipio, (mun && mun.uf) || ponto.uf].filter(Boolean).join(' | ') || 'Local localizado';
        const pop = mun && mun.populacao != null ? `<span class="loc-pop">${mun.populacao.toLocaleString('pt-BR')} hab. (IBGE ${esc(mun.ano || '')})</span>` : '';
        const aprox = ponto.origem === 'coord' ? '' : '<p class="note">Posição aproximada pelo endereço' + (ponto.precisao === 'endereco' ? '.' : ' (só pela rua ou bairro).') + '</p>';
        const sug = final.sugestoes;
        box.innerHTML = `
            <div class="loc-head"><strong>${esc(local)}</strong>${pop}</div>
            ${final.resumo ? `<p class="loc-resumo">${esc(final.resumo)}</p>` : ''}
            ${aprox}
            ${avisos.map(a => `<p class="loc-aviso">${esc(a)}</p>`).join('')}
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
                : `<p class="loc-none">${analise.contexto.mapa_consultado ? 'O mapa não mostrou indício de nenhum adicional de local neste ponto.' : 'Sem indícios para mostrar.'}</p>`}
            ${final.conferir.length ? `<ul class="loc-conferir">${final.conferir.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
            <p class="note">Fontes: OpenStreetMap e IBGE. O mapa pode estar incompleto: "sem indício" não significa que o adicional não se aplica. Confira antes de ofertar.${final.iaOk ? ' Parecer redigido por IA a partir desses dados.' : ''}</p>`;
        const b = $('btnAplicarLocal');
        if (b) b.addEventListener('click', aplicar);
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
