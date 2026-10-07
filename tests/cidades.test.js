// Testa: rede própria por cidade, regras do Norte, LPU acima de 2 Gbps e instalação "Sob consulta".
const fs = require('fs'), vm = require('vm');
const dir = __dirname + '/../';
const ctx = { console: { log() {} } }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['lpu_config.js', 'pricing.js', 'cidades-data.js', 'cidades-core.js', 'quote.js', 'lpu_vivo.js', 'lpu_claro.js', 'lpu_cirion.js', 'lpu_oi.js', 'lpu_geral.js', 'lpu_acima2g.js'])
    vm.runInContext(fs.readFileSync(dir + f, 'utf8'), ctx, { filename: f });
const Ci = ctx.Cidades, Q = ctx.Quote, C = { db: ctx.LPU_DB, Pricing: ctx.Pricing };
let n = 0, fails = 0;
const ok = (nome, cond, extra = '') => { n++; if (!cond) { fails++; console.log('FALHA', nome, extra); } };
const near = (a, b) => Math.abs(a - b) < 0.01;

// ---- rede própria
ok('Brasília/DF tem rede própria', Ci.redePropria('DF', 'brasilia').tem);
ok('acento e maiúsculas não importam', Ci.redePropria('DF', 'BRASÍLIA').tem && Ci.redePropria('GO', 'goiania').tem);
ok('cidade fora da lista', !Ci.redePropria('SP', 'Campinas').tem);
ok('sem cidade = null', Ci.redePropria('DF', '  ') === null);
ok('mesma cidade em outra UF não vale', !Ci.redePropria('SP', 'Brasília').tem);
ok('Taguatinga sugere as variações', Ci.redePropria('DF', 'Taguatinga').tem || Ci.redePropria('DF', 'Taguatinga').parecidas.length > 0);
ok('lista da UF sem repetição', new Set(Ci.listaUF('DF').map(Ci.norm)).size === Ci.listaUF('DF').length);

// ---- Norte
const R = (uf, c, v) => Ci.regraNorte(uf, c, v);
ok('UF fora do Norte = sem regra', R('DF', 'Brasília', 100) === null && R('TO', 'Palmas', 100) === null);
ok('sem cidade = sem regra', R('AM', '', 100) === null);
ok('Manaus LPU normal', R('AM', 'Manaus', 100).tipo === 'ok');
ok('Tefé acima de 20 = x2,5', R('AM', 'Tefé', 100).mult === 2.5);
ok('Tefé até 20 = x2', R('AM', 'tefe', 20).mult === 2 && R('AM', 'tefe', 20).listada);
ok('20 Mb é "até 20"', R('AM', 'Apuí', 20).mult === 1.8 && R('AM', 'Apuí', 30).mult === 2.5);
ok('Tabatinga inviável nas duas faixas', R('AM', 'Tabatinga', 100).tipo === 'inviavel' && R('AM', 'Tabatinga', 10).tipo === 'inviavel');
ok('Coari: inviável acima de 20, x1,8 até 20', R('AM', 'Coari', 100).tipo === 'inviavel' && R('AM', 'Coari', 10).mult === 1.8);
ok('Amazonas fora da lista = somente Starlink', R('AM', 'Cidade Qualquer', 100).tipo === 'inviavel' && !R('AM', 'Cidade Qualquer', 100).listada);
ok('Pará fora da lista = demais x3 / x1,8', R('PA', 'Xyz', 100).mult === 3 && R('PA', 'Xyz', 10).mult === 1.8);
ok('Rondônia demais = x2 / x2,5 (planilha)', R('RO', 'Xyz', 100).mult === 2 && R('RO', 'Xyz', 10).mult === 2.5);
ok('Paragominas >20 não atende, ≤20 normal', R('PA', 'Paragominas', 100).tipo === 'inviavel' && R('PA', 'Paragominas', 10).tipo === 'ok');
ok('Boca do Acre x3,5 (vírgula/ponto)', R('AM', 'Boca do Acre', 100).mult === 3.5);
ok('Japurá "X 4"', R('AM', 'Japurá', 100).mult === 4);
ok('Rorainópolis (erro de digitação da planilha)', R('RR', 'Rorainópolis', 100).tipo === 'ok' && R('RR', 'Rorainopolis', 100).tipo === 'ok');
ok('Boa Vista RR', R('RR', 'Boa Vista', 100).listada);
ok('Itamarati inviável', R('AM', 'Itamarati', 100).tipo === 'inviavel');

// ---- cotação com cidade do Norte
const base = { op: 'Claro', prod: 'L2-MPLS', uf: 'AM', speed: 100, dur: 36, prazos: [36], opts: {}, impostoMode: 'sem' };
const sem = Q.buildQuote(base, C), tefe = Q.buildQuote({ ...base, cidade: 'Tefé' }, C);
ok('Tefé multiplica a mensalidade por 2,5', near(tefe.r.mensalClean, sem.r.mensalClean * 2.5));
ok('Tefé multiplica a instalação por 2,5', near(tefe.r.instalacaoClean, sem.r.instalacaoClean * 2.5));
ok('composição fecha com a cidade', tefe.composition.consistente && tefe.composition.mensal.steps.some(p => /Norte/.test(p.label)));
ok('fator aparece na lista', tefe.factors.some(f => f.k === 'norte'));
ok('cidade do Norte listada = viável', tefe.status.level === 'viavel');
const inv = Q.buildQuote({ ...base, cidade: 'Tabatinga' }, C);
ok('Tabatinga = inviável sem preço', !inv.ok && inv.status.level === 'inviavel' && inv.motivo === 'cidade_inviavel');
ok('cidade não listada (PA) = atenção', Q.buildQuote({ ...base, uf: 'PA', cidade: 'Zzz' }, C).status.level === 'atencao');
ok('comparação respeita a cidade inviável', Q.compareOperators({ ...base, cidade: 'Tabatinga' }, C).every(r => !r.ok && r.cidadeInviavel));
const comb = Q.buildQuote({ ...base, cidade: 'Tefé', opts: { sla: true, shopping: true } }, C);
ok('multiplicador + opções fecham', comb.composition.consistente);
ok('texto comercial traz cidade/UF', /\(Tefé\/AM\)/.test(Q.buildCommercialText(tefe)));
ok('DF com cidade não aplica regra do Norte', near(Q.buildQuote({ ...base, uf: 'DF', cidade: 'Brasília' }, C).r.mensalClean, Q.buildQuote({ ...base, uf: 'DF' }, C).r.mensalClean));
ok('rede própria na cotação', Q.buildQuote({ ...base, uf: 'AM', cidade: 'Manaus' }, C).rede.tem);

// ---- acima de 2 Gbps (valores da planilha)
const dados = [['IP DEDICADO', 'DF', 2000, 5980, 7989.31], ['IP DEDICADO', 'RR', 20000, 64894.71, 86699.67], ['L2-MPLS', 'SP', 6000, 9666.54, 12914.55], ['L2-MPLS', 'AC', 10000, 25777.44, 34438.8]];
for (const op of ['Claro', 'Vivo', 'Cirion', 'Geral', 'Oi'])
    for (const [prod, uf, vel, s, c] of dados) {
        const q = Q.buildQuote({ op, prod, uf, speed: vel, dur: 24, prazos: [24], opts: {}, impostoMode: 'sem' }, C);
        ok(`${op} ${prod} ${uf} ${vel}: s/imp ${s}`, q.ok && near(q.r.mensalClean, s), q.ok ? q.r.mensalClean : 'sem cotação');
        ok(`${op} ${prod} ${uf} ${vel}: c/imp ${c}`, q.ok && near(q.r.mensalFull, c));
    }
const g = Q.buildQuote({ op: 'Claro', prod: 'IP DEDICADO', uf: 'RR', speed: 20000, dur: 24, prazos: [24], opts: {}, impostoMode: 'com' }, C);
ok('sem faixa de volume no acima de 2G', g.r.faixa === 1);
ok('instalação sob consulta + atenção', g.semInst && g.status.level === 'atencao' && /Sob consulta/.test(Q.buildCommercialText(g)) && !/R\$ 0,00/.test(Q.buildCommercialText(g).split('Instalação')[1]));
ok('composição fecha no acima de 2G', g.composition.consistente);
ok('acima de 2G com adicional segue fechando', Q.buildQuote({ op: 'Vivo', prod: 'L2-MPLS', uf: 'SP', speed: 3000, dur: 24, prazos: [24], opts: { sla: true, aeroporto: true }, impostoMode: 'sem' }, C).composition.consistente);
ok('BANDA LARGA não tem acima de 2G', !Q.buildQuote({ op: 'Claro', prod: 'BANDA LARGA', uf: 'DF', speed: 2000, dur: 24, prazos: [24], opts: {} }, C).ok);
ok('só 24 meses', !Q.buildQuote({ op: 'Claro', prod: 'IP DEDICADO', uf: 'DF', speed: 2000, dur: 36, prazos: [36], opts: {} }, C).ok);
ok('rótulo 2 Gbps', Q.speedLabel(2000) === '2 Gbps' && Q.speedLabel(20000) === '20 Gbps');
ok('análise automática não vazia', Q.buildLocalAnalysis(tefe).length >= 3);

// ---- linha para o Excel
{
    const linha = Q.buildExcelRow({ op: 'Claro', prod: 'L2-MPLS', uf: 'DF', speed: 100, dur: 36, prazos: [36], opts: {}, impostoMode: 'sem' }, C).split('\t');
    const q12 = Q.buildQuote({ op: 'Claro', prod: 'L2-MPLS', uf: 'DF', speed: 100, dur: 12, prazos: [12], opts: {}, impostoMode: 'sem' }, C);
    ok('Excel: 1 + 5 prazos x 2 = 11 células', linha.length === 11 && linha[0] === '60 dias', linha.length);
    ok('Excel: mensal 12 meses confere', linha[1] === Q.fmtBRL(q12.r.mensalClean) && /^R\$ [\d.]+,\d\d$/.test(linha[1]), linha[1]);
    const com = Q.buildExcelRow({ op: 'Claro', prod: 'L2-MPLS', uf: 'DF', speed: 100, dur: 36, prazos: [36], opts: {}, impostoMode: 'com' }, C).split('\t');
    ok('Excel: com impostos usa valor final', com[1] === Q.fmtBRL(q12.r.mensalFull));
    const g2 = Q.buildExcelRow({ op: 'Claro', prod: 'IP DEDICADO', uf: 'DF', speed: 2000, dur: 24, prazos: [24], opts: {}, impostoMode: 'sem' }, C).split('\t');
    ok('Excel: acima de 2G só 24 meses, resto "-"', g2[1] === '-' && g2[3] !== '-' && g2[4] === 'Sob consulta', g2.join('|'));
}
console.log(`${n} verificações,`, fails ? 'FALHAS: ' + fails : 'TODAS PASSARAM');
process.exit(fails ? 1 : 0);
