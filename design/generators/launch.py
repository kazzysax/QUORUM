from ui import *
ROOT="/mnt/user-data/outputs/artifacts/d531e38c-84bb-450d-8c97-5432d02403e2/project/"
STEPS=["Details","Artwork","Stages","Asset plan","Governance","Review"]
CLOSE=ic('<path d="M6 6l12 12M18 6L6 18"></path>',16)
UPLOAD=ic('<path d="M12 16V4"></path><path d="M7 9l5-5 5 5"></path><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path>',32)
INP=f"min-height: 46px; box-sizing: border-box; border-radius: 12px; border: 1px solid {BORDER}; background: {PANEL2}; color: {TEXT}; font: inherit; font-size: 14px; padding: 0 12px; width: 100%"

def F(label, inner, hint=""):
    h = f'<span style="font-size: 12px; font-weight: 400; color: {MUTED}">{hint}</span>' if hint else ""
    return f'<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: #D4D4D8">{label}{inner}{h}</label>'
def inp(ph, t="text"): return f'<input type="{t}" placeholder="{ph}" style="{INP}">'
def grid2(*xs): return f'<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px">{"".join(xs)}</div>'
def upbtn(t): return f'<button type="button" style="{BTN_S}; justify-content: flex-start">{t}</button>'

stepper="".join(f'<li style="flex: 1 1 110px"><button type="button" onClick="{{{{go{i}}}}}" aria-current="{{{{cur{i}}}}}" style="width: 100%; min-height: 56px; display: flex; align-items: center; gap: 10px; padding: 0 12px; border-radius: 14px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; text-align: left; {{{{st{i}}}}}"><span style="flex: none; width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; {HEAD}; font-size: 13px; border: 1px solid currentColor">{i+1}</span>{name}</button></li>' for i,name in enumerate(STEPS))

s0=f'''{h2("Collection details")}
{grid2(F("Collection name",inp("e.g. Molten Hours")), F("Symbol",inp("e.g. MOLT"),"3–6 letters, shown in wallets"))}
{F("Description",f'<textarea rows="4" placeholder="What the art is and who it is for" style="{INP}; padding: 12px; resize: vertical"></textarea>')}
{grid2(F("Max supply",inp("e.g. 500","number")), F("Creator royalty (%)",inp("e.g. 5","number"),"Paid to you on every market sale. You can lower it later; raising it needs a holder vote."))}'''

s1=f'''{h2("Artwork")}
<div style="border: 1.5px dashed {BORDER}; border-radius: 20px; padding: 36px; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center">
<span style="color: {ACCENT}">{UPLOAD}</span>
<strong style="font-size: 16px">Drop your art and metadata folder</strong>
<span style="font-size: 13px; color: {MUTED}; max-width: 420px">One image and one JSON file per piece. We record a provenance hash of the full set so holders can check nothing changes after launch.</span>
<button type="button" style="{BTN_S}">Choose files</button>
</div>
{grid2(F("Cover image",upbtn("Upload cover"),"Shown on the Marketplace banner, 2:1"), F("Collection image",upbtn("Upload square image"),"Shown in lists, 1:1"))}'''

def stage_card(name, desc):
    return f'''<div style="padding: 18px; border-radius: 18px; border: 1px solid {BORDER}; display: flex; flex-direction: column; gap: 14px"><div style="display: flex; justify-content: space-between; align-items: center; gap: 8px"><strong style="font-size: 15px">{name}</strong><span style="font-size: 12px; color: {MUTED}">{desc}</span></div>{grid2(F("Price (NEAR)",inp("e.g. 2.00")),F("Per-wallet limit",inp("e.g. 5","number")),F("Starts",inp("","datetime-local")),F("Ends",inp("","datetime-local")))}</div>'''
s2=f'''{h2("Stages and price")}
{stage_card("Presale (optional)","Allowlist only")}
{F("Allowlist",upbtn("Upload a list of NEAR accounts (.csv)"),"Only these accounts can mint in the presale.")}
{stage_card("Public","Open to everyone · always last")}'''

def asset_row(a,w):
    return f'<li style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; background: {PANEL2}; border: 1px solid {BORDER}">{chip(a,"accent")}<span style="flex: 1 1 160px; font-size: 13px; color: {MUTED}">Rhea route found · checked [date]</span><label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #D4D4D8">Weight<input type="number" value="{w}" style="{INP}; width: 80px"></label><button type="button" aria-label="Remove {a}" style="{BTN_S}; min-height: 40px; padding: 0 12px">{CLOSE}</button></li>'
s3=f'''{h2("Asset plan")}
<p style="margin: 0; font-size: 14px; line-height: 1.6; color: #C4C4CC">Choose what your NFTs will hold. Buyers pay NEAR; after the mint, holders vote to swap each NFT's half into its asset through Rhea. Assets are assigned by token number, in turn by weight, and can never be changed after launch.</p>
<ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px">{asset_row("USDC",2)}{asset_row("wNEAR",1)}</ul>
<button type="button" style="{BTN_S}; align-self: flex-start">+ Add an asset</button>
<p style="margin: 0; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(245,165,36,0.4); background: rgba(245,165,36,0.06); font-size: 13px; line-height: 1.55; color: #E4E4E7">Only pick assets with a deep Rhea pool. A thin pool means a poor swap for every NFT in that group.</p>'''

td=f'style="padding: 12px 8px; border-top: 1px solid {BORDER}"'
gov_rows="".join(f'<tr><td {td}>{a}</td><td {td}>{b}</td><td {td}>{c}</td><td {td}>{d}</td><td {td}>{e}</td></tr>' for a,b,c,d,e in [("Spend, swap, settle","3 days","10%","over 50%","2 days"),("Distribute","3 days","10%","over 50%","1 day"),("Parameter change","5 days","15%","60%","3 days"),("Text","2 days","5%","over 50%","none")])
th="".join(f'<th style="padding: 8px; font-weight: 500">{t}</th>' for t in ["Proposal","Vote length","Quorum","To pass","Timelock"])
s4=f'''{h2("Governance minimums")}
<p style="margin: 0; font-size: 14px; line-height: 1.6; color: #C4C4CC">Holders can always set longer votes and higher thresholds than these, never shorter or lower.</p>
<div style="overflow-x: auto"><table style="width: 100%; min-width: 560px; border-collapse: collapse; font-size: 14px"><thead><tr style="text-align: left; color: {MUTED}; font-size: 12px">{th}</tr></thead><tbody>{gov_rows}</tbody></table></div>
<button type="button" style="{BTN_S}; align-self: flex-start">Edit minimums</button>'''

def rev(a,b): return f'<div style="display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid {BORDER}; font-size: 14px"><span style="color: #C4C4CC">{a}</span><span style="font-weight: 600; text-align: right">{b}</span></div>'
s5=f'''{h2("Review and launch")}
<div>{rev("Collection","[name] · [symbol]")}{rev("Supply and royalty","[n] pieces · [x]%")}{rev("Stages","[presale], [public]")}{rev("Asset plan","USDC ×2, wNEAR ×1")}{rev("Starts paused","Yes: you mint one yourself first, then open it")}</div>
<div style="padding: 16px; border-radius: 16px; background: {PANEL2}; display: flex; flex-direction: column; gap: 8px"><strong style="font-size: 14px">What launching creates</strong><span style="font-size: 13px; line-height: 1.6; color: #C4C4CC">Your collection contract, its DAO, its treasury and a market listing. About [40] NEAR covers account storage; most of it stays locked in those accounts.</span></div>
<label style="display: flex; gap: 10px; align-items: flex-start; font-size: 13px; line-height: 1.5; color: #D4D4D8"><input type="checkbox" style="width: 20px; height: 20px; margin: 0; accent-color: {ACCENT}">I understand the asset plan and fee splits are permanent, and the contracts are not audited.</label>
<button type="button" style="{BTN_P}; min-height: 52px; font-size: 16px">Launch collection</button>'''

parts=[s0,s1,s2,s3,s4,s5]
steps_html="".join(f'<sc-if value="{{{{cur{i}}}}}" hint-placeholder-val="{{{{{"true" if i==0 else "false"}}}}}"><div style="display: flex; flex-direction: column; gap: 20px">{s}</div></sc-if>' for i,s in enumerate(parts))
nav=f'<div style="display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 4px"><button type="button" onClick="{{{{prev}}}}" style="{BTN_S}">Back</button><button type="button" onClick="{{{{next}}}}" style="{BTN_P}">{{{{next_label}}}}</button></div>'
preview=f'''{h2("Preview")}
<div style="border-radius: 20px; overflow: hidden; border: 1px solid {BORDER}; background: {PANEL2}">
<img src="{IMG['banner_tidewater']}" alt="Sample cover image" style="width: 100%; height: 140px; object-fit: cover; display: block">
<div style="padding: 16px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: center; gap: 12px"><img src="{IMG['tidewater']}" alt="" style="width: 52px; height: 52px; border-radius: 14px; object-fit: cover; margin-top: -40px; border: 3px solid {PANEL2}"><strong style="{HEAD}; font-size: 18px">[Collection name]</strong></div>
<span style="display: flex; gap: 8px; flex-wrap: wrap">{chip("Opens [date]","info")}{chip("[price] NEAR")}</span>
<span style="font-size: 13px; color: {MUTED}">This is how your drop will look on the Marketplace.</span>
</div></div>
<div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: #C4C4CC; line-height: 1.55">
<strong style="font-size: 14px; color: {TEXT}">How each mint splits</strong>
<span>Half of every mint price goes to your collection's DAO treasury straight away. The other half backs the buyer's NFT.</span>
<span>You earn through your royalty on sales, not from the mint price.</span>
</div>'''
body=f'''{h2('<span style="font-size: 30px">Launch a collection</span>', chip("For creators","accent"))}
<nav aria-label="Launch steps"><ol style="list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px">{stepper}</ol></nav>
<div style="display: flex; flex-wrap: wrap; gap: 20px">
{panel(steps_html + nav, "flex: 999 1 560px; min-width: 0")}
{panel(preview,"flex: 1 1 320px; min-width: 0; align-self: flex-start")}
</div>'''
logic='''state = { step: 0 };
renderVals() {
const s = this.state.step, n = 6;
const v = { prev: () => this.setState({ step: Math.max(0, s - 1) }), next: () => this.setState({ step: Math.min(n - 1, s + 1) }), next_label: s === n - 1 ? "Review complete" : "Continue" };
for (let i = 0; i < n; i++) {
v["cur" + i] = s === i;
v["go" + i] = () => this.setState({ step: i });
v["st" + i] = s === i ? "background: rgba(245,165,36,0.14); color: #F5A524; border: 1px solid rgba(245,165,36,0.5)" : (i < s ? "background: #1D1D25; color: #F4F4F5; border: 1px solid #2A2A33" : "background: transparent; color: #A1A1AA; border: 1px solid #2A2A33");
}
return v;
}'''
open(ROOT+"Launch.dc.html","w").write(page("Launch a collection","Launch",body,logic,1200))
print("ok")
