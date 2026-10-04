// node tests/rede.test.js - lógica pura da aba Rede própria
const R = require('../rede-core.js');
let falhas = 0;
const ok = (nome, cond) => { console.log((cond ? 'ok    ' : 'FALHA ') + nome); if (!cond) falhas++; };

// Geohash: valor de referência conhecido
ok('geohash(57.64911, 10.40744, 11) = u4pruydqqvj', R.geohash(57.64911, 10.40744, 11) === 'u4pruydqqvj');
// Brasília (Praça dos Três Poderes) começa com "6vj"
ok('Brasília cai em 6vj…', R.geohash(-15.7998, -47.8645, 5).startsWith('6vj'));

// Distância: 1 grau de latitude ~ 111,2 km; Brasília -> SP ~ 870 km
ok('1° lat ≈ 111,2 km', Math.abs(R.distanceM(0, 0, 1, 0) - 111195) < 200);
const bsbSp = R.distanceM(-15.7942, -47.8822, -23.5505, -46.6333);
ok('BSB -> SP ≈ 870 km', bsbSp > 850000 && bsbSp < 890000);

// Vizinhança: o ponto, e um ponto a 3 km, sempre caem nas 9 células (p5) do ponto
const lat = -15.8, lon = -47.9;
const cels = R.cellsAround(lat, lon, 5);
ok('9 células (ou menos) no ring p5', cels.length > 1 && cels.length <= 9);
let todosDentro = true;
for (let a = 0; a < 360; a += 15) {
    const r = R.guaranteedRadius(lat, 5) * 0.98, rad = a * Math.PI / 180;
    const la = lat + (r * Math.cos(rad)) / 111195, lo = lon + (r * Math.sin(rad)) / (111320 * Math.cos(lat * Math.PI / 180));
    if (!cels.includes(R.geohash(la, lo, 5))) todosDentro = false;
}
ok('qualquer ponto dentro do raio garantido está nas células', todosDentro);
ok('raio garantido p5 ≈ 4,5 a 4,9 km', R.guaranteedRadius(lat, 5) > 4400 && R.guaranteedRadius(lat, 5) < 4950);

// Coordenadas
let c = R.parseCoordPair('Q 5 Lote 2, Brasília (-15.7801, -47.9292)');
ok('par no texto (ponto)', c && c.lat === -15.7801 && c.lon === -47.9292);
c = R.parseCoordPair('-15,7801; -47,9292');
ok('par com vírgula decimal e ;', c && c.lat === -15.7801 && c.lon === -47.9292);
ok('ignora número fora do Brasil', R.parseCoordPair('48.8566, 2.3522') === null);
ok('ignora CEP/telefone', R.parseCoordPair('CEP 70.040-010, tel 3322-1100') === null);

// Velocidade
ok('100 -> 100', R.parseMbps(100) === 100);
ok('"1 Gbps" -> 1000', R.parseMbps('1 Gbps') === 1000);
ok('"500M" -> 500', R.parseMbps('500M') === 500);
ok('"1,5G" -> 1500', R.parseMbps('1,5G') === 1500);
ok('vazio -> null', R.parseMbps('') === null);

// Classificação
ok('30 m = No local', R.faixaDist(30).id === 'local');
ok('400 m = perto', R.faixaDist(400).id === 'perto');
ok('5 km = longe', R.faixaDist(5000).id === 'longe');
ok('ativo 100 / pedido 100 = igual', R.matchSpeed(100, 100).id === 'igual');
ok('ativo 50 / pedido 100 = menor (falta 50)', R.matchSpeed(50, 100).falta === 50);
ok('ativo 1000 / pedido 100 = maior', R.matchSpeed(1000, 100).id === 'maior');

// Colunas de uma planilha típica
const h = ['Designação', 'Cliente', 'Endereço', 'Cidade', 'UF', 'Latitude', 'Longitude', 'Velocidade (Mbps)', 'Tipo de Acesso', 'Status', 'Observação'];
const m = R.detectColumns(h);
ok('detecta id/lat/lon/mbps/tipo', m.id === 0 && m.lat === 5 && m.lon === 6 && m.mbps === 7 && m.tipo === 8);
const r1 = R.rowToAsset(['SIT-001', 'ACME', 'Rua A, 10', 'Brasília', 'df', '-15,78', '-47,93', '100', 'Fibra', 'Ativo', 'teste'], h, m);
ok('linha válida', r1.ok && r1.ativo.uf === 'DF' && r1.ativo.mbps === 100 && r1.ativo.lat === -15.78 && r1.ativo.extra['Observação'] === 'teste');
const r2 = R.rowToAsset(['SIT-002', '', 'Rua B', 'Goiânia', 'GO', '-47.93', '-15.78', '', '', '', ''], h, m);
ok('lat/long trocadas são corrigidas', r2.ok && r2.ativo.lat === -15.78 && r2.ativo.lon === -47.93);
const r3 = R.rowToAsset(['SIT-003', '', 'Rua C, 10', 'Goiânia', 'GO', '', '', '', '', '', ''], h, m);
ok('só endereço vira pendente de geocodificação', r3.ok && r3.pendente && r3.ativo.lat === null && R.buildQuery(r3.ativo) === 'Rua C, 10, Goiânia, GO, Brasil');
const r3b = R.rowToAsset(['SIT-004', '', '', '', '', '', '', '', '', '', ''], h, m);
ok('sem coordenada e sem endereço é descartada', !r3b.ok && r3b.motivo === 'sem_coordenada');
ok('query não repete cidade/UF já no endereço', R.buildQuery({ endereco: 'Rua A, 5, Brasília - DF', cidade: 'Brasília', uf: 'DF' }) === 'Rua A, 5, Brasília - DF, Brasil');
ok('stripNumber tira o número da porta', R.stripNumber('Rua A, 123, Brasília, DF, Brasil') === 'Rua A, Brasília, DF, Brasil');
ok('stripNumber preserva "BR 060"', R.stripNumber('Rodovia BR 060, Goiânia').includes('BR 060'));
const semId = { ...r3.ativo, id: '' };
ok('docId de pendente sem id é estável', R.docId(semId, new Set()) === R.docId(semId, new Set()) && R.docId(semId, new Set()).startsWith('end_'));
const m2 = R.detectColumns(['ID', 'Endereço Ponto A', 'Banda']);
const r4 = R.rowToAsset(['X1', 'Rua D 5 (-15.80, -47.90)', '200M'], ['ID', 'Endereço Ponto A', 'Banda'], m2);
ok('coordenada embutida no endereço', r4.ok && r4.ativo.lat === -15.8 && r4.ativo.mbps === 200);

// ID de documento
const vistos = new Set();
ok('docId troca "/"', R.docId({ id: 'A/B 1', lat: 0, lon: 0 }, vistos) === 'A_B_1');
ok('docId duplicado ganha sufixo', R.docId({ id: 'A/B 1', lat: 0, lon: 0 }, vistos) === 'A_B_1-2');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
process.exit(falhas ? 1 : 0);
