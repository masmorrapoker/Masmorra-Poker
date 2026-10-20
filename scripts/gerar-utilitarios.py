#!/usr/bin/env python3
"""
Gera src/styles/utilities.css com as classes utilitárias (padrão Tailwind v2/v3)
realmente usadas no código, sem depender de pacote externo.

Por quê: o JSX usa classes no estilo Tailwind, mas o Tailwind nunca foi
instalado. Parte das classes existia escrita à mão em index.css (algumas
duplicadas e com valores conflitantes) e ~250 não existiam.

Uso:  python3 scripts/gerar-utilitarios.py
      (varre src/**/*.tsx, gera src/styles/utilities.css e imprime as classes
       que não reconheceu, para revisão manual)
"""
import glob
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "styles" / "utilities.css"

# --------------------------------------------------------------------- tema
SPACING = {"0": "0px", "px": "1px", "0.5": "0.125rem", "1": "0.25rem", "1.5": "0.375rem",
           "2": "0.5rem", "2.5": "0.625rem", "3": "0.75rem", "3.5": "0.875rem", "4": "1rem",
           "5": "1.25rem", "6": "1.5rem", "7": "1.75rem", "8": "2rem", "9": "2.25rem",
           "10": "2.5rem", "11": "2.75rem", "12": "3rem", "14": "3.5rem", "16": "4rem",
           "20": "5rem", "24": "6rem", "28": "7rem", "32": "8rem", "36": "9rem", "40": "10rem",
           "44": "11rem", "48": "12rem", "52": "13rem", "56": "14rem", "60": "15rem",
           "64": "16rem", "72": "18rem", "80": "20rem", "96": "24rem"}
FRACTIONS = {"1/2": "50%", "1/3": "33.333333%", "2/3": "66.666667%", "1/4": "25%",
             "3/4": "75%", "full": "100%"}
FONT_SIZE = {"xs": ("0.75rem", "1rem"), "sm": ("0.875rem", "1.25rem"), "base": ("1rem", "1.5rem"),
             "lg": ("1.125rem", "1.75rem"), "xl": ("1.25rem", "1.75rem"), "2xl": ("1.5rem", "2rem"),
             "3xl": ("1.875rem", "2.25rem"), "4xl": ("2.25rem", "2.5rem"), "5xl": ("3rem", "1"),
             "6xl": ("3.75rem", "1")}
MAX_W = {"xs": "20rem", "sm": "24rem", "md": "28rem", "lg": "32rem", "xl": "36rem", "2xl": "42rem",
         "3xl": "48rem", "4xl": "56rem", "5xl": "64rem", "6xl": "72rem", "7xl": "80rem",
         "full": "100%", "max": "max-content", "none": "none"}
RADIUS = {"": "0.25rem", "none": "0px", "sm": "0.125rem", "md": "0.375rem", "lg": "0.5rem",
          "xl": "0.75rem", "2xl": "1rem", "3xl": "1.5rem", "full": "9999px"}
WEIGHT = {"normal": 400, "medium": 500, "semibold": 600, "bold": 700, "extrabold": 800, "black": 900}
TRACKING = {"tighter": "-0.05em", "tight": "-0.025em", "normal": "0em", "wide": "0.025em",
            "wider": "0.05em", "widest": "0.1em"}
LEADING = {"none": "1", "tight": "1.25", "snug": "1.375", "normal": "1.5", "relaxed": "1.625",
           "loose": "2"}
SHADOW = {"sm": "0 1px 2px 0 rgba(0,0,0,0.05)",
          "": "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)",
          "md": "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
          "lg": "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
          "xl": "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
          "2xl": "0 25px 50px -12px rgba(0,0,0,0.25)", "none": "none"}
BLUR = {"sm": "4px", "": "8px", "md": "12px", "lg": "16px", "xl": "24px", "2xl": "40px"}
BREAKPOINTS = {"sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px"}

# Cores: (r, g, b, alfa base). Cores do tema vêm das variáveis do :root de index.css.
COLORS = {
    "primary": (59, 130, 246, 1), "success": (16, 185, 129, 1), "danger": (239, 68, 68, 1),
    "warning": (245, 158, 11, 1), "muted": (148, 163, 184, 1), "dark": (15, 23, 42, 1),
    "card": (30, 41, 59, 0.7), "glass-border": (255, 255, 255, 0.08),
    "white": (255, 255, 255, 1), "black": (0, 0, 0, 1),
    "blue-400": (96, 165, 250, 1), "blue-500": (59, 130, 246, 1), "blue-600": (37, 99, 235, 1),
    "purple-400": (192, 132, 252, 1), "purple-500": (168, 85, 247, 1),
    "orange-400": (251, 146, 60, 1), "emerald-400": (52, 211, 153, 1),
}

DISPLAY = {"block": "block", "inline-block": "inline-block", "inline": "inline", "flex": "flex",
           "inline-flex": "inline-flex", "grid": "grid", "hidden": "none", "contents": "contents"}


def esc(cls: str) -> str:
    return re.sub(r"([:./\[\]%#(),!])", r"\\\1", cls)


def color_value(name: str, var: str):
    r, g, b, a = COLORS[name]
    alpha = f"var({var})" if a == 1 else f"calc({a} * var({var}))"
    return f"rgba({r}, {g}, {b}, {alpha})"


def arbitrary(v: str) -> str:
    return v.replace("_", " ")


def spacing(v: str):
    if v in SPACING:
        return SPACING[v]
    if v in FRACTIONS:
        return FRACTIONS[v]
    if v.startswith("[") and v.endswith("]"):
        return arbitrary(v[1:-1])
    return None


def base_rule(u: str):
    """Declarações CSS para o utilitário `u` (sem variantes). None se não reconhecido.
    Retorna (declarações, ordem) — a ordem garante que *-opacity venha depois das cores."""
    neg = u.startswith("-")
    core = u[1:] if neg else u

    def n(v):
        return f"-{v}" if neg and v not in ("0px", "0") else v

    if core in DISPLAY:
        return f"display: {DISPLAY[core]};", 1
    simple = {
        "flex-row": "flex-direction: row;", "flex-col": "flex-direction: column;",
        "flex-wrap": "flex-wrap: wrap;", "flex-1": "flex: 1 1 0%;", "flex-shrink-0": "flex-shrink: 0;",
        "shrink-0": "flex-shrink: 0;", "flex-grow": "flex-grow: 1;",
        "items-start": "align-items: flex-start;", "items-center": "align-items: center;",
        "items-end": "align-items: flex-end;", "items-baseline": "align-items: baseline;",
        "items-stretch": "align-items: stretch;",
        "justify-start": "justify-content: flex-start;", "justify-center": "justify-content: center;",
        "justify-end": "justify-content: flex-end;", "justify-between": "justify-content: space-between;",
        "justify-around": "justify-content: space-around;",
        "self-start": "align-self: flex-start;", "self-center": "align-self: center;",
        "relative": "position: relative;", "absolute": "position: absolute;", "fixed": "position: fixed;",
        "sticky": "position: sticky;", "static": "position: static;",
        "overflow-hidden": "overflow: hidden;", "overflow-visible": "overflow: visible;",
        "overflow-auto": "overflow: auto;", "overflow-y-auto": "overflow-y: auto;",
        "overflow-x-auto": "overflow-x: auto;",
        "truncate": "overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
        "whitespace-nowrap": "white-space: nowrap;", "break-words": "overflow-wrap: break-word;",
        "uppercase": "text-transform: uppercase;", "lowercase": "text-transform: lowercase;",
        "capitalize": "text-transform: capitalize;", "italic": "font-style: italic;",
        "line-through": "text-decoration-line: line-through;", "underline": "text-decoration-line: underline;",
        "no-underline": "text-decoration-line: none;",
        "text-left": "text-align: left;", "text-center": "text-align: center;", "text-right": "text-align: right;",
        "font-mono": "font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;",
        "text-current": "color: currentColor;",
        "object-contain": "object-fit: contain;", "object-cover": "object-fit: cover;",
        "resize-none": "resize: none;",
        "cursor-pointer": "cursor: pointer;", "cursor-not-allowed": "cursor: not-allowed;",
        "pointer-events-none": "pointer-events: none;", "pointer-events-auto": "pointer-events: auto;",
        "select-none": "user-select: none;",
        "w-auto": "width: auto;", "flex-initial": "flex: 0 1 auto;", "flex-none": "flex: none;", "h-max": "height: max-content;", "w-max": "width: max-content;", "transform": "", "group": "", "h-auto": "height: auto;", "w-screen": "width: 100vw;",
        "h-screen": "height: 100vh;", "min-h-screen": "min-height: 100vh;", "min-w-0": "min-width: 0px;",
        "mx-auto": "margin-left: auto; margin-right: auto;", "ml-auto": "margin-left: auto;",
        "mr-auto": "margin-right: auto;", "mt-auto": "margin-top: auto;",
        "border": "border-width: 1px; border-style: solid;", "border-0": "border-width: 0px;",
        "border-2": "border-width: 2px; border-style: solid;",
        "border-4": "border-width: 4px; border-style: solid;",
        "border-t": "border-top-width: 1px; border-top-style: solid;",
        "border-b": "border-bottom-width: 1px; border-bottom-style: solid;",
        "border-l": "border-left-width: 1px; border-left-style: solid;",
        "border-r": "border-right-width: 1px; border-right-style: solid;",
        "border-t-4": "border-top-width: 4px; border-top-style: solid;",
        "border-l-4": "border-left-width: 4px; border-left-style: solid;",
        "border-none": "border-style: none;", "border-transparent": "border-color: transparent;",
        "border-t-transparent": "border-top-color: transparent;",
        "bg-transparent": "background-color: transparent;",
        "transition": "transition-property: color, background-color, border-color, opacity, box-shadow, transform; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms;",
        "transition-all": "transition-property: all; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms;",
        "transition-colors": "transition-property: color, background-color, border-color; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms;",
        "transition-opacity": "transition-property: opacity; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms;",
        "transition-transform": "transition-property: transform; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms;",
        "duration-200": "transition-duration: 200ms;", "duration-300": "transition-duration: 300ms;",
        "rotate-180": "transform: rotate(180deg);",
        "bg-gradient-to-br": "background-image: linear-gradient(to bottom right, var(--tw-gradient-stops));",
        "bg-gradient-to-r": "background-image: linear-gradient(to right, var(--tw-gradient-stops));",
        "divide-y": None,  # tratado à parte (seletor filho)
        "inset-0": "inset: 0px;", "inset-x-0": "left: 0px; right: 0px;", "inset-y-0": "top: 0px; bottom: 0px;",
        "grid-cols-1": "grid-template-columns: repeat(1, minmax(0, 1fr));",
        "col-span-full": "grid-column: 1 / -1;",
        "backdrop-blur": "backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);",
        "sr-only": "position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border-width: 0;",
    }
    if core in simple:
        if simple[core] is None:
            return None
        return (simple[core], 1) if simple[core] else ("/* marcador */", 1)

    m = re.fullmatch(r"grid-cols-(\d+)", core)
    if m:
        return f"grid-template-columns: repeat({m[1]}, minmax(0, 1fr));", 1
    m = re.fullmatch(r"col-span-(\d+)", core)
    if m:
        return f"grid-column: span {m[1]} / span {m[1]};", 1
    m = re.fullmatch(r"z-(\d+|\[\d+\])", core)
    if m:
        return f"z-index: {m[1].strip('[]')};", 1
    m = re.fullmatch(r"opacity-(\d+)", core)
    if m:
        return f"opacity: {int(m[1]) / 100};", 1

    # espaçamento
    m = re.fullmatch(r"(gap-x|gap-y|gap|px|py|pt|pb|pl|pr|p|mx|my|mt|mb|ml|mr|m)-(.+)", core)
    if m and spacing(m[2]) is not None:
        v = n(spacing(m[2]))
        props = {"p": ["padding"], "px": ["padding-left", "padding-right"],
                 "py": ["padding-top", "padding-bottom"], "pt": ["padding-top"], "pb": ["padding-bottom"],
                 "pl": ["padding-left"], "pr": ["padding-right"], "m": ["margin"],
                 "mx": ["margin-left", "margin-right"], "my": ["margin-top", "margin-bottom"],
                 "mt": ["margin-top"], "mb": ["margin-bottom"], "ml": ["margin-left"], "mr": ["margin-right"],
                 "gap": ["gap"], "gap-x": ["column-gap"], "gap-y": ["row-gap"]}[m[1]]
        return " ".join(f"{p}: {v};" for p in props), 1
    m = re.fullmatch(r"(top|bottom|left|right)-(.+)", core)
    if m and spacing(m[2]) is not None:
        return f"{m[1]}: {n(spacing(m[2]))};", 1
    m = re.fullmatch(r"(w|h|min-h|max-h|min-w)-(.+)", core)
    if m:
        prop = {"w": "width", "h": "height", "min-h": "min-height", "max-h": "max-height",
                "min-w": "min-width"}[m[1]]
        v = spacing(m[2])
        if v is not None:
            return f"{prop}: {v};", 1
    m = re.fullmatch(r"max-w-(.+)", core)
    if m:
        v = MAX_W.get(m[1]) or (arbitrary(m[1][1:-1]) if m[1].startswith("[") else None)
        if v:
            return f"max-width: {v};", 1

    # texto
    m = re.fullmatch(r"text-(xs|sm|base|lg|xl|[2-6]xl)", core)
    if m:
        size, lh = FONT_SIZE[m[1]]
        return f"font-size: {size}; line-height: {lh};", 1
    m = re.fullmatch(r"text-\[(\d+(?:\.\d+)?px)\]", core)
    if m:
        return f"font-size: {m[1]};", 1
    m = re.fullmatch(r"font-(normal|medium|semibold|bold|extrabold|black)", core)
    if m:
        return f"font-weight: {WEIGHT[m[1]]};", 1
    m = re.fullmatch(r"tracking-(\w+)", core)
    if m and m[1] in TRACKING:
        return f"letter-spacing: {TRACKING[m[1]]};", 1
    m = re.fullmatch(r"leading-(\w+)", core)
    if m and m[1] in LEADING:
        return f"line-height: {LEADING[m[1]]};", 1

    # cores (com opacidade por variável, como no Tailwind)
    m = re.fullmatch(r"(border-l|border-t|border|bg|text|from|to|divide)-(.+)", core)
    if m and m[2] in COLORS:
        kind, name = m[1], m[2]
        if kind == "bg":
            return f"--tw-bg-opacity: 1; background-color: {color_value(name, '--tw-bg-opacity')};", 1
        if kind == "text":
            return f"--tw-text-opacity: 1; color: {color_value(name, '--tw-text-opacity')};", 1
        if kind == "border":
            return f"--tw-border-opacity: 1; border-color: {color_value(name, '--tw-border-opacity')};", 1
        if kind == "border-l":
            return f"border-left-color: {color_value(name, '--tw-border-opacity, 1')};".replace("var(--tw-border-opacity, 1)", "1"), 1
        if kind == "border-t":
            return f"border-top-color: {color_value(name, '--tw-border-opacity, 1')};".replace("var(--tw-border-opacity, 1)", "1"), 1
        r, g, b, a = COLORS[name]
        if kind == "from":
            return (f"--tw-gradient-from: rgba({r}, {g}, {b}, {a}); "
                    f"--tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba({r}, {g}, {b}, 0));"), 1
        if kind == "to":
            return f"--tw-gradient-to: rgba({r}, {g}, {b}, {a});", 1
        if kind == "divide":
            return None
    m = re.fullmatch(r"(bg|text|border)-opacity-(\d+|\[[\d.]+\])", core)
    if m:
        raw = m[2]
        val = raw[1:-1] if raw.startswith("[") else str(int(raw) / 100)
        return f"--tw-{m[1]}-opacity: {val};", 2

    # bordas arredondadas
    m = re.fullmatch(r"rounded(?:-(none|sm|md|lg|xl|2xl|3xl|full))?", core)
    if m:
        return f"border-radius: {RADIUS[m[1] or '']};", 1
    m = re.fullmatch(r"rounded-(t|b|l|r|tl|tr|bl|br)-(none|sm|md|lg|xl|2xl|3xl|full)", core)
    if m:
        corners = {"t": ["top-left", "top-right"], "b": ["bottom-left", "bottom-right"],
                   "l": ["top-left", "bottom-left"], "r": ["top-right", "bottom-right"],
                   "tl": ["top-left"], "tr": ["top-right"], "bl": ["bottom-left"], "br": ["bottom-right"]}[m[1]]
        return " ".join(f"border-{c}-radius: {RADIUS[m[2]]};" for c in corners), 1

    # sombras
    m = re.fullmatch(r"shadow(?:-(sm|md|lg|xl|2xl|none))?", core)
    if m:
        return f"box-shadow: {SHADOW[m[1] or '']};", 1
    m = re.fullmatch(r"shadow-\[(.+)\]", core)
    if m:
        return f"box-shadow: {arbitrary(m[1])};", 1
    m = re.fullmatch(r"shadow-(primary|success|warning|danger)/(\d+)", core)
    if m:
        r, g, b, _ = COLORS[m[1]]
        a = int(m[2]) / 100
        return f"box-shadow: 0 20px 25px -5px rgba({r},{g},{b},{a}), 0 8px 10px -6px rgba({r},{g},{b},{a});", 1

    # desfoque
    m = re.fullmatch(r"(backdrop-)?blur(?:-(sm|md|lg|xl|2xl))?", core)
    if m:
        v = BLUR[m[2] or ""]
        if m[1]:
            return f"backdrop-filter: blur({v}); -webkit-backdrop-filter: blur({v});", 1
        return f"filter: blur({v});", 1
    m = re.fullmatch(r"blur-\[(.+)\]", core)
    if m:
        return f"filter: blur({m[1]});", 1

    # transformações (compostas por variáveis)
    m = re.fullmatch(r"scale-(\d+|\[[\d.]+\])", core)
    if m:
        raw = m[1]
        val = raw[1:-1] if raw.startswith("[") else str(int(raw) / 100)
        return f"--tw-scale: {val}; transform: translate(var(--tw-tx, 0), var(--tw-ty, 0)) scale(var(--tw-scale));", 1
    m = re.fullmatch(r"translate-(x|y)-(.+)", core)
    if m and spacing(m[2]) is not None:
        var = "--tw-tx" if m[1] == "x" else "--tw-ty"
        return f"{var}: {n(spacing(m[2]))}; transform: translate(var(--tw-tx, 0), var(--tw-ty, 0)) scale(var(--tw-scale, 1));", 1

    # animação de giro lento (logo)
    if core == "animate-spin-slow":
        return "animation: spin-slow 8s linear infinite;", 1
    if core == "animate-spin":
        return "animation: spin 1s linear infinite;", 1
    return None


VARIANT_PSEUDO = {"hover": ":hover", "active": ":active", "focus": ":focus",
                  "first": ":first-child", "last": ":last-child", "disabled": ":disabled"}


def rule_for(cls: str):
    """CSS completo para a classe (com variantes responsivas/estado) ou None."""
    parts = cls.split(":")
    utility, variants = parts[-1], parts[:-1]
    media = None
    pseudo = ""
    group = False
    for v in variants:
        if v in BREAKPOINTS:
            media = BREAKPOINTS[v]
        elif v in VARIANT_PSEUDO:
            pseudo += VARIANT_PSEUDO[v]
        elif v == "group-hover":
            group = True
        else:
            return None

    selector = "." + esc(cls) + pseudo
    if group:
        selector = ".group:hover " + selector

    # utilitários de filhos
    m = re.fullmatch(r"space-(y|x)-(.+)", utility)
    if m and spacing(m[2]) is not None:
        prop = "margin-top" if m[1] == "y" else "margin-left"
        body = f"{selector} > :not([hidden]) ~ :not([hidden]) {{ {prop}: {spacing(m[2])}; }}"
        order = 1
    elif utility == "divide-y":
        body = f"{selector} > :not([hidden]) ~ :not([hidden]) {{ border-top-width: 1px; border-top-style: solid; }}"
        order = 1
    elif utility.startswith("divide-") and utility[7:] in COLORS:
        r, g, b, a = COLORS[utility[7:]]
        body = f"{selector} > :not([hidden]) ~ :not([hidden]) {{ border-color: rgba({r}, {g}, {b}, {a}); }}"
        order = 1
    else:
        res = base_rule(utility)
        if not res:
            return None
        decl, order = res
        body = f"{selector} {{ {decl} }}"

    if media:
        body = f"@media (min-width: {media}) {{ {body} }}"
    return body, order, media


# ---------------------------------------------------------------- execução
def collect_classes():
    used = set()
    for f in glob.glob(str(ROOT / "src" / "**" / "*.tsx"), recursive=True):
        src = open(f, encoding="utf-8").read()
        for m in re.findall(r'className=(?:"([^"]*)"|\{`([^`]*)`\})', src):
            text = re.sub(r"\$\{[^}]*\}", " ", " ".join(m))
            used.update(text.split())
        # classes dentro de expressões em template strings: '...' e "..." curtos
        for m in re.findall(r"\{`([^`]*)`\}", src):
            for lit in re.findall(r"'([^']*)'", m):
                used.update(lit.split())
    return used


def main():
    used = collect_classes()
    generated, unknown = [], []
    for cls in sorted(used):
        r = rule_for(cls)
        if r:
            generated.append((cls, *r))
        else:
            unknown.append(cls)

    # ordem: base sem media -> por breakpoint crescente; dentro, cores antes de *-opacity
    bp_order = {None: 0, "640px": 1, "768px": 2, "1024px": 3, "1280px": 4}
    generated.sort(key=lambda t: (bp_order[t[3]], t[2], ":" in t[0], t[0]))

    header = (
        "/* GERADO por scripts/gerar-utilitarios.py — não editar à mão.\n"
        " * Classes utilitárias (padrão Tailwind) usadas no código. Rode o script\n"
        " * de novo sempre que usar uma classe utilitária nova. */\n\n"
        "@keyframes spin { to { transform: rotate(360deg); } }\n\n"
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(header + "\n".join(g[1] for g in generated) + "\n", encoding="utf-8")
    (ROOT / "scripts" / ".utilitarios-gerados.json").write_text(
        json.dumps(sorted(g[0] for g in generated), indent=0), encoding="utf-8")
    print(f"{len(generated)} utilitários gerados em {OUT.relative_to(ROOT)}")
    print(f"{len(unknown)} classes não reconhecidas (componentes ou revisar):")
    print(" ".join(unknown))


if __name__ == "__main__":
    sys.exit(main())
