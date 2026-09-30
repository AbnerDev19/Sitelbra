const fs=require('fs'), vm=require('vm');
const dir=__dirname+'/../';
const ctx={window:{},console:{log(){}}}; ctx.window=ctx; ctx.globalThis=ctx;
vm.createContext(ctx);
for (const f of ['lpu_config.js','pricing.js','lpu_vivo.js','lpu_claro.js','lpu_cirion.js','lpu_oi.js','lpu_geral.js'])
  vm.runInContext(fs.readFileSync(dir+f,'utf8'),ctx,{filename:f});
const DB=ctx.LPU_DB, P=ctx.Pricing;
const find=(o,p,u,d,s)=>DB.find(i=>i.o==o&&i.p==p&&i.u==u&&i.d==d&&i.s==s);
const cnt={}; DB.forEach(i=>cnt[i.o]=(cnt[i.o]||0)+1); console.log('entradas',cnt);
let fails=0;
function eq(name,got,exp,tol=0.01){ const ok=Math.abs(got-exp)<=tol; if(!ok){fails++;console.log('FALHA',name,'got',got,'esperado',exp);} else console.log('ok   ',name,got.toFixed(2)); }
// ---- casos das abas de Projeto Especial (valores em cache da planilha) ----
// Claro/Vivo "Projeto Especial - Abner": L2 DF 50M 12m; fora urbana + indústria
let it=find('Claro','L2-MPLS','DF',12,50);
let r=P.computePricing(it,{foraUrbana:true,industria:true},'Claro');
eq('Abner mensal',r.mensalClean,1677.36096); eq('Abner inst',r.instalacaoClean,6020); eq('Abner mensal bruto',r.mensalFull,1740.9039543331603); eq('Abner inst bruta',r.instalacaoFull,7020.408163265306);
// Kamila/Base: B9 digitado na planilha (1518.943536), inst LPU 3000 (Kamila) / 2100 (Base)
const mk=(m,i)=>({m:{c:m,f:m/0.9635},i:{c:i,f:i/0.8575}});
r=P.computePricing(mk(1518.943536,3000),{foraUrbana:true,industria:true,cidPeq:true,rural:true,distancia:6000},'Claro');
eq('Kamila mensal',r.mensalClean,6736.8183708671995); eq('Kamila inst urbana',r.instUrbana,8540); eq('Kamila inst rural',r.instRural,25900); eq('Kamila inst bruta urbana',r.instUrbana*r.taxI,9959.183673469388);
r=P.computePricing(mk(1518.943536,2100),{foraUrbana:true,industria:true,rural:true,distancia:5000},'Claro');
eq('Base mensal',r.mensalClean,4374.5573836799995); eq('Base inst urbana',r.instUrbana,6020); eq('Base inst rural',r.instRural,22250); eq('Base inst rural bruta',r.instRural*r.taxI,25947.52186588921);
// Emilly (Cirion-like): B9=411.38 fora urbana, 2000 m -> J=1.4
r=P.computePricing(mk(411.38,11000),{foraUrbana:true,rural:true,distancia:2000},'Claro');
eq('Emilly mensal',r.mensalClean,691.1183999999998); eq('Emilly inst rural',r.instRural,7800);
// Cirion "Projeto Especial - Abner" impostos = /(1-.2365)
it=find('Cirion','L2-MPLS','DF',12,100); r=P.computePricing(it,{},'Cirion'); eq('Cirion razão mensal',r.taxM,1/(1-0.2365),0.0005);
it=find('Geral','L2-MPLS','DF',12,100); r=P.computePricing(it,{},'Geral'); eq('Geral razão mensal',r.taxM,1/0.7485,0.0005); eq('Geral razão inst',r.taxI,1/0.8575,0.0005);
it=find('Claro','L2-MPLS','DF',12,100); r=P.computePricing(it,{},'Claro'); eq('Claro razão mensal',r.taxM,1/0.9635,0.0005);
// faixas
it=find('Claro','IP DEDICADO','DF',12,1000); r=P.computePricing(it,{shopping:true},'Claro'); console.log('faixa shopping 1G IP DF:',r.mensalAntesFaixa.toFixed(2),r.faixa,r.mensalClean.toFixed(2));
// aeroporto
it=find('Claro','L2-MPLS','DF',12,50); r=P.computePricing(it,{aeroporto:true},'Claro'); eq('Aeroporto mensal = 3x',r.mensalClean,it.m.c*3); eq('Aeroporto inst',r.instalacaoClean,it.i.c+2*it.m.c);
// IPs
r=P.computePricing(it,{qtdIp:4},'Claro'); eq('IP x4 mensal',r.mensalClean,it.m.c+225); eq('IP x4 inst',r.instalacaoClean,it.i.c+40);
r=P.computePricing(it,{qtdIp:4},'Cirion'); eq('Cirion IP x4 mensal',r.mensalClean,it.m.c+180); eq('Cirion IP inst',r.instalacaoClean,it.i.c);
console.log(fails?('FALHAS: '+fails):'TODOS OS TESTES PASSARAM');
