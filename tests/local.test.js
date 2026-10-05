// Testa local-core.js com respostas simuladas do OpenStreetMap/IBGE (sem rede).
const fs = require('fs'), vm = require('vm');
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../local-core.js', 'utf8'), ctx);
const L = ctx.LocalCore;
let fails = 0, n = 0;
const ok = (name, cond, extra = '') => { n++; if (!cond) { fails++; console.log('FALHA', name, extra); } };
const P = { lat: -15.78, lon: -47.93 };
const nivel = (a, id) => a.sinais.find(s => s.id === id).nivel;
const el = (tags, dLat = 0, dLon = 0) => ({ type: 'node', id: Math.random(), lat: P.lat + dLat, lon: P.lon + dLon, tags });
const areaEl = tags => ({ type: 'area', id: 1, tags });
const cnt = t => ({ type: 'count', id: 0, tags: { total: String(t) } });

// coordenadas
ok('coord ok', JSON.stringify(L.parseCoords('-15,78 ; -47,93')) === JSON.stringify(P));
ok('coord fora do Brasil', L.parseCoords('48.85, 2.35') === null);
ok('endereço não é coord', L.parseCoords('Rua A, 10') === null);

// nominatim
const nom = L.parseNominatim({ lat: '-15.78', lon: '-47.93', display_name: 'X', address: { city: 'Brasília', 'ISO3166-2-lvl4': 'BR-DF', house_number: '5' } });
ok('nominatim uf', nom.uf === 'DF' && nom.municipio === 'Brasília' && nom.precisao === 'endereco');
ok('nominatim rua', L.parseNominatim({ lat: '1', lon: '1', address: {} }).precisao === 'rua_ou_bairro');

// IBGE
const pop = L.parseIbgePopulacao([{ resultados: [{ series: [{ serie: { 2024: '12345', 2025: '23456' } }] }] }]);
ok('ibge ano mais recente', pop.populacao === 23456 && pop.ano === '2025');
ok('ibge lixo', L.parseIbgePopulacao({}) === null);
ok('município sem acento', L.acharMunicipio([{ id: 1, nome: 'São Paulo' }], 'sao paulo').id === 1);

// cidade pequena
let a = L.analisar(P, L.parseOverpass({ elements: [cnt(80)] }), { nome: 'Xique', uf: 'BA', populacao: 12000, ano: '2025' });
ok('cidade pequena forte', nivel(a, 'cidPeq') === 'forte');
a = L.analisar(P, L.parseOverpass({ elements: [cnt(80)] }), { nome: 'Salvador', uf: 'BA', populacao: 2500000, ano: '2025' });
ok('cidade grande: nenhum', nivel(a, 'cidPeq') === 'nenhum');
a = L.analisar(P, L.parseOverpass({ elements: [cnt(80)] }), null);
ok('sem IBGE: não afirma', nivel(a, 'cidPeq') === 'nenhum');

// shopping / aeroporto / indústria / datacenter / favela
a = L.analisar(P, L.parseOverpass({ elements: [el({ shop: 'mall', name: 'Shopping Teste' }, 0.0005), cnt(100)] }), null);
ok('shopping forte', nivel(a, 'shopping') === 'forte');
a = L.analisar(P, L.parseOverpass({ elements: [el({ building: 'yes', name: 'Shopping Popular' }, 0.0005), cnt(100)] }), null);
ok('shopping pelo nome = possível', nivel(a, 'shopping') === 'possivel');
a = L.analisar(P, L.parseOverpass({ elements: [areaEl({ aeroway: 'aerodrome', name: 'Aeroporto X' }), cnt(10)] }), null);
ok('aeroporto: dentro da área = forte', nivel(a, 'aeroporto') === 'forte');
a = L.analisar(P, L.parseOverpass({ elements: [el({ aeroway: 'aerodrome' }, 0.01), cnt(100)] }), null);
ok('aeroporto a ~1 km = possível', nivel(a, 'aeroporto') === 'possivel');
a = L.analisar(P, L.parseOverpass({ elements: [el({ aeroway: 'aerodrome' }, 0.1), cnt(100)] }), null);
ok('aeroporto longe = nenhum', nivel(a, 'aeroporto') === 'nenhum');
a = L.analisar(P, L.parseOverpass({ elements: [areaEl({ landuse: 'industrial' }), cnt(100)] }), null);
ok('área industrial = forte', nivel(a, 'industria') === 'forte');
a = L.analisar(P, L.parseOverpass({ elements: [el({ building: 'warehouse' }, 0.0003), cnt(100)] }), null);
ok('1 galpão = possível', nivel(a, 'industria') === 'possivel');
a = L.analisar(P, L.parseOverpass({ elements: [el({ telecom: 'data_center', name: 'DC1' }, 0.0003), cnt(100)] }), null);
ok('datacenter forte', nivel(a, 'datacenter') === 'forte');
a = L.analisar(P, L.parseOverpass({ elements: [el({ informal: 'yes' }, 0.0004), cnt(100)] }), null);
ok('favela marcada = forte', nivel(a, 'favela') === 'forte');
a = L.analisar(P, L.parseOverpass({ elements: [cnt(100)] }), null, { bairro: 'Favela do Moinho' });
ok('favela só pelo nome = possível', nivel(a, 'favela') === 'possivel');

// urbano x rural
a = L.analisar(P, L.parseOverpass({ elements: [areaEl({ landuse: 'residential' }), cnt(150)] }), null);
ok('urbano: sem fora da urbana', nivel(a, 'foraUrbana') === 'nenhum' && nivel(a, 'rural') === 'nenhum');
a = L.analisar(P, L.parseOverpass({ elements: [areaEl({ landuse: 'farmland' }), cnt(2)] }), null);
ok('fazenda: fora urbana forte, rural possível', nivel(a, 'foraUrbana') === 'forte' && nivel(a, 'rural') === 'possivel');
a = L.analisar(P, L.parseOverpass({ elements: [cnt(1)] }), null);
ok('rarefeito sem uso do solo = só possível', nivel(a, 'foraUrbana') === 'possivel');
a = L.analisar(P, null, null);
ok('mapa fora do ar: nada é sugerido', a.sinais.every(s => s.nivel === 'nenhum') && a.contexto.mapa_consultado === false);

// Overpass: query válida e sem aspas quebradas
const q = L.buildOverpassQuery(-15.78, -47.93);
ok('query tem is_in e count', /is_in\(-15\.780000,-47\.930000\)/.test(q) && /out count;/.test(q));
ok('query com parênteses balanceados', (q.match(/\(/g) || []).length === (q.match(/\)/g) || []).length);

// IA: não cria sugestão, não remove, aceita ```json
a = L.analisar(P, L.parseOverpass({ elements: [el({ shop: 'mall' }, 0.0005), cnt(100)] }), { nome: 'Xique', uf: 'BA', populacao: 9000, ano: '2025' });
let m = L.mesclarComIA(a, '```json\n{"resumo":"ok","sugestoes":[{"id":"shopping","confianca":"alta","motivo":"Shopping perto"},{"id":"aeroporto","confianca":"alta","motivo":"inventado"},{"id":"foo","motivo":"x"}],"conferir":["a"]}\n```');
ok('IA ok', m.iaOk && m.resumo === 'ok');
ok('IA não inventa sugestão', m.sugestoes.map(s => s.id).sort().join() === 'cidPeq,shopping');
ok('IA motivo usado', m.sugestoes.find(s => s.id === 'shopping').motivo === 'Shopping perto');
m = L.mesclarComIA(a, 'texto solto, não é JSON');
ok('IA inválida: cai no mapa', !m.iaOk && m.sugestoes.length === 2 && m.sugestoes.every(s => s.motivo));
m = L.mesclarComIA(a, null);
ok('sem IA: forte = confiança alta', m.sugestoes.every(s => s.confianca === 'alta'));

// facts para IA: sem endereço completo
const f = L.buildFacts({ lat: 1, lon: 1, municipio: 'X', uf: 'BA', nome: 'Rua Secreta 10, X', precisao: 'endereco', origem: 'endereco' }, null, a);
ok('facts sem endereço completo', !JSON.stringify(f).includes('Rua Secreta') && !('lat' in f));
ok('patchOpts só ids válidos', JSON.stringify(L.patchOpts(['shopping', 'sla', 'foo'])) === '{"shopping":true}');

console.log(fails ? `${fails} falha(s) de ${n}` : `local: ${n} verificações OK`);
process.exit(fails ? 1 : 0);
