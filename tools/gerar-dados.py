#!/usr/bin/env python3
"""Gera os arquivos de dados do site a partir das planilhas.

Uso (na pasta do projeto):
    python3 tools/gerar-dados.py <rede_propria.xlsx> <norte.xlsx> <acima_2gbps.xlsx>

Saída:
    cidades-data.js    cidades com rede própria + regras das cidades do Norte
    lpu_acima2g.js     LPU acima de 2 Gbps (IP Dedicado e L2-MPLS, 24 meses, iguais p/ todas as operadoras)

Precisa de: pip install openpyxl
"""
import sys, json, re, unicodedata, os
import openpyxl

def norm(s):
    s = unicodedata.normalize('NFD', str(s)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

PEQUENAS = {'de', 'da', 'do', 'das', 'dos', 'e'}
SIGLAS = {'sia': 'SIA'}
ACENTOS = {'brazlandia': 'Brazlândia', 'ceilandia': 'Ceilândia', 'guara': 'Guará', 'varjao': 'Varjão',
           'bancario': 'Bancário', 'areas': 'Áreas', 'botanico': 'Botânico', 'sebastiao': 'Sebastião',
           'paranoa': 'Paranoá', 'brasilia': 'Brasília', 'nucleo': 'Núcleo', 'goiania': 'Goiânia',
           'luziania': 'Luziânia', 'neropolis': 'Nerópolis', 'rondonopolis': 'Rondonópolis', 'tres': 'Três'}

def titulo(s):
    """Nome para exibir. Só mexe em nomes todos em maiúsculas: 'SETOR DE AREAS COMPLEMENTARES' -> 'Setor de Áreas Complementares'."""
    s = str(s).strip()
    if not s.isupper():
        return s
    out = []
    for i, t in enumerate(s.lower().split()):
        if t in SIGLAS: out.append(SIGLAS[t])
        elif re.fullmatch(r'[ivx]+', t): out.append(t.upper())          # I, II, III
        elif i and t in PEQUENAS: out.append(t)
        elif t in ACENTOS: out.append(ACENTOS[t])
        else: out.append(t.capitalize())
    return ' '.join(out)

# ---------------------------------------------------------------- rede própria
def rede_propria(path):
    ws = openpyxl.load_workbook(path, data_only=True).active
    por_uf, vistos = {}, set()
    for r in range(4, ws.max_row + 1):
        uf, cid, org = ws.cell(r, 2).value, ws.cell(r, 3).value, ws.cell(r, 4).value
        if not uf or not cid:
            continue
        uf, cid = str(uf).strip().upper(), str(cid).strip()
        chave = (uf, norm(cid))
        if chave in vistos:          # a planilha repete cidades (ex.: BRASILIA / Brasília)
            # se a repetição traz acentos e a primeira não, fica com o nome acentuado
            ant = next(x for x in por_uf[uf] if norm(x[0]) == chave[1])
            if ant[0].isascii() and not cid.isascii():
                ant[0] = cid
            continue
        vistos.add(chave)
        por_uf.setdefault(uf, []).append([cid, str(org).strip() if org else ''])
    # nomes todos em maiúsculas viram "Capitalizado" (sem inventar acentos)
    for uf, lst in por_uf.items():
        for it in lst:
            it[0] = titulo(it[0])
        lst.sort(key=lambda x: norm(x[0]))
    return por_uf

# ---------------------------------------------------------------- norte
BLOCOS = {'AM': 1, 'RO': 4, 'AP': 7, 'AC': 10, 'RR': 13, 'PA': 16}   # coluna inicial de cada estado (Cidade, >20, <=20)
CORRECOES = {'Boa vista': 'Boa Vista', 'Rorainopolis': 'Rorainópolis'}  # erros de digitação na planilha

def regra(v):
    """Converte a célula da planilha numa regra: 1 = LPU normal | número = multiplicador | 'INV' | 'SAT' | 'NAO'."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    t = str(v).strip().upper()
    if t == 'SIM':
        return 1
    m = re.match(r'^X\s*([\d]+(?:[.,]\d+)?)$', t)
    if m:
        return float(m.group(1).replace(',', '.'))
    if t.startswith('INVI'):
        return 'INV'
    if 'SAT' in t:
        return 'SAT'
    if t == 'N':
        return 'NAO'
    raise ValueError(f'valor não reconhecido na planilha do Norte: {v!r}')

def norte(path):
    ws = openpyxl.load_workbook(path, data_only=True).active
    out = {}
    for uf, c0 in BLOCOS.items():
        cidades, demais = {}, None
        for r in range(3, ws.max_row + 1):
            nome = ws.cell(r, c0).value
            if nome is None:
                continue
            nome = str(nome).strip()
            if nome.upper().startswith('QUALQUER CIDADE'):
                continue
            par = [regra(ws.cell(r, c0 + 1).value), regra(ws.cell(r, c0 + 2).value)]
            if par[0] is None or par[1] is None:
                continue
            if norm(nome) == 'demais':
                demais = par
            else:
                cidades[CORRECOES.get(nome, nome)] = par
        out[uf] = {'cidades': cidades, 'demais': demais}
    # rodapé da coluna do Amazonas: "QUALQUER CIDADE NÃO LISTADA ACIMA SOMENTE STARLINK"
    ws_txt = [str(ws.cell(r, 1).value or '') for r in range(1, ws.max_row + 1)]
    if any('SOMENTE STARLINK' in t.upper() for t in ws_txt) and out['AM']['demais'] is None:
        out['AM']['demais'] = ['STAR', 'STAR']
    return out

# ---------------------------------------------------------------- acima de 2 Gbps
VELS = [(2000, 'C', 'D'), (3000, 'E', 'F'), (4000, 'G', 'H'), (5000, 'I', 'J'), (6000, 'K', 'L'), (10000, 'M', 'N'), (20000, 'O', 'P')]
ABAS = {'IP DEDICADO': 'LINK IP', 'L2-MPLS': 'LINK VPN - L2 - MPLS'}

def acima_2g(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    out = {}
    for prod, aba in ABAS.items():
        ws = wb[aba]
        tab = {}
        for r in range(4, 31):
            uf = ws[f'B{r}'].value
            if not uf:
                continue
            tab[uf] = {str(v): [round(ws[f'{cs}{r}'].value, 4), round(ws[f'{cc}{r}'].value, 4)] for v, cs, cc in VELS}
        out[prod] = tab
    return out

def main():
    if len(sys.argv) != 4:
        print(__doc__); sys.exit(1)
    p_rede, p_norte, p_2g = sys.argv[1:]
    raiz = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
    rede, nor = rede_propria(p_rede), norte(p_norte)
    with open(os.path.join(raiz, 'cidades-data.js'), 'w', encoding='utf-8') as f:
        f.write('// cidades-data.js - GERADO por tools/gerar-dados.py. Não edite à mão: rode o script com as planilhas novas.\n')
        f.write('// REDE: { UF: [[cidade, origem], ...] }   NORTE: { UF: { cidades: {nome: [>20 Mb, <=20 Mb]}, demais: [..] } }\n')
        f.write('// Regra: 1 = LPU normal | número = multiplicador | "INV" = inviável | "SAT" = apenas satélite | "NAO" = não atende | "STAR" = somente Starlink\n')
        f.write('window.CIDADES_REDE_PROPRIA = ' + json.dumps(rede, ensure_ascii=False, separators=(',', ':')) + ';\n')
        f.write('window.CIDADES_NORTE = ' + json.dumps(nor, ensure_ascii=False, separators=(',', ':')) + ';\n')
    dados = acima_2g(p_2g)
    with open(os.path.join(raiz, 'lpu_acima2g.js'), 'w', encoding='utf-8') as f:
        f.write('// lpu_acima2g.js - GERADO por tools/gerar-dados.py a partir da planilha "LPU - Velocidade acima de 2Gbps".\n')
        f.write('// Só IP Dedicado e L2-MPLS, só 24 meses, região urbana. Valores iguais para todas as operadoras.\n')
        f.write('// A planilha NÃO traz instalação: as entradas ficam marcadas semInst (a tela mostra "Sob consulta").\n')
        f.write('// [mensal s/ impostos, mensal c/ impostos] por UF e velocidade (Mbps).\n')
        f.write('window.LPU_ACIMA_2G = ' + json.dumps(dados, separators=(',', ':')) + ';\n')
        f.write('if (window.loadLpuAcima2G) window.loadLpuAcima2G();\n')
    print('rede própria:', sum(len(v) for v in rede.values()), 'cidades em', len(rede), 'UFs')
    print('norte:', {uf: len(v['cidades']) for uf, v in nor.items()}, '| demais:', {uf: v['demais'] for uf, v in nor.items()})
    print('acima de 2G:', {p: len(t) for p, t in dados.items()}, 'UFs')

if __name__ == '__main__':
    main()
