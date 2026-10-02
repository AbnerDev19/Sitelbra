// Testa quote.js: a composição do preço tem que fechar EXATAMENTE com Pricing.computePricing,
// o status só pode usar fatos existentes e nada pode vazar o nome da operadora no texto ao cliente.
const fs = require('fs'), vm = require('vm');
const dir = __dirname + '/../';
const ctx = { console: { log() {} } }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['lpu_config.js', 'pricing.js', 'quote.js', 'lpu_vivo.js', 'lpu_claro.js', 'lpu_cirion.js', 'lpu_oi.js', 'lpu_geral.js'])
    vm.runInContext(fs.readFileSync(dir + f, 'utf8'), ctx, { filename: f });
const C = { db: ctx.LPU_DB, Pricing: ctx.Pricing }, Q = ctx.Quote;
let fails = 0, n = 0;
const ok = (name, cond, extra = '') => { n++; if (!cond) { fails++; console.log('FALHA', name, extra); } };

const base = { prod: 'L2-MPLS', uf: 'DF', speed: 100, dur: 36, prazos: [36], impostoMode: 'com' };
const cenarios = {
    'sem opções': {},
    'tudo urbano': { foraUrbana: true, industria: true, cidPeq: true, provedor: true, shopping: true, sla: true, dupla: true, radio: true, comodato: true, favela: true, datacenter: true, aeroporto: true, qtdIp: 4 },
    'rural': { rural: true, distancia: 6000, industria: true, foraUrbana: true, favela: true, comodato: true },
    'rural + fibra curta': { rural: true, distancia: 400, fibraCurta: true, radio: true },
    'distância sem rural': { distancia: 800 },
    'IPs': { qtdIp: 8 }, 'MTU': { mtu: true }, 'faixa alta': { shopping: true, dupla: true, sla: true, aeroporto: true }
};
const combos = [];
for (const op of ['Claro', 'Vivo', 'Cirion', 'Geral', 'Oi']) {
    const its = C.db.filter(i => i.o === op && i.u === 'DF' && i.d === 36);
    const prods = [...new Set(its.map(i => i.p))];
    prods.forEach(p => { const sp = [...new Set(its.filter(i => i.p === p).map(i => i.s))]; [sp[0], sp[sp.length - 1]].forEach(s => combos.push([op, p, s])); });
}
combos.forEach(([op, prod, speed]) => Object.entries(cenarios).forEach(([nome, opts]) => {
    const q = Q.buildQuote({ ...base, op, prod, speed, opts }, C);
    const id = `${op} ${prod} ${speed}M / ${nome}`;
    ok(id + ' cotação ok', q.ok);
    if (!q.ok) return;
    ok(id + ' composição fecha', q.composition.consistente, `mensal ${q.composition.mensal.final} vs ${q.r.mensalClean} | inst ${q.composition.inst.final} vs ${q.r.instalacaoClean}`);
    ok(id + ' status válido', ['viavel', 'atencao'].includes(q.status.level));
    const txt = Q.buildCommercialText(q, C);
    ok(id + ' texto sem operadora', !new RegExp('\\b' + op + '\\b').test(txt) || op === 'Geral');
}));
console.log('combinações testadas:', combos.length, 'x', Object.keys(cenarios).length);

// Fatores: só aparecem os realmente aplicados
let q = Q.buildQuote({ ...base, op: 'Claro', speed: 500, prazos: [36], opts: { dupla: true, sla: true } }, C);
const labels = q.factors.map(f => f.label);
ok('fatores: dupla+SLA+velocidade+prazo', ['500 Mbps', '36 meses', 'SLA maior', 'Dupla abordagem'].every(l => labels.includes(l)) && labels.length === 4, labels.join('|'));
// Cirion ignora rádio/MTU -> Atenção e fatores não listam
q = Q.buildQuote({ ...base, op: 'Cirion', opts: { radio: true, mtu: true } }, C);
ok('Cirion rádio/MTU = atenção', q.status.level === 'atencao' && q.ignorados.length === 2);
ok('Cirion rádio/MTU não aparecem nos fatores', !q.factors.some(f => f.k === 'radio' || f.k === 'mtu'));
// Rural sem distância -> atenção
q = Q.buildQuote({ ...base, op: 'Claro', opts: { rural: true } }, C);
ok('rural sem distância = atenção', q.status.level === 'atencao');
// Prazo adicional sem preço -> atenção
q = Q.buildQuote({ ...base, op: 'Claro', prazos: [36, 99], opts: {} }, C);
ok('prazo sem preço = atenção', q.status.level === 'atencao' && q.porPrazo.some(p => !p.ok));
// Viável limpo
q = Q.buildQuote({ ...base, op: 'Claro', opts: {} }, C);
ok('Claro limpa = viável', q.status.level === 'viavel');
// Inviável
q = Q.buildQuote({ ...base, op: 'Claro', prod: 'L2-MPLS', uf: 'DF', speed: 100, dur: 7, prazos: [7], opts: {} }, C);
ok('prazo inexistente = inviável', !q.ok && q.status.level === 'inviavel');
// Incompleto
q = Q.buildQuote({ ...base, op: '', opts: {} }, C);
ok('incompleto', !q.ok && q.motivo === 'incompleto' && q.missing.includes('Operadora'));
// Comparação: sem ranking, mesmo parâmetro
const cmp = Q.compareOperators({ ...base, op: 'Claro', opts: {} }, C);
ok('comparação cobre todas as operadoras', cmp.length === 5);
const claroCmp = cmp.find(x => x.op === 'Claro'), claroQ = Q.buildQuote({ ...base, op: 'Claro', opts: {} }, C);
ok('comparação = cotação individual', Math.abs(claroCmp.r.mensalFull - claroQ.r.mensalFull) < 1e-9);
// Resumo
ok('resumo contém operadora', Q.buildSummaryText(claroQ).includes('Operadora: Claro'));
console.log(`${n} verificações,`, fails ? 'FALHAS: ' + fails : 'TODAS PASSARAM');
process.exit(fails ? 1 : 0);
