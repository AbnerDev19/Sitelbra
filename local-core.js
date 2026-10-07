// local-core.js - Análise do local (lógica pura, sem DOM e sem rede), testável no Node:
//   node tests/local.test.js
//
// Fluxo: o navegador (local.js) busca endereço (Nominatim), entorno (Overpass/OpenStreetMap) e população (IBGE).
// Aqui esses dados viram SINAIS por adicional de local (shopping, aeroporto, indústria...), com a evidência de cada um.
// A IA (api/ai.js, task "local") só redige o parecer em cima desses sinais: ela NÃO cria sugestões novas
// e NÃO mexe em valores. Quem aplica no formulário é a pessoa, no botão "Aplicar".
//
// Só os adicionais que dependem do LOCAL são analisados. SLA, dupla abordagem, rádio, comodato, MTU, IPs
// e provedores dependem do projeto, não do endereço, e nunca são sugeridos.
(function (root) {

    // ---------- AJUSTES EDITÁVEIS ----------
    const AJ = {
        cidadePequenaMax: 30000,   // mesma regra de specials.js: "menos de 30 mil habitantes"
        shoppingM: 250,            // shopping (shop=mall) até esta distância
        aeroportoTerminalM: 300,   // terminal de aeroporto até esta distância = forte
        aeroportoPertoM: 2500,     // aeródromo até esta distância = possível
        industriaM: 150,           // galpão/fábrica até esta distância
        datacenterM: 150,          // datacenter até esta distância
        prediosM: 300,             // raio para contar construções
        prediosRuralMax: 4,        // até isso, sem uso urbano, indica área rarefeita (OSM pode estar incompleto)
        prediosRuralForteMax: 8,   // com uso rural do solo confirmado
        maxElementos: 120
    };

    // Servidores públicos do Overpass (mapa). Consultados ao mesmo tempo: vale o primeiro que responder.
    // Usado por local.js (navegador) e api/local.js (servidor). Para usar um servidor próprio, ponha-o primeiro.
    const OVERPASS_SERVERS = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.private.coffee/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
    ];

    // Todos os ids são as MESMAS chaves de opts usadas em script.js/pricing.js.
    const ADICIONAIS = {
        shopping:   { nome: 'Shopping Center' },
        aeroporto:  { nome: 'Aeroporto' },
        industria:  { nome: 'Indústria / Galpão' },
        datacenter: { nome: 'Datacenter' },
        cidPeq:     { nome: 'Cidade pequena' },
        foraUrbana: { nome: 'Fora da zona urbana' },
        rural:      { nome: 'Zona rural' },
        favela:     { nome: 'Favela / fibra pública subterrânea' }
    };
    const IDS = Object.keys(ADICIONAIS);

    const URBANO_USO = ['residential', 'commercial', 'retail', 'industrial'];
    const URBANO_PLACE = ['suburb', 'neighbourhood', 'quarter', 'city_block'];
    const RURAL_USO = ['farmland', 'farmyard', 'meadow', 'orchard', 'vineyard', 'forest'];
    const RURAL_PLACE = ['hamlet', 'isolated_dwelling', 'farm'];
    const RE_FAVELA = /favela|comunidade|aglomerado|ocupa[cç][aã]o|invas[aã]o|complexo d[oae]|morro d[oae]|alagados/i;
    const RE_SHOPPING = /shopping/i;
    const RE_DATACENTER = /data ?cent(er|re)/i;

    // ---------- UTILIDADES ----------
    const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const BR = { latMin: -34, latMax: 6, lonMin: -74.5, lonMax: -33 };
    const rad = d => d * Math.PI / 180;

    function distanceM(lat1, lon1, lat2, lon2) {
        const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
        return 6371000 * 2 * Math.asin(Math.sqrt(a));
    }
    const fmtDist = m => m < 1000 ? `${Math.round(m / 10) * 10 || Math.round(m)} m` : `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
    const fmtHab = n => n.toLocaleString('pt-BR');

    // Aceita "-15.78, -47.93", "-15,78 -47,93", "-15.78;-47.93". Fora do Brasil = não é coordenada.
    function parseCoords(str) {
        const m = /^\s*(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/.exec(String(str || ''));
        if (!m) return null;
        const lat = parseFloat(m[1].replace(',', '.')), lon = parseFloat(m[2].replace(',', '.'));
        if (!(lat >= BR.latMin && lat <= BR.latMax && lon >= BR.lonMin && lon <= BR.lonMax)) return null;
        return { lat, lon };
    }

    const ESTADOS = { 'acre': 'AC', 'alagoas': 'AL', 'amapa': 'AP', 'amazonas': 'AM', 'bahia': 'BA', 'ceara': 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES',
        'goias': 'GO', 'maranhao': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', 'para': 'PA', 'paraiba': 'PB', 'parana': 'PR',
        'pernambuco': 'PE', 'piaui': 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', 'rondonia': 'RO', 'roraima': 'RR',
        'santa catarina': 'SC', 'sao paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO' };

    // ---------- NOMINATIM (endereço -> ponto) ----------
    // Aceita o item de /search ou o objeto de /reverse.
    function parseNominatim(x) {
        if (!x) return null;
        const a = x.address || {};
        const lat = parseFloat(x.lat), lon = parseFloat(x.lon);
        if (!isFinite(lat) || !isFinite(lon)) return null;
        return {
            lat, lon, nome: x.display_name || '',
            municipio: a.city || a.town || a.village || a.municipality || a.city_district || '',
            uf: String(a['ISO3166-2-lvl4'] || '').replace(/^BR-/, '') || ESTADOS[norm(a.state)] || '',
            bairro: a.suburb || a.neighbourhood || a.quarter || a.city_district || '',
            // Sem número da casa, o ponto é da rua ou do bairro: posição aproximada.
            precisao: a.house_number ? 'endereco' : 'rua_ou_bairro'
        };
    }

    // ---------- OVERPASS (entorno no OpenStreetMap) ----------
    function buildOverpassQuery(lat, lon, lite) {
        const p = `${lat.toFixed(6)},${lon.toFixed(6)}`;
        // Versão reduzida: sem áreas (is_in) e sem contagem de construções. Só o essencial por adicional.
        if (lite) return `[out:json][timeout:20];
(
  nwr(around:${AJ.shoppingM},${p})["shop"="mall"];
  nwr(around:${AJ.aeroportoPertoM},${p})["aeroway"="aerodrome"];
  nwr(around:${AJ.aeroportoPertoM},${p})["aeroway"="terminal"];
  nwr(around:${AJ.industriaM},${p})["building"~"^(industrial|warehouse|factory)$"];
  nwr(around:${AJ.industriaM},${p})["landuse"="industrial"];
  nwr(around:${AJ.datacenterM},${p})["telecom"="data_center"];
  nwr(around:300,${p})["informal"="yes"];
);
out tags center ${AJ.maxElementos};`;
        return `[out:json][timeout:25];
is_in(${p})->.a;
(area.a["landuse"]; area.a["place"]; area.a["aeroway"];);
out tags;
(
  nwr(around:${AJ.shoppingM},${p})["shop"="mall"];
  nwr(around:${AJ.shoppingM},${p})["building"]["name"~"shopping",i];
  nwr(around:${AJ.aeroportoPertoM},${p})["aeroway"~"^(aerodrome|terminal)$"];
  nwr(around:${AJ.industriaM},${p})["building"~"^(industrial|warehouse|factory)$"];
  nwr(around:${AJ.industriaM},${p})["landuse"="industrial"];
  nwr(around:${AJ.datacenterM},${p})["telecom"="data_center"];
  nwr(around:${AJ.datacenterM},${p})["building"="data_center"];
  nwr(around:${AJ.datacenterM},${p})["name"~"data ?cent(er|re)",i];
  nwr(around:300,${p})["informal"="yes"];
  nwr(around:300,${p})["residential"~"^(favela|slum)$"];
  nwr(around:300,${p})["place"~"^(neighbourhood|suburb|quarter)$"]["name"~"favela|comunidade|aglomerado|ocupa|invas|complexo|morro",i];
);
out tags center ${AJ.maxElementos};
nwr(around:${AJ.prediosM},${p})["building"];
out count;`;
    }

    // Normaliza a resposta: áreas que CONTÊM o ponto, elementos próximos (com centro) e contagem de construções.
    function parseOverpass(j) {
        if (!j || typeof j !== 'object') throw new Error('resposta inválida do mapa');
        // O Overpass responde 200 com "remark" quando estoura tempo/memória: sem elementos, isso é falha, não "nada encontrado".
        if (j.remark && /error|timed out|out of memory/i.test(j.remark) && !(j.elements || []).length) throw new Error('o servidor do mapa não concluiu a consulta (' + String(j.remark).slice(0, 80) + ')');
        const out = { areas: [], elementos: [], predios: null };
        const seen = new Set();
        ((j && j.elements) || []).forEach(e => {
            if (!e) return;
            if (e.type === 'count') { const t = parseInt(e.tags && e.tags.total, 10); if (isFinite(t)) out.predios = t; return; }
            if (e.type === 'area') { out.areas.push({ tags: e.tags || {} }); return; }
            const k = e.type + ':' + e.id; if (seen.has(k)) return; seen.add(k);
            const c = e.center || e;
            out.elementos.push({ tipo: e.type, id: e.id, tags: e.tags || {}, lat: c.lat, lon: c.lon });
        });
        return out;
    }

    // ---------- IBGE (população do município) ----------
    // Lista de municípios da UF: https://servicodados.ibge.gov.br/api/v1/localidades/estados/{UF}/municipios
    function acharMunicipio(lista, nome) {
        const alvo = norm(nome);
        if (!alvo || !Array.isArray(lista)) return null;
        return lista.find(m => norm(m.nome) === alvo)
            || lista.find(m => norm(m.nome).replace(/^(municipio|cidade) de /, '') === alvo.replace(/^(municipio|cidade) de /, ''))
            || null;
    }
    // Estimativa populacional (agregado 6579, variável 9324), período mais recente.
    function parseIbgePopulacao(j) {
        try {
            const serie = j[0].resultados[0].series[0].serie;
            const anos = Object.keys(serie).filter(a => isFinite(parseInt(serie[a], 10))).sort();
            if (!anos.length) return null;
            const ano = anos[anos.length - 1];
            return { populacao: parseInt(serie[ano], 10), ano };
        } catch (e) { return null; }
    }

    // ---------- CLASSIFICAÇÃO ----------
    const nomeDe = t => (t && (t.name || t['name:pt'])) || '';
    const sinal = () => ({ nivel: 'nenhum', evidencias: [] });
    const sobe = (s, nivel, ev) => { // nunca rebaixa: forte > possivel > nenhum
        const rank = { nenhum: 0, possivel: 1, forte: 2 };
        if (rank[nivel] > rank[s.nivel]) s.nivel = nivel;
        if (ev) s.evidencias.push(ev);
    };

    // ponto: {lat, lon}; overpass: saída de parseOverpass (ou null se o mapa falhou); municipio: {nome, uf, populacao, ano} (ou null)
    function analisar(ponto, overpass, municipio, extra) {
        extra = extra || {};
        const S = {}; IDS.forEach(id => { S[id] = sinal(); });
        const op = overpass || { areas: [], elementos: [], predios: null };
        const comDist = op.elementos
            .filter(e => isFinite(e.lat) && isFinite(e.lon))
            .map(e => Object.assign({}, e, { dist: distanceM(ponto.lat, ponto.lon, e.lat, e.lon) }))
            .sort((a, b) => a.dist - b.dist);
        const tem = (e, k, re) => e.tags[k] && re.test(e.tags[k]);

        // Cidade pequena: regra objetiva do IBGE
        if (municipio && municipio.populacao != null) {
            if (municipio.populacao < AJ.cidadePequenaMax)
                sobe(S.cidPeq, 'forte', `${municipio.nome}${municipio.uf ? '/' + municipio.uf : ''} tem cerca de ${fmtHab(municipio.populacao)} habitantes (IBGE ${municipio.ano || ''}), abaixo de ${fmtHab(AJ.cidadePequenaMax)}.`.replace('  ', ' '));
        }

        // Shopping
        comDist.filter(e => e.dist <= AJ.shoppingM).forEach(e => {
            if (e.tags.shop === 'mall') sobe(S.shopping, 'forte', `Shopping${nomeDe(e.tags) ? ' "' + nomeDe(e.tags) + '"' : ''} no mapa a cerca de ${fmtDist(e.dist)}.`);
            else if (RE_SHOPPING.test(nomeDe(e.tags))) sobe(S.shopping, 'possivel', `Construção "${nomeDe(e.tags)}" a cerca de ${fmtDist(e.dist)} (o nome sugere shopping).`);
        });

        // Aeroporto: dentro da área do aeródromo = forte
        op.areas.filter(a => a.tags.aeroway === 'aerodrome' || a.tags.aeroway === 'terminal').forEach(a =>
            sobe(S.aeroporto, 'forte', `O ponto está dentro da área de aeroporto${nomeDe(a.tags) ? ' "' + nomeDe(a.tags) + '"' : ''}.`));
        comDist.filter(e => e.tags.aeroway === 'terminal' && e.dist <= AJ.aeroportoTerminalM).forEach(e =>
            sobe(S.aeroporto, 'forte', `Terminal de aeroporto${nomeDe(e.tags) ? ' "' + nomeDe(e.tags) + '"' : ''} a cerca de ${fmtDist(e.dist)}.`));
        const aero = comDist.find(e => e.tags.aeroway === 'aerodrome' && e.dist <= AJ.aeroportoPertoM);
        if (aero && S.aeroporto.nivel === 'nenhum')
            sobe(S.aeroporto, 'possivel', `Aeroporto${nomeDe(aero.tags) ? ' "' + nomeDe(aero.tags) + '"' : ''} a cerca de ${fmtDist(aero.dist)}. Confirme se o endereço fica dentro do aeroporto.`);

        // Indústria / galpão
        op.areas.filter(a => a.tags.landuse === 'industrial').forEach(a =>
            sobe(S.industria, 'forte', `O ponto está em área industrial${nomeDe(a.tags) ? ' "' + nomeDe(a.tags) + '"' : ''} (uso do solo).`));
        const galpoes = comDist.filter(e => e.dist <= AJ.industriaM && (tem(e, 'building', /^(industrial|warehouse|factory)$/) || e.tags.landuse === 'industrial'));
        if (galpoes.length >= 3) sobe(S.industria, 'forte', `${galpoes.length} construções industriais/galpões num raio de ${AJ.industriaM} m.`);
        else if (galpoes.length) sobe(S.industria, 'possivel', `${galpoes.length === 1 ? 'Construção industrial/galpão' : galpoes.length + ' construções industriais/galpões'} a cerca de ${fmtDist(galpoes[0].dist)}.`);

        // Datacenter
        comDist.filter(e => e.dist <= AJ.datacenterM).forEach(e => {
            if (e.tags.telecom === 'data_center' || e.tags.building === 'data_center')
                sobe(S.datacenter, 'forte', `Datacenter${nomeDe(e.tags) ? ' "' + nomeDe(e.tags) + '"' : ''} no mapa a cerca de ${fmtDist(e.dist)}.`);
            else if (RE_DATACENTER.test(nomeDe(e.tags)))
                sobe(S.datacenter, 'possivel', `"${nomeDe(e.tags)}" a cerca de ${fmtDist(e.dist)} (o nome sugere datacenter).`);
        });

        // Favela / comunidade
        const nomesLocais = [extra.bairro].concat(op.areas.map(a => nomeDe(a.tags))).filter(Boolean);
        const informal = comDist.find(e => e.tags.informal === 'yes' || /^(favela|slum)$/.test(e.tags.residential || ''));
        if (informal) sobe(S.favela, 'forte', `Área marcada como informal/favela no mapa${nomeDe(informal.tags) ? ' ("' + nomeDe(informal.tags) + '")' : ''}, a cerca de ${fmtDist(informal.dist)}.`);
        nomesLocais.filter(n => RE_FAVELA.test(n)).slice(0, 2).forEach(n => sobe(S.favela, 'possivel', `O nome do local ("${n}") sugere favela/comunidade. Confirme.`));
        comDist.filter(e => e.dist <= 300 && RE_FAVELA.test(nomeDe(e.tags)) && /^(neighbourhood|suburb|quarter)$/.test(e.tags.place || ''))
            .slice(0, 1).forEach(e => sobe(S.favela, 'possivel', `Bairro "${nomeDe(e.tags)}" a cerca de ${fmtDist(e.dist)} (o nome sugere favela/comunidade). Confirme.`));

        // Zona urbana x rural
        const uso = op.areas.map(a => a.tags.landuse).filter(Boolean);
        const places = op.areas.map(a => a.tags.place).filter(Boolean);
        const urbano = uso.some(u => URBANO_USO.includes(u)) || places.some(p => URBANO_PLACE.includes(p)) || (op.predios != null && op.predios >= 25);
        const usoRural = uso.filter(u => RURAL_USO.includes(u)).concat(places.filter(p => RURAL_PLACE.includes(p)));
        const rarefeito = op.predios != null && op.predios <= AJ.prediosRuralMax;
        if (overpass && !urbano) {
            if (usoRural.length && (op.predios == null || op.predios <= AJ.prediosRuralForteMax)) {
                sobe(S.foraUrbana, 'forte', `O ponto está em área de uso rural no mapa (${[...new Set(usoRural)].join(', ')})${op.predios != null ? ` e há só ${op.predios} construções num raio de ${AJ.prediosM} m` : ''}.`);
                sobe(S.rural, 'possivel', 'Indícios de zona rural. A instalação rural depende da distância até a rede, que o mapa não informa.');
            } else if (rarefeito) {
                sobe(S.foraUrbana, 'possivel', `Poucas construções mapeadas (${op.predios}) num raio de ${AJ.prediosM} m e nenhum uso urbano do solo. O OpenStreetMap pode estar incompleto nessa região.`);
                sobe(S.rural, 'possivel', 'Área rarefeita no mapa. Se for rural, a instalação depende da distância até a rede, que o mapa não informa.');
            }
        }

        const sinais = IDS.map(id => Object.assign({ id, nome: ADICIONAIS[id].nome }, S[id]));
        return {
            sinais,
            contexto: {
                predios_raio_m: AJ.prediosM, predios: op.predios,
                uso_do_solo: [...new Set(uso)], tipo_de_area: urbano ? 'urbana' : (usoRural.length || rarefeito ? 'rarefeita_ou_rural' : 'indefinida'),
                mapa_consultado: !!overpass
            }
        };
    }

    // ---------- DADOS PARA A IA ----------
    // Não envia o endereço completo: só município/UF/bairro e os fatos.
    function buildFacts(ponto, municipio, analise) {
        return {
            municipio: municipio ? municipio.nome : (ponto.municipio || null),
            uf: (municipio && municipio.uf) || ponto.uf || null,
            bairro: ponto.bairro || null,
            populacao_ibge: municipio && municipio.populacao != null ? { habitantes: municipio.populacao, ano: municipio.ano || null } : null,
            precisao_da_posicao: ponto.origem === 'coord' ? 'coordenada informada' : (ponto.precisao === 'endereco' ? 'endereço com número (aproximada)' : 'só rua ou bairro (aproximada)'),
            contexto_do_mapa: analise.contexto,
            sinais_do_mapa: analise.sinais.filter(s => s.nivel !== 'nenhum').map(s => ({ id: s.id, adicional: s.nome, nivel: s.nivel, evidencias: s.evidencias })),
            sem_indicio_no_mapa: analise.sinais.filter(s => s.nivel === 'nenhum').map(s => s.id)
        };
    }

    // Junta o parecer da IA aos sinais. REGRA: a IA não cria nem remove sugestão; só dá confiança e motivo.
    // Se a resposta vier inválida (ou sem IA), vale a análise por mapa.
    function mesclarComIA(analise, aiText) {
        let ai = null;
        if (aiText) {
            try { ai = JSON.parse(String(aiText).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim()); } catch (e) { ai = null; }
        }
        const porId = {};
        if (ai && Array.isArray(ai.sugestoes)) ai.sugestoes.forEach(s => { if (s && IDS.includes(s.id)) porId[s.id] = s; });
        const conf = { alta: 'alta', media: 'media', média: 'media', baixa: 'baixa' };
        const sugestoes = analise.sinais.filter(s => s.nivel !== 'nenhum').map(s => {
            const a = porId[s.id] || {};
            return {
                id: s.id, nome: s.nome, nivel: s.nivel, evidencias: s.evidencias,
                confianca: conf[norm(a.confianca)] || conf[a.confianca] || (s.nivel === 'forte' ? 'alta' : 'media'),
                motivo: typeof a.motivo === 'string' && a.motivo.trim() ? a.motivo.trim() : s.evidencias[0] || ''
            };
        });
        return {
            iaOk: !!ai,
            resumo: ai && typeof ai.resumo === 'string' ? ai.resumo.trim() : '',
            conferir: ai && Array.isArray(ai.conferir) ? ai.conferir.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()).slice(0, 6) : [],
            sugestoes
        };
    }

    // ids marcados -> pedaço de opts para mesclar com readOptions()
    function patchOpts(ids) {
        const p = {}; (ids || []).forEach(id => { if (IDS.includes(id)) p[id] = true; });
        return p;
    }

    const api = { AJ, OVERPASS_SERVERS, ADICIONAIS, IDS, parseCoords, parseNominatim, buildOverpassQuery, parseOverpass, acharMunicipio, parseIbgePopulacao,
        analisar, buildFacts, mesclarComIA, patchOpts, distanceM, fmtDist };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.LocalCore = api;

})(typeof window !== 'undefined' ? window : globalThis);
