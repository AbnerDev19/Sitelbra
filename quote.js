// quote.js
// Camada que transforma o resultado de pricing.js em informação para a tela:
// status de viabilidade, composição do preço, fatores aplicados e textos de resumo.
// NÃO calcula preço: toda conta vem de Pricing.computePricing (pricing.js).
// Função pura (sem DOM), então dá para testar no Node: node tests/quote.test.js

(function (root) {

    // Operadoras cujas tabelas NÃO foram conferidas com planilha LPU (ver RELATORIO_CORRECOES.md).
    // Elas recebem status "Atenção". Para remover o aviso, deixe a lista vazia.
    const OPERADORAS_SEM_PLANILHA = ['Oi'];

    // Arquivo de origem de cada tabela (cabeçalho dos arquivos lpu_*.js)
    const TABELAS_FONTE = {
        Claro: 'LPU_CLARO_e_VIVO - TODOS PRODUTOS - 2025-REV00',
        Vivo: 'LPU_CLARO_e_VIVO - TODOS PRODUTOS - 2025-REV00',
        Cirion: 'LPU_CIRION - TODOS PRODUTOS - 2025',
        Geral: 'LPU_GERAL (L2, IP e BDL)',
        Oi: null // sem planilha de referência no projeto
    };

    const fmtBRL = v => (v === undefined || v === null || isNaN(v))
        ? 'R$ 0,00'
        : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');

    const speedLabel = s => s >= 1000 ? (s / 1000) + ' Gbps' : s + ' Mbps';

    const fmtNum = (v, max = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: max });

    const fmtPct = p => (p >= 0 ? '+' : '−') + fmtNum(Math.abs(p), 1) + '%';

    const findItem = (db, op, prod, uf, dur, speed) =>
        db.find(i => i.o == op && i.p == prod && i.u == uf && i.d == dur && i.s == speed);

    // ---------- FATORES APLICADOS ----------
    // Lista apenas o que realmente entrou no cálculo (usa os fatores devolvidos por pricing.js).
    function buildFactors(sel, r) {
        const f = r.fatores, o = sel.opts, dist = Math.max(0, parseFloat(o.distancia) || 0);
        const out = [{ k: 'speed', label: speedLabel(sel.speed) }];
        sel.prazos.forEach(p => out.push({ k: 'prazo' + p, label: p + ' meses' }));
        const add = (cond, k, label) => { if (cond) out.push({ k, label }); };
        add(f.F !== 1, 'shopping', 'Shopping Center');
        add(f.G > 0, 'aeroporto', 'Aeroporto');
        add(f.C !== 1, 'industria', 'Indústria / Galpão');
        add(f.H > 0, 'datacenter', 'Datacenter');
        add(!!o.rural, 'rural', 'Zona rural' + (dist > 0 ? ` (${fmtNum(dist, 0)} m)` : ''));
        add(f.B !== 1, 'fora_urbana', 'Fora da zona urbana');
        add(f.D !== 1, 'cid_peq', 'Cidade pequena');
        add(f.K > 0, 'favela', 'Favela / fibra pública subterrânea');
        add(!!o.fibraCurta && (dist > 0 || !!o.rural), 'fibra_curta', 'Fibra a menos de 500 m');
        add(f.E !== 1, 'provedor', 'Provedores');
        add(f.I !== 1, 'sla', 'SLA maior');
        add(f.N !== 1, 'dupla', 'Dupla abordagem');
        add(f.O !== 1, 'radio', 'Rádio homologado');
        add(f.L > 0, 'comodato', 'Equipamento em comodato');
        add(f.Q > 0, 'mtu', 'BDL MTU 1500');
        add(f.P > 0, 'ips', `IPs fixos (${fmtNum(parseFloat(o.qtdIp) || 0, 0)})`);
        return out;
    }

    // Opções marcadas que a regra da operadora ignora (ex.: Rádio e MTU na Cirion)
    function buildIgnored(sel, r) {
        const f = r.fatores, o = sel.opts, dist = Math.max(0, parseFloat(o.distancia) || 0);
        const out = [];
        if (o.radio && f.O === 1) out.push('Rádio homologado');
        if (o.mtu && f.Q === 0) out.push('BDL MTU 1500');
        if (o.fibraCurta && dist === 0 && !o.rural) out.push('Fibra a menos de 500 m (sem distância informada)');
        return out;
    }

    // ---------- COMPOSIÇÃO DO PREÇO ----------
    // Refaz o passo a passo das MESMAS contas de pricing.js, mostrando o efeito de cada fator.
    // Se o total não fechar com computePricing, a composição é marcada como inconsistente
    // (a tela esconde o bloco em vez de mostrar números errados).
    function buildComposition(item, sel, r, Pricing) {
        const f = r.fatores, op = sel.op;
        const qtdIp = Math.max(0, parseFloat(sel.opts.qtdIp) || 0);
        const dist = Math.max(0, parseFloat(sel.opts.distancia) || 0);
        const R = Pricing.rulesFor(op);

        function mult(steps, run, label, k) {
            if (k === 1) return run;
            const nv = run * k;
            steps.push({ label, tipo: 'mult', fator: k, pct: (k - 1) * 100, delta: nv - run, total: nv });
            return nv;
        }
        function plus(steps, run, label, v) {
            if (!v) return run;
            const nv = run + v;
            steps.push({ label, tipo: 'add', valor: v, delta: v, total: nv });
            return nv;
        }

        // Mensalidade
        const m = []; let run = item.m.c;
        run = mult(m, run, 'Fora da zona urbana', f.B);
        run = mult(m, run, 'Indústria / Galpão', f.C);
        run = mult(m, run, 'Rádio homologado', f.O);
        run = mult(m, run, 'Cidade pequena', f.D);
        run = mult(m, run, 'Provedores', f.E);
        run = mult(m, run, 'SLA maior', f.I);
        run = mult(m, run, `Distância (${fmtNum(dist, 0)} m)`, f.J);
        run = mult(m, run, 'Dupla abordagem', f.N);
        run = mult(m, run, 'Shopping Center', f.F);
        run = plus(m, run, 'Aeroporto (2x a mensalidade da LPU)', f.G);
        run = plus(m, run, 'Datacenter', f.H);
        run = plus(m, run, 'Favela / fibra pública subterrânea', f.K);
        run = plus(m, run, 'Equipamento em comodato', f.L);
        if (r.faixa !== 1) {
            const nv = run * r.faixa;
            m.push({ label: r.faixa === 0.65 ? 'Faixa de volume (acima de R$ 15 mil)' : 'Faixa de volume (R$ 10 a 15 mil)',
                tipo: 'faixa', fator: r.faixa, pct: (r.faixa - 1) * 100, delta: nv - run, total: nv });
            run = nv;
        }
        run = plus(m, run, `IPs fixos (${fmtNum(qtdIp, 0)})`, f.P);
        run = plus(m, run, 'BDL MTU 1500', f.Q * 2);
        const mensal = { base: item.m.c, steps: m, final: run };

        // Instalação
        const i = []; let ri;
        if (sel.opts.rural) {
            ri = 0;
            ri = plus(i, ri, `Instalação por distância (${fmtNum(dist, 0)} m x 3,65)`, dist * 3.65);
            ri = plus(i, ri, 'Base de instalação rural', 500);
            ri = plus(i, ri, 'Equipamento em comodato', 10 * f.L);
            ri = plus(i, ri, 'Indústria / Galpão', f.C === 1 ? 0 : 3500);
            ri = plus(i, ri, 'Rádio homologado', f.O === 1 ? 0 : 7500);
            ri = plus(i, ri, 'Favela / fibra pública subterrânea', 2 * f.K);
            if (sel.opts.fibraCurta) {
                const nv = ri / 2;
                i.push({ label: 'Fibra a menos de 500 m (metade da instalação rural)', tipo: 'faixa', fator: 0.5, pct: -50, delta: nv - ri, total: nv });
                ri = nv;
            }
            var instBase = 0;
        } else {
            ri = item.i.c;
            instBase = item.i.c;
            ri = mult(i, ri, 'Fora da zona urbana', f.B);
            ri = mult(i, ri, 'Cidade pequena', f.D);
            ri = mult(i, ri, 'Provedores', f.E);
            ri = mult(i, ri, 'Shopping Center', f.F);
            ri = plus(i, ri, 'Aeroporto (2x a mensalidade da LPU)', f.G);
            ri = plus(i, ri, 'Favela / fibra pública subterrânea', 2 * f.K);
            ri = plus(i, ri, 'Equipamento em comodato', 10 * f.L);
            ri = plus(i, ri, 'Indústria / Galpão', f.C === 1 ? 0 : 3500);
            ri = plus(i, ri, 'Rádio homologado', f.O === 1 ? 0 : 7500);
            ri = plus(i, ri, `IPs fixos (${fmtNum(qtdIp, 0)})`, R.ipInst(qtdIp));
            ri = plus(i, ri, 'BDL MTU 1500', f.Q * 5);
        }
        const inst = { base: instBase, rural: !!sel.opts.rural, steps: i, final: ri };

        const consistente = Math.abs(run - r.mensalClean) < 0.005 && Math.abs(ri - r.instalacaoClean) < 0.005;
        return { mensal, inst, impostos: { taxM: r.taxM, taxI: r.taxI }, consistente };
    }

    // ---------- STATUS DE VIABILIDADE ----------
    // Não existe no projeto uma regra comercial de "viabilidade" além da própria LPU.
    // Por isso o status usa somente fatos já presentes nas regras e nos dados:
    //   Inviável: a LPU não tem preço para a combinação escolhida.
    //   Atenção : há preço, mas alguma regra/dado exige conferência (opção ignorada pela operadora,
    //             zona rural sem distância, prazo adicional sem preço, tabela sem planilha de referência).
    //   Viável  : há preço e nenhuma das condições acima.
    function evaluateStatus(sel, r, extra) {
        const reasons = [];
        if (OPERADORAS_SEM_PLANILHA.includes(sel.op))
            reasons.push(`A tabela da ${sel.op} não foi conferida com planilha LPU. Confirme os valores.`);
        extra.ignorados.forEach(n => reasons.push(`"${n}" está marcado, mas não altera o preço para ${sel.op}.`));
        if (sel.opts.rural && !(parseFloat(sel.opts.distancia) > 0))
            reasons.push('Zona rural marcada sem distância informada. A instalação rural depende da distância.');
        extra.semPreco.forEach(p => reasons.push(`Sem valor na LPU para o prazo de ${p} meses.`));
        return reasons.length
            ? { level: 'atencao', label: 'Atenção', reasons }
            : { level: 'viavel', label: 'Viável', reasons: ['Valores encontrados na LPU, sem pendências nas regras aplicadas.'] };
    }

    // ---------- TOTAIS A EXIBIR (conforme modo de impostos) ----------
    function displayValues(r, mode) {
        const nota = r.faixa === 0.65 ? ' | Faixa > R$ 15 mil (x0,65)' : r.faixa === 0.85 ? ' | Faixa R$ 10-15 mil (x0,85)' : '';
        if (mode === 'sem') return { mensal: r.mensalClean, inst: r.instalacaoClean, rotulo: 'Sem impostos', nota };
        if (mode === 'ambos') return { mensal: r.mensalFull, inst: r.instalacaoFull, rotulo: 'Com impostos', sub: { mensal: r.mensalClean, inst: r.instalacaoClean, rotulo: 'Sem impostos' }, nota };
        return { mensal: r.mensalFull, inst: r.instalacaoFull, rotulo: 'Com impostos', nota };
    }

    // ---------- COTAÇÃO COMPLETA ----------
    // sel: { op, prod, uf, speed, dur, prazos[], opts, impostoMode }
    function buildQuote(sel, ctx) {
        const { db, Pricing } = ctx;
        const missing = [];
        if (!sel.op) missing.push('Operadora');
        if (!sel.prod) missing.push('Produto');
        if (!sel.uf) missing.push('UF');
        if (!sel.speed) missing.push('Velocidade');
        if (missing.length) {
            // Só é "Inviável" quando a LPU realmente não tem nada para operadora + produto + UF + prazo.
            if (sel.op && sel.prod && sel.uf && !db.some(i => i.o == sel.op && i.p == sel.prod && i.u == sel.uf && i.d == sel.dur)) {
                return { ok: false, motivo: 'sem_lpu', missing,
                    status: { level: 'inviavel', label: 'Inviável', reasons: [`A LPU não tem ${sel.prod} para ${sel.uf} com prazo de ${sel.dur} meses (${sel.op}).`] } };
            }
            return { ok: false, motivo: 'incompleto', missing };
        }
        const item = findItem(db, sel.op, sel.prod, sel.uf, sel.dur, sel.speed);
        if (!item) {
            return { ok: false, motivo: 'sem_lpu', missing: [],
                status: { level: 'inviavel', label: 'Inviável', reasons: [`A LPU não tem ${sel.prod} ${speedLabel(sel.speed)} para ${sel.uf} com prazo de ${sel.dur} meses (${sel.op}).`] } };
        }
        const r = Pricing.computePricing(item, sel.opts, sel.op);
        const porPrazo = sel.prazos.slice().sort((a, b) => a - b).map(d => {
            const it = findItem(db, sel.op, sel.prod, sel.uf, d, sel.speed);
            return { dur: d, ok: !!it, r: it ? Pricing.computePricing(it, sel.opts, sel.op) : null };
        });
        const extra = { ignorados: buildIgnored(sel, r), semPreco: porPrazo.filter(p => !p.ok).map(p => p.dur) };
        return {
            ok: true, sel, item, r, porPrazo,
            display: displayValues(r, sel.impostoMode),
            status: evaluateStatus(sel, r, extra),
            ignorados: extra.ignorados,
            factors: buildFactors(sel, r),
            composition: buildComposition(item, sel, r, Pricing),
            fonte: TABELAS_FONTE[sel.op] || null
        };
    }

    // ---------- COMPARAÇÃO ENTRE OPERADORAS (mesmos parâmetros, sem ranking) ----------
    function compareOperators(sel, ctx) {
        const { db, Pricing } = ctx;
        const ops = [...new Set(db.map(i => i.o))].sort();
        return ops.map(op => {
            const item = findItem(db, op, sel.prod, sel.uf, sel.dur, sel.speed);
            if (!item) return { op, ok: false };
            const r = Pricing.computePricing(item, sel.opts, op);
            return { op, ok: true, r, display: displayValues(r, sel.impostoMode), atual: op === sel.op };
        });
    }

    // ---------- TEXTOS ----------
    function characteristics(q) {
        return q.factors.filter(x => x.k !== 'speed' && !/^prazo/.test(x.k)).map(x => x.label);
    }

    // Adicionais que a pessoa MARCOU (independe de terem efeito no preço). Serve para o histórico.
    // Aceita tanto sel.opts de uma cotação nova quanto opts de um registro antigo do histórico.
    function optsLabels(o) {
        o = o || {};
        const dist = Math.max(0, parseFloat(o.distancia) || 0), ips = parseFloat(o.qtdIp) || 0, out = [];
        const add = (cond, label) => { if (cond) out.push(label); };
        add(o.shopping, 'Shopping Center');
        add(o.aeroporto, 'Aeroporto');
        add(o.industria, 'Indústria / Galpão');
        add(o.datacenter, 'Datacenter');
        add(o.rural, 'Zona rural' + (dist > 0 ? ` (${fmtNum(dist, 0)} m)` : ''));
        add(o.foraUrbana, 'Fora da zona urbana');
        add(o.cidPeq, 'Cidade pequena');
        add(o.favela, 'Favela / fibra pública subterrânea');
        add(o.fibraCurta, 'Fibra a menos de 500 m');
        add(o.provedor, 'Provedores');
        add(o.sla, 'SLA maior');
        add(o.dupla, 'Dupla abordagem');
        add(o.radio, 'Rádio homologado');
        add(o.comodato, 'Equipamento em comodato');
        add(o.mtu, 'BDL MTU 1500');
        add(ips > 0, `IPs fixos (${fmtNum(ips, 0)})`);
        return out;
    }

    // Assunto padrão do e-mail. Não cita a operadora (o e-mail vai para o cliente).
    // parts: { prod, speed, uf, prazos[], dur }. Funciona com sel e com registros antigos do histórico.
    function buildEmailSubject(parts) {
        const p = parts || {};
        const prazos = (p.prazos && p.prazos.length ? p.prazos : (p.dur ? [p.dur] : [])).slice().sort((a, b) => a - b);
        const prazo = prazos.length ? prazos.join('/') + ' meses' : '';
        return ['Cotação Sitelbra', [p.prod, p.speed ? speedLabel(p.speed) : ''].filter(Boolean).join(' '), p.uf, prazo].filter(Boolean).join(' | ');
    }

    // Resumo interno (inclui operadora)
    function buildSummaryText(q) {
        const s = q.sel, d = q.display, car = characteristics(q);
        const linhas = [
            'RESUMO DA COTAÇÃO',
            `Operadora: ${s.op}`,
            `Produto: ${s.prod}`,
            `UF: ${s.uf}`,
            `Velocidade: ${speedLabel(s.speed)}`,
            `Prazo: ${s.dur} meses`,
            `Mensalidade (${d.rotulo.toLowerCase()}): ${fmtBRL(d.mensal)}`,
            `Instalação (${d.rotulo.toLowerCase()}): ${fmtBRL(d.inst)}`
        ];
        if (d.sub) linhas.push(`Mensalidade (sem impostos): ${fmtBRL(d.sub.mensal)}`, `Instalação (sem impostos): ${fmtBRL(d.sub.inst)}`);
        linhas.push(`Características adicionais: ${car.length ? car.join(', ') : 'Nenhuma'}`);
        return linhas.join('\n');
    }

    // Texto comercial padrão ao cliente (sem nome de operadora). Mesmo conteúdo que a versão anterior.
    function buildCommercialText(q, ctx) {
        const s = q.sel;
        const blocos = q.porPrazo.map(p => {
            if (!p.ok) return `== Contrato de ${p.dur} meses ==\nValor indisponível para este prazo.`;
            const r = p.r;
            return `== Contrato de ${p.dur} meses ==\n-- Valores Com Impostos --\nMensal: ${fmtBRL(r.mensalFull)}\nInstalação: ${fmtBRL(r.instalacaoFull)}\n\n-- Valores Clean (Ref.) --\nMensal s/impostos: ${fmtBRL(r.mensalClean)}\nInstalação s/impostos: ${fmtBRL(r.instalacaoClean)}`;
        });
        return `Olá, tudo bem?\n\nSegue abaixo a cotação conforme solicitado. Validade de 30 dias.\n\nProduto: ${s.prod} ${speedLabel(s.speed)} (${s.uf})\n\n${blocos.join('\n\n')}\n\nPrazo de instalação: 60 Dias\n\nFicamos à disposição.\n\nAtenciosamente,`;
    }

    // Dados enviados à IA: somente fatos calculados (nada inventado)
    function buildAiPayload(q, textoAtual) {
        const s = q.sel, d = q.display, c = q.composition;
        const passos = steps => steps.map(p => ({ fator: p.label, efeito: p.tipo === 'add' ? fmtBRL(p.valor) : fmtPct(p.pct) }));
        return {
            produto: s.prod, uf: s.uf, velocidade: speedLabel(s.speed),
            prazos_meses: s.prazos.slice().sort((a, b) => a - b), prazo_principal_meses: s.dur,
            operadora: s.op,
            valores: {
                base: d.rotulo,
                mensalidade: fmtBRL(d.mensal), instalacao: fmtBRL(d.inst),
                mensalidade_sem_impostos: fmtBRL(q.r.mensalClean), instalacao_sem_impostos: fmtBRL(q.r.instalacaoClean),
                instalacao_dividida_pela_mensalidade: q.r.mensalClean > 0 ? Number((q.r.instalacaoClean / q.r.mensalClean).toFixed(2)) : null,
                lpu_base_mensal: fmtBRL(c.mensal.base),
                lpu_base_instalacao: c.inst.rural ? null : fmtBRL(c.inst.base)
            },
            fatores_aplicados: characteristics(q),
            composicao_mensal: passos(c.mensal.steps),
            composicao_instalacao: passos(c.inst.steps),
            instalacao_zona_rural: c.inst.rural,
            status: q.status.label, motivos_status: q.status.reasons,
            texto_comercial_atual: textoAtual || ''
        };
    }

    const api = { fmtBRL, speedLabel, fmtPct, fmtNum, findItem, buildQuote, compareOperators, buildSummaryText, buildCommercialText,
        buildAiPayload, characteristics, optsLabels, buildEmailSubject, TABELAS_FONTE, OPERADORAS_SEM_PLANILHA };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.Quote = api;

})(typeof window !== 'undefined' ? window : globalThis);
