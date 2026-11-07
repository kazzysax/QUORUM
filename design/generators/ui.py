# Shared pieces for the Quorum app artboards (one look across every page).
BG="#0A0A0D"; PANEL="#15151B"; PANEL2="#1D1D25"; BORDER="#2A2A33"; MUTED="#A1A1AA"; TEXT="#F4F4F5"; ACCENT="#F5A524"
HEAD='font-family: &quot;Space Grotesk&quot;, sans-serif'

def ic(path, size=22):
    return f'<svg aria-hidden="true" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{path}</svg>'

ICONS={
 "Portfolio":'<path d="M21 12a9 9 0 1 1-9-9v9z"></path><path d="M14 3.3A9 9 0 0 1 20.7 10H14z"></path>',
 "Launch":'<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"></path><path d="M9 15l-3-3a12 12 0 0 1 12-9 12 12 0 0 1-9 12z"></path><circle cx="15" cy="9" r="1.5"></circle>',
 "Votings":'<rect x="4" y="3" width="16" height="18" rx="2"></rect><path d="M8.5 12l2.5 2.5 4.5-5"></path>',
 "Offers":'<path d="M3 12V4h8l10 10-8 8z"></path><circle cx="7.5" cy="8" r="1.4"></circle>',
 "Sells":'<path d="M4 20h16"></path><path d="M7 16l10-10"></path><path d="M9 6h8v8"></path>',
 "Marketplace":'<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect>',
}
WALLET='<path d="M3 7a2 2 0 0 1 2-2h12v4"></path><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M16 13.5h2"></path>'
SEARCH='<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path>'
ARROW='<path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path>'

def sidebar(active):
    items=""
    for name in ["Portfolio","Launch","Votings","Offers","Sells","Marketplace"]:
        on = name==active
        style=(f"background: rgba(245,165,36,0.14); color: {ACCENT}; border: 1px solid rgba(245,165,36,0.45)" if on
               else f"color: {MUTED}; border: 1px solid transparent")
        cur=' aria-current="page"' if on else ""
        items+=f'''<a href="{name}.dc.html"{cur} style="width: 72px; min-height: 64px; box-sizing: border-box; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-decoration: none; font-size: 11px; font-weight: 500; {style}">{ic(ICONS[name])}<span>{name}</span></a>
'''
    return f'''<aside style="flex: 1 1 96px; max-width: 100%; box-sizing: border-box; padding: 20px 12px; background: {PANEL}; border: 1px solid {BORDER}; border-radius: 24px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; gap: 24px">
<div style="display: flex; flex-direction: column; align-items: center; gap: 20px">
<a href="Main.dc.html" aria-label="Quorum home" style="width: 52px; height: 52px; border-radius: 16px; background: {PANEL2}; border: 1px solid {BORDER}; display: grid; place-items: center">{drop(30,"side")}</a>
<nav aria-label="App" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px">
{items}</nav>
</div>
<button type="button" aria-label="Connect wallet" style="width: 56px; height: 56px; border-radius: 16px; border: 1px solid {BORDER}; background: {ACCENT}; color: #111113; display: grid; place-items: center; cursor: pointer">{ic(WALLET,24)}</button>
</aside>'''

def topbar(placeholder="Search NFTs, collections or accounts"):
    return f'''<div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between">
<label style="flex: 1 1 320px; max-width: 560px; display: flex; align-items: center; gap: 10px; height: 52px; box-sizing: border-box; padding: 0 18px; background: {PANEL}; border: 1px solid {BORDER}; border-radius: 16px; color: {MUTED}">{ic(SEARCH,20)}<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Search</span><input type="search" placeholder="{placeholder}" style="flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: {TEXT}; font: inherit; font-size: 15px"></label>
<div style="display: flex; align-items: center; gap: 12px; height: 52px; box-sizing: border-box; padding: 0 8px 0 16px; background: {PANEL}; border: 1px solid {BORDER}; border-radius: 16px">
<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: {MUTED}"><span style="width: 8px; height: 8px; border-radius: 50%; background: #4ADE80"></span>NEAR mainnet</span>
<span style="width: 1px; height: 24px; background: {BORDER}"></span>
<span style="font-size: 15px; font-weight: 500">Hi, [account].near</span>
<span aria-hidden="true" style="width: 36px; height: 36px; border-radius: 12px; background: {PANEL2}; border: 1px solid {BORDER}; display: grid; place-items: center; font-size: 14px; font-weight: 600; color: {ACCENT}">A</span>
</div>
</div>'''

IMG={
 "tidewater":"/_blob/f95ef2db01104deac65dee100bd62847","molten":"/_blob/761c80f364dded5df4e3cc44128cf2df",
 "orchard":"/_blob/0a2dd7394bbb0b4d6cbb6dab31d8b70f","nocturne":"/_blob/23ca6f8154d38530006ec9e0dd23688f",
 "saltlight":"/_blob/a2ee7d63d6b3d5a0c6ff2f36b21cb1bb","currents":"/_blob/dba86caaad39efcd57a4655905ef8060",
 "banner_molten":"/_blob/c8ffb95554e75c10b0594cfb5b0eaca1","banner_tidewater":"/_blob/f6e3316b794e26c7e6eaa6e24d6dcd52",
 "banner_orchard":"/_blob/de312d3c7394aee0bc6193d031a9d7d0"}
COLL=[("tidewater","Tidewater"),("molten","Molten Hours"),("orchard","Glass Orchard"),("nocturne","Nocturne Drops"),("saltlight","Saltlight"),("currents","Quiet Currents")]
POS=["50% 50%","20% 30%","80% 70%","30% 80%","70% 20%","10% 60%"]

def drop(size=30, uid="d"):
    # Premium liquid-gold water drop: graded body, inner depth, specular highlight, fine rim.
    return f'''<svg aria-hidden="true" width="{size}" height="{size}" viewBox="0 0 64 64"><defs><linearGradient id="dg-{uid}" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#FFF4D6"></stop><stop offset="0.38" stop-color="#F5C35A"></stop><stop offset="0.72" stop-color="#E08A0B"></stop><stop offset="1" stop-color="#7A3E05"></stop></linearGradient><radialGradient id="dr-{uid}" cx="0.5" cy="0.72" r="0.42"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.35"></stop><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"></stop></radialGradient></defs><path d="M32 4C32 4 12 27 12 40a20 20 0 0 0 40 0C52 27 32 4 32 4Z" fill="url(#dg-{uid})"></path><path d="M32 4C32 4 12 27 12 40a20 20 0 0 0 40 0C52 27 32 4 32 4Z" fill="url(#dr-{uid})"></path><path d="M32 4C32 4 12 27 12 40a20 20 0 0 0 40 0C52 27 32 4 32 4Z" fill="none" stroke="#FFF4D6" stroke-opacity="0.55" stroke-width="1"></path><path d="M22 38c0-5 3-11 7-17" fill="none" stroke="#FFFFFF" stroke-opacity="0.85" stroke-width="3.2" stroke-linecap="round"></path><ellipse cx="25" cy="46" rx="2.4" ry="1.6" fill="#FFFFFF" fill-opacity="0.6"></ellipse></svg>'''

def art(variant=0, size="100%", radius=16, label=""):
    key=COLL[variant%6][0]
    alt = label or ""
    return f'<img src="{IMG[key]}" alt="{alt}" style="display: block; width: {size}; aspect-ratio: 1; object-fit: cover; object-position: {POS[variant%6]}; border-radius: {radius}px">'

def old_art(variant=0, size="100%", radius=16, label=""):
    # Original monochrome night scenes: moon phase, horizon, a few stars. Variant changes phase and tint.
    v=[(70,30,0.0,"#111116"),(62,42,0.18,"#141015"),(54,26,0.0,"#0F1216"),(70,50,0.32,"#16120C"),(48,38,0.08,"#121212"),(66,34,0.0,"#100F14")][variant%6]
    cx,cy,glow,bg=v
    shadow = [8,-6,12,99,5,-9][variant%6]
    ridge=["M0 78 Q20 70 35 74 T70 70 T100 76 V100 H0Z","M0 80 Q25 72 45 78 T100 72 V100 H0Z","M0 74 Q30 80 55 72 T100 78 V100 H0Z"][variant%3]
    stars="".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#FFFFFF" opacity="{o}"></circle>' for x,y,r,o in [(12,14,0.5,0.8),(28,40,0.35,0.6),(86,18,0.45,0.7),(44,10,0.3,0.5),(92,52,0.35,0.6),(18,58,0.3,0.4),(64,8,0.35,0.6)][: 4+variant%4])
    moon = f'<circle cx="{cx}" cy="{cy}" r="11" fill="#F4F4F5"></circle>' + (f'<circle cx="{cx+shadow}" cy="{cy-3}" r="10.5" fill="{bg}"></circle>' if shadow!=99 else '')
    glowc = f'<circle cx="{cx}" cy="{cy}" r="24" fill="{ACCENT}" opacity="{glow}"></circle>' if glow else ""
    lab = f' role="img" aria-label="{label}"' if label else ' aria-hidden="true"'
    return f'<svg{lab} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style="display: block; width: {size}; aspect-ratio: 1; border-radius: {radius}px; background: {bg}">{glowc}{stars}{moon}<path d="{ridge}" fill="#050507"></path><path d="M0 92 H100 V100 H0Z" fill="#050507"></path></svg>'

def page(title, active, body, logic="renderVals() { return {}; }", h=1060):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Space+Grotesk:wght@500;600;700&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0;background:{BG}}}
a{{color:{ACCENT}}}a:hover{{color:#FBBF5A}}
input::placeholder{{color:#8B8B94}}
</style>
</helmet>
<div style="min-height: 100%; box-sizing: border-box; padding: 20px; display: flex; flex-wrap: wrap; gap: 20px; align-items: stretch; background: {BG}; color: {TEXT}; font-family: Inter, system-ui, sans-serif">
{sidebar(active)}
<main style="flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column; gap: 20px">
{topbar()}
{body}
</main>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":1440,"height":{h}}}}}'>
class Component extends DCLogic {{
{logic}
}}
</script>
</body>
</html>
'''

def panel(inner, extra=""):
    return f'<section style="background: {PANEL}; border: 1px solid {BORDER}; border-radius: 24px; padding: 24px; box-sizing: border-box; display: flex; flex-direction: column; gap: 20px; {extra}">{inner}</section>'

def h2(text, right=""):
    return f'<div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between"><h2 style="margin: 0; {HEAD}; font-size: 22px; font-weight: 600">{text}</h2>{right}</div>'

def pill_link(text, href):
    return f'<a href="{href}" style="display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 14px; border: 1px solid {BORDER}; border-radius: 999px; color: {TEXT}; text-decoration: none; font-size: 13px; font-weight: 500">{text} {ic(ARROW,14)}</a>'

def chip(text, tone="neutral"):
    styles={"neutral":f"background: {PANEL2}; color: #D4D4D8; border: 1px solid {BORDER}",
            "accent":f"background: rgba(245,165,36,0.14); color: {ACCENT}; border: 1px solid rgba(245,165,36,0.4)",
            "ok":"background: rgba(74,222,128,0.12); color: #86EFAC; border: 1px solid rgba(74,222,128,0.35)",
            "info":"background: rgba(96,165,250,0.12); color: #93C5FD; border: 1px solid rgba(96,165,250,0.35)"}[tone]
    return f'<span style="display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 500; {styles}">{text}</span>'

BTN=f"display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 20px; border-radius: 14px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none"
BTN_P=BTN+f"; background: {ACCENT}; color: #111113; border: 0"
BTN_S=BTN+f"; background: {PANEL2}; color: {TEXT}; border: 1px solid {BORDER}"
