import json,re,sys
gen=set(json.load(open('scripts/.utilitarios-gerados.json')))
src=open('src/index.css').read()

def unesc(s): return re.sub(r'\\(.)',r'\1',s)
def selector_is_utility(sel):
    sel=sel.strip()
    # aceita .a, .a.b, .a:hover, .group:hover .a  (todas as classes devem ser utilitários gerados)
    if not sel.startswith('.'): return False
    if re.search(r'[\s>~+]',sel.replace('.group:hover ','')): return False
    classes=re.findall(r'\.((?:\\.|[\w-])+)',sel)
    if not classes: return False
    pseudos=re.sub(r'\.((?:\\.|[\w-])+)','',sel)
    if pseudos not in ('',':hover',':active',':focus'): return False
    return all(unesc(c) in gen or unesc(c)=='group' for c in classes)

out=[];i=0;removed=[];n=len(src)
def parse_block(text):
    """retorna lista de (prelude, body|None) no nível atual"""
    items=[];i=0
    while i<len(text):
        # comentários
        if text.startswith('/*',i):
            j=text.index('*/',i)+2; items.append(('COMMENT',text[i:j])); i=j; continue
        if text[i].isspace():
            j=i
            while j<len(text) and text[j].isspace(): j+=1
            items.append(('WS',text[i:j])); i=j; continue
        j=text.index('{',i); prelude=text[i:j]
        depth=1;k=j+1
        while depth:
            if text[k]=='{': depth+=1
            elif text[k]=='}': depth-=1
            k+=1
        items.append(('RULE',prelude,text[j+1:k-1])); i=k
    return items

def render(items, inside_media=False):
    res=[]
    for it in items:
        if it[0] in ('COMMENT','WS'): res.append(it[1]); continue
        _,pre,body=it
        p=pre.strip()
        if p.startswith('@media'):
            inner=render(parse_block(body),True)
            if inner.strip()=='' or re.fullmatch(r'(\s|/\*.*?\*/)*',inner,re.S):
                removed.append(p+' {vazio}'); continue
            res.append(f'{pre}{{{inner}}}'); continue
        if p.startswith('@'):
            res.append(f'{pre}{{{body}}}'); continue
        sels=[s for s in p.split(',')]
        keep=[s for s in sels if not selector_is_utility(s)]
        if not keep:
            removed.append(p); continue
        if len(keep)!=len(sels):
            removed.append('parcial: '+p)
            pre=pre.replace(p, ','.join(k.strip() for k in keep))
        res.append(f'{pre}{{{body}}}')
    return ''.join(res)

new=render(parse_block(src))
new=re.sub(r'\n{3,}','\n\n',new)
open('src/index.css','w').write(new)
print(len(removed),'regras removidas/podadas')
print('\n'.join(removed[:400]))
