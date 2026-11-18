/* ED Note, v5: projects with several PDFs, side-by-side viewers, groups, workspaces, comments, bookmarks,
   adjustable stroke sizes, straight lines and the .ednote file format */
(() => {
"use strict";
const APP_VERSION = "6.9.9";
/* COMPATIBILITY RULE: every release must open and edit files from every earlier release.
   SCHEMA is the data version written to project.json. cleanProject() upgrades any older shape
   (v3 single-PDF files go through migrateV3 first) and never drops user content. Fixture files from
   each release are checked by an automated test before shipping. */
const SCHEMA = 8; /* 7: card text size (fs), document-to-document links (links with pins:[a,b]); 8: card paper/frame/font, text box font, workspace paper colour */
const APP_NAME = "ED Note";
/* v6.9.4: an .ednote file starts with its own signature line ("EDNOTE/1"), then the zip. Apps such as WhatsApp no longer
   see a zip and rename it to .zip. Zip readers (and older ED Note versions) skip the extra line, so nothing breaks. */
const EDNOTE_MIME = "application/vnd.ednote";
const EDNOTE_SIG = "EDNOTE/1\n";
const $ = s => document.querySelector(s);
const NS = "http://www.w3.org/2000/svg";
const pdfjsLib = window.pdfjsLib;
if (pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";

const HL_COLORS = ["y","g","b","p","o"];
const PEN_COLORS = ["k","u","r","g","v"];
const CNAME = {y:"Sarı",g:"Yeşil",b:"Mavi",p:"Pembe",o:"Turuncu",k:"Siyah",u:"Mavi",r:"Kırmızı",v:"Mor"};
const PEN_HEX = {k:"#1d1d1f",u:"#2357b8",r:"#c8352a",g:"#2f7a43",v:"#6b47b8"};
const HL_HEX = {y:"#f2cf45",g:"#7ccf8a",b:"#78b6ec",p:"#f09cc2",o:"#f2a35c"};
/* stroke sizes are in PDF points (1 pt = 0.353 mm), so they scale with the page */
const SIZE_RANGE = { pen:[0.3, 24], hl:[4, 48], text:[6, 72], eraser:[4, 120] };
const SIZE_DEF = { pen:[1.2, 2.2, 3.6], hl:[8, 13, 20], text:[9, 11, 14], eraser:[8, 18, 40] };
const SIZE_NAME = { pen:"Kalem kalınlığı", hl:"Fosforlu kalınlığı", text:"Yazı boyutu", eraser:"Silgi boyutu" };
const toSlider = (k, v) => { const [a, b] = SIZE_RANGE[k]; return Math.round(100 * Math.log(v / a) / Math.log(b / a)); };
const fromSlider = (k, x) => { const [a, b] = SIZE_RANGE[k], v = a * Math.pow(b / a, x / 100); return v < 3 ? Math.round(v * 10) / 10 : v < 20 ? Math.round(v * 2) / 2 : Math.round(v); };
const fmtSize = v => (v < 10 && v % 1 ? v.toFixed(1) : String(Math.round(v))).replace(".", ",");
const ICON = {
  link:'<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  del:'<svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12M9.5 7V4.5h5V7"/></svg>',
  x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  move:'<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/></svg>',
  play:'<svg viewBox="0 0 24 24"><path d="M7 4.5v15L19.5 12z"/></svg>',
  mic:'<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  download:'<svg viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg>',
  minus:'<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',
  fit:'<svg viewBox="0 0 24 24"><path d="M4 12h16"/><path d="m8 8-4 4 4 4M16 8l4 4-4 4"/></svg>',
  book:'<svg viewBox="0 0 24 24"><path d="M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h9.5"/></svg>',
  split:'<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M12 5v14"/></svg>',
  ribbon:'<svg viewBox="0 0 24 24"><path d="M7 3h10v18l-5-4-5 4z"/></svg>',
  comment:'<svg viewBox="0 0 24 24"><path d="M5 5h14v10H10l-4 4v-4H5z"/></svg>',
  more:'<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18" cy="12" r="1.1"/></svg>',
  chevron:'<svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg>',
  ungroup:'<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="8" height="8" rx="1.5"/><rect x="12.5" y="12.5" width="8" height="8" rx="1.5"/></svg>',
  arrow:'<svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg>',
  hash:'<svg viewBox="0 0 24 24"><path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h15M4 15h15"/></svg>',
  camera:'<svg viewBox="0 0 24 24"><path d="M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.6"/></svg>',
  palette:'<svg viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.9-.8 1.6-1.8-.4-1.2.4-2.2 1.6-2.2h1.7a3.6 3.6 0 0 0 3.6-3.6c0-5.2-3.8-9.4-8.5-9.4z"/><circle cx="7.6" cy="11.4" r="1.1"/><circle cx="10.4" cy="7.6" r="1.1"/><circle cx="14.9" cy="7.9" r="1.1"/></svg>',
  font:'<svg viewBox="0 0 24 24"><path d="M2.5 19 7.6 5.5h.8L13.5 19M4.4 14.5h7.2"/><circle cx="18" cy="15.6" r="2.9"/><path d="M20.9 12.4V19"/></svg>',
  hat:'<svg viewBox="0 0 24 24"><path d="M2.8 15.6c3.4 1.7 15 1.7 18.4 0"/><path d="M5.6 15.3 7 8.7c.3-1.4 1.6-2.3 3-1.9l2 .6 2-.6c1.4-.4 2.7.5 3 1.9l1.4 6.6"/><path d="M6.4 12.3c3.6 1 7.6 1 11.2 0"/></svg>',
  brain:'<svg viewBox="0 0 24 24"><path d="M12 5.3v13.4"/><path d="M12 5.3a2.9 2.9 0 0 0-5-1.3A3 3 0 0 0 4.6 8a3.2 3.2 0 0 0 .2 5.4 3 3 0 0 0 2.5 4.5A2.8 2.8 0 0 0 12 18.7"/><path d="M12 5.3a2.9 2.9 0 0 1 5-1.3A3 3 0 0 1 19.4 8a3.2 3.2 0 0 1-.2 5.4 3 3 0 0 1-2.5 4.5 2.8 2.8 0 0 1-4.7.8"/><path d="M8.2 9.4c1 .3 1.7 1 1.9 2M15.8 9.4c-1 .3-1.7 1-1.9 2"/></svg>'
};
const FS_STEPS = [0.85, 1, 1.2, 1.45, 1.75, 2.1, 2.5];
/* paper colours for cards and for the workspace (light / dark appearance) */
const PAPER_COLORS = {
  white:{ name:"Beyaz", l:"#ffffff", d:"#1c1c1e" }, cream:{ name:"Krem", l:"#fbf6e9", d:"#27241d" }, yellow:{ name:"Sarı bloknot", l:"#fff4b8", d:"#2e2a16" },
  kraft:{ name:"Kraft", l:"#e9d7b2", d:"#2f281c" }, brown:{ name:"Kahverengi", l:"#d4b88f", d:"#36291b" }, mint:{ name:"Yeşil", l:"#e5f3e8", d:"#1a261f" },
  sky:{ name:"Mavi", l:"#e5eefa", d:"#1a222d" }, rose:{ name:"Pembe", l:"#fae8ee", d:"#2b1d23" }, grey:{ name:"Gri", l:"#ececea", d:"#262628" } };
const FRAMES = { none:"Yok", thin:"İnce", thick:"Kalın" };
/* any colour, not only the named ones: cards keep `color` (it also colours the highlight in the PDF) and may add `cc`, a free frame colour;
   paper may be a named paper or a free colour "#rrggbb" (older versions show such paper as white) */
const isHex = v => /^#[0-9a-f]{6}$/i.test(v || "");
function mixHex(a, b, t){ const P = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = P(a), B = P(b); return "#" + A.map((v, i) => Math.round(v * (1 - t) + B[i] * t).toString(16).padStart(2, "0")).join(""); }
const paperOf = k => PAPER_COLORS[k] || (isHex(k) ? { name:k.toUpperCase(), l:k.toLowerCase(), d:mixHex(k, "#1c1c1e", 0.84) } : null);
const okPaper = k => !!paperOf(k) && k !== "white";
const ACCENT_MORE = ["#e57373","#f06292","#ba68c8","#9575cd","#7986cb","#5c8ee6","#4fc3f7","#4dd0e1","#4db6ac","#5fb878","#aed581","#dce775","#fff176","#ffd54f","#ffb74d","#ff8a65","#d9534f","#a1887f","#90a4ae","#546e7a","#37474f","#1d1d1f"];
const LABEL_COLORS = ["#e5484d","#f76b15","#ffc53d","#46a758","#12a594","#0090ff","#3e63dd","#8e4ec6","#d6409f","#8d8d86"];
const PAPER_MORE = ["#fffdf5","#fff9db","#fff3e0","#fde9e4","#fce4ec","#f3e5f5","#ede7f6","#e8eaf6","#e3f2fd","#e0f7fa","#e0f2f1","#e8f5e9","#f1f8e9","#f9fbe7","#efebe9","#eceff1","#f5f5f5","#e7e2d6","#d7ccc8","#cfd8dc"];
/* 40 fonts: scientific first, then plain, technical and warm. Files load only when a font is used. */
const FONTS = [{"cat": "Bilimsel", "id": "stix-two-text", "name": "STIX Two", "note": "Bilimsel dergilerin yazı tipi"}, {"cat": "Bilimsel", "id": "libertinus-serif", "name": "Libertinus Serif", "note": "LaTeX belgelerine yakın"}, {"cat": "Bilimsel", "id": "tinos", "name": "Tinos", "note": "Times New Roman ile aynı ölçüler"}, {"cat": "Bilimsel", "id": "caladea", "name": "Caladea", "note": "Cambria ile aynı ölçüler"}, {"cat": "Bilimsel", "id": "gelasio", "name": "Gelasio", "note": "Georgia ile aynı ölçüler"}, {"cat": "Bilimsel", "id": "source-serif-4", "name": "Source Serif", "note": ""}, {"cat": "Bilimsel", "id": "noto-serif", "name": "Noto Serif", "note": ""}, {"cat": "Bilimsel", "id": "charis-sil", "name": "Charis", "note": ""}, {"cat": "Bilimsel", "id": "gentium-book-plus", "name": "Gentium", "note": ""}, {"cat": "Bilimsel", "id": "crimson-pro", "name": "Crimson Pro", "note": ""}, {"cat": "Bilimsel", "id": "eb-garamond", "name": "EB Garamond", "note": ""}, {"cat": "Bilimsel", "id": "libre-baskerville", "name": "Libre Baskerville", "note": ""}, {"cat": "Bilimsel", "id": "old-standard-tt", "name": "Old Standard", "note": ""}, {"cat": "Bilimsel", "id": "literata", "name": "Literata", "note": ""}, {"cat": "Bilimsel", "id": "merriweather", "name": "Merriweather", "note": ""}, {"cat": "Bilimsel", "id": "pt-serif", "name": "PT Serif", "note": ""}, {"cat": "Bilimsel", "id": "spectral", "name": "Spectral", "note": ""}, {"cat": "Bilimsel", "id": "newsreader", "name": "Newsreader", "note": ""}, {"cat": "Bilimsel", "id": "lora", "name": "Lora", "note": ""}, {"cat": "Bilimsel", "id": "alegreya", "name": "Alegreya", "note": ""}, {"cat": "Sade", "id": "carlito", "name": "Carlito", "note": "Calibri ile aynı ölçüler"}, {"cat": "Sade", "id": "arimo", "name": "Arimo", "note": "Arial ile aynı ölçüler"}, {"cat": "Sade", "id": "inter", "name": "Inter", "note": ""}, {"cat": "Sade", "id": "ibm-plex-sans", "name": "IBM Plex Sans", "note": ""}, {"cat": "Sade", "id": "source-sans-3", "name": "Source Sans", "note": ""}, {"cat": "Sade", "id": "noto-sans", "name": "Noto Sans", "note": ""}, {"cat": "Sade", "id": "fira-sans", "name": "Fira Sans", "note": ""}, {"cat": "Sade", "id": "roboto", "name": "Roboto", "note": ""}, {"cat": "Sade", "id": "open-sans", "name": "Open Sans", "note": ""}, {"cat": "Teknik", "id": "jetbrains-mono", "name": "JetBrains Mono", "note": "Eşit aralıklı"}, {"cat": "Teknik", "id": "ibm-plex-mono", "name": "IBM Plex Mono", "note": "Eşit aralıklı"}, {"cat": "Teknik", "id": "source-code-pro", "name": "Source Code Pro", "note": "Eşit aralıklı"}, {"cat": "Sıcak", "id": "nunito", "name": "Nunito", "note": ""}, {"cat": "Sıcak", "id": "quicksand", "name": "Quicksand", "note": ""}, {"cat": "Sıcak", "id": "varela-round", "name": "Varela Round", "note": ""}, {"cat": "Sıcak", "id": "comfortaa", "name": "Comfortaa", "note": ""}, {"cat": "Sıcak", "id": "shantell-sans", "name": "Shantell Sans", "note": ""}, {"cat": "Sıcak", "id": "kalam", "name": "Kalam", "note": "El yazısı"}, {"cat": "Sıcak", "id": "patrick-hand", "name": "Patrick Hand", "note": "El yazısı"}, {"cat": "Sıcak", "id": "caveat", "name": "Caveat", "note": "El yazısı"}];
const FONT_IDS = new Set(FONTS.map(f => f.id));
const fontCss = id => FONT_IDS.has(id) ? `'edf-${id}', var(--f)` : "";
const fontName = id => (FONTS.find(f => f.id === id) || { name:"Sistem" }).name;
const MODE = { trace:{ name:"Dedektif", icon:ICON.hat }, keep:{ name:"Beyin", icon:ICON.brain } };

const el = {
  recent:$("#recent"), recentEmpty:$("#recentEmpty"), main:$("#main"), pdfArea:$("#pdfArea"),
  ws:$("#ws"), plane:$("#plane"), links:$("#links"), wsInk:$("#wsInk"), wsEmpty:$("#wsEmpty"), spaces:$("#spaces"), xlinks:$("#xlinks"),
  chip:$("#chip"), ghost:$("#ghost"), toast:$("#toast"), toastMsg:$("#toastMsg"), banner:$("#banner"), bannerMsg:$("#bannerMsg"), bannerActs:$("#bannerActs"),
  zl:$("#zl"), linkHint:$("#linkHint"), tabCount:$("#tabCount"), docTitle:$("#docTitle"), saveState:$("#saveState"),
  undo:$("#bUndo"), redo:$("#bRedo"), penOnly:$("#bPenOnly"), q:$("#q"), qCount:$("#qCount"), searchbar:$("#searchbar"), opts:$("#opts"),
  rec:$("#bRec"), recTime:$("#recTime"), recModeIcon:$("#recModeIcon"), recPop:$("#recPop"), morePop:$("#morePop"), recsPop:$("#recsPop"),
  recList:$("#recList"), recListEmpty:$("#recListEmpty"), recsTitle:$("#recsTitle"),
  player:$("#player"), plPlay:$("#plPlay"), plTitle:$("#plTitle"), plTime:$("#plTime"), plSeek:$("#plSeek"), plFill:$("#plFill"), plTicks:$("#plTicks"), plSpeed:$("#plSpeed"),
  outlinePop:$("#outlinePop"), commentPop:$("#commentPop"), searchPop:$("#searchPop"), spacePop:$("#spacePop")
};

const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = v => Math.round(v * 100) / 100;
const fmtT = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : String(m).padStart(2, "0")) + ":" + String(x).padStart(2, "0"); };
const fmtDate = d => { try { return new Intl.DateTimeFormat("tr", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }).format(new Date(d)); } catch { return ""; } };
const stripPdf = n => String(n || "").replace(/\.pdf$/i, "");
const ls = { get(k){ try { return localStorage.getItem(k); } catch { return null; } }, set(k, v){ try { localStorage.setItem(k, v); } catch {} } };
const narrowMQ = window.matchMedia("(max-width: 640px), (max-height: 520px) and (max-width: 1000px)"); /* phones; tablets keep the side-by-side layout */
/* v6.9.8: the document and the workspace are always on one screen (phones too); narrowMQ is only used by the library */
const isNarrow = () => false;

/* the workspace is a sheet of paper with a fixed size (units: 1 = 1 pt, so it maps 1:1 to the PDF export) */
const MM = 72 / 25.4;
const PDF_PAGE_MAX = 14000;                        /* PDF viewers stop at about 14400 pt (200 in); bigger workspaces are scaled down in the export */
const SHEET_MIN = Math.round(100 * MM);
const PAPER = { A3:[297, 420], A2:[420, 594], A1:[594, 841], A0:[841, 1189], "2A0":[1189, 1682] };
const SHEET_DEF = { w:Math.round(594 * MM), h:Math.round(420 * MM) }; /* A2 landscape; grows by itself as things are added */
const GROW_MARGIN = Math.round(60 * MM);
const PATTERNS = { blank:"Boş", dot:"Noktalı", grid:"Kareli", lined:"Çizgili", mm:"Milimetrik" };
const newSpace = name => ({ id:"s" + uid(), name, view:{ tx:40, ty:60, s:1 }, sheet:{ x:0, y:0, w:SHEET_DEF.w, h:SHEET_DEF.h }, pattern:"dot" });
const emptyProject = (name) => ({ id:"p" + uid(), name:name || "Proje", docs:[], spaces:[newSpace("Masa 1")],
  items:[], links:[], groups:[], ink:[], texts:[], comments:[], bookmarks:[], pins:[], recs:[], ui:{ space:null, viewers:[], split:false } });
const S = {
  proj:null, sample:false, pdfs:new Map(), sampleBytes:new Map(), viewers:[], av:0, space:null,
  sel:null, selLink:null, linkFrom:null, pendingSel:null, lastColor:"y", flashId:null, needFit:false,
  tool:"select", penColor:"k", hlColor:"y", sizeIdx:{ pen:1, hl:1, text:1, eraser:1 }, presets:JSON.parse(JSON.stringify(SIZE_DEF)), lineMode:{ pen:"free", hl:"free" }, penOnly:false,
  search:{ q:"", hits:[], idx:-1, pending:null }, recMode:"trace", lastFs:1, lastBg:"", lastFrame:"", lastFont:"", textFont:""
};
const cardEls = new Map();
const docName = fp => { const d = S.proj && S.proj.docs.find(x => x.fp === fp); return d ? stripPdf(d.name) : "Belge"; };
const curSpace = () => S.proj.spaces.find(s => s.id === S.space) || S.proj.spaces[0];
const view = () => curSpace().view;
const spaceItems = () => S.proj.items.filter(i => i.space === S.space);
const curSize = k => S.presets[k][S.sizeIdx[k]];
const AV = () => S.viewers[S.av] && !S.viewers[S.av].root.hidden ? S.viewers[S.av] : S.viewers[0];

/* ================= IndexedDB ================= */
const DB = (() => {
  let p;
  function open(){
    if (p) return p;
    p = new Promise((res, rej) => {
      const r = indexedDB.open("alinti-masasi", 2);
      r.onupgradeneeded = () => {
        const d = r.result;
        for (const [n, k] of [["docs","fp"],["pdfs","fp"],["blobs","id"],["meta","k"],["projects","id"]]) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath:k });
      };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return p;
  }
  async function run(store, mode, fn){
    const d = await open();
    return new Promise((res, rej) => { const t = d.transaction(store, mode), req = fn(t.objectStore(store)); t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  }
  return { get:(s, k) => run(s, "readonly", st => st.get(k)), put:(s, v) => run(s, "readwrite", st => st.put(v)), del:(s, k) => run(s, "readwrite", st => st.delete(k)), all:s => run(s, "readonly", st => st.getAll()) };
})();

/* ================= UI helpers ================= */
let toastTimer;
function toast(msg, action, ms){
  el.toastMsg.textContent = msg; el.toast.querySelectorAll(".btn").forEach(b => b.remove());
  if (action){ const b = document.createElement("button"); b.className = "btn sm"; b.textContent = action.label; b.onclick = () => { el.toast.hidden = true; action.fn(); }; el.toast.appendChild(b); }
  el.toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.hidden = true, ms || (action ? 6000 : 2800));
}
function banner(msg, actions = [], kind = ""){
  el.bannerMsg.textContent = msg; el.bannerActs.innerHTML = "";
  for (const a of actions){ const b = document.createElement("button"); b.className = "btn sm" + (a.primary ? " primary" : ""); b.textContent = a.label; b.onclick = () => { if (!a.keep) hideBanner(); a.fn(); }; el.bannerActs.appendChild(b); }
  el.banner.className = "banner" + (kind ? " " + kind : ""); el.banner.hidden = false;
}
function hideBanner(){ el.banner.hidden = true; }
$("#bannerX").onclick = hideBanner;
let openPopEl = null, popCloseCb = null;
function openPop(pop, anchor, onClose){
  const r = anchor.getBoundingClientRect();
  closePop(); pop.hidden = false; openPopEl = pop; popCloseCb = onClose || null;
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let x = r.right - w, y = r.bottom + 8;
  if (x < 12) x = Math.min(r.left, window.innerWidth - w - 12);
  x = clamp(x, 12, window.innerWidth - w - 12);
  if (y + h > window.innerHeight - 12) y = Math.max(12, r.top - h - 8);
  pop.style.left = x + "px"; pop.style.top = y + "px";
}
function closePop(){ if (openPopEl){ const cb = popCloseCb; openPopEl.hidden = true; openPopEl = null; popCloseCb = null; if (cb) cb(); } }
document.addEventListener("pointerdown", e => {
  if (openPopEl && !openPopEl.contains(e.target) && !e.target.closest("#bRec,#bMore,#plList,.mic,.cpin,.vbtn-ol,.sp-more,#q")) closePop();
}, true);
function setView(v){ document.body.dataset.view = v; document.body.classList.toggle("home-toast", v === "home"); if (v === "home"){ closePlayer(); renderHome(); el.xlinks.innerHTML = ""; } }
function setTab(t){
  document.body.dataset.tab = t;
  $("#tabPdf").setAttribute("aria-selected", String(t === "pdf")); $("#tabWs").setAttribute("aria-selected", String(t === "ws"));
  if (t === "ws") requestAnimationFrame(() => { el.plane.querySelectorAll("textarea.note").forEach(autosize); const wr = el.ws.getBoundingClientRect(), seen = [...el.plane.querySelectorAll(":scope > .card, :scope > .group")].some(n => { const r = n.getBoundingClientRect(); return r.left >= wr.left && r.right <= wr.right && r.top >= wr.top && r.bottom <= wr.bottom; }); if (S.needFit || (!seen && spaceItems().length)){ S.needFit = false; fitAll(); } applyView(); drawLinks(); });
  if (t === "pdf") requestAnimationFrame(() => document.querySelectorAll(".tbox textarea").forEach(autosize));
  hideChip(); scheduleX();
}
$("#tabPdf").onclick = () => setTab("pdf");
$("#tabWs").onclick = () => setTab("ws");

/* ================= history + save ================= */
const Hist = { past:[], future:[], last:null };
const SNAP_KEYS = ["docs","items","links","groups","ink","texts","comments","bookmarks","pins","stickers"];
const snap = () => JSON.stringify(SNAP_KEYS.map(k => S.proj[k]));
function updUndo(){ el.undo.disabled = !Hist.past.length; el.redo.disabled = !Hist.future.length; }
function resetHistory(){ Hist.past = []; Hist.future = []; Hist.last = snap(); updUndo(); }
function commit(){
  const s = snap();
  if (s !== Hist.last){ if (Hist.last !== null){ Hist.past.push(Hist.last); if (Hist.past.length > 50) Hist.past.shift(); } Hist.future = []; Hist.last = s; }
  updUndo(); save(); densSoon();
}
function restoreSnap(s){
  const d = JSON.parse(s); SNAP_KEYS.forEach((k, i) => S.proj[k] = d[i]); S.sel = null; S.selLink = null;
  renderTabs(); for (const v of S.viewers) if (!v.root.hidden && !S.proj.docs.some(x => x.fp === v.fp)) showDoc(v, S.proj.docs[0].fp);
  renderWs(); renderAllOverlays(); save(); updUndo(); densSoon();
}
function undo(){ if (!Hist.past.length) return; Hist.future.push(Hist.last); Hist.last = Hist.past.pop(); restoreSnap(Hist.last); }
function redo(){ if (!Hist.future.length) return; Hist.past.push(Hist.last); Hist.last = Hist.future.pop(); restoreSnap(Hist.last); }
el.undo.onclick = undo; el.redo.onclick = redo;

function setSaveState(t){ el.saveState.textContent = t; }
let saveTimer, persistAsked = false;
function serialize(){ return { app:"ednote", v:SCHEMA, appVersion:APP_VERSION, savedAt:new Date().toISOString(), ...S.proj }; }
async function saveNow(){
  if (!S.proj || S.sample) return;
  S.proj.ui = { space:S.space, viewers:S.viewers.filter(v => !v.root.hidden).map(v => v.fp).filter(Boolean), split:el.pdfArea.classList.contains("dual") };
  await DB.put("projects", { id:S.proj.id, name:S.proj.name, updated:Date.now(), data:serialize() });
}
function save(){
  if (!S.proj) return;
  el.tabCount.textContent = spaceItems().length;
  if (S.sample){ setSaveState("Örnek proje, kaydedilmez"); return; }
  setSaveState("Kaydediliyor…"); clearTimeout(saveTimer); S.editTick = (S.editTick || 0) + 1;
  saveTimer = setTimeout(async () => {
    try {
      await saveNow(); setSaveState(FS.ok ? "Kaydedildi · klasör" : "Kaydedildi"); OD.soon();
      if (!persistAsked && navigator.storage && navigator.storage.persist){ persistAsked = true; navigator.storage.persist().catch(() => {}); }
      folderSync();
    } catch (e){ console.error(e); setSaveState("Kaydedilemedi"); toast("Kaydedilemedi. Cihazında yer kalmamış olabilir."); }
  }, 450);
}

/* ================= folder sync ================= */
const FS = { supported:"showDirectoryPicker" in window, handle:null, ok:false, busy:false, again:false };
async function writeFile(dir, name, data){ const fh = await dir.getFileHandle(name, { create:true }); const w = await fh.createWritable(); await w.write(data); await w.close(); }
async function fileExists(dir, name){ try { await dir.getFileHandle(name); return true; } catch { return false; } }
const audioExt = m => /mp4/.test(m || "") ? ".m4a" : /ogg/.test(m || "") ? ".ogg" : ".webm";
const safeName = n => (String(n || "proje").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80)) || "proje";
async function writeAllToDir(){
  const dir = FS.handle; if (!dir) return;
  await writeFile(dir, "project.json", JSON.stringify(serialize(), null, 1));
  const dd = await dir.getDirectoryHandle("docs", { create:true });
  for (const d of S.proj.docs){ const fn = d.fp + ".pdf"; if (!(await fileExists(dd, fn))){ const p = await DB.get("pdfs", d.fp); if (p) await writeFile(dd, fn, new Blob([p.bytes], { type:"application/pdf" })); } }
  if (S.proj.recs.length){
    const ad = await dir.getDirectoryHandle("audio", { create:true });
    for (const r of S.proj.recs){ if (Rec.active && Rec.active.id === r.id) continue; const fn = r.id + audioExt(r.mime); if (!(await fileExists(ad, fn))){ const b = await DB.get("blobs", r.id); if (b) await writeFile(ad, fn, b.blob); } }
  }
}
async function folderSync(){
  if (!FS.ok || !FS.handle) return;
  if (FS.busy){ FS.again = true; return; }
  FS.busy = true;
  try { await writeAllToDir(); setSaveState("Kaydedildi · klasör"); } catch (e){ console.warn(e); FS.ok = false; setSaveState("Kaydedildi · klasör bağlantısı koptu"); }
  FS.busy = false; if (FS.again){ FS.again = false; setTimeout(folderSync, 1500); }
}
async function linkFolder(){
  closePop();
  if (!FS.supported){ toast("Bu tarayıcı klasöre doğrudan yazmayı desteklemiyor. Dışa aktar seçeneğini kullan."); return; }
  if (S.sample){ toast("Örnek proje klasöre bağlanamaz. Kendi PDF'ini aç."); return; }
  try {
    const parent = await window.showDirectoryPicker({ id:"alinti", mode:"readwrite" });
    const dir = await parent.getDirectoryHandle(safeName(S.proj.name) + " (ED Note)", { create:true });
    FS.handle = dir; FS.ok = true; await DB.put("meta", { k:"dir:" + S.proj.id, h:dir });
    await saveNow(); await writeAllToDir(); setSaveState("Kaydedildi · klasör");
    toast(`"${dir.name}" klasörüne bağlandı. Değişiklikler oraya da kaydediliyor.`, null, 4500);
  } catch (e){ if (e && e.name !== "AbortError"){ console.error(e); toast("Klasöre bağlanılamadı."); } }
}
async function restoreFolder(){
  FS.handle = null; FS.ok = false; $("#mFolder").hidden = !FS.supported;
  if (!FS.supported || S.sample) return;
  const m = await DB.get("meta", "dir:" + S.proj.id).catch(() => null);
  if (!m || !m.h){ $("#mFolder").textContent = "Klasöre bağla"; return; }
  $("#mFolder").textContent = "Klasör bağlantısını değiştir"; FS.handle = m.h;
  let st = "prompt"; try { st = await m.h.queryPermission({ mode:"readwrite" }); } catch {}
  if (st === "granted"){ FS.ok = true; setSaveState("Kaydedildi · klasör"); }
  else banner(`Klasöre otomatik kayıt için izin gerekiyor ("${m.h.name}").`, [{ label:"İzin ver", primary:true, fn: async () => { try { if ((await m.h.requestPermission({ mode:"readwrite" })) === "granted"){ FS.ok = true; await folderSync(); } } catch {} } }]);
}

/* ================= tools ================= */
function setTool(t){
  if (t !== "lasso" && ISEL.on) iselClear();
  S.tool = t; document.body.dataset.tool = t;
  document.querySelectorAll("#tools button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tool === t)));
  if (t !== "select"){ hideChip(); try { window.getSelection().removeAllRanges(); } catch {} }
  if (S.linkFrom && t !== "select") cancelLink();
  renderOpts();
}
document.querySelectorAll("#tools button").forEach(b => b.onclick = () => setTool(b.dataset.tool));
const LINE_ICON = {
  free:'<svg viewBox="0 0 24 24"><path d="M3.5 15.5c2.5-6 4.5-6 6 0s3.5 6 6 0 3.5-5 5-3"/></svg>',
  line:'<svg viewBox="0 0 24 24"><path d="M4 18 20 6"/><circle cx="4" cy="18" r="1.3"/><circle cx="20" cy="6" r="1.3"/></svg>'
};
function savePrefs(){ ls.set("ednote:prefs", JSON.stringify({ presets:S.presets, sizeIdx:S.sizeIdx, lineMode:S.lineMode, lastFs:S.lastFs, lastBg:S.lastBg, lastCc:S.lastCc || "", recentColors:S.recentColors || [], lastFrame:S.lastFrame, lastFont:S.lastFont, textFont:S.textFont, readMode:S.readMode || "", lastLinkColor:S.lastLinkColor || "", lastLinkDash:!!S.lastLinkDash, lastLinkShape:S.lastLinkShape || "", penTip:S.penTip || "", shapeSnap:S.shapeSnap !== false, penColor:S.penColor, hlColor:S.hlColor })); }
function loadPrefs(){
  try {
    const p = JSON.parse(ls.get("ednote:prefs") || "null"); if (!p) return;
    if (p.readMode === "night" || p.readMode === "sepia") S.readMode = p.readMode;
    if (LINK_COLORS[p.lastLinkColor]) S.lastLinkColor = p.lastLinkColor; S.lastLinkDash = !!p.lastLinkDash; S.shapeSnap = p.shapeSnap !== false; if (TIPS.includes(p.penTip)) S.penTip = p.penTip; if (PEN_COLORS.includes(p.penColor) || isHex(p.penColor)) S.penColor = p.penColor; if (HL_COLORS.includes(p.hlColor) || isHex(p.hlColor)) S.hlColor = p.hlColor; if (LINK_SHAPES.includes(p.lastLinkShape)) S.lastLinkShape = p.lastLinkShape;
    for (const k of Object.keys(SIZE_DEF)){
      if (Array.isArray(p.presets && p.presets[k]) && p.presets[k].length === 3) S.presets[k] = p.presets[k].map(v => clamp(+v || SIZE_DEF[k][1], ...SIZE_RANGE[k]));
      if (p.sizeIdx && [0, 1, 2].includes(p.sizeIdx[k])) S.sizeIdx[k] = p.sizeIdx[k];
    }
    for (const k of ["pen","hl"]) if (p.lineMode && (p.lineMode[k] === "line" || p.lineMode[k] === "free")) S.lineMode[k] = p.lineMode[k];
    if (FS_STEPS.includes(p.lastFs)) S.lastFs = p.lastFs;
    if (paperOf(p.lastBg)) S.lastBg = p.lastBg; if (FRAMES[p.lastFrame]) S.lastFrame = p.lastFrame;
    if (isHex(p.lastCc)) S.lastCc = p.lastCc;
    if (Array.isArray(p.recentColors)) S.recentColors = p.recentColors.filter(isHex).slice(0, 10);
    if (FONT_IDS.has(p.lastFont)) S.lastFont = p.lastFont; if (FONT_IDS.has(p.textFont)) S.textFont = p.textFont;
  } catch {}
}
const dotPx = (k, v) => Math.round(5 + 15 * toSlider(k, v) / 100);
/* ================= pen box (v6.9.7): saved pens and highlighters, one tap to pick; shared through library.json ================= */
const HL_MORE = ["#fff176","#ffd54f","#ffb74d","#ff8a65","#f48fb1","#ce93d8","#b39ddb","#90caf9","#80deea","#80cbc4","#a5d6a7","#c5e1a5","#e6ee9c","#bcaaa4","#b0bec5","#ffab91"];
const PEN_SEED = {
  "p-siyah":{ name:"Siyah", kind:"pen", color:"k", w:1.2, o:1 },
  "p-mavi":{ name:"Mavi tükenmez", kind:"pen", color:"u", w:1.6, o:2 },
  "p-kirmizi":{ name:"Kırmızı", kind:"pen", color:"r", w:1.6, o:3 },
  "p-kursun":{ name:"Kurşun kalem", kind:"pen", color:"#38383c", w:2.4, tip:"pencil", o:4 },
  "p-kaligrafi":{ name:"Kaligrafi", kind:"pen", color:"k", w:4.5, tip:"callig", o:5 },
  "p-sari":{ name:"Sarı fosforlu", kind:"hl", color:"y", w:12, o:6 },
  "p-yesil":{ name:"Yeşil fosforlu", kind:"hl", color:"g", w:12, o:7 }
};
const PEN_MAX = 8;
function penBox(){
  const st = libState();
  if (!st.pensSeeded){ for (const [k, v] of Object.entries(PEN_SEED)) if (!st.pens[k]) st.pens[k] = { ...v, t:1 }; st.pensSeeded = true; libSave(st, true); }
  return Object.entries(st.pens).filter(([, v]) => !v.del && v.kind).map(([id, v]) => ({ id, ...v })).sort((a, b) => (a.o ?? a.t) - (b.o ?? b.t));
}
function savePen(id, val){ const st = libState(); st.pens[id] = val ? { ...val, t:Date.now() } : { del:true, t:Date.now() }; libSave(st); }
/* a small sample of what the pen draws: colour, thickness and tip */
function penIcon(p){
  const c = isHex(p.color) ? p.color : (p.kind === "hl" ? HL_HEX : PEN_HEX)[p.color] || "#1d1d1f";
  const sq = "M4 15c3-6 5-6 8 0s5 6 8 0";
  if (p.kind === "hl") return `<svg viewBox="0 0 24 24" class="pb-ic"><path d="${sq}" style="fill:none;stroke:${c};stroke-width:7;stroke-linecap:round;opacity:.6"/></svg>`;
  if (p.tip === "callig") return `<svg viewBox="0 0 24 24" class="pb-ic"><path d="${outlineD([[4,15],[6,11],[8,10],[10,11.5],[12,15],[14,18.5],[16,19.5],[18,18],[20,15]].map(q => [...q, 0.5]), Math.min(5, p.w * 0.9), false, true)}" style="fill:${c};stroke:none"/></svg>`;
  const w = clamp(p.w * 0.9, 1.4, 4.2);
  return `<svg viewBox="0 0 24 24" class="pb-ic"><path d="${sq}" style="fill:none;stroke:${c};stroke-width:${w};stroke-linecap:round"${p.tip === "pencil" ? ' filter="url(#edPencil)"' : ""}/></svg>`;
}
let penEdit = false;
function renderPenBox(kind){
  let box = $("#penBox");
  if (!box){ box = document.createElement("div"); box.className = "penbox"; box.id = "penBox"; box.setAttribute("role", "toolbar"); box.setAttribute("aria-label", "Kalem kutusu"); el.opts.parentNode.insertBefore(box, el.opts); }
  box.hidden = !(kind === "pen" || kind === "hl"); if (box.hidden) return;
  box.innerHTML = "";
  const curCol = kind === "hl" ? S.hlColor : S.penColor, curW = curSize(kind);
  for (const p of penBox()){
    const on = p.kind === kind && p.color === curCol && (p.kind === "hl" || (p.tip || "") === (S.penTip || "")) && Math.abs(p.w - curW) < 0.05;
    const b = document.createElement("button"); b.className = "pb-pen" + (on ? " on" : "") + (penEdit ? " editing" : ""); b.innerHTML = penIcon(p); b.title = `${p.name} (${fmtSize(p.w)} pt)`; b.setAttribute("aria-label", p.name); b.setAttribute("aria-pressed", String(on));
    b.onclick = () => {
      if (penEdit){ askText("Kalemin adı", p.name, n => { savePen(p.id, { ...p, name:n, id:undefined }); renderOpts(); }); return; }
      if (p.kind === "hl") S.hlColor = p.color; else { S.penColor = p.color; S.penTip = p.tip || ""; }
      S.presets[p.kind][S.sizeIdx[p.kind]] = p.w; if (S.tool !== p.kind) setTool(p.kind); savePrefs(); renderOpts();
    };
    if (penEdit){ const x = document.createElement("span"); x.className = "sty-del"; x.textContent = "×"; x.title = "Kutudan çıkar"; x.onclick = e => { e.stopPropagation(); savePen(p.id, null); renderOpts(); }; b.appendChild(x); }
    box.appendChild(b);
  }
  const add = document.createElement("button"); add.className = "pb-add"; add.textContent = "+"; add.title = "Şu anki kalemi kutuya ekle"; add.setAttribute("aria-label", add.title);
  add.onclick = () => {
    if (penBox().length >= PEN_MAX){ toast(`Kutuda en çok ${PEN_MAX} kalem olabilir. Düzenle ile birini çıkar.`); return; }
    const k = S.tool === "hl" ? "hl" : "pen", def = (k === "hl" ? "Fosforlu " : "Kalem ") + (penBox().length + 1);
    askText("Kalemin adı", def, n => { savePen("p" + uid(), { name:n, kind:k, color:k === "hl" ? S.hlColor : S.penColor, w:curSize(k), ...(k === "pen" && S.penTip ? { tip:S.penTip } : {}), o:Date.now() }); renderOpts(); });
  };
  const ed = document.createElement("button"); ed.className = "pb-edit"; ed.textContent = penEdit ? "Bitti" : "Düzenle"; ed.onclick = () => { penEdit = !penEdit; renderOpts(); };
  box.append(add, ed);
}
function renderOpts(){
  const sw = $("#swatches"), sz = $("#sizes"); sw.innerHTML = ""; sz.innerHTML = "";
  const t = S.tool, kind = ["hl","pen","text","eraser"].includes(t) ? t : null;
  el.opts.hidden = !kind; if (!kind){ const pb = $("#penBox"); if (pb) pb.hidden = true; return; }
  el.opts.dataset.kind = kind;
  if (kind === "text"){
    /* font for new text boxes */
    const fb = document.createElement("button"); fb.className = "font-pick sm"; fb.innerHTML = ICON.font; const n = document.createElement("span"); n.textContent = fontName(S.textFont); if (S.textFont) n.style.fontFamily = fontCss(S.textFont); fb.appendChild(n);
    fb.title = "Yeni metin kutularının yazı tipi"; fb.onclick = () => openFontPop(fb, S.textFont, fid => { S.textFont = fid; savePrefs(); renderOpts(); });
    queueMicrotask(() => { const sz = $("#sizes"); const sep = document.createElement("span"); sep.className = "vsep"; sz.append(sep, fb); });
  }
  if (kind !== "eraser"){
    const cols = kind === "hl" ? HL_COLORS : PEN_COLORS, hex = kind === "hl" ? HL_HEX : PEN_HEX, cur = kind === "hl" ? S.hlColor : S.penColor;
    const setCol = k => { if (kind === "hl") S.hlColor = k; else S.penColor = k; savePrefs(); renderOpts(); };
    for (const k of cols){
      const b = document.createElement("button"); b.className = "sw"; b.style.background = hex[k]; b.title = CNAME[k]; b.setAttribute("aria-label", CNAME[k]); b.setAttribute("aria-pressed", String(k === cur));
      b.onclick = () => setCol(k); sw.appendChild(b);
    }
    /* v6.9.7: any colour for pen, highlighter and text */
    const more = document.createElement("button"); more.className = "sw sw-more"; more.title = "Başka renk"; more.setAttribute("aria-label", "Başka renk");
    if (isHex(cur)){ more.style.background = cur; more.setAttribute("aria-pressed", "true"); } else more.textContent = "+";
    more.onclick = () => openPalette(more, { title:kind === "hl" ? "Fosforlu kalem rengi" : kind === "text" ? "Yazı rengi" : "Kalem rengi", named:cols.map(k => ({ k, hex:hex[k], name:CNAME[k] })), more:kind === "hl" ? HL_MORE : ACCENT_MORE, current:cur,
      onPick:v => { closePop(); setCol(v); } });
    sw.appendChild(more);
  }
  /* v6.9.7: pen tip: ink, pencil, calligraphy */
  if (kind === "pen"){
    const tg = document.createElement("span"); tg.className = "seg3 tips";
    const TI = { "":['<svg viewBox="0 0 24 24"><path d="M5 19 15.5 8.5l2 2L7 21H5z"/><path d="m15.5 8.5 2-2 2 2-2 2"/></svg>', "Mürekkep"], pencil:['<svg viewBox="0 0 24 24"><path d="M5 19l1-4L16 5l3 3L9 18z"/><path d="m14 7 3 3M6 15l3 3"/></svg>', "Kurşun kalem"], callig:['<svg viewBox="0 0 24 24"><path d="M12 3 7 11l5 10 5-10z"/><path d="M12 11v4"/></svg>', "Kaligrafi ucu"] };
    for (const [k, [ic, nm]] of Object.entries(TI)){ const b = document.createElement("button"); b.innerHTML = ic; b.title = nm; b.setAttribute("aria-label", nm); b.setAttribute("aria-pressed", String((S.penTip || "") === k)); b.onclick = () => { S.penTip = k; savePrefs(); renderOpts(); }; tg.appendChild(b); }
    const sep = document.createElement("span"); sep.className = "vsep"; sw.append(sep, tg);
  }
  /* v6.9.9: shape recognition switch */
  if (kind === "pen" || kind === "hl"){
    const sb = document.createElement("button"); sb.className = "chip-toggle shape-tg"; sb.setAttribute("aria-pressed", String(S.shapeSnap !== false)); sb.title = "Açıkken: çizip kalemi bir an beklet, düzgün şekle dönüşür (çizgi, ok, daire, üçgen, kare, beşgen, altıgen)";
    sb.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 17 9 7l5 10z"/><circle cx="17" cy="9" r="3.5"/></svg><span>Şekil</span>';
    sb.onclick = () => { S.shapeSnap = S.shapeSnap === false; savePrefs(); renderOpts(); toast(S.shapeSnap ? "Şekil tanıma açık: çiz ve kalemi bir an beklet." : "Şekil tanıma kapalı."); };
    const sep = document.createElement("span"); sep.className = "vsep"; sz.append(sep, sb);
  }
  renderPenBox(kind);
  sw.hidden = kind === "eraser"; sw.nextElementSibling.hidden = kind === "eraser";
  const dots = [];
  S.presets[kind].forEach((v, i) => {
    const b = document.createElement("button"); b.className = "sz"; b.title = `${["İnce","Orta","Kalın"][i]} uç (${fmtSize(v)} pt). Seçip kaydırıcıyla değiştirebilirsin.`; b.setAttribute("aria-label", ["İnce","Orta","Kalın"][i] + " uç"); b.setAttribute("aria-pressed", String(S.sizeIdx[kind] === i));
    const d = document.createElement("i"); d.style.width = d.style.height = dotPx(kind, v) + "px"; if (kind === "eraser") d.className = "ring"; b.appendChild(d); dots.push(d);
    b.onclick = () => { S.sizeIdx[kind] = i; savePrefs(); renderOpts(); }; sz.appendChild(b);
  });
  const wrap = document.createElement("label"); wrap.className = "szr-wrap";
  const r = document.createElement("input"); r.type = "range"; r.className = "szr"; r.min = 0; r.max = 100; r.step = 1; r.value = toSlider(kind, curSize(kind)); r.setAttribute("aria-label", SIZE_NAME[kind]); r.title = SIZE_NAME[kind] + " ([ ve ] tuşları)";
  const val = document.createElement("span"); val.className = "szv"; val.innerHTML = `${fmtSize(curSize(kind))}<small>pt</small>`;
  r.addEventListener("input", () => {
    const v = fromSlider(kind, +r.value); S.presets[kind][S.sizeIdx[kind]] = v;
    dots[S.sizeIdx[kind]].style.width = dots[S.sizeIdx[kind]].style.height = dotPx(kind, v) + "px";
    val.innerHTML = `${fmtSize(v)}<small>pt</small>`; r.style.setProperty("--p", r.value + "%"); savePrefs();
  });
  r.style.setProperty("--p", r.value + "%");
  wrap.append(r, val); sz.appendChild(wrap);
  if (kind === "pen" || kind === "hl"){
    const sep = document.createElement("span"); sep.className = "vsep"; sz.appendChild(sep);
    const seg = document.createElement("span"); seg.className = "lmode"; seg.setAttribute("role", "radiogroup"); seg.setAttribute("aria-label", "Çizgi türü");
    for (const m of ["free","line"]){
      const b = document.createElement("button"); b.innerHTML = LINE_ICON[m]; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(S.lineMode[kind] === m));
      b.title = m === "free" ? "Serbest çizim" : "Düz çizgi (bilgisayarda Shift'e basılı tutarak da çizebilirsin)"; b.setAttribute("aria-label", m === "free" ? "Serbest çizim" : "Düz çizgi");
      b.onclick = () => { S.lineMode[kind] = m; savePrefs(); renderOpts(); }; seg.appendChild(b);
    }
    sz.appendChild(seg);
  }
}
function nudgeSize(dir){
  const k = ["hl","pen","text","eraser"].includes(S.tool) ? S.tool : null; if (!k) return;
  const v = fromSlider(k, clamp(toSlider(k, curSize(k)) + dir * 6, 0, 100)); S.presets[k][S.sizeIdx[k]] = v; savePrefs(); renderOpts();
}
function setPenOnly(on, announce){ S.penOnly = on; el.penOnly.setAttribute("aria-pressed", String(on)); ls.set("alinti:penOnly", on ? "1" : "0"); if (announce) toast(on ? "Kalem algılandı. Kalemle yaz, parmakla kaydır." : "Parmakla da yazabilirsin."); }
el.penOnly.onclick = () => setPenOnly(!S.penOnly, true);

/* ================= PDF loading ================= */
async function loadPdfDoc(fp){
  if (S.pdfs.has(fp)) return S.pdfs.get(fp);
  let bytes = S.sampleBytes.get(fp);
  if (bytes) bytes = bytes.slice();
  else { const rec = await DB.get("pdfs", fp).catch(() => null); if (!rec) return null; bytes = rec.bytes.slice ? rec.bytes.slice() : new Uint8Array(rec.bytes); }
  const pdf = await pdfjsLib.getDocument({ data:bytes, isEvalSupported:false }).promise;
  S.pdfs.set(fp, pdf); return pdf;
}
async function ingestPdf(bytes, name, opts = {}){
  const keep = bytes.slice();
  const pdf = await pdfjsLib.getDocument({ data:bytes, isEvalSupported:false }).promise;
  const fp = (pdf.fingerprints && pdf.fingerprints[0]) || ("x" + keep.length + "_" + uid());
  if (!S.pdfs.has(fp)) S.pdfs.set(fp, pdf); else { try { pdf.destroy(); } catch {} }
  if (opts.sample) S.sampleBytes.set(fp, keep); else await DB.put("pdfs", { fp, name, bytes:keep });
  return { fp, pages:S.pdfs.get(fp).numPages };
}

/* ================= viewers ================= */
function makeViewer(idx){
  const v = { idx, fp:null, pdf:null, pages:[], scale:1, curPage:1, gen:0, io:null, touchScroll:null, maxW:600 };
  const root = document.createElement("div"); root.className = "viewer"; root.dataset.v = idx;
  const head = document.createElement("div"); head.className = "vhead";
  const tabs = document.createElement("div"); tabs.className = "vtabs"; tabs.setAttribute("role", "tablist");
  const add = document.createElement("button"); add.className = "icon-btn sm"; add.title = "Projeye belge ekle"; add.setAttribute("aria-label", add.title); add.innerHTML = ICON.plus; add.onclick = () => { S.av = idx; markActive(); $("#filePdf").dataset.mode = "add"; $("#filePdf").click(); };
  const ol = document.createElement("button"); ol.className = "icon-btn sm vbtn-ol"; ol.title = "Sayfalar, içindekiler ve yer imleri"; ol.setAttribute("aria-label", ol.title); ol.innerHTML = ICON.book; ol.onclick = () => openOutline(v, ol);
  const zoom = document.createElement("div"); zoom.className = "vzoom";
  const zo = document.createElement("button"); zo.className = "icon-btn sm zbtn"; zo.innerHTML = ICON.minus; zo.setAttribute("aria-label", "Uzaklaştır"); zo.onclick = () => setScale(v, clamp(v.scale / 1.2, 0.3, 4));
  const pg = document.createElement("button"); pg.className = "hud-val pgbtn"; pg.textContent = "–"; pg.title = "Sayfalara göz at"; pg.onclick = () => openOutline(v, pg, "pages");
  const zi = document.createElement("button"); zi.className = "icon-btn sm zbtn"; zi.innerHTML = ICON.plus; zi.setAttribute("aria-label", "Yakınlaştır"); zi.onclick = () => setScale(v, clamp(v.scale * 1.2, 0.3, 4));
  const zf = document.createElement("button"); zf.className = "icon-btn sm"; zf.innerHTML = ICON.fit; zf.title = "Genişliğe sığdır"; zf.setAttribute("aria-label", zf.title); zf.onclick = () => fitWidth(v);
  zoom.append(zo, pg, zi, zf);
  const sp = document.createElement("button"); sp.className = "icon-btn sm vsplit"; sp.innerHTML = idx === 0 ? ICON.split : ICON.x; sp.title = idx === 0 ? "Yan yana göster" : "İkinci görünümü kapat"; sp.setAttribute("aria-label", sp.title);
  sp.onclick = () => toggleSplit(idx === 0 ? undefined : false);
  head.append(tabs, add, ol, zoom, sp);
  const pane = document.createElement("div"); pane.className = "pane vpane";
  const pages = document.createElement("div"); pages.className = "pages"; pane.appendChild(pages);
  const dens = document.createElement("div"); dens.className = "dens"; dens.setAttribute("aria-label", "Sayfalardaki işaretler");
  root.append(head, pane, dens);
  Object.assign(v, { root, head, tabs, pane, pagesEl:pages, pgEl:pg, dens });
  attachPdfZoom(v);
  pane.addEventListener("scroll", () => { updatePgInfo(v); if (!el.chip.hidden && !chipDrag) positionChip(); scheduleX(); }, { passive:true });
  root.addEventListener("pointerdown", () => { if (S.av !== idx){ S.av = idx; markActive(); } }, true);
  attachPaneHandlers(v);
  return v;
}
function markActive(){ S.viewers.forEach(v => v.root.classList.toggle("active", v.idx === S.av && !S.viewers[1].root.hidden)); }
function initViewers(){ el.pdfArea.innerHTML = ""; S.viewers = [makeViewer(0), makeViewer(1)]; S.viewers.forEach(v => el.pdfArea.appendChild(v.root)); S.viewers[1].root.hidden = true; }
function renderTabs(){
  for (const v of S.viewers){
    v.tabs.innerHTML = "";
    for (const d of S.proj.docs){
      const b = document.createElement("button"); b.className = "vtab" + (S.proj.docs.length < 2 ? " only" : ""); b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(d.fp === v.fp));
      const t = document.createElement("span"); t.textContent = stripPdf(d.name); b.title = d.name; b.appendChild(t);
      const x = document.createElement("i"); x.className = "vx"; x.innerHTML = ICON.x; x.title = "Belgeyi projeden çıkar"; b.appendChild(x);
      b.onclick = e => {
        if (e.target.closest(".vx")){ e.stopPropagation(); if (!b.classList.contains("arm")){ b.classList.add("arm"); toast(`"${stripPdf(d.name)}" ve üzerindeki notlar projeden çıkarılacak. Onaylamak için × işaretine tekrar dokun.`, null, 4000); setTimeout(() => b.classList.remove("arm"), 4000); return; } removeDoc(d.fp); return; }
        if (d.fp !== v.fp) showDoc(v, d.fp);
      };
      v.tabs.appendChild(b);
    }
    const on = v.tabs.querySelector('[aria-selected="true"]'); if (on) v.tabs.scrollLeft = Math.max(0, on.offsetLeft - 8);
  }
}
function toggleSplit(force){
  const on = force === undefined ? !el.pdfArea.classList.contains("dual") : force;
  if (on && isNarrow()) return;
  el.pdfArea.classList.toggle("dual", on); S.viewers[1].root.hidden = !on;
  if (on){
    const v1 = S.viewers[1], other = S.proj.docs.find(d => d.fp !== S.viewers[0].fp) || S.proj.docs[0];
    showDoc(v1, v1.fp && S.proj.docs.some(d => d.fp === v1.fp) ? v1.fp : other.fp);
    S.av = 1;
  } else { S.av = 0; const v1 = S.viewers[1]; v1.gen++; v1.fp = null; v1.pdf = null; v1.pagesEl.innerHTML = ""; v1.pages = []; }
  markActive(); requestAnimationFrame(() => { S.viewers.forEach(v => v.fp && !v.root.hidden && fitWidth(v)); scheduleX(); }); save();
}
async function showDoc(v, fp){
  if (!fp) return;
  const gen = ++v.gen;
  const pdf = await loadPdfDoc(fp);
  if (gen !== v.gen) return;
  if (!pdf){ toast("Bu belgenin PDF dosyası bu cihazda yok.", null, 4500); return; }
  if (v.io) v.io.disconnect(); if (v.io2) v.io2.disconnect();
  const pages = []; let maxW = 0;
  for (let i = 1; i <= pdf.numPages; i++){
    const page = await pdf.getPage(i); if (gen !== v.gen) return;
    const vp = page.getViewport({ scale:1 }); maxW = Math.max(maxW, vp.width);
    const div = document.createElement("div"); div.className = "page"; div.dataset.page = i;
    const num = document.createElement("div"); num.className = "pnum";
    const hl = document.createElement("div"); hl.className = "hlLayer";
    const ink = document.createElementNS(NS, "svg"); ink.setAttribute("class", "ink"); ink.setAttribute("viewBox", `0 0 ${vp.width} ${vp.height}`); ink.setAttribute("preserveAspectRatio", "none");
    const tx = document.createElement("div"); tx.className = "txLayer";
    const cm = document.createElement("div"); cm.className = "cmLayer";
    div.append(num, hl, ink, tx, cm);
    pages.push({ n:i, page, w:vp.width, h:vp.height, div, num, hl, ink, tx, cm, canvas:null, text:null, rendered:0, task:null });
  }
  v.fp = fp; v.pdf = pdf; v.pages = pages; v.maxW = maxW;
  v.pagesEl.innerHTML = ""; pages.forEach(p => v.pagesEl.appendChild(p.div)); v.pane.scrollTop = 0;
  renderTabs(); fitWidth(v, true); renderViewerOverlays(v); scheduleX(); densSoon();
  if (!S.sample) save();
}
function fitWidth(v, initial){ if (!v.pdf) return; const avail = (v.pane.clientWidth || window.innerWidth / (S.viewers[1].root.hidden ? 1 : 2)) - 70; setScale(v, clamp(avail / v.maxW, 0.35, 2.2), initial); }
/* v6.9.9: the spot that should stay still while zooming is held in page units (page + x, y on that page),
   so the fixed gaps between pages and the centring of narrow pages no longer make the view drift */
function pdfAnchor(v, clientX, clientY){
  let best = null, bd = Infinity;
  for (const p of v.pages){ const r = p.div.getBoundingClientRect(), d = clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0; if (d < bd){ bd = d; best = { p, r }; } if (d === 0) break; }
  if (!best) return null;
  return { p:best.p, ux:(clientX - best.r.left) / v.scale, uy:(clientY - best.r.top) / v.scale, cx:clientX, cy:clientY };
}
function pdfRestore(v, a){
  if (!a) return; const r = a.p.div.getBoundingClientRect();
  v.pane.scrollLeft += r.left + a.ux * v.scale - a.cx; v.pane.scrollTop += r.top + a.uy * v.scale - a.cy;
}
function setScale(v, s, initial, at){
  if (!v.pdf) return;
  let anchor = null;
  if (!initial){ const pr = v.pane.getBoundingClientRect(); anchor = pdfAnchor(v, at ? at.x : pr.left + pr.width / 2, at ? at.y : pr.top + pr.height / 2); if (anchor && at && at.cx != null){ anchor.cx = at.cx; anchor.cy = at.cy; } }
  v.scale = s;
  for (const p of v.pages){ p.div.style.width = Math.round(p.w * s) + "px"; p.div.style.height = Math.round(p.h * s) + "px"; p.div.style.setProperty("--scale-factor", s); p.rendered = 0; renderHL(v, p); renderCM(v, p); }
  if (!initial) pdfRestore(v, anchor);
  v.root.querySelectorAll(".tbox textarea").forEach(autosize);
  observePages(v); updatePgInfo(v); scheduleX(); densSoon();
}
/* zoom inside the document pane only: two fingers on touch screens, Ctrl + mouse wheel (or touchpad pinch) on a computer.
   While the fingers move, the pages are only stretched (fast); when they lift, the pages are drawn sharp at the new size,
   keeping the spot under the fingers in place. The rest of the app never zooms. */
/* z: { s0 start scale, k factor, ox/oy the start spot inside the page stack, cx0/cy0 start and cx/cy current spot in screen pixels } */
function startPdfZoom(v, clientX, clientY){
  const pr = v.pagesEl.getBoundingClientRect();
  return { s0:v.scale, k:1, ox:clientX - pr.left, oy:clientY - pr.top, cx0:clientX, cy0:clientY, cx:clientX, cy:clientY };
}
function previewPdfZoom(v, z){ v.pagesEl.style.transformOrigin = `${z.ox}px ${z.oy}px`; v.pagesEl.style.transform = `translate(${z.cx - z.cx0}px, ${z.cy - z.cy0}px) scale(${z.k})`; }
function commitPdfZoom(v, z){
  const s = clamp(z.s0 * z.k, 0.3, 4);
  /* the spot that was under the fingers at the start goes to where the fingers are now */
  const a = pdfAnchorFromStart(v, z);
  v.pagesEl.style.transform = ""; v.pagesEl.style.transformOrigin = "";
  if (Math.abs(s / z.s0 - 1) < 0.01){ if (a){ a.cx = z.cx; a.cy = z.cy; pdfRestore(v, a); } return; }
  v.scale = z.s0; setScale(v, s, true); if (a){ a.cx = z.cx; a.cy = z.cy; pdfRestore(v, a); }
  updatePgInfo(v); scheduleX();
}
/* with the stretch removed, find the page spot that was under the start point */
function pdfAnchorFromStart(v, z){ const t = v.pagesEl.style.transform; v.pagesEl.style.transform = ""; const a = pdfAnchor(v, z.cx0, z.cy0); v.pagesEl.style.transform = t; return a; }
function attachPdfZoom(v){
  const pane = v.pane; let pz = null;
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const mid = (a, b) => { const r = pane.getBoundingClientRect(); return { x:(a.clientX + b.clientX) / 2 - r.left, y:(a.clientY + b.clientY) / 2 - r.top }; };
  pane.addEventListener("touchstart", e => {
    if (e.touches.length !== 2 || !v.pdf) return;
    e.preventDefault();
    if (draw && draw.where === "pdf" && draw.v === v){ cancelAnimationFrame(draw.raf); if (draw.path) draw.path.remove(); draw = null; }
    const [a, b] = e.touches, mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
    pz = { d0:Math.max(1, dist(a, b)), ...startPdfZoom(v, mx, my) };
  }, { passive:false });
  pane.addEventListener("touchmove", e => {
    if (!pz) return; e.preventDefault(); if (e.touches.length < 2) return;
    const [a, b] = e.touches;
    pz.k = clamp(pz.s0 * dist(a, b) / pz.d0, 0.3, 4) / pz.s0; pz.cx = (a.clientX + b.clientX) / 2; pz.cy = (a.clientY + b.clientY) / 2; previewPdfZoom(v, pz);
  }, { passive:false });
  const end = e => { if (!pz || e.touches.length >= 2) return; const z = pz; pz = null; commitPdfZoom(v, z); };
  pane.addEventListener("touchend", end); pane.addEventListener("touchcancel", end);
  pane.addEventListener("wheel", e => {
    if (!(e.ctrlKey || e.metaKey) || !v.pdf) return;
    e.preventDefault();
    if (!v.wz) v.wz = startPdfZoom(v, e.clientX, e.clientY);
    const z = v.wz; z.k = clamp(z.s0 * z.k * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0025)), 0.3, 4) / z.s0;
    /* the wheel zooms around the pointer: keep the start spot under it (move the origin if the pointer moved) */
    if (Math.hypot(e.clientX - z.cx, e.clientY - z.cy) > 2){ z.cx = e.clientX; z.cy = e.clientY; }
    previewPdfZoom(v, z); clearTimeout(v.wzT); v.wzT = setTimeout(() => { const zz = v.wz; v.wz = null; if (zz) commitPdfZoom(v, zz); }, 200);
  }, { passive:false });
}
/* the browser itself never zooms the whole app (pinch, Ctrl + wheel, Ctrl +/-): toolbars and buttons keep their size */
window.addEventListener("wheel", e => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive:false });
for (const ev of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ev, e => e.preventDefault(), { passive:false });
document.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || !["+", "=", "-", "0"].includes(e.key)) return;
  e.preventDefault();
  if (document.body.dataset.view !== "editor" || !S.proj) return;
  const v = AV(); if (!v || !v.pdf) return;
  if (e.key === "0") fitWidth(v); else setScale(v, clamp(v.scale * (e.key === "-" ? 1 / 1.2 : 1.2), 0.3, 4));
}, true);
function observePages(v){
  if (v.io) v.io.disconnect(); if (v.io2) v.io2.disconnect();
  v.io = new IntersectionObserver(entries => { for (const e of entries) if (e.isIntersecting){ const p = v.pages[+e.target.dataset.page - 1]; if (p && p.rendered !== v.scale) renderPage(v, p); } }, { root:v.pane, rootMargin:"800px 0px" });
  /* big books: pages far from view give their memory back and are drawn again when you come back */
  v.io2 = new IntersectionObserver(entries => { for (const e of entries) if (!e.isIntersecting){ const p = v.pages[+e.target.dataset.page - 1]; if (p) unloadPage(p); } }, { root:v.pane, rootMargin:"4000px 0px" });
  v.pages.forEach(p => { v.io.observe(p.div); v.io2.observe(p.div); });
}
function unloadPage(p){
  if (!p.canvas && !p.task) return;
  if (p.task){ try { p.task.cancel(); } catch {} p.task = null; }
  if (p.canvas){ p.canvas.width = p.canvas.height = 0; p.canvas.remove(); p.canvas = null; }
  if (p.text && !p.text.contains(document.getSelection().anchorNode)){ p.text.remove(); p.text = null; }
  p.rendered = 0;
}
async function renderPage(v, p){
  const scale = v.scale; p.rendered = scale;
  if (p.task){ try { p.task.cancel(); } catch {} }
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5), vp = p.page.getViewport({ scale });
  const canvas = document.createElement("canvas"); canvas.width = Math.floor(vp.width * dpr); canvas.height = Math.floor(vp.height * dpr);
  const task = p.page.render({ canvasContext:canvas.getContext("2d"), viewport:vp, transform: dpr !== 1 ? [dpr,0,0,dpr,0,0] : null }); p.task = task;
  try { await task.promise; } catch (e){ if (e && e.name === "RenderingCancelledException") return; console.error(e); }
  if (p.rendered !== scale) return;
  if (p.canvas) p.canvas.remove(); p.div.insertBefore(canvas, p.hl); p.canvas = canvas;
  const tl = document.createElement("div"); tl.className = "textLayer";
  try { const tc = await p.page.getTextContent(); if (p.rendered !== scale) return; await pdfjsLib.renderTextLayer({ textContentSource:tc, container:tl, viewport:vp, textDivs:[] }).promise; } catch (e){ console.warn("text layer", e); }
  if (p.rendered !== scale) return;
  const eoc = document.createElement("div"); eoc.className = "endOfContent"; tl.appendChild(eoc);
  if (p.text) p.text.remove(); p.div.insertBefore(tl, p.ink); p.text = tl;
  tl.addEventListener("mousedown", () => tl.classList.add("selecting"));
  markSearchHits(v, p);
}
document.addEventListener("mouseup", () => document.querySelectorAll(".textLayer.selecting").forEach(t => t.classList.remove("selecting")));
function updatePgInfo(v){
  if (!v.pdf){ v.pgEl.textContent = "–"; return; }
  const mid = v.pane.scrollTop + v.pane.clientHeight / 3; let cur = 1;
  for (const p of v.pages){ if (p.div.offsetTop <= mid) cur = p.n; else break; }
  v.curPage = cur; v.pgEl.textContent = `${cur} / ${v.pages.length}`;
  if (S.proj && !S.sample && v.fp) readTick(v.fp, cur);
  /* reading progress for the library: the furthest page reached (the last page counts once the end is on screen) */
  if (S.proj && !S.sample && v.fp && v.pages.length){
    const end = v.pane.scrollTop + v.pane.clientHeight >= v.pane.scrollHeight - 8 ? v.pages.length : cur;
    const rd = S.proj.read || (S.proj.read = {}), prev = rd[v.fp];
    if (!prev || end > prev[0] || prev[1] !== v.pages.length){ rd[v.fp] = [Math.max(end, prev ? Math.min(prev[0], v.pages.length) : 0), v.pages.length]; save(); }
  }
}
function scrollToPage(v, page, y = 0, smooth){
  const p = v.pages[page - 1]; if (!p) return;
  v.pane.scrollTo({ top:p.div.offsetTop + y * v.scale - 90, behavior: smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });
}
async function revealInDoc(fp, page, y){
  if (isNarrow()) setTab("pdf");
  let v = S.viewers.find(x => !x.root.hidden && x.fp === fp);
  if (!v){ v = AV(); await showDoc(v, fp); }
  S.av = v.idx; markActive();
  await new Promise(r => requestAnimationFrame(r));
  scrollToPage(v, page, y || 0, true);
  return v;
}
async function removeDoc(fp){
  const p = S.proj;
  if (p.docs.length < 2){ toast("Projenin tek belgesi çıkarılamaz."); return; }
  p.docs = p.docs.filter(d => d.fp !== fp);
  const gone = new Set(p.items.filter(i => i.doc === fp).map(i => i.id));
  p.items = p.items.filter(i => i.doc !== fp);
  const anchGone = new Set([...p.ink.filter(s => s.doc === fp), ...p.texts.filter(t => t.doc === fp), ...p.comments.filter(c => c.doc === fp), ...p.pins.filter(n => n.doc === fp)].map(o => o.id));
  p.pins = p.pins.filter(n => n.doc !== fp) ; p.ink = p.ink.filter(s => s.doc !== fp); p.texts = p.texts.filter(t => t.doc !== fp); p.comments = p.comments.filter(c => c.doc !== fp); p.bookmarks = p.bookmarks.filter(b => b.doc !== fp);
  p.links = p.links.filter(l => !gone.has(l.a) && !gone.has(l.b) && !(l.anchor && anchGone.has(l.anchor.id)) && !(l.pins && l.pins.some(id => anchGone.has(id))));
  normalizeGroups();
  for (const v of S.viewers) if (v.fp === fp){ v.fp = null; if (!v.root.hidden) await showDoc(v, p.docs[0].fp); }
  renderTabs(); renderWs(); commit(); toast("Belge projeden çıkarıldı", { label:"Geri al", fn:undo });
}

/* ================= overlays ================= */
const recAttr = (node, o) => { if (o.rec){ node.dataset.rec = o.rec; node.dataset.t = o.t; } };
const viewersOf = fp => S.viewers.filter(v => !v.root.hidden && v.fp === fp);
function forPage(fp, n, fn){ for (const v of viewersOf(fp)){ const p = v.pages[n - 1]; if (p) fn(v, p); } }
function renderHL(v, p){
  const s = v.scale; p.hl.innerHTML = "";
  for (const it of S.proj.items){
    if ((it.type !== "excerpt" && it.type !== "image") || it.doc !== v.fp || it.page !== p.n) continue;
    for (const r of it.rects){
      const d = document.createElement("div"); d.className = "hl " + (it.type === "image" ? "img" : "c-" + it.color) + (S.flashId === it.id ? " flash" : "");
      d.dataset.id = it.id; d.style.cssText = `left:${r.x*s}px;top:${r.y*s}px;width:${r.w*s}px;height:${r.h*s}px`; recAttr(d, it); p.hl.appendChild(d);
    }
  }
}
function renderInkP(v, p){ p.ink.innerHTML = ""; if (ISEL.on && ISEL.where === "pdf" && ISEL.p === p) queueMicrotask(iselDraw); for (const st of S.proj.ink) if (st.where === "pdf" && st.doc === v.fp && st.page === p.n) p.ink.appendChild(inkPath(st)); }
function renderTextsP(v, p){ p.tx.innerHTML = ""; for (const t of S.proj.texts) if (t.doc === v.fp && t.page === p.n) p.tx.appendChild(tboxEl(t, v, p)); p.tx.querySelectorAll("textarea").forEach(autosize); }
function renderCM(v, p){
  const s = v.scale; p.cm.innerHTML = "";
  for (const pn of S.proj.pins){
    if (pn.doc !== v.fp || pn.page !== p.n) continue;
    const b = document.createElement("button"); b.className = "pinmark"; b.dataset.id = pn.id; b.style.left = pn.x * s + "px"; b.style.top = pn.y * s + "px"; recAttr(b, pn);
    b.title = "Bağlı karta git"; b.setAttribute("aria-label", "Bağlantı işareti");
    b.onclick = e => { e.stopPropagation(); if (S.linkFrom){ completeAnchor({ type:"pin", id:pn.id }); return; }
      const DL = S.proj.links.find(l => l.pins && l.pins.includes(pn.id)); if (DL){ followDocLink(DL, pn.id, v.idx); return; }
      const WL = S.proj.links.find(l => l.pin === pn.id); if (WL){ goToWsPoint(WL); return; }
      const L = S.proj.links.find(l => l.anchor && l.anchor.id === pn.id); if (L) focusCard(L.a); };
    p.cm.appendChild(b);
  }
  for (const c of S.proj.comments){
    if (c.doc !== v.fp || c.page !== p.n) continue;
    for (const r of c.rects){ const m = document.createElement("div"); m.className = "cmark"; m.style.cssText = `left:${r.x*s}px;top:${(r.y + r.h)*s - 2}px;width:${r.w*s}px`; recAttr(m, c); p.cm.appendChild(m); }
    const pin = document.createElement("button"); pin.className = "cpin" + (c.text.trim() ? "" : " empty"); pin.dataset.id = c.id; pin.innerHTML = ICON.comment;
    pin.title = c.text.trim() ? c.text.slice(0, 120) : "Yorum"; pin.setAttribute("aria-label", "Yorum"); pin.style.top = ((c.rects[0] ? c.rects[0].y : 0) * s) + "px"; recAttr(pin, c);
    pin.onclick = e => { e.stopPropagation(); if (S.linkFrom){ completeAnchor({ type:"comment", id:c.id }); return; } openComment(c.id, pin); };
    p.cm.appendChild(pin);
  }
}
function renderNum(v, p){
  p.num.innerHTML = ""; const lab = document.createElement("span"); lab.textContent = "s. " + p.n; p.num.appendChild(lab);
  if (S.proj.bookmarks.some(b => b.doc === v.fp && b.page === p.n)){ const b = document.createElement("span"); b.className = "bmk"; b.innerHTML = ICON.ribbon; b.title = "Yer imi"; p.num.appendChild(b); }
  const recs = S.proj.recs.filter(r => r.doc === v.fp && r.page === p.n);
  if (recs.length){ const b = document.createElement("button"); b.className = "mic"; b.innerHTML = ICON.mic + (recs.length > 1 ? recs.length + " kayıt" : fmtT(recs[0].dur)); b.title = "Bu sayfanın ses kayıtları"; b.onclick = () => openRecList(b, v.fp, p.n); p.num.appendChild(b); }
}
function renderViewerOverlays(v){ for (const p of v.pages){ renderHL(v, p); renderInkP(v, p); renderTextsP(v, p); renderCM(v, p); renderNum(v, p); } refreshReveal(); }
function renderAllOverlays(){ S.viewers.forEach(v => { if (v.fp && !v.root.hidden) renderViewerOverlays(v); }); renderWsInk(); scheduleX(); }
const renderDocPage = (fp, n) => { forPage(fp, n, (v, p) => { renderHL(v, p); renderInkP(v, p); renderTextsP(v, p); renderCM(v, p); renderNum(v, p); }); refreshReveal(); scheduleX(); };

/* ================= ink ================= */
/* the two edges of a filled stroke. Width comes from pressure, and for the calligraphy nib (v6.9.7) from the direction:
   a flat nib held at 45° draws thin strokes one way and wide strokes across it */
function outlineSides(pts, w, pressure, nib){
  const n = pts.length, dir = [];
  for (let i = 0; i < n; i++){ const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dir.push([dx / len, dy / len]); }
  let rr = pts.map((q, i) => {
    let r = (pressure ? w * (0.35 + 1.0 * (q[2] ?? 0.5)) : w) / 2;
    if (nib){ const ang = Math.atan2(dir[i][1], dir[i][0]); r *= 0.16 + 0.84 * Math.abs(Math.sin(ang - Math.PI / 4)); }
    return r;
  });
  if (nib && n > 2) rr = rr.map((r, i) => (rr[Math.max(0, i - 1)] + 2 * r + rr[Math.min(n - 1, i + 1)]) / 4);
  const L = [], R = [];
  for (let i = 0; i < n; i++){ const [dx, dy] = dir[i], r = rr[i]; L.push([r2(pts[i][0] - dy * r), r2(pts[i][1] + dx * r)]); R.push([r2(pts[i][0] + dy * r), r2(pts[i][1] - dx * r)]); }
  return { L, R, rs:r2(rr[0]), re:r2(rr[n - 1]) };
}
function outlineD(pts, w, pressure, nib){
  const n = pts.length;
  if (n === 1){ const [x, y] = pts[0], r = r2((pressure ? w * (0.35 + 1.0 * (pts[0][2] ?? 0.5)) : w) / 2 * (nib ? 0.6 : 1)); return `M${r2(x - r)},${y}a${r},${r} 0 1,0 ${r2(2*r)},0a${r},${r} 0 1,0 ${r2(-2*r)},0Z`; }
  const { L, R, rs, re } = outlineSides(pts, w, pressure, nib);
  /* both edges are drawn as smooth curves through the midpoints (no visible corners) */
  const curve = P => { let d = ""; for (let i = 1; i < P.length - 1; i++) d += `Q${P[i][0]},${P[i][1]} ${r2((P[i][0] + P[i+1][0]) / 2)},${r2((P[i][1] + P[i+1][1]) / 2)}`; return d + `L${P[P.length-1][0]},${P[P.length-1][1]}`; };
  const Rb = R.slice().reverse();
  return `M${L[0][0]},${L[0][1]}` + curve(L) + `A${re},${re} 0 0,1 ${R[n-1][0]},${R[n-1][1]}` + curve(Rb) + `A${rs},${rs} 0 0,1 ${L[0][0]},${L[0][1]}Z`;
}
/* ink colour: a named colour or (v6.9.7) any "#rrggbb" */
const inkHex = st => isHex(st.color) ? st.color : st.kind === "hl" ? HL_HEX[st.color] || HL_HEX.y : PEN_HEX[st.color] || PEN_HEX.k;
const TIPS = ["pencil", "callig"];
const filled = st => st.kind !== "hl" && (st.tip === "callig" || (st.pr && st.tip !== "pencil"));
/* ---- pen smoothing: a One Euro filter on the points (steady when slow, quick when fast) and a gentle filter on pressure ---- */
function oneEuro(minCut = 2.5, beta = 0.025, dCut = 1.2){
  const a = (fc, dt) => { const tau = 1 / (2 * Math.PI * fc); return 1 / (1 + tau / dt); };
  let x = null, dx = 0, t0 = 0;
  return (v, t, k) => { /* v: value, t: ms, k: screen pixels per unit (so the feel is the same at any zoom) */
    if (x === null){ x = v; t0 = t; return v; }
    const dt = (t - t0 > 0.5 ? Math.min(t - t0, 50) : 4) / 1000; t0 = t; /* same time stamp twice: assume a 240 Hz pen */
    const d = (v - x) / dt; dx = dx + a(dCut, dt) * (d - dx);
    x = x + a(minCut + beta * Math.abs(dx) * k, dt) * (v - x); return x;
  };
}
function polyD(pts){
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}l0.01,0`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++){ d += `Q${pts[i][0]},${pts[i][1]} ${r2((pts[i][0] + pts[i+1][0]) / 2)},${r2((pts[i][1] + pts[i+1][1]) / 2)}`; }
  const l = pts[pts.length - 1]; return d + `L${l[0]},${l[1]}`;
}
/* pressure strokes are filled outlines; everything else is a round-capped stroke, which stays clean at any width */
/* shapes (v6.9.9) keep sharp corners: drawn with straight segments */
const linD = pts => pts.length ? `M${pts[0][0]},${pts[0][1]}` + pts.slice(1).map(q => `L${q[0]},${q[1]}`).join("") : "";
const inkD = st => st.sh ? linD(st.pts) : polyD(st.pts);
const strokeD = st => filled(st) ? outlineD(st.pts, st.w, st.pr, st.tip === "callig") : inkD(st);
function inkPath(st){
  const path = document.createElementNS(NS, "path"), hex = isHex(st.color), tip = st.tip === "pencil" ? " ipencil" : "";
  if (st.kind === "hl"){ path.setAttribute("d", inkD(st)); path.setAttribute("class", "ihl hc-" + (hex ? "x" : st.color)); path.setAttribute("stroke-width", st.w); if (hex) path.style.stroke = st.color; }
  else if (!filled(st)){ path.setAttribute("d", inkD(st)); path.setAttribute("class", "ips ik-" + (hex ? "x" : st.color) + tip); path.setAttribute("stroke-width", st.w); if (hex) path.style.stroke = st.color; }
  else { path.setAttribute("d", outlineD(st.pts, st.w, st.pr, st.tip === "callig")); path.setAttribute("class", "ipen ik-" + (hex ? "x" : st.color)); if (hex) path.style.fill = st.color; }
  path.dataset.id = st.id; recAttr(path, st); return path;
}
function renderWsInk(){ el.wsInk.innerHTML = ""; if (!S.proj) return; if (ISEL.on && ISEL.where === "ws") queueMicrotask(iselDraw); for (const st of S.proj.ink) if (st.where === "ws" && st.space === S.space) el.wsInk.appendChild(inkPath(st)); }
function distSeg(px, py, a, b){ const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx*dx + dy*dy, t = l2 ? clamp(((px - a[0]) * dx + (py - a[1]) * dy) / l2, 0, 1) : 0; return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy)); }
function strokeHit(st, x, y, r){ const pts = st.pts, pad = r + st.w / 2; if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) <= pad; for (let i = 1; i < pts.length; i++) if (distSeg(x, y, pts[i-1], pts[i]) <= pad) return true; return false; }

/* ================= drawing on PDF ================= */
let draw = null;
const pointsFrom = e => (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
function pagePoint(v, p, e){ const r = p.div.getBoundingClientRect(); return [ r2((e.clientX - r.left) / v.scale), r2((e.clientY - r.top) / v.scale) ]; }
function pageAt(v, e){ const d = e.target.closest && e.target.closest(".page"); return d && v.pagesEl.contains(d) ? v.pages[+d.dataset.page - 1] : null; }
function beginStroke(e, where, v, p, pt){
  const kind = S.tool === "hl" ? "hl" : "pen";
  const st = stamp({ id:uid(), where, kind, color: kind === "hl" ? S.hlColor : S.penColor, w:curSize(kind), ...(kind === "pen" && TIPS.includes(S.penTip) ? { tip:S.penTip } : {}), pr: kind === "pen" && e.pointerType === "pen", pts:[] });
  if (where === "pdf"){ st.doc = v.fp; st.page = p.n; } else st.space = S.space;
  if (where === "ws") pt = clampPt(pt);
  st.pts.push([pt[0], pt[1], r2(e.pressure || 0.5)]);
  const path = inkPath(st); (where === "pdf" ? p.ink : el.wsInk).appendChild(path);
  /* pen and finger get smoothed; a mouse is already steady */
  const smooth = e.pointerType === "pen" || e.pointerType === "touch";
  draw = { mode:"stroke", st, path, where, v, p, id:e.pointerId, start:st.pts[0], straight:false, sx:e.clientX, sy:e.clientY,
    fx:smooth ? oneEuro() : null, fy:smooth ? oneEuro() : null, fp:e.pressure || 0.5, raw:null, pred:null, k:where === "pdf" ? v.scale : view().s,
    srcCard: where === "ws" && e.target.closest && e.target.closest(".card") ? e.target.closest(".card").dataset.id : null };
  if (draw.fx){ draw.fx(pt[0], e.timeStamp, draw.k); draw.fy(pt[1], e.timeStamp, draw.k); }
  if (S.lineMode[kind] === "line" || e.shiftKey) makeStraight();
}
/* ======= ink links: a pen stroke from a card to the document (or back, or to another card) becomes a link ======= */
function makePin(v, p, pt){ const pn = stamp({ id:"n" + uid(), doc:v.fp, page:p.n, x:r2(clamp(pt[0], 0, p.w)), y:r2(clamp(pt[1], 0, p.h)) }); S.proj.pins.push(pn); return pn; }
const linkTmp = document.createElementNS(NS, "svg"); linkTmp.id = "linkTmp"; document.body.appendChild(linkTmp);
function clearLinkPreview(){ linkTmp.innerHTML = ""; document.querySelectorAll(".linktarget").forEach(n => n.classList.remove("linktarget")); }
function inkLinkTarget(e){
  const d = draw; if (!d || d.mode !== "stroke") return null;
  const under = document.elementFromPoint(e.clientX, e.clientY); if (!under) return null;
  const card = under.closest(".card"), page = under.closest(".viewer .page");
  if (d.where === "pdf"){
    if (card && el.ws.contains(card) && !isNarrow()) return { card };
    /* from one document to the other one shown side by side */
    const vr = page && page.closest(".viewer"); if (vr && +vr.dataset.v !== d.v.idx && !isNarrow()) return { page2:page };
    /* from the book to any spot on the workspace, e.g. next to your handwriting */
    if (!isNarrow() && el.ws.contains(under) && !under.closest(".hud,.spaces,.wsfind,.link-hint")) return { ws:true };
    return null;
  }
  if (!d.srcCard){ if (page && !isNarrow()) return { page, fromWs:true }; return null; }
  if (card && el.ws.contains(card) && card.dataset.id !== d.srcCard) return { card };
  if (page && !isNarrow()) return { page };
  return null;
}
function linkPreview(e){
  clearLinkPreview();
  const t = inkLinkTarget(e); draw.path.style.opacity = t ? ".3" : ""; if (!t) return;
  (t.card || t.page || t.page2 || el.ws).classList.add("linktarget");
  const box = (draw.where === "pdf" ? draw.v.pane : el.ws).getBoundingClientRect();
  if (e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom) return;
  linkTmp.innerHTML = ARROW_DEFS("tmpA") + `<path class="xl tmp" d="M${draw.sx},${draw.sy} L${e.clientX},${e.clientY}" marker-end="url(#tmpA)"/>`;
}
function tryInkLink(e){
  const d = draw, t = inkLinkTarget(e); clearLinkPreview(); if (!t) return false;
  let link, pin = null;
  let pin2 = null;
  const look = { ...(S.lastLinkColor ? { color:S.lastLinkColor } : {}), ...(S.lastLinkDash ? { dash:true } : {}), ...(S.lastLinkShape ? { shape:S.lastLinkShape } : {}) };
  if (d.where === "pdf" && t.ws){
    const p = screenToPlane(e.clientX, e.clientY); pin = makePin(d.v, d.p, d.start);
    link = { id:uid(), pin:pin.id, at:{ space:S.space, x:r2(p.x), y:r2(p.y) }, heads:"end", ...look };
  } else if (t.fromWs){
    const vr = t.page.closest(".viewer"), v = S.viewers[+vr.dataset.v], p = v.pages[+t.page.dataset.page - 1];
    pin = makePin(v, p, pagePoint(v, p, e)); link = { id:uid(), pin:pin.id, at:{ space:S.space, x:r2(d.start[0]), y:r2(d.start[1]) }, heads:"start", ...look };
  } else if (d.where === "pdf" && t.page2){
    const vr = t.page2.closest(".viewer"), v2 = S.viewers[+vr.dataset.v], p2 = v2.pages[+t.page2.dataset.page - 1];
    pin = makePin(d.v, d.p, d.start); pin2 = makePin(v2, p2, pagePoint(v2, p2, e)); link = { id:uid(), pins:[pin.id, pin2.id], arrow:true };
  } else if (d.where === "pdf"){
    const cid = t.card.dataset.id; pin = makePin(d.v, d.p, d.start); link = { id:uid(), a:cid, anchor:{ type:"pin", id:pin.id }, to:"card" };
  } else if (t.card){
    const b = t.card.dataset.id;
    if (S.proj.links.some(L => !L.anchor && ((L.a === d.srcCard && L.b === b) || (L.a === b && L.b === d.srcCard)))){ toast("Bu iki kart zaten bağlı"); cancelAnimationFrame(d.raf); d.path.remove(); draw = null; return true; }
    link = { id:uid(), a:d.srcCard, b, arrow:true };
  } else {
    const vr = t.page.closest(".viewer"), v = S.viewers[+vr.dataset.v], p = v.pages[+t.page.dataset.page - 1];
    pin = makePin(v, p, pagePoint(v, p, e)); link = { id:uid(), a:d.srcCard, anchor:{ type:"pin", id:pin.id }, to:"anchor" };
  }
  cancelAnimationFrame(d.raf); d.path.remove(); draw = null;
  if (S.lastLinkColor) link.color = S.lastLinkColor; if (S.lastLinkDash) link.dash = true; if (S.lastLinkShape) link.shape = S.lastLinkShape;
  S.proj.links.push(link); if (pin) renderDocPage(pin.doc, pin.page); if (pin2) renderDocPage(pin2.doc, pin2.page);
  if (link.pins){ S.selLink = null; commit(); scheduleX(); toast("İki belge birbirine bağlandı. İşarete dokununca karşı uca gidersin."); return true; }
  if (link.pin){ growSheet(link.at.x - 20, link.at.y - 20, link.at.x + 20, link.at.y + 20); renderSheet(); S.selLink = null; drawLinks(); commit(); toast("Belgedeki yer masadaki noktaya bağlandı. İki uçtaki işarete dokununca karşı uca gidersin.", null, 4500); return true; }
  S.sel = link.a; S.selLink = null; renderWs(); commit(); toast(pin ? "Kart belgedeki yere bağlandı" : "Kartlar bağlandı");
  return true;
}
/* ================= shape recognition (v6.9.9): draw, then hold the pen still for a moment =================
   Only the hold turns a stroke into a shape, so handwriting (an "O", a "D") is never changed by itself.
   The stroke is resampled and its turning is measured: corners are where the direction changes sharply in a short stretch,
   a round shape turns evenly. Open strokes become a line or an arrow; closed ones a circle, ellipse, triangle, rectangle/square,
   quadrilateral, pentagon or hexagon (five and six sides become regular). */
function resample(pts, n){
  const P = pts.map(q => [q[0], q[1]]); let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  if (L <= 0) return null;
  const step = L / (n - 1), out = [P[0].slice()]; let acc = 0;
  for (let i = 1; i < P.length; i++){
    let a = P[i - 1], b = P[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (acc + d >= step && out.length < n){ const t = (step - acc) / d, q = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]; out.push(q); a = q; d = Math.hypot(b[0] - a[0], b[1] - a[1]); acc = 0; }
    acc += d;
  }
  while (out.length < n) out.push(P[P.length - 1].slice());
  return { pts:out, L };
}
const angOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function findCorners(R, closed){
  const n = R.length, th = [];
  for (let i = 0; i < n; i++){
    const a = R[(i - 3 + n) % n], b = R[i], c = R[(i + 3) % n];
    th.push(!closed && (i < 3 || i > n - 4) ? 0 : Math.abs(angDiff(angOf(a, b), angOf(b, c))));
  }
  const out = [];
  for (let i = 0; i < n; i++){
    if (th[i] < 0.55) continue; /* about 30° within a short stretch */
    const prev = th[(i - 1 + n) % n], next = th[(i + 1) % n]; if (th[i] < prev || th[i] < next) continue;
    if (out.length && i - out[out.length - 1] < 4){ if (th[i] > th[out[out.length - 1]]) out[out.length - 1] = i; continue; }
    out.push(i);
  }
  if (closed && out.length > 1 && out[0] + n - out[out.length - 1] < 4){ if (th[out[0]] < th[out[out.length - 1]]) out.shift(); else out.pop(); }
  return out;
}
function regularPoly(n, cx, cy, r, rot){ const out = []; for (let i = 0; i <= n; i++){ const a = rot + i * 2 * Math.PI / n; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return out; }
function recognizeShape(raw){
  const xs = raw.map(q => q[0]), ys = raw.map(q => q[1]), x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys), diag = Math.hypot(x2 - x1, y2 - y1);
  if (diag <= 0) return null;
  const rs = resample(raw, 72); if (!rs) return null; const R = rs.pts, L = rs.L;
  const A = R[0], B = R[R.length - 1], gap = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const closed = gap < Math.max(0.22 * diag, L * 0.08);
  if (!closed){
    if (gap / L > 0.9) return { name:"Çizgi", pts:[A, B] };
    /* arrow drawn in one go: a long shaft, then a short head at the tip */
    const C = findCorners(R, false);
    if (C.length >= 1){
      const tipI = C[0], tip = R[tipI], shaft = Math.hypot(tip[0] - A[0], tip[1] - A[1]);
      let tail = 0; for (let i = tipI + 1; i < R.length; i++) tail += Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]);
      const nearTip = R.slice(tipI).every(q => Math.hypot(q[0] - tip[0], q[1] - tip[1]) < shaft * 0.5);
      let straight = 0; for (let i = 1; i <= tipI; i++) straight += Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]);
      if (nearTip && tail < shaft * 1.2 && shaft / Math.max(1, straight) > 0.9 && shaft > diag * 0.55){
        const a = angOf(A, tip), h = clamp(shaft * 0.2, 6, shaft * 0.45), w1 = [tip[0] - h * Math.cos(a - 0.5), tip[1] - h * Math.sin(a - 0.5)], w2 = [tip[0] - h * Math.cos(a + 0.5), tip[1] - h * Math.sin(a + 0.5)];
        return { name:"Ok", pts:[A, tip, w1, tip, w2] };
      }
    }
    return null;
  }
  const C = findCorners(R, true);
  /* drop corners where the outline barely turns (noise on a straight side) */
  for (let again = true; again && C.length > 2;){ again = false; let wk = -1, wa = 9;
    C.forEach((ci, k) => { const a = R[C[(k - 1 + C.length) % C.length]], b = R[ci], c = R[C[(k + 1) % C.length]], t = Math.abs(angDiff(angOf(a, b), angOf(b, c))); if (t < wa){ wa = t; wk = k; } });
    if (wa < 0.42){ C.splice(wk, 1); again = true; } }
  const cx = R.reduce((s, q) => s + q[0], 0) / R.length, cy = R.reduce((s, q) => s + q[1], 0) / R.length;
  if (C.length <= 1){
    /* round: circle when nearly as wide as tall, otherwise an ellipse in the drawn box */
    const rx = (x2 - x1) / 2, ry = (y2 - y1) / 2, ecx = (x1 + x2) / 2, ecy = (y1 + y2) / 2;
    if (Math.min(rx, ry) / Math.max(rx, ry) > 0.8){ const r = (rx + ry) / 2, out = []; for (let i = 0; i <= 72; i++){ const a = i / 72 * 2 * Math.PI; out.push([ecx + r * Math.cos(a), ecy + r * Math.sin(a)]); } return { name:"Daire", pts:out, round:true }; }
    const out = []; for (let i = 0; i <= 72; i++){ const a = i / 72 * 2 * Math.PI; out.push([ecx + rx * Math.cos(a), ecy + ry * Math.sin(a)]); } return { name:"Elips", pts:out, round:true };
  }
  /* corners only count when the parts between them are straight; a wobbly circle can show false corners but curved sides */
  const bent = C.some((ci, k) => { const cj = C[(k + 1) % C.length], P = R[ci], Q = R[cj], len = Math.hypot(Q[0] - P[0], Q[1] - P[1]); if (len < 1) return false;
    let mx = 0; for (let i = ci; i !== cj; i = (i + 1) % R.length){ const q = R[i]; mx = Math.max(mx, Math.abs((Q[0] - P[0]) * (P[1] - q[1]) - (P[0] - q[0]) * (Q[1] - P[1])) / len); } return mx / len > 0.1; });
  if (bent){ const rx = (x2 - x1) / 2, ry = (y2 - y1) / 2, ecx = (x1 + x2) / 2, ecy = (y1 + y2) / 2, r = (rx + ry) / 2, round = Math.min(rx, ry) / Math.max(rx, ry) > 0.8, out = [];
    for (let i = 0; i <= 72; i++){ const a = i / 72 * 2 * Math.PI; out.push([ecx + (round ? r : rx) * Math.cos(a), ecy + (round ? r : ry) * Math.sin(a)]); } return { name:round ? "Daire" : "Elips", pts:out, round:true }; }
  const V = C.map(i => R[i]), n = V.length;
  if (n === 2) return null;
  if (n === 3){
    const sides = [0, 1, 2].map(i => Math.hypot(V[(i + 1) % 3][0] - V[i][0], V[(i + 1) % 3][1] - V[i][1])), mx = Math.max(...sides), mn = Math.min(...sides);
    if (mn / mx > 0.86){ const tcx = (V[0][0] + V[1][0] + V[2][0]) / 3, tcy = (V[0][1] + V[1][1] + V[2][1]) / 3, r = V.reduce((s, q) => s + Math.hypot(q[0] - tcx, q[1] - tcy), 0) / 3; return { name:"Eşkenar üçgen", pts:regularPoly(3, tcx, tcy, r, angOf([tcx, tcy], V[0])) }; }
    return { name:"Üçgen", pts:[...V, V[0]] };
  }
  if (n === 4){
    const ang = [0, 1, 2, 3].map(i => { const a = V[(i + 3) % 4], b = V[i], c = V[(i + 1) % 4]; return Math.abs(Math.PI - Math.abs(angDiff(angOf(b, a), angOf(b, c)))); });
    const rectish = ang.every(a => Math.abs(a - Math.PI / 2) < 0.3);
    if (rectish){
      /* rectangle along the mean direction of its sides; straight to the screen when nearly level */
      let rot = 0, k = 0; for (let i = 0; i < 4; i++){ let a = angOf(V[i], V[(i + 1) % 4]); a = ((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2); if (a > Math.PI / 4) a -= Math.PI / 2; rot += a; k++; } rot /= k;
      if (Math.abs(rot) < 0.14) rot = 0;
      const c = Math.cos(-rot), sn = Math.sin(-rot), loc = V.map(q => [(q[0] - cx) * c - (q[1] - cy) * sn, (q[0] - cx) * sn + (q[1] - cy) * c]);
      let w = (Math.max(...loc.map(q => q[0])) - Math.min(...loc.map(q => q[0]))) / 2, h = (Math.max(...loc.map(q => q[1])) - Math.min(...loc.map(q => q[1]))) / 2;
      const square = Math.min(w, h) / Math.max(w, h) > 0.88; if (square) w = h = (w + h) / 2;
      const c2 = Math.cos(rot), s2 = Math.sin(rot), corners = [[-w, -h], [w, -h], [w, h], [-w, h], [-w, -h]].map(q => [cx + q[0] * c2 - q[1] * s2, cy + q[0] * s2 + q[1] * c2]);
      return { name:square ? "Kare" : "Dikdörtgen", pts:corners };
    }
    return { name:"Dörtgen", pts:[...V, V[0]] };
  }
  if (n === 5 || n === 6){ const r = V.reduce((s, q) => s + Math.hypot(q[0] - cx, q[1] - cy), 0) / n; return { name:n === 5 ? "Beşgen" : "Altıgen", pts:regularPoly(n, cx, cy, r, angOf([cx, cy], V[0])) }; }
  return null;
}
function trySnapShape(){
  if (!draw || draw.mode !== "stroke" || draw.straight || draw.snapped || S.shapeSnap === false) return;
  const st = draw.st, xs = st.pts.map(q => q[0]), ys = st.pts.map(q => q[1]);
  if (st.pts.length < 6 || Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * draw.k < 28) return; /* too small: probably writing */
  const res = recognizeShape(draw.rp && draw.rp.length > 5 ? draw.rp : st.pts); if (!res) return;
  const pr = st.pts.reduce((s, q) => s + (q[2] ?? 0.5), 0) / st.pts.length;
  st.pts = res.pts.map(q => [r2(q[0]), r2(q[1]), r2(pr)]); st.pr = false; if (st.tip === "callig") delete st.tip; if (!res.round) st.sh = 1;
  draw.snapped = true; const np = inkPath(st); draw.path.replaceWith(np); draw.path = np;
  try { navigator.vibrate && navigator.vibrate(12); } catch {}
  toast(res.name);
}
function makeStraight(){ draw.straight = true; draw.st.pr = false; draw.st.pts = [draw.start]; const np = inkPath(draw.st); draw.path.replaceWith(np); draw.path = np; }
/* snap a straight line to 0/45/90 degrees when it is within 6 degrees of one */
function snapLine(a, b){
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); if (len < 0.01) return b;
  const ang = Math.atan2(dy, dx), step = Math.PI / 4, near = Math.round(ang / step) * step;
  if (Math.abs(ang - near) > 6 * Math.PI / 180) return b;
  return [r2(a[0] + Math.cos(near) * len), r2(a[1] + Math.sin(near) * len)];
}
function extendStroke(pt, pressure, ev, t){
  if (draw.snapped) return;
  const st = draw.st; if (draw.where === "ws") pt = clampPt(pt);
  if (!draw.straight) (draw.rp || (draw.rp = [draw.start.slice(0, 2)])).push([pt[0], pt[1]]); /* unsmoothed copy for shape recognition */
  /* holding the pen still restarts nothing; moving it more than a few pixels does */
  if (S.shapeSnap !== false && !draw.straight){ const h = draw.hold; if (!h || Math.hypot(pt[0] - h[0], pt[1] - h[1]) * draw.k > 5){ draw.hold = [pt[0], pt[1]]; clearTimeout(draw.holdT); const d0 = draw; draw.holdT = setTimeout(() => { if (draw === d0) trySnapShape(); }, 600); } }
  if (pressure != null && pressure > 0){ draw.fp = draw.fp + 0.35 * (pressure - draw.fp); pressure = draw.fp; } /* steady pressure: no wobbly line width */
  if (draw.fx && !draw.straight){ const tt = t || performance.now(); draw.raw = [pt[0], pt[1]]; pt = [r2(draw.fx(pt[0], tt, draw.k)), r2(draw.fy(pt[1], tt, draw.k))]; }
  if (!draw.straight && ev && ev.shiftKey) makeStraight();
  if (draw.straight){
    const b = snapLine(draw.start, pt); st.pts = [draw.start, [b[0], b[1], draw.start[2]]];
    if (!draw.raf) draw.raf = requestAnimationFrame(() => { if (!draw || draw.mode !== "stroke") return; draw.raf = 0; draw.path.setAttribute("d", strokeD(st)); });
    return;
  }
  const last = st.pts[st.pts.length - 1], minD = draw.where === "pdf" ? 0.6 / draw.v.scale : 0.6 / view().s;
  if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) < minD) return;
  st.pts.push([pt[0], pt[1], r2(pressure || 0.5)]);
  paintStroke();
}
/* draws the stroke so far; a predicted point (where the pen is about to be) hides the delay but is never saved */
function paintStroke(){
  if (draw.raf) return;
  draw.raf = requestAnimationFrame(() => {
    if (!draw || draw.mode !== "stroke") return; draw.raf = 0; const st = draw.st;
    if (draw.pred && !draw.straight && st.pts.length > 1){ const l = st.pts[st.pts.length - 1]; draw.path.setAttribute("d", strokeD({ ...st, pts:[...st.pts, [draw.pred[0], draw.pred[1], l[2]]] })); }
    else draw.path.setAttribute("d", strokeD(st));
  });
}
function predictStroke(e, toPt){
  if (!draw || draw.mode !== "stroke" || draw.straight || !draw.fx || !e.getPredictedEvents) return;
  const pe = e.getPredictedEvents(); if (!pe.length){ draw.pred = null; return; }
  const q = toPt(pe[pe.length - 1]); draw.pred = q; paintStroke();
}
function endStroke(){
  const st = draw.st; cancelAnimationFrame(draw.raf); draw.pred = null; clearTimeout(draw.holdT);
  /* the filter trails the pen a little: finish exactly where the pen was lifted */
  if (draw.raw && !draw.straight && !draw.snapped && st.pts.length){ const l = st.pts[st.pts.length - 1]; if (Math.hypot(draw.raw[0] - l[0], draw.raw[1] - l[1]) > 0.05) st.pts.push([r2(draw.raw[0]), r2(draw.raw[1]), l[2]]); }
  draw.path.setAttribute("d", strokeD(st));
  S.proj.ink.push(st); const fp = draw.v && draw.v.fp, n = draw.p && draw.p.n, wsStroke = draw.where === "ws"; draw = null;
  if (wsStroke){ const xs = st.pts.map(q => q[0]), ys = st.pts.map(q => q[1]); growSheet(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)); }
  if (fp && viewersOf(fp).length > 1) renderDocPage(fp, n);
  commit();
}
function eraseAt(where, v, p, pt){
  const r = curSize("eraser") / 2, before = S.proj.ink.length, removed = [];
  S.proj.ink = S.proj.ink.filter(st => { const hit = st.where === where && (where === "ws" ? st.space === S.space : st.doc === v.fp && st.page === p.n) && strokeHit(st, pt[0], pt[1], r); if (hit) removed.push(st.id); return !hit; });
  if (S.proj.ink.length !== before){
    S.proj.links = S.proj.links.filter(l => !(l.anchor && removed.includes(l.anchor.id)));
    if (where === "pdf") renderDocPage(v.fp, p.n); else renderWsInk(); draw.erased = true; scheduleX();
  }
}
function attachPaneHandlers(v){
  const pane = v.pane;
  pane.addEventListener("pointerdown", e => {
    if (e.pointerType === "pen" && !S.penOnly) setPenOnly(true, true);
    if (S.tool === "select") return;
    if (e.target.closest(".tbox,.pnum,.cpin,.isel")) return;
    if (e.button && e.button !== 0) return;
    if (ISEL.on) iselClear();
    if (e.pointerType === "touch" && S.penOnly){ v.touchScroll = { id:e.pointerId, x:e.clientX, y:e.clientY, st:pane.scrollTop, sl:pane.scrollLeft }; pane.setPointerCapture(e.pointerId); return; }
    const p = pageAt(v, e); if (!p) return;
    e.preventDefault(); pane.setPointerCapture(e.pointerId);
    const pt = pagePoint(v, p, e);
    if (S.tool === "pen" || S.tool === "hl") beginStroke(e, "pdf", v, p, pt);
    else if (S.tool === "eraser"){ draw = { mode:"erase", where:"pdf", v, p, id:e.pointerId }; eraseAt("pdf", v, p, pt); }
    else if (S.tool === "lasso"){ const path = document.createElementNS(NS, "path"); path.setAttribute("class", "lasso"); p.ink.appendChild(path); draw = { mode:"lasso", where:"pdf", v, p, pts:[pt], path, id:e.pointerId }; }
    else if (S.tool === "text") draw = { mode:"text", where:"pdf", v, p, pt, x0:e.clientX, y0:e.clientY, id:e.pointerId };
  });
  pane.addEventListener("pointermove", e => {
    const ts = v.touchScroll;
    if (ts && e.pointerId === ts.id){ pane.scrollTop = ts.st - (e.clientY - ts.y); pane.scrollLeft = ts.sl - (e.clientX - ts.x); return; }
    if (!draw || draw.id !== e.pointerId || draw.where !== "pdf" || draw.v !== v) return;
    const p = draw.p;
    if (draw.mode === "stroke"){ for (const ce of pointsFrom(e)) extendStroke(pagePoint(v, p, ce), ce.pressure, e, ce.timeStamp); predictStroke(e, ce => pagePoint(v, p, ce)); linkPreview(e); }
    else if (draw.mode === "erase") for (const ce of pointsFrom(e)) eraseAt("pdf", v, p, pagePoint(v, p, ce));
    else if (draw.mode === "lasso"){ const pt = pagePoint(v, p, e), l = draw.pts[draw.pts.length - 1]; if (Math.hypot(pt[0] - l[0], pt[1] - l[1]) > 1.5 / v.scale){ draw.pts.push(pt); draw.path.setAttribute("d", polyD(draw.pts) + "Z"); } }
  });
  const end = e => {
    if (v.touchScroll && e.pointerId === v.touchScroll.id){ v.touchScroll = null; return; }
    if (!draw || draw.id !== e.pointerId || draw.where !== "pdf" || draw.v !== v) return;
    const d = draw;
    if (d.mode === "stroke"){ if (!tryInkLink(e)) endStroke(); }
    else if (d.mode === "erase"){ draw = null; if (d.erased) commit(); }
    else if (d.mode === "lasso"){ draw = null; d.path.remove(); finishLasso(v, d.p, d.pts); }
    else if (d.mode === "text"){ draw = null; if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) addTextBox(v, d.p, d.pt); }
  };
  pane.addEventListener("pointerup", end); pane.addEventListener("pointercancel", end);
  pane.addEventListener("click", e => {
    if (S.tool !== "select") return;
    const sel = window.getSelection(); if (sel && !sel.isCollapsed) return;
    if (e.target.closest(".tbox,.pnum,.cpin,.pinmark")) return;
    const p = pageAt(v, e); if (!p) return;
    const [x, y] = pagePoint(v, p, e), r = 7 / v.scale;
    const st = [...S.proj.ink].reverse().find(s => s.where === "pdf" && s.doc === v.fp && s.page === p.n && strokeHit(s, x, y, r));
    if (S.linkFrom){ if (st) completeAnchor({ type:"ink", id:st.id }); else { const pn = makePin(v, p, [x, y]); completeAnchor({ type:"pin", id:pn.id }); renderDocPage(v.fp, p.n); } return; }
    for (let i = S.proj.items.length - 1; i >= 0; i--){
      const it = S.proj.items[i];
      if ((it.type === "excerpt" || it.type === "image") && it.doc === v.fp && it.page === p.n && it.rects.some(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h)){ focusCard(it.id); return; }
    }
    if (st){
      const L = S.proj.links.find(l => l.anchor && l.anchor.id === st.id);
      if (L){ focusCard(L.a); return; }
      if (st.rec){ playAt(st.rec, st.t); return; }
    }
  });
}

/* eraser ring follows the pointer so the eraser size is visible */
const ring = document.createElement("div"); ring.id = "eraserRing"; ring.hidden = true; document.body.appendChild(ring);
document.addEventListener("pointermove", e => {
  if (S.tool !== "eraser" || document.body.dataset.view !== "editor" || e.pointerType === "touch"){ ring.hidden = true; return; }
  const vr = e.target.closest && e.target.closest(".vpane"), inWs = !vr && e.target.closest && e.target.closest("#ws") && !e.target.closest(".hud,.spaces");
  if (!vr && !inWs){ ring.hidden = true; return; }
  const sc = vr ? S.viewers[+vr.closest(".viewer").dataset.v].scale : view().s, d = curSize("eraser") * sc;
  ring.hidden = false; ring.style.width = ring.style.height = d + "px"; ring.style.left = e.clientX + "px"; ring.style.top = e.clientY + "px";
}, { passive:true });

/* ================= selecting pen drawings with the lasso (v6.9.8): move, resize, recolour, duplicate, delete =================
   A lasso around strokes selects them (in the PDF or on the workspace). Drag inside the frame to move, drag a corner to resize.
   A lasso around no strokes on a PDF page still copies the region to the workspace as a picture. */
let ISEL = { on:false };
function inPoly(x, y, P){ let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++){ const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
const strokesIn = (poly, filt) => S.proj.ink.filter(s => filt(s) && s.pts.filter(q => inPoly(q[0], q[1], poly)).length >= Math.max(1, s.pts.length * 0.6));
const iselStrokes = () => { const ids = new Set(ISEL.ids || []); return S.proj.ink.filter(s => ids.has(s.id)); };
const iselSvg = () => ISEL.where === "pdf" ? ISEL.p && ISEL.p.ink : el.wsInk;
const iselScale = () => ISEL.where === "pdf" ? ISEL.v.scale : view().s;
const iselPoint = ev => { if (ISEL.where === "pdf") return pagePoint(ISEL.v, ISEL.p, ev); const q = screenToPlane(ev.clientX, ev.clientY); return [q.x, q.y]; };
function iselBox(ss){
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const s of ss){ const pad = s.w / 2; for (const q of s.pts){ x1 = Math.min(x1, q[0] - pad); y1 = Math.min(y1, q[1] - pad); x2 = Math.max(x2, q[0] + pad); y2 = Math.max(y2, q[1] + pad); } }
  return { x:x1, y:y1, w:x2 - x1, h:y2 - y1 };
}
function iselStart(ctx){ iselClear(); ISEL = { ...ctx, on:true }; iselDraw(); }
function iselClear(){ if (!ISEL.on) return; ISEL = { on:false }; document.querySelectorAll("g.isel").forEach(g => g.remove()); iselBar.hidden = true; }
function iselDraw(){
  document.querySelectorAll("g.isel").forEach(g => g.remove());
  const svg = iselSvg(), ss = ISEL.on ? iselStrokes() : [];
  if (!ISEL.on || !svg || !document.contains(svg) || !ss.length){ if (ISEL.on && !ss.length) iselClear(); iselBar.hidden = true; return; }
  const b = ISEL.box = iselBox(ss), k = 1 / iselScale(), g = document.createElementNS(NS, "g"); g.setAttribute("class", "isel");
  const rect = document.createElementNS(NS, "rect"); for (const [a, v] of [["x", b.x], ["y", b.y], ["width", b.w], ["height", b.h]]) rect.setAttribute(a, v); rect.setAttribute("class", "isel-box"); g.appendChild(rect);
  for (const [h, x, y] of [["nw", b.x, b.y], ["ne", b.x + b.w, b.y], ["sw", b.x, b.y + b.h], ["se", b.x + b.w, b.y + b.h]]){
    const c = document.createElementNS(NS, "circle"); c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", 8 * k); c.setAttribute("class", "isel-h"); c.dataset.h = h; g.appendChild(c);
  }
  g.addEventListener("pointerdown", iselDrag); svg.appendChild(g); iselBarPos();
}
function iselDrag(e){
  e.stopPropagation(); e.preventDefault();
  const h = e.target.dataset && e.target.dataset.h, b = ISEL.box, p0 = iselPoint(e), ids = new Set(ISEL.ids), svg = iselSvg();
  const paths = [...svg.querySelectorAll("path[data-id]")].filter(n => ids.has(n.dataset.id)), g = svg.querySelector("g.isel");
  const ax = h ? (h.includes("w") ? b.x + b.w : b.x) : 0, ay = h ? (h.includes("n") ? b.y + b.h : b.y) : 0, cx = h ? (h.includes("w") ? b.x : b.x + b.w) : 0, cy = h ? (h.includes("n") ? b.y : b.y + b.h) : 0;
  let m = [1, 0, 0]; iselBar.hidden = true;
  const mv = ev => {
    const q = iselPoint(ev);
    if (!h) m = [1, q[0] - p0[0], q[1] - p0[1]];
    else { const dx = cx - ax, dy = cy - ay, sc = clamp(((q[0] - ax) * dx + (q[1] - ay) * dy) / (dx * dx + dy * dy || 1), 0.1, 10); m = [sc, ax * (1 - sc), ay * (1 - sc)]; }
    const t = `matrix(${m[0]},0,0,${m[0]},${m[1]},${m[2]})`; for (const n of paths) n.setAttribute("transform", t); if (g) g.setAttribute("transform", t);
  };
  const up = () => {
    window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
    if (m[0] === 1 && Math.abs(m[1]) + Math.abs(m[2]) < 0.5 / iselScale()){ for (const n of paths) n.removeAttribute("transform"); if (g) g.removeAttribute("transform"); iselBarPos(); return; }
    for (const s of iselStrokes()){ s.pts = s.pts.map(q => [r2(q[0] * m[0] + m[1]), r2(q[1] * m[0] + m[2]), q[2]]); if (m[0] !== 1) s.w = r2(clamp(s.w * m[0], 0.3, 60)); }
    if (ISEL.where === "ws"){ const bb = iselBox(iselStrokes()); growSheet(bb.x, bb.y, bb.x + bb.w, bb.y + bb.h); }
    iselRerender(); commit();
  };
  window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
}
function iselRerender(){ if (ISEL.where === "pdf") renderInkP(ISEL.v, ISEL.p); else { renderSheet(); renderWsInk(); } iselDraw(); drawLinks(); }
/* the bar over the selection */
const iselBar = document.createElement("div"); iselBar.className = "isel-bar"; iselBar.hidden = true; document.body.appendChild(iselBar);
iselBar.addEventListener("pointerdown", e => e.stopPropagation());
function iselBarPos(){
  const g = document.querySelector("g.isel rect"); if (!ISEL.on || !g){ iselBar.hidden = true; return; }
  iselBar.innerHTML = "";
  const btn = (txt, title, fn, cls = "") => { const b = document.createElement("button"); b.className = cls; b.innerHTML = txt; b.title = title; b.setAttribute("aria-label", title); b.onclick = fn; iselBar.appendChild(b); return b; };
  const n = (ISEL.ids || []).length;
  const lab = document.createElement("span"); lab.className = "isel-n"; lab.textContent = n + " çizim"; iselBar.appendChild(lab);
  btn('<i class="isel-col"></i>', "Rengini değiştir", ev => {
    const kinds = new Set(iselStrokes().map(s => s.kind)), hl = kinds.size === 1 && kinds.has("hl"), cols = hl ? HL_COLORS : PEN_COLORS, hex = hl ? HL_HEX : PEN_HEX;
    openPalette(ev.currentTarget, { title:"Çizimlerin rengi", named:cols.map(k => ({ k, hex:hex[k], name:CNAME[k] })), more:hl ? HL_MORE : ACCENT_MORE, current:"",
      onPick:v => { closePop(); for (const s of iselStrokes()) s.color = isHex(v) ? v : (s.kind === "hl" ? (HL_COLORS.includes(v) ? v : "y") : (PEN_COLORS.includes(v) ? v : "k")); iselRerender(); commit(); } });
  });
  btn('<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/></svg>', "Çoğalt", () => {
    const off = 14 / iselScale(), ids = [];
    for (const s of iselStrokes()){ const c = { ...JSON.parse(JSON.stringify(s)), id:uid() }; delete c.rec; delete c.t; c.pts = c.pts.map(q => [r2(q[0] + off), r2(q[1] + off), q[2]]); S.proj.ink.push(c); ids.push(c.id); }
    ISEL.ids = ids; iselRerender(); commit();
  });
  if (ISEL.where === "pdf" && ISEL.poly) btn('<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="m4 16 5-5 4 4 2-2 5 5"/></svg>', "Bölgeyi görsel olarak masaya ekle", () => { const { v, p, poly } = ISEL; iselClear(); lassoImage(v, p, poly); });
  btn(ICON.del, "Sil", () => iselDelete(), "danger");
  btn('<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>', "Bitti", () => iselClear());
  const r = g.getBoundingClientRect(); iselBar.hidden = false;
  const bw = iselBar.offsetWidth || 260, x = clamp(r.left + r.width / 2 - bw / 2, 8, innerWidth - bw - 8), y = r.top - 52 > 8 ? r.top - 52 : Math.min(innerHeight - 52, r.bottom + 10);
  iselBar.style.left = x + "px"; iselBar.style.top = y + "px";
}
document.addEventListener("scroll", () => { if (ISEL.on && ISEL.where === "pdf") requestAnimationFrame(iselBarPos); }, true);
function iselDelete(){ const ids = new Set(ISEL.ids); S.proj.ink = S.proj.ink.filter(s => !ids.has(s.id)); S.proj.links = S.proj.links.filter(l => !(l.anchor && l.anchor.type === "ink" && ids.has(l.anchor.id))); const w = ISEL.where, v = ISEL.v, p = ISEL.p; iselClear(); if (w === "pdf") renderInkP(v, p); else renderWsInk(); drawLinks(); commit(); }

/* ================= lasso -> select drawings, or copy the region as a picture ================= */
async function finishLasso(v, p, pts){
  if (pts.length < 4) return;
  const ss = strokesIn(pts, s => s.where === "pdf" && s.doc === v.fp && s.page === p.n);
  if (ss.length){ iselStart({ where:"pdf", v, p, ids:ss.map(s => s.id), poly:pts }); return; }
  return lassoImage(v, p, pts);
}
async function lassoImage(v, p, pts){
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  const x1 = Math.max(0, Math.min(...xs)), y1 = Math.max(0, Math.min(...ys)), x2 = Math.min(p.w, Math.max(...xs)), y2 = Math.min(p.h, Math.max(...ys)), bw = x2 - x1, bh = y2 - y1;
  if (bw < 8 || bh < 8){ toast("Bölge çok küçük. Kopyalamak istediğin alanın etrafını çiz."); return; }
  try {
    const sc = clamp(1400 / Math.max(bw, bh), 1.5, 4), c = document.createElement("canvas"); c.width = Math.ceil(bw * sc); c.height = Math.ceil(bh * sc);
    const ctx = c.getContext("2d");
    ctx.beginPath(); pts.forEach(([x, y], i) => ctx[i ? "lineTo" : "moveTo"]((x - x1) * sc, (y - y1) * sc)); ctx.closePath(); ctx.clip();
    await p.page.render({ canvasContext:ctx, viewport:p.page.getViewport({ scale:sc }), transform:[1, 0, 0, 1, -x1 * sc, -y1 * sc] }).promise;
    ctx.setTransform(sc, 0, 0, sc, -x1 * sc, -y1 * sc);
    for (const st of S.proj.ink){
      if (st.where !== "pdf" || st.doc !== v.fp || st.page !== p.n) continue;
      if (st.kind === "hl"){ ctx.save(); ctx.globalAlpha = .42; ctx.globalCompositeOperation = "multiply"; ctx.strokeStyle = inkHex(st); ctx.lineWidth = st.w; ctx.lineCap = ctx.lineJoin = "round"; ctx.stroke(new Path2D(inkD(st))); ctx.restore(); }
      else if (!filled(st)){ ctx.save(); if (st.tip === "pencil") ctx.globalAlpha = .8; ctx.strokeStyle = inkHex(st); ctx.lineWidth = st.w; ctx.lineCap = ctx.lineJoin = "round"; ctx.stroke(new Path2D(inkD(st))); ctx.restore(); }
      else { ctx.fillStyle = inkHex(st); ctx.fill(new Path2D(outlineD(st.pts, st.w, st.pr, st.tip === "callig"))); }
    }
    let src = c.toDataURL("image/webp", 0.9); if (!src.startsWith("data:image/webp")) src = c.toDataURL("image/png");
    const sp = defaultSpot();
    const it = stamp({ id:uid(), type:"image", src, doc:v.fp, page:p.n, space:S.space, rects:[{ x:r2(x1), y:r2(y1), w:r2(bw), h:r2(bh) }], color:"b", note:"", w:clamp(Math.round(bw * 1.3), 170, 380), x:sp.x, y:sp.y });
    if (!it.font && S.lastFont) it.font = S.lastFont; if (!it.bg && S.lastBg && S.lastBg !== "white") it.bg = S.lastBg; if (!it.cc && S.lastCc) it.cc = S.lastCc; if (!it.frame && S.lastFrame && S.lastFrame !== "thin") it.frame = S.lastFrame; if (!it.fs && S.lastFs !== 1) it.fs = S.lastFs; S.proj.items.push(it); S.sel = it.id; renderWs(); renderDocPage(v.fp, p.n); commit();
    toast("Görsel masaya eklendi", isNarrow() ? { label:"Masaya git", fn:() => setTab("ws") } : null);
  } catch (err){ console.error(err); toast("Görsel kopyalanamadı. Tekrar dene."); }
}

/* ================= text boxes ================= */
function addTextBox(v, p, pt){
  const t = stamp({ id:uid(), doc:v.fp, page:p.n, x:r2(pt[0]), y:r2(pt[1] - 8), w:180, text:"", color:S.penColor, size:curSize("text"), ...(S.textFont ? { font:S.textFont } : {}) });
  S.proj.texts.push(t); renderTextsP(v, p);
  const f = () => { const ta = v.root.querySelector(`.tbox[data-id="${t.id}"] textarea`); if (ta && document.activeElement !== ta) ta.focus(); }; f(); requestAnimationFrame(f);
}
function tboxEl(t, v, p){
  const d = document.createElement("div"); d.className = "tbox tc-" + (isHex(t.color) ? "x" : t.color); d.dataset.id = t.id; recAttr(d, t); if (isHex(t.color)) d.style.setProperty("--tc", t.color);
  const place = () => { d.style.left = `calc(var(--scale-factor) * ${t.x}px)`; d.style.top = `calc(var(--scale-factor) * ${t.y}px)`; d.style.width = `calc(var(--scale-factor) * ${t.w}px)`; };
  place();
  const ctl = document.createElement("div"); ctl.className = "tctl";
  if (t.rec && S.proj.recs.some(r => r.id === t.rec)){ const pl = document.createElement("button"); pl.innerHTML = ICON.play + fmtT(t.t); pl.title = "Bu notun yazıldığı anı dinle"; pl.addEventListener("pointerdown", e => e.preventDefault()); pl.onclick = () => playAt(t.rec, t.t); ctl.appendChild(pl); }
  const mv = document.createElement("button"); mv.className = "tmove"; mv.title = "Taşı"; mv.innerHTML = ICON.move;
  const dl = document.createElement("button"); dl.title = "Sil"; dl.innerHTML = ICON.x;
  const fb = document.createElement("button"); fb.className = "tfont"; fb.title = "Yazı tipi"; fb.innerHTML = ICON.font; fb.addEventListener("pointerdown", e => e.preventDefault());
  fb.onclick = () => openFontPop(fb, t.font, fid => { if (fid) t.font = fid; else delete t.font; S.textFont = fid; savePrefs(); renderDocPage(t.doc, t.page); commit(); });
  ctl.append(fb, mv, dl);
  const ta = document.createElement("textarea"); ta.rows = 1; ta.value = t.text; ta.placeholder = "Yaz…"; ta.setAttribute("aria-label", "Metin kutusu");
  ta.style.fontSize = `calc(var(--scale-factor) * ${t.size}px)`; if (t.font) ta.style.fontFamily = fontCss(t.font);
  ta.addEventListener("pointerdown", e => { if (S.linkFrom){ e.preventDefault(); completeAnchor({ type:"text", id:t.id }); } });
  ta.addEventListener("input", () => { t.text = ta.value; autosize(ta); save(); });
  ta.addEventListener("blur", () => { if (!S.proj.texts.includes(t)) return; if (!t.text.trim()) removeText(true); else commit(); });
  const removeText = silent => { S.proj.texts = S.proj.texts.filter(x => x.id !== t.id); S.proj.links = S.proj.links.filter(l => !(l.anchor && l.anchor.id === t.id)); renderDocPage(t.doc, t.page); if (!silent) toast("Metin silindi", { label:"Geri al", fn:undo }); commit(); };
  dl.addEventListener("pointerdown", e => e.preventDefault()); dl.onclick = () => removeText(false);
  mv.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation(); mv.setPointerCapture(e.pointerId);
    const st = { x:e.clientX, y:e.clientY, ix:t.x, iy:t.y };
    const move = ev => { t.x = r2(clamp(st.ix + (ev.clientX - st.x) / v.scale, -t.w / 2, p.w - 20)); t.y = r2(clamp(st.iy + (ev.clientY - st.y) / v.scale, -10, p.h - 10)); place(); scheduleX(); };
    const up = () => { mv.removeEventListener("pointermove", move); mv.removeEventListener("pointerup", up); mv.removeEventListener("pointercancel", up); renderDocPage(t.doc, t.page); commit(); };
    mv.addEventListener("pointermove", move); mv.addEventListener("pointerup", up); mv.addEventListener("pointercancel", up);
  });
  d.append(ctl, ta); return d;
}

/* ================= comments ================= */
function addComment(info){
  const v = S.viewers[info.v];
  const c = stamp({ id:uid(), doc:v.fp, page:info.page, rects:info.rects, quote:info.text, text:"" });
  S.proj.comments.push(c); renderDocPage(v.fp, info.page); commit();
  requestAnimationFrame(() => { const pin = v.root.querySelector(`.cpin[data-id="${c.id}"]`); if (pin) openComment(c.id, pin, true); });
}
let cmOpen = null;
function openComment(id, anchor, fresh){
  const c = S.proj.comments.find(x => x.id === id); if (!c) return;
  $("#cmTitle").textContent = `Yorum · ${S.proj.docs.length > 1 ? docName(c.doc) + " · " : ""}s. ${c.page}`;
  $("#cmQuote").textContent = c.quote || "";
  const hasRec = c.rec && S.proj.recs.some(r => r.id === c.rec);
  $("#cmTs").textContent = hasRec ? "▶ " + fmtT(c.t) : ""; $("#cmTs").hidden = !hasRec; $("#cmTs").onclick = () => playAt(c.rec, c.t);
  const ta = $("#cmText"); ta.value = c.text;
  openPop(el.commentPop, anchor, () => {
    const cc = cmOpen; cmOpen = null; if (!cc) return;
    if (!cc.text.trim() && fresh) S.proj.comments = S.proj.comments.filter(x => x.id !== cc.id);
    renderDocPage(cc.doc, cc.page); commit();
  });
  cmOpen = c;
  setTimeout(() => ta.focus(), 30);
}
$("#cmText").addEventListener("input", e => { if (cmOpen){ cmOpen.text = e.target.value; save(); } });
$("#cmDone").onclick = () => closePop();
$("#cmDel").onclick = () => { const c = cmOpen; if (!c) return; cmOpen = null; S.proj.comments = S.proj.comments.filter(x => x.id !== c.id); S.proj.links = S.proj.links.filter(l => !(l.anchor && l.anchor.id === c.id)); closePop(); renderDocPage(c.doc, c.page); renderWs(); commit(); toast("Yorum silindi", { label:"Geri al", fn:undo }); };
$("#cmCard").onclick = () => {
  const c = cmOpen; if (!c) return;
  const sp = defaultSpot();
  const it = { id:uid(), type:"excerpt", text:c.quote || "", doc:c.doc, page:c.page, space:S.space, rects:c.rects, color:"o", note:c.text, w:250, x:sp.x, y:sp.y };
  if (c.rec){ it.rec = c.rec; it.t = c.t; }
  if (!it.font && S.lastFont) it.font = S.lastFont; if (!it.bg && S.lastBg && S.lastBg !== "white") it.bg = S.lastBg; if (!it.cc && S.lastCc) it.cc = S.lastCc; if (!it.frame && S.lastFrame && S.lastFrame !== "thin") it.frame = S.lastFrame; if (!it.fs && S.lastFs !== 1) it.fs = S.lastFs; S.proj.items.push(it); if (!c.text.trim()) c.text = " ";
  closePop(); S.sel = it.id; renderWs(); renderDocPage(c.doc, c.page); commit(); toast("Yorum masaya kart olarak eklendi", isNarrow() ? { label:"Masaya git", fn:() => setTab("ws") } : null);
};

/* ================= outline & bookmarks ================= */
/* page thumbnails: drawn small, lazily, one at a time; kept as small JPEGs */
const thumbCache = new Map(); let thumbGen = 0, olTab = "pages";
function thumbMarks(fp, n){
  const q = S.proj, cards = q.items.filter(i => i.doc === fp && i.page === n).length;
  return { cards, bm:q.bookmarks.some(b => b.doc === fp && b.page === n), ink:q.ink.some(s => s.doc === fp && s.page === n) || q.texts.some(t => t.doc === fp && t.page === n) || q.comments.some(c => c.doc === fp && c.page === n) };
}
function renderThumbs(v){
  const grid = $("#thGrid"), gen = ++thumbGen, fp = v.fp; grid.innerHTML = "";
  const queue = []; let busy = false;
  const pump = async () => {
    if (busy) return; busy = true;
    while (queue.length && gen === thumbGen){
      const { n, img } = queue.shift(), key = fp + ":" + n;
      if (!thumbCache.has(key)){
        try {
          const page = await v.pdf.getPage(n), vp1 = page.getViewport({ scale:1 }), sc = 200 / vp1.width, vp = page.getViewport({ scale:sc });
          const c = document.createElement("canvas"); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
          const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
          await page.render({ canvasContext:ctx, viewport:vp }).promise;
          if (thumbCache.size > 600) thumbCache.delete(thumbCache.keys().next().value);
          thumbCache.set(key, c.toDataURL("image/jpeg", 0.72));
        } catch { continue; }
      }
      if (gen === thumbGen){ img.src = thumbCache.get(key); img.closest(".th").classList.add("ready"); }
    }
    busy = false;
  };
  const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting){ io.unobserve(e.target); queue.push({ n:+e.target.dataset.page, img:e.target.querySelector("img") }); } queue.sort((a, b) => a.n - b.n); pump(); }, { root:el.outlinePop, rootMargin:"300px 0px" });
  for (const p of v.pages){
    const b = document.createElement("button"); b.className = "th"; b.dataset.page = p.n; b.style.setProperty("--ar", (p.w / p.h).toFixed(4));
    if (p.n === v.curPage) b.classList.add("cur");
    const m = thumbMarks(fp, p.n);
    b.innerHTML = `<span class="th-img"><img alt=""></span><span class="th-n">${p.n}</span>` + (m.bm ? `<span class="th-bm" title="Yer imi"></span>` : "") + (m.cards ? `<span class="th-c" title="${m.cards} kart">${m.cards}</span>` : m.ink ? `<span class="th-c dot" title="Not var"></span>` : "");
    b.setAttribute("aria-label", `Sayfa ${p.n}`);
    const key = fp + ":" + p.n; if (thumbCache.has(key)){ b.querySelector("img").src = thumbCache.get(key); b.classList.add("ready"); } else io.observe(b);
    b.onclick = () => { closePop(); scrollToPage(v, p.n, 0, true); };
    grid.appendChild(b);
  }
  const obs = new MutationObserver(() => { if (el.outlinePop.hidden){ thumbGen++; io.disconnect(); obs.disconnect(); } }); obs.observe(el.outlinePop, { attributes:true, attributeFilter:["hidden"] });
  requestAnimationFrame(() => { const cur = grid.querySelector(".th.cur"); if (cur) el.outlinePop.scrollTop = Math.max(0, cur.offsetTop - el.outlinePop.clientHeight / 2 + cur.offsetHeight / 2); });
}
function setOlTab(v, t){
  olTab = t; $("#olPages").hidden = t !== "pages"; $("#olToc").hidden = t !== "toc";
  $("#olTabs").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.t === t)));
  el.outlinePop.classList.toggle("wide", t === "pages");
  if (t === "pages") renderThumbs(v);
}
async function openOutline(v, anchor, tab){
  if (!v.pdf) return;
  if (tab) olTab = tab;
  $("#olTitle").textContent = docName(v.fp);
  const bm = $("#bmList"); bm.innerHTML = "";
  for (const b of S.proj.bookmarks.filter(x => x.doc === v.fp).sort((a, b) => a.page - b.page)){
    const li = document.createElement("li");
    const it = document.createElement("button"); it.className = "ol-item"; it.innerHTML = `<span></span><span class="pgn">s. ${b.page}</span>`; it.firstChild.textContent = b.title; it.onclick = () => { closePop(); scrollToPage(v, b.page, 0, true); };
    const x = document.createElement("button"); x.className = "icon-btn sm"; x.innerHTML = ICON.x; x.title = "Yer imini kaldır"; x.setAttribute("aria-label", x.title);
    x.onclick = () => { S.proj.bookmarks = S.proj.bookmarks.filter(y => y.id !== b.id); li.remove(); renderDocPage(v.fp, b.page); commit(); };
    li.append(it, x); bm.appendChild(li);
  }
  updatePgInfo(v);
  $("#bmAdd").textContent = `Sayfa ${v.curPage}'i işaretle`;
  $("#bmAdd").onclick = () => {
    const page = v.curPage; if (S.proj.bookmarks.some(b => b.doc === v.fp && b.page === page)){ toast("Bu sayfa zaten işaretli"); return; }
    S.proj.bookmarks.push({ id:uid(), doc:v.fp, page, title:`Sayfa ${page}` }); renderDocPage(v.fp, page); commit(); openOutline(v, anchor);
  };
  const ol = $("#olList"); ol.innerHTML = ""; $("#olEmpty").hidden = true;
  $("#olTabs").querySelectorAll("button").forEach(b => b.onclick = () => setOlTab(v, b.dataset.t));
  $("#olPages").hidden = olTab !== "pages"; $("#olToc").hidden = olTab !== "toc"; el.outlinePop.classList.toggle("wide", olTab === "pages");
  $("#olTabs").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.t === olTab)));
  openPop(el.outlinePop, anchor);
  if (olTab === "pages") renderThumbs(v);
  try {
    const outline = await v.pdf.getOutline();
    if (!outline || !outline.length){ $("#olEmpty").hidden = false; return; }
    const flat = []; const walk = (items, depth) => { for (const o of items){ if (flat.length > 300) return; flat.push({ o, depth }); if (o.items && o.items.length && depth < 3) walk(o.items, depth + 1); } }; walk(outline, 0);
    for (const { o, depth } of flat){
      let page = null;
      try { const dest = typeof o.dest === "string" ? await v.pdf.getDestination(o.dest) : o.dest; if (dest && dest[0]) page = typeof dest[0] === "number" ? dest[0] + 1 : (await v.pdf.getPageIndex(dest[0])) + 1; } catch {}
      const li = document.createElement("li");
      const it = document.createElement("button"); it.className = "ol-item"; it.style.paddingLeft = (8 + depth * 14) + "px";
      it.innerHTML = `<span></span><span class="pgn">${page ? "s. " + page : ""}</span>`; it.firstChild.textContent = o.title;
      it.onclick = () => { if (page){ closePop(); scrollToPage(v, page, 0, true); } };
      li.appendChild(it); ol.appendChild(li);
    }
  } catch { $("#olEmpty").hidden = false; }
}

/* ================= search across all documents ================= */
const textCache = new Map();
async function pageStrings(fp, n){
  const key = fp + ":" + n; if (textCache.has(key)) return textCache.get(key);
  const pdf = await loadPdfDoc(fp); const tc = await (await pdf.getPage(n)).getTextContent();
  const strs = tc.items.map(i => i.str || "").filter(s => s.length); textCache.set(key, strs); return strs;
}
function clearSearch(){ S.search = { q:"", hits:[], idx:-1, pending:null }; el.qCount.textContent = ""; document.querySelectorAll(".textLayer span.hit").forEach(s => s.classList.remove("hit", "on")); if (openPopEl === el.searchPop) closePop(); }
async function runSearch(q){
  q = q.trim().toLocaleLowerCase("tr").replace(/ı/g, "i"); clearSearch(); if (!q || !S.proj) return;
  S.search.q = q; const hits = [];
  for (const d of S.proj.docs){
    const pdf = await loadPdfDoc(d.fp); if (!pdf) continue;
    for (let n = 1; n <= pdf.numPages; n++){
      const strs = await pageStrings(d.fp, n); if (S.search.q !== q) return;
      let k = 0; for (const s of strs){ const i = s.toLocaleLowerCase("tr").replace(/ı/g, "i").indexOf(q); if (i >= 0) hits.push({ fp:d.fp, page:n, k:k++, s, i }); }
    }
  }
  S.search.hits = hits; el.qCount.textContent = String(hits.length);
  S.viewers.forEach(v => { if (v.fp) v.pages.forEach(p => markSearchHits(v, p)); });
  renderResults(true);
}
function renderResults(show){
  const list = $("#srList"); list.innerHTML = "";
  const hits = S.search.hits; if (!hits.length){ if (openPopEl === el.searchPop) closePop(); return; }
  let lastFp = null;
  hits.slice(0, 250).forEach((h, idx) => {
    if (h.fp !== lastFp && S.proj.docs.length > 1){ const hd = document.createElement("li"); hd.className = "sr-doc"; hd.textContent = docName(h.fp); list.appendChild(hd); lastFp = h.fp; }
    const li = document.createElement("li"); const b = document.createElement("button"); b.className = "sr-item" + (idx === S.search.idx ? " on" : "");
    const pg = document.createElement("span"); pg.className = "pgn"; pg.textContent = "s. " + h.page;
    const ql = S.search.q.length, a = Math.max(0, h.i - 40), pre = (a ? "…" : "") + h.s.slice(a, h.i), mid = h.s.slice(h.i, h.i + ql), post = h.s.slice(h.i + ql, h.i + ql + 60);
    const m = document.createElement("mark"); m.textContent = mid;
    b.append(pg, document.createTextNode(pre), m, document.createTextNode(post));
    b.onclick = () => { closePop(); gotoHit(idx); };
    li.appendChild(b); list.appendChild(li);
  });
  if (show && (document.activeElement === el.q || openPopEl === el.searchPop)) openPop(el.searchPop, el.searchbar);
}
function spanHits(p){ if (!p.text || !S.search.q) return []; return [...p.text.querySelectorAll("span:not(.markedContent)")].filter(s => s.textContent.length && s.textContent.toLocaleLowerCase("tr").replace(/ı/g, "i").includes(S.search.q)); }
function markSearchHits(v, p){
  const spans = spanHits(p); spans.forEach(s => s.classList.add("hit"));
  const cur = S.search.hits[S.search.idx];
  if (cur && cur.fp === v.fp && cur.page === p.n && spans[cur.k]){ spans[cur.k].classList.add("on"); if (S.search.pending === S.search.idx){ S.search.pending = null; scrollToSpan(v, spans[cur.k]); } }
}
function scrollToSpan(v, span){ const pr = v.pane.getBoundingClientRect(), sr = span.getBoundingClientRect(); v.pane.scrollTop += sr.top - pr.top - v.pane.clientHeight / 3; }
async function gotoHit(i){
  const h = S.search.hits; if (!h.length) return;
  S.search.idx = (i + h.length) % h.length; el.qCount.textContent = `${S.search.idx + 1}/${h.length}`;
  document.querySelectorAll(".textLayer span.hit.on").forEach(s => s.classList.remove("on"));
  const cur = h[S.search.idx];
  const v = await revealInDoc(cur.fp, cur.page, 0);
  v.pages.forEach(p => { if (p.text && !p.text.querySelector(".hit")) markSearchHits(v, p); });
  const p = v.pages[cur.page - 1]; if (!p) return;
  const spans = spanHits(p);
  if (spans[cur.k]){ spans[cur.k].classList.add("on"); spans[cur.k].classList.add("hit"); requestAnimationFrame(() => scrollToSpan(v, spans[cur.k])); } else S.search.pending = S.search.idx;
  renderResults(false);
}
function toggleSearch(on){ el.searchbar.hidden = !on; if (on){ el.q.focus(); el.q.select(); } else { el.q.value = ""; clearSearch(); } }
$("#bSearch").onclick = () => toggleSearch(el.searchbar.hidden);
$("#qClose").onclick = () => toggleSearch(false);
let qTimer;
el.q.addEventListener("input", () => { clearTimeout(qTimer); qTimer = setTimeout(() => runSearch(el.q.value), 300); });
el.q.addEventListener("focus", () => { if (S.search.hits.length) openPop(el.searchPop, el.searchbar); });
el.q.addEventListener("keydown", e => {
  if (e.key === "Enter"){ e.preventDefault(); clearTimeout(qTimer); if (S.search.q !== el.q.value.trim().toLocaleLowerCase("tr").replace(/ı/g, "i")) runSearch(el.q.value).then(() => gotoHit(0)); else { closePop(); gotoHit(S.search.idx + (e.shiftKey ? -1 : 1)); } }
  if (e.key === "Escape") toggleSearch(false);
});
$("#qNext").onclick = () => { closePop(); gotoHit(S.search.idx + 1); };
$("#qPrev").onclick = () => { closePop(); gotoHit(S.search.idx - 1); };

/* ================= selection -> excerpt / comment ================= */
function readSelection(){
  if (S.tool !== "select") return null;
  const sel = window.getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0), node = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
  const div = node && node.closest && node.closest(".page"), vr = div && div.closest(".viewer"); if (!div || !vr) return null;
  const v = S.viewers[+vr.dataset.v];
  const text = sel.toString().replace(/-\s*\n\s*/g, "").replace(/\s+/g, " ").trim(); if (!text) return null;
  const n = +div.dataset.page, p = v.pages[n - 1], pr = div.getBoundingClientRect(), s = v.scale;
  let rects = [...range.getClientRects()].filter(r => r.width > 1 && r.height > 1 && r.height < pr.height * 0.4)
    .map(r => ({ x:(r.left - pr.left)/s, y:(r.top - pr.top)/s, w:r.width/s, h:r.height/s })).filter(r => r.x > -4 && r.y > -4 && r.x < p.w && r.y < p.h);
  rects.sort((a, b) => a.y - b.y || a.x - b.x);
  const merged = [];
  for (const r of rects){ const m = merged[merged.length - 1]; if (m && Math.abs(m.y - r.y) < m.h * 0.5 && r.x <= m.x + m.w + 3){ const x2 = Math.max(m.x + m.w, r.x + r.w), y2 = Math.max(m.y + m.h, r.y + r.h); m.x = Math.min(m.x, r.x); m.y = Math.min(m.y, r.y); m.w = x2 - m.x; m.h = y2 - m.y; } else merged.push({ ...r }); }
  const cr = range.getClientRects(), end = cr.length ? cr[cr.length - 1] : range.getBoundingClientRect();
  return { v:v.idx, text, page:n, rects:merged.map(r => ({ x:r2(r.x), y:r2(r.y), w:r2(r.w), h:r2(r.h) })), end };
}
let selTimer;
document.addEventListener("selectionchange", () => { clearTimeout(selTimer); selTimer = setTimeout(updateChip, 160); });
function updateChip(){ if (chipDrag) return; const info = readSelection(); if (!info){ hideChip(); return; } S.pendingSel = info; el.chip.hidden = false; positionChip(info.end); }
function positionChip(end){
  if (!end){ const info = readSelection(); if (!info){ hideChip(); return; } S.pendingSel = info; end = info.end; }
  const w = el.chip.offsetWidth || 200, x = clamp(end.right - w / 2, 8, window.innerWidth - w - 8);
  let y = end.bottom + 12; if (y > window.innerHeight - 60) y = end.top - 52;
  el.chip.style.left = x + "px"; el.chip.style.top = clamp(y, 8, window.innerHeight - 46) + "px";
}
function hideChip(){ if (!chipDrag) el.chip.hidden = true; }
let chipDrag = null;
const chipQ = $("#chipQuote");
el.chip.addEventListener("mousedown", e => e.preventDefault());
$("#chipComment").addEventListener("pointerdown", e => e.preventDefault());
$("#chipComment").onclick = () => { const info = S.pendingSel; if (!info) return; try { window.getSelection().removeAllRanges(); } catch {} el.chip.hidden = true; addComment(info); };
chipQ.addEventListener("pointerdown", e => { e.preventDefault(); chipDrag = { x0:e.clientX, y0:e.clientY, moved:false }; chipQ.setPointerCapture(e.pointerId); });
chipQ.addEventListener("pointermove", e => {
  if (!chipDrag) return;
  if (!chipDrag.moved && Math.hypot(e.clientX - chipDrag.x0, e.clientY - chipDrag.y0) > 8 && !isNarrow()){ chipDrag.moved = true; const t = S.pendingSel?.text || ""; el.ghost.textContent = t.slice(0, 140) + (t.length > 140 ? "…" : ""); el.ghost.hidden = false; }
  if (chipDrag.moved){ el.ghost.style.left = e.clientX + "px"; el.ghost.style.top = e.clientY + "px"; el.ws.classList.toggle("drop", overWs(e)); }
});
function endChip(e, cancel){
  if (!chipDrag) return;
  const d = chipDrag; chipDrag = null; el.ghost.hidden = true; el.ws.classList.remove("drop");
  if (cancel) return;
  const info = S.pendingSel;
  if (d.moved){ if (overWs(e)) addExcerpt(info, screenToPlane(e.clientX, e.clientY)); } else addExcerpt(info);
  if (!d.moved || overWs(e)){ try { window.getSelection().removeAllRanges(); } catch {} el.chip.hidden = true; }
}
chipQ.addEventListener("pointerup", e => endChip(e, false));
chipQ.addEventListener("pointercancel", e => endChip(e, true));
function overWs(e){ if (isNarrow()) return false; const r = el.ws.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }
/* new cards go to a free place near the middle of the view, so they never land on top of each other.
   Places that are fully on screen come first, and right/below is preferred over left/above. */
function defaultSpot(sz){
  const f = S.lastFs || 1, w = sz ? sz.w : Math.round(Math.min(900, 250 * f)), h = sz ? sz.h : Math.round(150 * f);
  const r = el.ws.getBoundingClientRect(), v = view(), vw = r.width || window.innerWidth, vh = r.height || window.innerHeight * 0.7;
  const bx = (vw / 2 - v.tx) / v.s - w / 2, by = (vh / 3 - v.ty) / v.s - h / 3;
  const boxes = S.proj ? [...el.plane.querySelectorAll(":scope > .card, :scope > .group")].map(n => ({ x:n.offsetLeft, y:n.offsetTop, w:n.offsetWidth, h:n.offsetHeight })) : [];
  const g = 18, free = c => boxes.every(b => c.x + w + g <= b.x || c.x >= b.x + b.w + g || c.y + h + g <= b.y || c.y >= b.y + b.h + g);
  const onScreen = c => { const L = v.tx + c.x * v.s, T = v.ty + c.y * v.s; return L >= 8 && T >= 52 && L + w * v.s <= vw - 8 && T + h * v.s <= vh - 64; };
  const step = 40, cand = [];
  for (let ring = 0; ring < 36; ring++){
    const pts = []; for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === ring) pts.push([dx, dy]);
    pts.sort((a, b) => ((a[1] < 0) * 2 + (a[0] < 0)) - ((b[1] < 0) * 2 + (b[0] < 0)) || (Math.abs(a[0]) + Math.abs(a[1])) - (Math.abs(b[0]) + Math.abs(b[1])));
    for (const [dx, dy] of pts) cand.push(clampBox(bx + dx * step, by + dy * step, w, h));
  }
  return cand.find(c => free(c) && onScreen(c)) || cand.find(free) || clampBox(bx, by, w, h);
}
/* if a new card had to go off screen, slide the workspace just enough to show it */
function showCardIfHidden(id){
  requestAnimationFrame(() => {
    const c = cardEls.get(id); if (!c) return; const cr = c.getBoundingClientRect(), wr = el.ws.getBoundingClientRect(), v = view();
    let dx = 0, dy = 0;
    if (cr.right > wr.right - 12) dx = wr.right - 12 - cr.right; if (cr.left + dx < wr.left + 12) dx = wr.left + 12 - cr.left;
    if (cr.bottom > wr.bottom - 70) dy = wr.bottom - 70 - cr.bottom; if (cr.top + dy < wr.top + 52) dy = wr.top + 52 - cr.top;
    if (dx || dy){ v.tx += dx; v.ty += dy; applyView(); drawLinks(); save(); }
  });
}
function screenToPlane(cx, cy){ const r = el.ws.getBoundingClientRect(), v = view(); return { x:r2((cx - r.left - v.tx) / v.s), y:r2((cy - r.top - v.ty) / v.s) }; }
function addExcerpt(info, pt){
  if (!info) return;
  const v = S.viewers[info.v];
  const cw = Math.round(Math.min(900, 250 * (S.lastFs || 1)));
  const it = stamp({ id:uid(), type:"excerpt", text:info.text, doc:v.fp, page:info.page, space:S.space, rects:info.rects, color:S.lastColor, note:"", w:cw, x:0, y:0 });
  if (pt){ ({ x:it.x, y:it.y } = clampBox(pt.x - cw / 2, pt.y - 24, cw, 120)); } else { const p = defaultSpot(); it.x = p.x; it.y = p.y; }
  if (!it.font && S.lastFont) it.font = S.lastFont; if (!it.bg && S.lastBg && S.lastBg !== "white") it.bg = S.lastBg; if (!it.cc && S.lastCc) it.cc = S.lastCc; if (!it.frame && S.lastFrame && S.lastFrame !== "thin") it.frame = S.lastFrame; if (!it.fs && S.lastFs !== 1) it.fs = S.lastFs; S.proj.items.push(it); S.sel = it.id; S.selLink = null;
  renderWs(); renderDocPage(v.fp, info.page); commit(); if (!pt) showCardIfHidden(it.id);
  toast("Alıntı masaya eklendi", isNarrow() ? { label:"Masaya git", fn:() => setTab("ws") } : null);
}

/* ================= workspaces ================= */
function renderSpaces(){
  el.spaces.innerHTML = "";
  for (const sp of S.proj.spaces){
    const b = document.createElement("button"); b.className = "sp"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(sp.id === S.space)); b.textContent = sp.name; b.dataset.sid = sp.id;
    b.onclick = () => { if (sp.id !== S.space) switchSpace(sp.id); };
    b.ondblclick = () => renameSpace(sp.id);
    el.spaces.appendChild(b);
    if (sp.id === S.space){
      const m = document.createElement("button"); m.className = "sp sp-more"; m.innerHTML = ICON.more; m.title = "Masa seçenekleri"; m.setAttribute("aria-label", "Masa seçenekleri");
      m.onclick = () => { const d = $("#spDelete"); delete d.dataset.arm; d.textContent = "Bu masayı sil"; d.style.color = ""; openPop(el.spacePop, m); }; el.spaces.appendChild(m);
    }
  }
  const add = document.createElement("button"); add.className = "sp sp-add"; add.innerHTML = ICON.plus; add.title = "Yeni masa"; add.setAttribute("aria-label", "Yeni masa");
  add.onclick = () => { const sp = newSpace("Masa " + (S.proj.spaces.length + 1)); S.proj.spaces.push(sp); switchSpace(sp.id); };
  el.spaces.appendChild(add);
}
function switchSpace(id){ S.space = id; S.sel = null; S.selLink = null; cancelLink(); renderSpaces(); renderWs(); save(); }
function renameSpace(id){
  const sp = S.proj.spaces.find(s => s.id === id); if (!sp) return; closePop();
  const btn = el.spaces.querySelector(`.sp[data-sid="${id}"]`); if (!btn) return;
  const inp = document.createElement("input"); inp.className = "sp-input"; inp.value = sp.name; inp.setAttribute("aria-label", "Masa adı");
  btn.replaceWith(inp); inp.focus(); inp.select();
  let done = false;
  const finish = ok => { if (done) return; done = true; if (ok) sp.name = inp.value.trim() || sp.name; renderSpaces(); save(); };
  inp.addEventListener("blur", () => finish(true)); inp.addEventListener("keydown", e => { if (e.key === "Enter") finish(true); if (e.key === "Escape") finish(false); });
}
$("#spRename").onclick = () => renameSpace(S.space);
/* ---- sheet size and pattern (tucked away in the space menu) ---- */
const PAT_ICON = { blank:"", dot:"", grid:"", lined:"", mm:"" };
function contentMin(){
  /* measured from the DOM, so it is exact for the current space */
  const sh = sheet(); let x2 = sh.x + SHEET_MIN, y2 = sh.y + SHEET_MIN;
  el.plane.querySelectorAll(":scope > .card, :scope > .group").forEach(n => { x2 = Math.max(x2, n.offsetLeft + n.offsetWidth + 20); y2 = Math.max(y2, n.offsetTop + n.offsetHeight + 20); });
  for (const st of S.proj.ink) if (st.where === "ws" && st.space === S.space) for (const p of st.pts){ x2 = Math.max(x2, p[0] + st.w + 10); y2 = Math.max(y2, p[1] + st.w + 10); }
  return { w:Math.ceil(x2 - sh.x), h:Math.ceil(y2 - sh.y) };
}
const toCm = v => Math.round(v / MM / 10), fromCm = c => Math.round(c * 10 * MM);
function setSheetSize(w, h){
  const sh = sheet(), mn = contentMin(), max = Infinity;
  const W = clamp(Math.round(w), Math.max(SHEET_MIN, mn.w), max), H = clamp(Math.round(h), Math.max(SHEET_MIN, mn.h), max);
  const note = $("#shNote");
  note.textContent = (W > w + 2 || H > h + 2) ? `İçerik sığmadığı için en az ${toCm(Math.max(SHEET_MIN, mn.w))} × ${toCm(Math.max(SHEET_MIN, mn.h))} cm olabilir.` : "";
  sh.w = W; sh.h = H; renderSheet(); applyView(); save(); fillSheetPop(false);
}
function fillSheetPop(rebuild){
  const sp = curSpace(), sh = sp.sheet;
  const row = $("#patRow");
  if (rebuild){
    row.innerHTML = "";
    for (const [k, name] of Object.entries(PATTERNS)){
      const b = document.createElement("button"); b.className = "pat"; b.dataset.p = k; b.setAttribute("role", "radio"); b.title = name;
      b.innerHTML = `<i class="pat-sw" data-pat="${k}"></i><span>${name}</span>`;
      b.onclick = () => { curSpace().pattern = k; renderSheet(); save(); fillSheetPop(false); };
      row.appendChild(b);
    }
    const sel = $("#shPreset"); sel.innerHTML = "";
    for (const k of Object.keys(PAPER)){ const o = document.createElement("option"); o.value = k; o.textContent = k; sel.appendChild(o); }
    for (const [v, t] of [["custom","Özel"]]){ const o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); }
    $("#shNote").textContent = "";
  }
  row.querySelectorAll(".pat").forEach(b => b.setAttribute("aria-checked", String(b.dataset.p === sp.pattern)));
  const dr = $("#deskRow");
  if (rebuild){ dr.innerHTML = ""; for (const [k, d] of Object.entries(DESKS)){ const b = document.createElement("button"); b.className = "desk-sw"; b.dataset.k = k; b.title = d.name; b.setAttribute("aria-label", d.name); if (d.bg) b.style.backgroundImage = d.bg;
    const t = document.createElement("span"); t.textContent = d.name; const w = document.createElement("span"); w.className = "desk-w"; w.append(b, t); b.onclick = () => { if (k === "plain") delete curSpace().desk; else curSpace().desk = k; renderSheet(); save(); fillSheetPop(false); }; dr.appendChild(w); } }
  dr.querySelectorAll(".desk-sw").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === (sp.desk || "plain"))));
  $("#grainChk").checked = !!sp.grain;
  const pr = $("#paperRow");
  if (rebuild){ pr.innerHTML = ""; for (const [k, p] of Object.entries(PAPER_COLORS)){ const b = document.createElement("button"); b.className = "paper-sw"; b.dataset.k = k; b.style.setProperty("--pl", p.l); b.style.setProperty("--pd", p.d); b.title = p.name; b.setAttribute("aria-label", p.name);
    b.onclick = () => { if (k === "white") delete curSpace().paper; else curSpace().paper = k; renderSheet(); save(); fillSheetPop(false); }; pr.appendChild(b); }
    /* any other colour */
    const more = document.createElement("button"); more.className = "paper-sw paper-more"; more.title = "Başka renk"; more.setAttribute("aria-label", "Başka renk"); more.textContent = "+";
    more.onclick = () => { openPalette(more, { title:"Masa kağıdı", named:PAPER_NAMED(), more:PAPER_MORE, current:curSpace().paper || "white",
      back:() => sheetAnchor ? openSheetPop(sheetAnchor) : closePop(),
      onPick:v => { if (v === "white") delete curSpace().paper; else curSpace().paper = v; renderSheet(); save(); if (sheetAnchor && document.contains(sheetAnchor)) openSheetPop(sheetAnchor); else closePop(); } }); };
    pr.appendChild(more); }
  pr.querySelectorAll(".paper-sw").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === (sp.paper || "white"))));
  const pm = pr.querySelector(".paper-more"); if (pm){ const custom = isHex(sp.paper); pm.setAttribute("aria-pressed", String(custom)); if (custom){ pm.style.setProperty("--pl", sp.paper); pm.style.setProperty("--pd", paperOf(sp.paper).d); } else { pm.style.removeProperty("--pl"); pm.style.removeProperty("--pd"); } }
  const land = sh.w >= sh.h, wmm = Math.round(sh.w / MM), hmm = Math.round(sh.h / MM);
  const hit = Object.entries(PAPER).find(([, [a, b]]) => Math.abs(Math.min(wmm, hmm) - a) <= 2 && Math.abs(Math.max(wmm, hmm) - b) <= 2);
  $("#shPreset").value = hit ? hit[0] : "custom";
  $("#shOrient").querySelectorAll("button").forEach(b => b.setAttribute("aria-checked", String((b.dataset.o === "land") === land)));
  $("#shW").value = toCm(sh.w); $("#shH").value = toCm(sh.h);
}
let sheetAnchor = null;
function openSheetPop(anchor){ sheetAnchor = anchor; closePop(); fillSheetPop(true); openPop($("#sheetPop"), anchor); }
$("#spSheet").onclick = () => { const a = el.spaces.querySelector(".sp-more") || el.spaces; openSheetPop(a); };
$("#shPreset").onchange = e => {
  const k = e.target.value, sh = sheet(), land = sh.w >= sh.h;
  if (k === "custom") return;
  const [a, b] = PAPER[k].map(v => v * MM); setSheetSize(land ? b : a, land ? a : b);
};
$("#shOrient").querySelectorAll("button").forEach(b => b.onclick = () => { const sh = sheet(), land = b.dataset.o === "land"; if ((sh.w >= sh.h) === land) return; setSheetSize(sh.h, sh.w); });
for (const id of ["shW","shH"]) $("#" + id).addEventListener("change", () => setSheetSize(fromCm(+$("#shW").value || 0), fromCm(+$("#shH").value || 0)));
$("#spDelete").onclick = () => {
  const btn = $("#spDelete");
  if (S.proj.spaces.length < 2){ closePop(); toast("Son masa silinemez."); return; }
  const n = spaceItems().length;
  if (n && !btn.dataset.arm){ btn.dataset.arm = "1"; btn.textContent = `${n} kartla birlikte sil, emin misin?`; btn.style.color = "var(--rec)"; return; }
  const id = S.space, gone = new Set(spaceItems().map(i => i.id));
  S.proj.items = S.proj.items.filter(i => i.space !== id); S.proj.groups = S.proj.groups.filter(g => g.space !== id);
  S.proj.ink = S.proj.ink.filter(s => !(s.where === "ws" && s.space === id)); S.proj.links = S.proj.links.filter(l => !gone.has(l.a) && !gone.has(l.b));
  S.proj.spaces = S.proj.spaces.filter(s => s.id !== id); prunePins(); closePop(); switchSpace(S.proj.spaces[0].id); renderAllOverlays(); commit();
};

/* ================= workspace render ================= */
const itemById = id => S.proj.items.find(i => i.id === id);
/* ---- desk surfaces (the area around the sheet) and paper grain, drawn from noise so no image files are needed (v6.9.6) ---- */
const svgTex = (w, h, body) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`;
const noiseTex = (w, h, freq, oct, seed, m, extra = "") => svgTex(w, h, `<filter id='f' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${oct}' seed='${seed}' stitchTiles='stitch'/><feColorMatrix type='matrix' values='${m}'/>${extra}</filter><rect width='100%' height='100%' filter='url(#f)'/>`);
const DESKS = {
  plain:{ name:"Düz" },
  wood:{ name:"Ahşap", bg:noiseTex(640, 320, "0.0035 0.11", 4, 7, "0.30 0 0 0 0.47  0.22 0 0 0 0.31  0.14 0 0 0 0.17  0 0 0 0 1") },
  cork:{ name:"Mantar pano", bg:noiseTex(300, 300, "0.75", 3, 4, "0.55 0 0 0 0.42  0.45 0 0 0 0.28  0.32 0 0 0 0.13  0 0 0 0 1") },
  slate:{ name:"Karatahta", bg:noiseTex(500, 500, "0.012", 5, 9, "0.10 0 0 0 0.14  0.11 0 0 0 0.18  0.10 0 0 0 0.16  0 0 0 0 1") },
  linen:{ name:"Keten", bg:svgTex(240, 240, "<filter id='f' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='0.9 0.025' numOctaves='2' seed='2' stitchTiles='stitch' result='a'/><feTurbulence type='fractalNoise' baseFrequency='0.025 0.9' numOctaves='2' seed='5' stitchTiles='stitch' result='b'/><feBlend in='a' in2='b' mode='multiply'/><feColorMatrix type='matrix' values='0.22 0 0 0 0.74  0.22 0 0 0 0.71  0.22 0 0 0 0.65  0 0 0 0 1'/></filter><rect width='100%' height='100%' filter='url(#f)'/>") },
  felt:{ name:"Keçe", bg:noiseTex(260, 260, "0.9", 2, 3, "0.16 0 0 0 0.22  0.16 0 0 0 0.23  0.16 0 0 0 0.26  0 0 0 0 1") }
};
const GRAIN = noiseTex(360, 360, "0.85 0.6", 4, 11, "0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.22  0 0 0 -0.7 0.42");
document.documentElement.style.setProperty("--grain", GRAIN);
function renderDesk(){
  const sp = curSpace(), d = DESKS[sp.desk] && sp.desk !== "plain" ? DESKS[sp.desk] : null;
  if (d){ el.ws.style.setProperty("--desk", d.bg); el.ws.dataset.desk = sp.desk; } else { el.ws.style.removeProperty("--desk"); delete el.ws.dataset.desk; }
  sheetEl.classList.toggle("grain", !!sp.grain); deskPos();
}
/* the desk moves with the sheet when the view is panned */
function deskPos(){ if (!el.ws.dataset.desk) return; const v = view(); el.ws.style.backgroundPosition = `${Math.round(v.tx)}px ${Math.round(v.ty)}px`; }
const sheetEl = document.createElement("div"); sheetEl.id = "sheet"; el.plane.insertBefore(sheetEl, el.plane.firstChild);
const sheet = () => curSpace().sheet;
function renderSheet(){
  const sp = curSpace(), sh = sp.sheet; Object.assign(sheetEl.style, { left:sh.x + "px", top:sh.y + "px", width:sh.w + "px", height:sh.h + "px" }); sheetEl.dataset.pat = sp.pattern; renderDesk();
  const pc = paperOf(sp.paper); if (pc && sp.paper !== "white"){ sheetEl.style.setProperty("--pl", pc.l); sheetEl.style.setProperty("--pd", pc.d); sheetEl.classList.add("tinted"); } else { sheetEl.style.removeProperty("--pl"); sheetEl.style.removeProperty("--pd"); sheetEl.classList.remove("tinted"); }
}
/* keep at least a strip of the sheet on screen, so it can never be scrolled away and lost */
function clampView(){
  const v = view(), sh = sheet(), r = el.ws.getBoundingClientRect(); if (!r.width) return;
  const m = Math.min(90, r.width / 3), L = v.tx + sh.x * v.s, Rr = v.tx + (sh.x + sh.w) * v.s, T = v.ty + sh.y * v.s, B = v.ty + (sh.y + sh.h) * v.s;
  if (Rr < m) v.tx += m - Rr; if (L > r.width - m) v.tx -= L - (r.width - m);
  if (B < m) v.ty += m - B; if (T > r.height - m) v.ty -= T - (r.height - m);
}
/* where things may go: anywhere the sheet can still grow to, without passing the 2 m limit */
function allowRegion(){ return { x1:-Infinity, y1:-Infinity, x2:Infinity, y2:Infinity }; }
const clampPt = pt => { const a = allowRegion(); return [r2(clamp(pt[0], a.x1, a.x2)), r2(clamp(pt[1], a.y1, a.y2))]; };
function clampBox(x, y, w, h){ const a = allowRegion(); return { x:Math.round(clamp(x, a.x1, Math.max(a.x1, a.x2 - w))), y:Math.round(clamp(y, a.y1, Math.max(a.y1, a.y2 - h))) }; }
/* the sheet grows to keep a margin around everything on it, never past 2 m */
function growSheet(x1, y1, x2, y2){
  const sh = sheet(), m = GROW_MARGIN, M = Infinity, N = Infinity;
  let a = Math.min(sh.x, x1 - m), b = Math.min(sh.y, y1 - m), c = Math.max(sh.x + sh.w, x2 + m), d = Math.max(sh.y + sh.h, y2 + m);
  if (c - a > M){ if (a < sh.x) a = c - M; if (c - a > M) c = a + M; }
  if (d - b > N){ if (b < sh.y) b = d - N; if (d - b > N) d = b + N; }
  a = Math.floor(a); b = Math.floor(b); c = Math.ceil(c); d = Math.ceil(d);
  if (a === sh.x && b === sh.y && c === sh.x + sh.w && d === sh.y + sh.h) return false;
  sh.x = a; sh.y = b; sh.w = c - a; sh.h = d - b; renderSheet(); return true;
}
function growToContent(){
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  el.plane.querySelectorAll(":scope > .card, :scope > .group").forEach(n => { x1 = Math.min(x1, n.offsetLeft); y1 = Math.min(y1, n.offsetTop); x2 = Math.max(x2, n.offsetLeft + n.offsetWidth); y2 = Math.max(y2, n.offsetTop + n.offsetHeight); });
  for (const st of S.proj.ink) if (st.where === "ws" && st.space === S.space) for (const p of st.pts){ x1 = Math.min(x1, p[0]); y1 = Math.min(y1, p[1]); x2 = Math.max(x2, p[0]); y2 = Math.max(y2, p[1]); }
  return isFinite(x1) && growSheet(x1, y1, x2, y2);
}
function fitSheet(){
  const r = el.ws.getBoundingClientRect(), v = view(), sh = sheet(); if (!r.width) return;
  v.s = clamp(Math.min((r.width - 60) / sh.w, (r.height - 110) / sh.h), 0.1, 1.15);
  v.tx = (r.width - sh.w * v.s) / 2 - sh.x * v.s; v.ty = (r.height - sh.h * v.s) / 2 - sh.y * v.s + 20; applyView(); drawLinks();
}
function applyView(){
  if (!S.proj) return;
  clampView();
  const v = view();
  el.plane.style.transform = `translate(${v.tx}px,${v.ty}px) scale(${v.s})`; deskPos(); if (S.selStk) stkBarPos(); if (ISEL.on && ISEL.where === "ws") iselDraw();
  el.ws.dataset.zoom = v.s < 0.45 ? "far" : v.s < 0.9 ? "mid" : "near";
  el.zl.textContent = Math.round(v.s * 100) + "%"; scheduleX(); if (MINI.on) renderMini();
}
function renderWs(){
  el.plane.querySelectorAll(".card,.group").forEach(n => n.remove()); cardEls.clear();
  const items = spaceItems();
  for (const g of S.proj.groups.filter(g => g.space === S.space)){
    const mem = items.filter(i => i.group === g.id).sort((a, b) => a.ord - b.ord); if (!mem.length) continue;
    el.plane.insertBefore(groupEl(g, mem), el.wsInk);
  }
  for (const it of items) if (!it.group) el.plane.insertBefore(cardEl(it, false), el.wsInk);
  el.plane.querySelectorAll("textarea.note").forEach(autosize);
  el.wsEmpty.hidden = items.length > 0 || S.proj.ink.some(s => s.where === "ws" && s.space === S.space);
  el.tabCount.textContent = items.length;
  renderSheet(); renderWsInk(); if (growToContent()) save(); applyView(); renderStickers(); drawLinks(); refreshReveal(); applyWsFilter();
}
/* ================= stickers on the workspace and on cards (v6.9.6) =================
   S.proj.stickers: { id, e:"emoji" | img:dataURL, s:size, r:degrees, and either space + x, y (centre on the workspace)
   or card + fx (share of the card's width) + y (from the card's top) } */
const stkList = () => S.proj.stickers || (S.proj.stickers = []);
function stkNode(k){
  const n = document.createElement("div"); n.className = "stk" + (S.selStk === k.id ? " sel" : ""); n.dataset.sid = k.id;
  n.style.width = n.style.height = k.s + "px"; n.style.setProperty("--r", (k.r || 0) + "deg");
  if (k.img){ const im = document.createElement("img"); im.src = k.img; im.alt = ""; im.draggable = false; n.appendChild(im); }
  else { const e = document.createElement("span"); e.textContent = k.e; e.style.fontSize = Math.round(k.s * 0.8) + "px"; n.appendChild(e); }
  n.addEventListener("pointerdown", e => stkDrag(e, k, n));
  return n;
}
function renderStickers(){
  el.plane.querySelectorAll(".stk").forEach(n => n.remove());
  for (const k of stkList()){
    if (k.card){
      const c = cardEls.get(k.card); if (!c) continue; const it = itemById(k.card); if (!it || it.space !== S.space) continue;
      const n = stkNode(k); n.style.left = (k.fx * 100) + "%"; n.style.top = k.y + "px"; n.classList.add("on-card"); c.appendChild(n);
    } else if (k.space === S.space){ const n = stkNode(k); n.style.left = k.x + "px"; n.style.top = k.y + "px"; el.plane.appendChild(n); }
  }
  stkBarPos();
}
function stkSelect(id){ S.selStk = id; el.plane.querySelectorAll(".stk").forEach(n => n.classList.toggle("sel", n.dataset.sid === id)); stkBarPos(); }
/* drag: on the workspace or onto a card (it then sticks to that card); off a card it goes back to the workspace */
function stkDrag(e, k, n){
  if (S.tool !== "select" || e.button > 0) return;
  e.stopPropagation(); e.preventDefault(); stkSelect(k.id);
  const s = view().s, st = { x:e.clientX, y:e.clientY }; let moved = false;
  const mv = ev => {
    const dx = (ev.clientX - st.x), dy = (ev.clientY - st.y); if (!moved && Math.hypot(dx, dy) < 4) return; moved = true;
    n.style.transform = `translate(-50%,-50%) translate(${dx / s}px, ${dy / s}px) rotate(var(--r))`;
    stkBar.hidden = true;
  };
  const up = ev => {
    window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
    if (!moved){ stkBarPos(); return; }
    n.style.visibility = "hidden"; const under = document.elementFromPoint(ev.clientX, ev.clientY); n.style.visibility = "";
    const card = under && under.closest && under.closest("#plane .card"), p = screenToPlane(ev.clientX, ev.clientY);
    if (card && cardEls.get(card.dataset.id) === card){
      const r = card.getBoundingClientRect(), it = itemById(card.dataset.id);
      k.card = it.id; k.fx = r2(clamp((ev.clientX - r.left) / r.width, -0.1, 1.1)); k.y = r2((ev.clientY - r.top) / s); delete k.space; delete k.x;
    } else { delete k.card; delete k.fx; k.space = S.space; k.x = p.x; k.y = p.y; growSheet(p.x - k.s, p.y - k.s, p.x + k.s, p.y + k.s); }
    renderStickers(); commit();
  };
  window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
}
/* small bar over the selected sticker: size, turn, delete */
const stkBar = document.createElement("div"); stkBar.className = "stk-bar"; stkBar.hidden = true;
stkBar.innerHTML = '<button data-a="-" title="Küçült" aria-label="Küçült">−</button><button data-a="+" title="Büyüt" aria-label="Büyüt">+</button><button data-a="r" title="Döndür" aria-label="Döndür">↻</button><button data-a="x" title="Sil" aria-label="Çıkartmayı sil">' + ICON.del + '</button>';
el.ws.appendChild(stkBar);
stkBar.addEventListener("pointerdown", e => e.stopPropagation());
stkBar.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return; const k = stkList().find(x => x.id === S.selStk); if (!k) return;
  const a = b.dataset.a;
  if (a === "+") k.s = Math.min(320, Math.round(k.s * 1.2)); else if (a === "-") k.s = Math.max(24, Math.round(k.s / 1.2));
  else if (a === "r") k.r = ((k.r || 0) + 15 + 180) % 360 - 180;
  else if (a === "x"){ S.proj.stickers = stkList().filter(x => x !== k); S.selStk = null; }
  renderStickers(); commit();
});
function stkBarPos(){
  const n = S.selStk && el.plane.querySelector(`.stk[data-sid="${S.selStk}"]`);
  if (!n || S.tool !== "select"){ stkBar.hidden = true; return; }
  const r = n.getBoundingClientRect(), w = el.ws.getBoundingClientRect();
  stkBar.hidden = false; stkBar.style.left = (r.left + r.width / 2 - w.left) + "px"; stkBar.style.top = Math.max(4, r.top - w.top - 44) + "px";
}
/* picker: the same sticker set as the folders, an own emoji or an own picture */
const stkPop = document.createElement("div"); stkPop.className = "pop look-pop stk-pop"; stkPop.hidden = true; stkPop.setAttribute("role", "dialog"); stkPop.setAttribute("aria-label", "Çıkartma"); document.body.appendChild(stkPop);
function openStickerPick(anchor, onPick, tab = 0){
  stkPop.innerHTML = "";
  const h = document.createElement("div"); h.className = "sh-h"; h.textContent = "Çıkartma"; stkPop.appendChild(h);
  const tabs = document.createElement("div"); tabs.className = "look-tabs"; const grid = document.createElement("div"); grid.className = "look-emo";
  const fill = i => { tabs.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-pressed", String(i === j))); grid.innerHTML = "";
    for (const e of STICKERS[i][1].split(" ")){ const b = document.createElement("button"); b.textContent = e; b.setAttribute("aria-label", e); b.onclick = () => { closePop(); onPick({ e }); }; grid.appendChild(b); } };
  STICKERS.forEach(([name], i) => { const b = document.createElement("button"); b.textContent = name; b.onclick = () => fill(i); tabs.appendChild(b); });
  stkPop.append(tabs, grid); fill(tab);
  const own = document.createElement("div"); own.className = "look-own";
  const inp = document.createElement("input"); inp.type = "text"; inp.placeholder = "Kendi emojin"; inp.maxLength = 8;
  const go = () => { const v = [...inp.value.trim()].slice(0, 3).join(""); if (v){ closePop(); onPick({ e:v }); } };
  inp.onkeydown = e => { if (e.key === "Enter") go(); };
  const ok = document.createElement("button"); ok.className = "btn sm"; ok.textContent = "Ekle"; ok.onclick = go;
  const up = document.createElement("button"); up.className = "btn sm"; up.textContent = "Görsel yükle";
  up.onclick = async () => { const f = await pickImageFile(); if (!f) return; try { const img = await shrinkImage(f, 360, true); closePop(); onPick({ img }); } catch { toast("Bu görsel açılamadı."); } };
  own.append(inp, ok, up); stkPop.appendChild(own);
  openPop(stkPop, anchor);
}
function addSticker(val, where){
  const k = { id:"k" + uid(), s:val.img ? 96 : 64, r:val.img ? 0 : -6, ...(val.img ? { img:val.img } : { e:val.e }) };
  if (where && where.card){ k.card = where.card; k.fx = 0.94; k.y = -6; k.s = val.img ? 72 : 46; k.r = 10; }
  else { const r = el.ws.getBoundingClientRect(), p = screenToPlane(r.left + r.width / 2, r.top + r.height / 2); k.space = S.space; k.x = p.x; k.y = p.y; growSheet(p.x - 80, p.y - 80, p.x + 80, p.y + 80); }
  stkList().push(k); S.selStk = k.id; renderStickers(); commit();
}
function autosize(t){ t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }
function groupEl(g, mem){
  const ge = document.createElement("div"); ge.className = "group" + (g.collapsed ? " collapsed" : ""); ge.dataset.gid = g.id;
  /* v6.9.6: group colour and paper */
  if (isHex(g.c)){ ge.style.setProperty("--gc", g.c); ge.classList.add("g-col"); }
  const gp = g.bg && paperOf(g.bg); if (gp){ ge.style.setProperty("--gbg-l", gp.l); ge.style.setProperty("--gbg-d", gp.d); ge.classList.add("g-paper"); }
  ge.style.left = g.x + "px"; ge.style.top = g.y + "px"; ge.style.width = g.w + "px";
  const head = document.createElement("div"); head.className = "g-head";
  const title = document.createElement("input"); title.className = "g-title"; title.value = g.title || ""; title.placeholder = "Grup başlığı"; title.setAttribute("aria-label", "Grup başlığı");
  title.addEventListener("input", () => { g.title = title.value; save(); }); title.addEventListener("change", commit);
  const cnt = document.createElement("span"); cnt.className = "g-count"; cnt.textContent = mem.length + " kart";
  const col = document.createElement("button"); col.className = "mini"; col.style.opacity = 1; col.innerHTML = ICON.chevron; col.title = g.collapsed ? "Grubu aç" : "Yığına dönüştür"; col.setAttribute("aria-label", col.title);
  col.style.transform = g.collapsed ? "rotate(-90deg)" : ""; col.onclick = () => { g.collapsed = !g.collapsed; renderWs(); commit(); };
  const ug = document.createElement("button"); ug.className = "mini"; ug.style.opacity = 1; ug.innerHTML = ICON.ungroup; ug.title = "Grubu dağıt"; ug.setAttribute("aria-label", ug.title); ug.onclick = () => ungroup(g.id);
  const gs = document.createElement("button"); gs.className = "mini"; gs.style.opacity = 1; gs.innerHTML = ICON.palette; gs.title = "Grubun rengi ve kağıdı"; gs.setAttribute("aria-label", gs.title); gs.onclick = () => openGroupStyle(g.id, gs);
  head.append(title, cnt, gs, col, ug); ge.appendChild(head);
  for (const it of mem) ge.appendChild(cardEl(it, true));
  const rz = document.createElement("div"); rz.className = "g-rz"; ge.appendChild(rz);
  head.addEventListener("pointerdown", e => {
    if (e.target.closest("button,input") || S.linkFrom) return; e.stopPropagation();
    const s = view().s, st = { x:e.clientX, y:e.clientY, ix:g.x, iy:g.y }; let moved = false;
    const mv = ev => { const dx = (ev.clientX - st.x) / s, dy = (ev.clientY - st.y) / s; if (!moved && Math.hypot(dx, dy) * s < 3) return; moved = true; ({ x:g.x, y:g.y } = clampBox(st.ix + dx, st.iy + dy, ge.offsetWidth, ge.offsetHeight)); growSheet(g.x, g.y, g.x + ge.offsetWidth, g.y + ge.offsetHeight); ge.style.left = g.x + "px"; ge.style.top = g.y + "px"; drawLinks(); };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); if (moved) commit(); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
  rz.addEventListener("pointerdown", e => {
    e.stopPropagation(); const s = view().s, st = { x:e.clientX, iw:g.w };
    const mv = ev => { g.w = clamp(Math.round(st.iw + (ev.clientX - st.x) / s), 200, Math.max(200, Math.min(960, allowRegion().x2 - g.x))); growSheet(g.x, g.y, g.x + g.w, g.y + ge.offsetHeight); ge.style.width = g.w + "px"; ge.querySelectorAll("textarea").forEach(autosize); drawLinks(); };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); commit(); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  });
  return ge;
}
function openGroupStyle(gid, anchor){
  const g = S.proj.groups.find(x => x.id === gid); if (!g) return;
  const again = () => { const a = el.plane.querySelector(`.group[data-gid="${gid}"] .g-head .mini`); openGroupStyle(gid, a || anchor); };
  const done = () => { renderWs(); commit(); again(); };
  stylePop.innerHTML = "";
  const h = document.createElement("div"); h.className = "sh-h"; h.textContent = "Grup kutusu"; stylePop.appendChild(h);
  const sec = t => { const l = document.createElement("div"); l.className = "sh-l"; l.textContent = t; stylePop.appendChild(l); const r = document.createElement("div"); r.className = "st-row"; stylePop.appendChild(r); return r; };
  const btn = (row, hex, name, fn) => { const b = document.createElement("button"); b.className = "col-pick"; const d = document.createElement("i"); d.style.background = hex; const t = document.createElement("span"); t.textContent = name; b.append(d, t); const c = document.createElement("span"); c.className = "chev"; c.innerHTML = ICON.chevron; b.appendChild(c); b.onclick = () => fn(b); row.appendChild(b); };
  btn(sec("Renk (çerçeve ve başlık)"), isHex(g.c) ? g.c : "transparent", isHex(g.c) ? g.c.toUpperCase() : "Yok", b => openPalette(b, { title:"Grup rengi", named:[{ k:"none", hex:"#ffffff", name:"Renk yok" }, ...ACCENT_NAMED()], more:ACCENT_MORE, current:g.c || "none", back:again,
    onPick:v => { const hex = isHex(v) ? v : HL_HEX[v]; if (hex) g.c = hex; else delete g.c; done(); } }));
  const gp = paperOf(g.bg || "white") || PAPER_COLORS.white;
  btn(sec("Kağıt"), g.bg ? gp.l : "transparent", g.bg ? gp.name : "Şeffaf", b => openPalette(b, { title:"Grup kağıdı", named:[{ k:"none", hex:"#ffffff", name:"Şeffaf" }, ...PAPER_NAMED().filter(n => n.k !== "white"), { k:"white", hex:"#ffffff", name:"Beyaz" }], more:PAPER_MORE, current:g.bg || "none", back:again,
    onPick:v => { if (v === "none") delete g.bg; else g.bg = v; done(); } }));
  openPop(stylePop, anchor);
}
function ungroup(gid){
  const g = S.proj.groups.find(x => x.id === gid); if (!g) return;
  const mem = S.proj.items.filter(i => i.group === gid).sort((a, b) => a.ord - b.ord);
  let y = g.y;
  for (const it of mem){ const c = cardEls.get(it.id), h = c && c.offsetHeight ? c.offsetHeight : 140; delete it.group; delete it.ord; it.w = Math.max(170, g.w - 16); ({ x:it.x, y:it.y } = clampBox(g.x, y, it.w, h)); y += h + 16; }
  S.proj.groups = S.proj.groups.filter(x => x.id !== gid); renderWs(); commit();
}
function normalizeGroups(){
  for (const g of [...S.proj.groups]){
    const mem = S.proj.items.filter(i => i.group === g.id).sort((a, b) => a.ord - b.ord);
    mem.forEach((m, i) => m.ord = i);
    if (mem.length === 0) S.proj.groups = S.proj.groups.filter(x => x !== g);
    else if (mem.length === 1){ const m = mem[0]; delete m.group; delete m.ord; m.x = g.x; m.y = g.y; m.w = Math.max(170, g.w - 16); S.proj.groups = S.proj.groups.filter(x => x !== g); }
  }
}
function anchorObj(a){ const list = { ink:S.proj.ink, text:S.proj.texts, comment:S.proj.comments, pin:S.proj.pins }[a.type] || []; return list.find(o => o.id === a.id); }
const pinUsed = (links, id) => links.some(l => (l.anchor && l.anchor.id === id) || (l.pins && l.pins.includes(id)) || l.pin === id);
function prunePins(){ const before = S.proj.pins.length; S.proj.pins = S.proj.pins.filter(n => pinUsed(S.proj.links, n.id)); return before !== S.proj.pins.length; }
function anchorLabel(a){
  const o = anchorObj(a); if (!o || !o.doc) return null;
  return (S.proj.docs.length > 1 ? docName(o.doc).slice(0, 14) + " · " : "") + "s. " + o.page;
}
/* ================= rich text in card notes (v6.9.4) =================
   it.note stays the plain text: search, exam mode, Markdown, older versions all keep using it.
   it.rich (optional) holds the same text as runs: [{ s, b, i, u, c:"#rrggbb", f:fontId }]. Their texts joined must equal it.note;
   if an older version edits the note, they no longer match and the plain text wins (nothing is lost but the styling). */
const RT_KEYS = ["b", "i", "u", "c", "f"];
const rtStyle = r => { const o = {}; if (r && r.b) o.b = true; if (r && r.i) o.i = true; if (r && r.u) o.u = true; if (r && isHex(r.c)) o.c = r.c.toLowerCase(); if (r && FONT_IDS.has(r.f)) o.f = r.f; return o; };
const rtSame = (a, b) => RT_KEYS.every(k => ((a && a[k]) || "") === ((b && b[k]) || ""));
const rtHas = r => RT_KEYS.some(k => r[k]);
function rtNorm(runs){
  const out = [];
  for (const r of runs){ const s = String(r.s || ""); if (!s) continue; const st = rtStyle(r); const l = out[out.length - 1]; if (l && rtSame(l, st)) l.s += s; else out.push({ s, ...st }); }
  return out;
}
const rtValid = it => Array.isArray(it.rich) && it.rich.map(r => String(r.s || "")).join("") === (it.note || "");
const rtRuns = it => rtValid(it) ? rtNorm(it.rich) : [{ s:it.note || "" }];
const richOf = it => rtValid(it) && it.rich.some(rtHas) ? rtNorm(it.rich) : null;
/* Markdown for a note: bold **, italic *, underline <u> (colours and fonts have no Markdown form) */
function mdNote(it){
  const runs = richOf(it); if (!runs) return it.note || "";
  return runs.map(r => r.s.split("\n").map(line => { if (!line.trim()) return line; const m = /^(\s*)(.*?)(\s*)$/.exec(line); let t = m[2]; if (r.u) t = `<u>${t}</u>`; if (r.i) t = `*${t}*`; if (r.b) t = `**${t}**`; return m[1] + t + m[3]; }).join("\n")).join("");
}
function rtSet(it, runs){ runs = rtNorm(runs); it.note = runs.map(r => r.s).join(""); if (runs.some(rtHas)) it.rich = runs; else delete it.rich; }
function cleanRich(i){
  if (!Array.isArray(i.rich)) return {};
  const runs = rtNorm(i.rich.filter(r => r && typeof r.s === "string"));
  return runs.map(r => r.s).join("") === String(i.note || "") && runs.some(rtHas) ? { rich:runs } : {};
}
/* style at a position of the plain text */
function rtStyleAt(runs){
  const ends = []; let n = 0; for (const r of runs){ n += r.s.length; ends.push(n); }
  return pos => { for (let k = 0; k < runs.length; k++) if (pos < ends[k]) return runs[k]; return runs[runs.length - 1] || {}; };
}
/* change the style of the characters a..b */
function rtMap(runs, a, b, fn){
  const out = []; let p = 0;
  for (const r of runs){
    const e = p + r.s.length, st = rtStyle(r);
    if (e <= a || p >= b) out.push({ s:r.s, ...st });
    else {
      const x = Math.max(a, p) - p, y = Math.min(b, e) - p;
      if (x > 0) out.push({ s:r.s.slice(0, x), ...st });
      out.push({ s:r.s.slice(x, y), ...rtStyle(fn(st)) });
      if (y < r.s.length) out.push({ s:r.s.slice(y), ...st });
    }
    p = e;
  }
  return rtNorm(out);
}
/* put text in at a..b with a style */
function rtInsert(runs, a, b, text, st){
  const before = [], after = []; let p = 0;
  for (const r of runs){ const e = p + r.s.length, s0 = rtStyle(r);
    if (e <= a) before.push(r); else if (p >= b) after.push(r);
    else { if (a > p) before.push({ s:r.s.slice(0, a - p), ...s0 }); if (b < e) after.push({ s:r.s.slice(b - p), ...s0 }); }
    p = e; }
  return rtNorm([...before, { s:text, ...rtStyle(st) }, ...after]);
}
function rtCss(st){ const c = []; if (st.b) c.push("font-weight:700"); if (st.i) c.push("font-style:italic"); if (st.u) c.push("text-decoration:underline"); if (st.c) c.push("color:" + st.c); if (st.f) c.push("font-family:" + fontCss(st.f)); return c.join(";"); }
function rtNode(text, st){
  if (!st || !rtHas(st)) return document.createTextNode(text);
  const sp = document.createElement("span"); sp.dataset.rt = "1"; sp.style.cssText = rtCss(st); sp.textContent = text; return sp;
}
function rtRender(box, runs){
  box.textContent = "";
  for (const r of runs) box.appendChild(rtNode(r.s, r));
  if (runs.length && runs[runs.length - 1].s.endsWith("\n")){ const br = document.createElement("br"); br.dataset.s = "1"; box.appendChild(br); } /* lets the caret sit on the empty last line */
}
/* read the editor back into runs, whatever markup the browser put there */
const rgbHex = v => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(v || ""); return m ? "#" + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, "0")).join("") : ""; };
function rtRead(box){
  const base = getComputedStyle(box), baseC = rgbHex(base.color), baseF = base.fontFamily, runs = [];
  const styleOf = node => {
    const elx = node.parentElement, cs = getComputedStyle(elx), st = {};
    if (+cs.fontWeight >= 600 && !(+base.fontWeight >= 600)) st.b = true;
    if (cs.fontStyle === "italic" && base.fontStyle !== "italic") st.i = true;
    for (let e = elx; e && e !== box; e = e.parentElement){ if ((getComputedStyle(e).textDecorationLine || "").includes("underline")){ st.u = true; break; } }
    const c = rgbHex(cs.color); if (c && c !== baseC) st.c = c;
    if (cs.fontFamily !== baseF){ const m = /edf-([a-z0-9-]+)/.exec(cs.fontFamily); if (m && FONT_IDS.has(m[1])) st.f = m[1]; }
    return st;
  };
  const walk = (n, first) => {
    for (const ch of n.childNodes){
      if (ch.nodeType === 3){ if (ch.data) runs.push({ s:ch.data.replace(/ /g, " "), ...styleOf(ch) }); continue; }
      if (ch.nodeType !== 1) continue;
      if (ch.tagName === "BR"){ if (!ch.dataset.s) runs.push({ s:"\n" }); continue; }
      const block = /^(DIV|P|LI)$/.test(ch.tagName);
      if (block && runs.length && !runs[runs.length - 1].s.endsWith("\n")) runs.push({ s:"\n" });
      walk(ch);
    }
  };
  walk(box);
  return rtNorm(runs);
}
/* caret / selection as character positions */
function rtSel(box){
  const sel = getSelection(); if (!sel.rangeCount) return null;
  const r = sel.getRangeAt(0); if (!box.contains(r.startContainer) || !box.contains(r.endContainer)) return null;
  const pos = (node, off) => { const q = document.createRange(); q.selectNodeContents(box); q.setEnd(node, off); return q.toString().length; };
  const a = pos(r.startContainer, r.startOffset), b = pos(r.endContainer, r.endOffset); return [Math.min(a, b), Math.max(a, b)];
}
function rtSetSel(box, a, b = a){
  const find = want => { const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); let n, p = 0, last = null;
    while ((n = w.nextNode())){ if (want <= p + n.data.length) return [n, want - p]; p += n.data.length; last = n; }
    return last ? [last, last.data.length] : [box, 0]; };
  const [sn, so] = find(a), [en, eo] = find(b), r = document.createRange(); r.setStart(sn, so); r.setEnd(en, eo);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
}

/* ---- the editor inside a card ---- */
const RT = { id:null, box:null, last:null, pending:null };
function noteEditor(it, onBlur){
  const ed = document.createElement("div"); ed.className = "note note-ed"; ed.contentEditable = "true"; ed.dataset.note = it.id; ed.spellcheck = true;
  ed.setAttribute("role", "textbox"); ed.setAttribute("aria-multiline", "true"); ed.setAttribute("aria-label", "Kart notu");
  ed.dataset.ph = it.type === "note" ? "Düşünceni yaz… (formül için $E = mc^2$)" : "Not ekle…";
  rtRender(ed, rtRuns(it));
  const sync = () => { const runs = rtRead(ed); rtSet(it, runs); ed.classList.toggle("empty", !it.note); drawLinks(); save(); };
  ed.classList.toggle("empty", !it.note);
  const insert = (text, style) => {
    const sel = rtSel(ed) || [it.note.length, it.note.length], runs = rtRead(ed);
    const st = style || (RT.pending && RT.pending.id === it.id && RT.pending.at === sel[0] ? RT.pending.st : rtStyleAt(runs)(Math.max(0, sel[0] - 1)));
    const next = rtInsert(runs, sel[0], sel[1], text, st); rtSet(it, next); rtRender(ed, rtRuns(it)); rtSetSel(ed, sel[0] + text.length);
    /* after a line break the browser puts the caret outside the styled text: keep the style for what is typed next */
    RT.pending = text.endsWith("\n") && rtHas(rtStyle(st)) ? { id:it.id, at:sel[0] + text.length, st:rtStyle(st) } : null; ed.classList.toggle("empty", !it.note); drawLinks(); save(); fmtUpdate();
  };
  ed.addEventListener("beforeinput", e => {
    const t = e.inputType;
    if (t === "insertParagraph" || t === "insertLineBreak"){ e.preventDefault(); insert("\n"); return; }
    if (t === "formatBold" || t === "formatItalic" || t === "formatUnderline"){ e.preventDefault(); rtToggle({ formatBold:"b", formatItalic:"i", formatUnderline:"u" }[t]); return; }
    if (t && t.startsWith("format")){ e.preventDefault(); return; }
    if (t === "insertText" && RT.pending && RT.pending.id === it.id && e.data){ const s0 = rtSel(ed); if (s0 && s0[0] === RT.pending.at){ e.preventDefault(); insert(e.data, RT.pending.st); } }
  });
  ed.addEventListener("input", sync);
  ed.addEventListener("paste", e => { e.preventDefault(); const t = (e.clipboardData && e.clipboardData.getData("text/plain")) || ""; if (t) insert(t.replace(/\r\n?/g, "\n")); });
  ed.addEventListener("drop", e => { e.preventDefault(); const t = e.dataTransfer && e.dataTransfer.getData("text/plain"); if (t){ ed.focus(); insert(t.replace(/\r\n?/g, "\n")); } });
  ed.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && ["b", "i", "u"].includes(e.key.toLowerCase())){ e.preventDefault(); e.stopPropagation(); rtToggle(e.key.toLowerCase()); }
  });
  ed.addEventListener("focus", () => { RT.id = it.id; RT.box = ed; select(it.id); fmtShow(true); fmtUpdate(); });
  ed.addEventListener("blur", () => {
    RT.last = { id:it.id, sel:RT.lastSel && RT.lastSel.id === it.id ? RT.lastSel.sel : [it.note.length, it.note.length] };
    setTimeout(() => { if (document.activeElement !== ed && !fmtBar.contains(document.activeElement)){ if (RT.box === ed){ RT.box = null; RT.id = null; } fmtShow(false); } }, 0);
    commit(); onBlur && onBlur();
  });
  return ed;
}
document.addEventListener("selectionchange", () => {
  if (!RT.box || !document.contains(RT.box)) return;
  const sel = rtSel(RT.box); if (!sel) return;
  RT.lastSel = { id:RT.id, sel };
  if (RT.pending && (RT.pending.id !== RT.id || RT.pending.at !== sel[0] || sel[0] !== sel[1])) RT.pending = null;
  fmtUpdate();
});
/* the editor that a format command acts on: the focused one, or the one that was focused before a palette opened */
function rtTarget(){
  if (RT.box && document.contains(RT.box)){ const it = itemById(RT.id); if (it) return { it, box:RT.box, sel:rtSel(RT.box) || (RT.lastSel && RT.lastSel.sel) }; }
  if (RT.last){ const it = itemById(RT.last.id), box = el.plane.querySelector(`.note-ed[data-note="${RT.last.id}"]`); if (it && box) return { it, box, sel:RT.last.sel }; }
  return null;
}
function rtApply(fn, label){
  const t = rtTarget(); if (!t) return;
  const { it, box } = t; let [a, b] = t.sel || [0, 0];
  const runs = rtRead(box);
  if (a === b){
    /* nothing selected: the next letters typed get the style */
    const cur = RT.pending && RT.pending.id === it.id && RT.pending.at === a ? RT.pending.st : rtStyle(rtStyleAt(runs)(Math.max(0, a - 1)));
    box.focus(); rtSetSel(box, a); RT.pending = { id:it.id, at:a, st:rtStyle(fn(cur)) }; fmtUpdate(); return;
  }
  rtSet(it, rtMap(runs, a, b, fn)); rtRender(box, rtRuns(it));
  box.focus(); rtSetSel(box, a, b); drawLinks(); commit(); fmtUpdate();
}
function rtToggle(k){
  const t = rtTarget(); if (!t) return;
  const [a, b] = t.sel || [0, 0], runs = rtRead(t.box), at = rtStyleAt(runs);
  let on;
  if (a === b) on = !!(RT.pending && RT.pending.id === t.it.id && RT.pending.at === a ? RT.pending.st[k] : rtStyle(at(Math.max(0, a - 1)))[k]);
  else { on = true; for (let p = a; p < b; p++) if (!at(p)[k]){ on = false; break; } }
  rtApply(st => { const o = { ...st }; if (on) delete o[k]; else o[k] = true; return o; });
}

/* ---- format bar: shown under the top bar while a card note is being edited ---- */
const fmtBar = document.createElement("div"); fmtBar.className = "fmtbar"; fmtBar.id = "fmtBar"; fmtBar.hidden = true; fmtBar.setAttribute("role", "toolbar"); fmtBar.setAttribute("aria-label", "Yazı biçimi");
fmtBar.innerHTML = `<button data-f="b" title="Kalın (Ctrl+B)" aria-label="Kalın"><b>K</b></button><button data-f="i" title="İtalik (Ctrl+I)" aria-label="İtalik"><i>İ</i></button><button data-f="u" title="Altı çizili (Ctrl+U)" aria-label="Altı çizili"><u>A</u></button>
<span class="vsep"></span><button data-f="c" class="fm-col" title="Yazı rengi" aria-label="Yazı rengi"><span class="fm-a">A</span><i class="fm-bar"></i></button>
<button data-f="f" class="fm-font" title="Yazı tipi" aria-label="Yazı tipi"><span class="fm-fn">Yazı tipi</span></button>
<span class="vsep"></span><button data-f="x" title="Biçimi temizle" aria-label="Biçimi temizle"><svg viewBox="0 0 24 24"><path d="M6 5h12M12 5l-3 14M5 19l14-14" /></svg></button>`;
document.querySelector(".subbar").appendChild(fmtBar);
/* pressing a button must not take the focus (and the selection) away from the note */
fmtBar.addEventListener("pointerdown", e => { if (e.target.closest("button")) e.preventDefault(); });
fmtBar.addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });
const TEXT_COLORS = ["#1d1d1f","#6e6e73","#c8352a","#e5743a","#b88a00","#2f7a43","#1f8a8a","#2357b8","#6b47b8","#b8357a","#8b5a2b","#546e7a"];
fmtBar.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return; const f = b.dataset.f;
  if (f === "b" || f === "i" || f === "u"){ rtToggle(f); return; }
  if (f === "x"){ rtApply(() => ({})); return; }
  const t = rtTarget(); if (!t) return; RT.last = { id:t.it.id, sel:t.sel || [0, 0] };
  if (f === "c"){
    const cur = fmtCur();
    openPalette(b, { title:"Yazı rengi", named:[{ k:"default", hex:"#8e8e93", name:"Varsayılan" }], more:TEXT_COLORS, current:cur.c || "default",
      onPick:v => { closePop(); rtApply(st => { const o = { ...st }; if (v === "default") delete o.c; else o.c = v; return o; }); } });
  }
  if (f === "fn" || f === "f"){
    openFontPop(b, fmtCur().f || "", id => rtApply(st => { const o = { ...st }; if (id) o.f = id; else delete o.f; return o; }));
  }
});
function fmtShow(on){ fmtBar.hidden = !on; if (!on) RT.pending = null; }
function fmtCur(){
  const t = rtTarget(); if (!t) return {};
  const [a, b] = t.sel || [0, 0];
  if (RT.pending && RT.pending.id === t.it.id && RT.pending.at === a && a === b) return RT.pending.st;
  return rtStyle(rtStyleAt(rtRuns(t.it))(a === b ? Math.max(0, a - 1) : a));
}
function fmtUpdate(){
  if (fmtBar.hidden) return;
  const st = fmtCur();
  for (const k of ["b", "i", "u"]) fmtBar.querySelector(`[data-f="${k}"]`).setAttribute("aria-pressed", String(!!st[k]));
  fmtBar.querySelector(".fm-bar").style.background = st.c || "var(--ink-2)";
  const fn = fmtBar.querySelector(".fm-fn"); fn.textContent = st.f ? fontName(st.f) : "Yazı tipi"; fn.style.fontFamily = st.f ? fontCss(st.f) : "";
}

function cardEl(it, inGroup){
  const c = document.createElement("div"); c.className = "card" + (it.type === "note" ? " isnote" : "") + (S.sel === it.id ? " selected" : ""); c.dataset.id = it.id; recAttr(c, it);
  if (it.fs && it.fs !== 1) c.style.setProperty("--fs", it.fs);
  c.dataset.color = it.color; c.dataset.frame = it.frame || "thin";
  const pb = it.bg && paperOf(it.bg); if (pb){ c.style.setProperty("--cbg-l", pb.l); c.style.setProperty("--cbg-d", pb.d); c.classList.add("tinted"); }
  if (isHex(it.cc)) c.style.setProperty("--acc", it.cc);
  if (it.font) c.style.setProperty("--cf", fontCss(it.font));
  if (!inGroup){ c.style.left = it.x + "px"; c.style.top = it.y + "px"; c.style.width = it.w + "px"; }
  const head = document.createElement("div"); head.className = "card-head";
  if (it.photo){ const k = document.createElement("span"); k.className = "kind"; k.innerHTML = `<i class="c-${it.color}"></i>Fotoğraf`; head.appendChild(k); }
  else if (it.type === "video"){ const k = document.createElement("span"); k.className = "kind"; k.innerHTML = `<i class="c-${it.color}"></i>Video · ${fmtT(it.dur)}`; head.appendChild(k); }
  else if (it.type === "excerpt" || it.type === "image"){
    const pg = document.createElement("button"); pg.className = "pg"; pg.innerHTML = `<i class="c-${it.color}"></i>`;
    const pgt = document.createElement("span"); pgt.className = "pg-t"; pgt.textContent = (it.type === "image" ? "Görsel · " : "") + (S.proj.docs.length > 1 ? docName(it.doc).slice(0, 22) + " · " : "") + "s. " + it.page; pg.appendChild(pgt);
    pg.title = "Belgede bu yere git"; pg.onclick = () => goToExcerpt(it.id); head.appendChild(pg);
  } else { const k = document.createElement("span"); k.className = "kind"; k.innerHTML = `<i class="c-${it.color}"></i>Not`; head.appendChild(k); }
  if (it.rec && S.proj.recs.some(r => r.id === it.rec)){ const ts = document.createElement("button"); ts.className = "tstamp"; ts.innerHTML = ICON.play + fmtT(it.t); ts.title = "Bu kartın eklendiği anı dinle"; ts.onclick = () => playAt(it.rec, it.t); head.appendChild(ts); }
  const sp = document.createElement("span"); sp.className = "spacer"; head.appendChild(sp);
  const lb = document.createElement("button"); lb.className = "mini"; lb.title = "Başka bir karta ya da belgedeki bir işarete bağla"; lb.setAttribute("aria-label", "Bağla"); lb.innerHTML = ICON.link; lb.onclick = () => startLink(it.id);
  const db = document.createElement("button"); db.className = "mini del"; db.title = "Kartı sil"; db.setAttribute("aria-label", "Kartı sil"); db.innerHTML = ICON.del; db.onclick = () => removeItem(it.id);
  head.append(lb, db); c.appendChild(head);
  const anchors = S.proj.links.filter(l => l.anchor && l.a === it.id);
  if (anchors.length){
    const row = document.createElement("div"); row.className = "anc-row"; row.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;padding:6px 12px 0";
    for (const L of anchors){
      const lab = anchorLabel(L.anchor); if (!lab) continue;
      const a = document.createElement("span"); a.className = "anc";
      const go = document.createElement("button"); go.innerHTML = ICON.arrow; go.appendChild(document.createTextNode(lab)); go.title = "Bağlı işarete git"; go.onclick = () => goToAnchor(L.anchor);
      const x = document.createElement("button"); x.className = "anc-x"; x.innerHTML = ICON.x; x.title = "Bağlantıyı kaldır"; x.setAttribute("aria-label", x.title); x.onclick = () => removeLink(L.id);
      a.append(go, x); row.appendChild(a);
    }
    c.appendChild(row);
  }
  if (it.type === "excerpt"){ const q = document.createElement("div"); q.className = "quote"; q.textContent = it.text; c.appendChild(q); }
  if (it.type === "video"){
    const vb = document.createElement("button"); vb.className = "vshot" + (it.local ? " local" : ""); vb.title = "Videoyu oynat"; vb.setAttribute("aria-label", "Videoyu oynat");
    if (it.poster){ const im = document.createElement("img"); im.src = it.poster; im.alt = ""; im.draggable = false; im.onload = drawLinks; vb.appendChild(im); } else vb.classList.add("noposter");
    const pl = document.createElement("span"); pl.className = "vplay-ic"; pl.innerHTML = ICON.play; vb.appendChild(pl);
    const meta = document.createElement("span"); meta.className = "vmeta"; meta.textContent = (it.local ? "Cihazda kayıtlı · " : "") + fmtMB(it.size) + (it.vh ? " · " + Math.min(it.vw, it.vh) + "p" : ""); vb.appendChild(meta);
    vb.addEventListener("pointerdown", e => e.stopPropagation()); vb.onclick = () => { if (Date.now() - lastDragEnd < 350) return; openVideo(it); };
    c.appendChild(vb);
  }
  if (it.type === "image"){ const im = document.createElement("img"); im.className = "shot"; im.alt = it.photo ? "Fotoğraf" : "Sayfa " + it.page + " görsel alıntısı"; im.draggable = false; im.src = it.src; im.onload = drawLinks; c.appendChild(im); }
  /* the note: formatted text (bold, italic, underline, colour, font) edited in place */
  let showMath = () => {};
  const ta = noteEditor(it, () => { showMath(); drawLinks(); });
  c.appendChild(ta);
  /* when a note has formulas, show them rendered; a tap switches back to editing */
  const mv = document.createElement("div"); mv.className = "note mview"; mv.title = "Düzenlemek için dokun";
  showMath = () => { const on = hasMath(it.note) && document.activeElement !== ta; mv.hidden = !on; ta.hidden = on; if (on) renderMathInto(mv, it.note, richOf(it)); };
  mv.addEventListener("click", () => { if (Date.now() - lastDragEnd < 350 || S.linkFrom) return; mv.hidden = true; ta.hidden = false; ta.focus(); rtSetSel(ta, (it.note || "").length); });
  c.appendChild(mv); showMath();
  if (it.tags && it.tags.length){
    const tr = document.createElement("div"); tr.className = "ctags";
    for (const t of it.tags){ const b = document.createElement("button"); b.className = "tchip sm"; b.textContent = "#" + t; b.title = "Bu etiketli kartları göster"; b.onclick = () => openWsFind({ tag:t }); tr.appendChild(b); }
    c.appendChild(tr);
  }
  const cols = document.createElement("div"); cols.className = "colors";
  for (const k of HL_COLORS){ const d = document.createElement("button"); d.className = "dot c-" + k + (it.color === k ? " on" : ""); d.title = CNAME[k]; d.setAttribute("aria-label", CNAME[k]); d.onclick = () => { it.color = k; delete it.cc; S.lastColor = k; S.lastCc = ""; renderWs(); if (it.doc) renderDocPage(it.doc, it.page); commit(); }; cols.appendChild(d); }
  const stb = document.createElement("button"); stb.className = "fsb cst"; stb.innerHTML = ICON.palette; stb.title = "Kağıt, çerçeve ve yazı tipi"; stb.setAttribute("aria-label", stb.title);
  stb.onclick = () => openCardStyle(it.id, stb); cols.appendChild(stb);
  const tgb = document.createElement("button"); tgb.className = "fsb ctg"; tgb.innerHTML = ICON.hash; tgb.title = "Etiketler"; tgb.setAttribute("aria-label", tgb.title);
  tgb.onclick = () => openTagPop(it.id, tgb); cols.appendChild(tgb);
  const sp2 = document.createElement("span"); sp2.className = "spacer"; cols.appendChild(sp2);
  for (const [dir, lab, tip] of [[-1, "A−", "Yazıyı küçült (−)"], [1, "A+", "Yazıyı büyüt (+)"]]){
    const f = document.createElement("button"); f.className = "fsb" + (dir > 0 ? " up" : ""); f.textContent = lab; f.title = tip; f.setAttribute("aria-label", tip);
    f.onclick = () => cardFont(it.id, dir); cols.appendChild(f);
  }
  c.appendChild(cols);
  const rz = document.createElement("div"); rz.className = "rz"; rz.title = "Genişliği değiştir"; c.appendChild(rz);
  if (inGroup) rz.hidden = true;
  c.addEventListener("pointerdown", e => {
    if (S.linkFrom){ e.stopPropagation(); e.preventDefault(); completeLink(it.id); return; }
    if (e.target.closest("button,textarea,input,[contenteditable=\"true\"]")){ e.stopPropagation(); return; }
    e.stopPropagation(); select(it.id);
    if (e.target === rz){
      const s = view().s, st = { x:e.clientX, iw:it.w };
      const mv = ev => { it.w = clamp(Math.round(st.iw + (ev.clientX - st.x) / s), 170, Math.max(170, Math.min(900, allowRegion().x2 - it.x))); growSheet(it.x, it.y, it.x + it.w, it.y + c.offsetHeight); c.style.width = it.w + "px"; c.querySelectorAll("textarea").forEach(autosize); drawLinks(); };
      const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); commit(); };
      window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); return;
    }
    startCardDrag(e, it, c);
  });
  cardEls.set(it.id, c);
  return c;
}
/* ---- formulas in notes: $inline$ and $$display$$, drawn by MathJax as SVG ---- */
/* pandoc rules, so prices like "$5 ve $10" in old notes stay plain text:
   an inline formula must not start with a space, must not end with a space, and the closing $ must not be followed by a digit */
const hasMath = t => !!t && t.includes("$") && parseMath(t).some(x => x.t === "math");
function inlineClose(t, from){
  if (/\s/.test(t[from] || " ")) return -1;
  for (let j = from; j < t.length; j++){
    if (t[j] === "\n") return -1;
    if (t[j] === "\\"){ j++; continue; }
    if (t[j] === "$" && !/\s/.test(t[j - 1]) && !/\d/.test(t[j + 1] || "")) return j;
  }
  return -1;
}
/* text segments also carry idx: the position of each of their characters in the original note (for formatting) */
function parseMath(t){
  const out = []; let i = 0, buf = "", idx = [];
  while (i < t.length){
    if (t[i] === "\\" && t[i + 1] === "$"){ buf += "$"; idx.push(i + 1); i += 2; continue; }
    if (t[i] === "$"){
      const disp = t[i + 1] === "$", open = disp ? 2 : 1, close = disp ? t.indexOf("$$", i + 2) : inlineClose(t, i + 1);
      if (close > i + open && (disp || !t.slice(i + 1, close).includes("\n"))){
        if (disp && buf.endsWith("\n")){ buf = buf.slice(0, -1); idx.pop(); }
        if (buf) out.push({ t:"text", s:buf, idx }); buf = ""; idx = []; out.push({ t:"math", tex:t.slice(i + open, close).trim(), display:disp }); i = close + open;
        if (disp && t[i] === "\n") i++;
        continue;
      }
    }
    idx.push(i); buf += t[i++];
  }
  if (buf) out.push({ t:"text", s:buf, idx });
  return out;
}
let mjLoad = null;
function loadMathJax(){
  if (window.MathJax && window.MathJax.tex2svg) return Promise.resolve();
  if (!mjLoad){ window.MathJax = { svg:{ fontCache:"none" }, startup:{ typeset:false } };
    mjLoad = loadScript("vendor/mathjax/tex-svg.js").then(() => window.MathJax.startup.promise).then(() => { try { document.head.appendChild(window.MathJax.svgStylesheet()); } catch {} }); }
  return mjLoad;
}
function renderMathInto(box, text, runs){
  box.textContent = "";
  const sty = runs ? rtStyleAt(runs) : null;
  for (const seg of parseMath(text)){
    if (seg.t === "text"){
      if (!sty){ box.appendChild(document.createTextNode(seg.s)); continue; }
      /* formatted text between the formulas: group characters that share a style */
      let j = 0; while (j < seg.s.length){ const st = sty(seg.idx[j]); let k = j + 1; while (k < seg.s.length && rtSame(sty(seg.idx[k]), st)) k++; box.appendChild(rtNode(seg.s.slice(j, k), st)); j = k; }
      continue;
    }
    const span = document.createElement("span"); span.className = seg.display ? "mx mx-d" : "mx"; span.textContent = seg.tex; box.appendChild(span);
    loadMathJax().then(() => { try { const n = window.MathJax.tex2svg(seg.tex, { display:seg.display });
      if (n.querySelector("[data-mjx-error], merror")){ span.classList.add("mx-err"); span.title = "Formülde hata var"; return; }
      span.textContent = ""; span.appendChild(n); drawLinks(); } catch {} }).catch(() => {});
  }
}
let lastDragEnd = 0;

/* ---- card look: colour, paper, frame, font ---- */
const stylePop = document.createElement("div"); stylePop.className = "pop style-pop"; stylePop.hidden = true; stylePop.setAttribute("role", "dialog"); document.body.appendChild(stylePop);
const fontPop = document.createElement("div"); fontPop.className = "pop font-pop"; fontPop.hidden = true; fontPop.setAttribute("role", "dialog"); fontPop.setAttribute("aria-label", "Yazı tipi"); document.body.appendChild(fontPop);
function fontList(current, onPick){
  const wrap = document.createElement("div"); wrap.className = "font-list";
  const add = (id, name, note) => {
    const b = document.createElement("button"); b.className = "font-item"; b.setAttribute("aria-pressed", String((current || "") === id));
    const n = document.createElement("span"); n.className = "fi-n"; n.textContent = name; if (id) n.style.fontFamily = fontCss(id);
    b.appendChild(n); if (note){ const t = document.createElement("span"); t.className = "fi-t"; t.textContent = note; b.appendChild(t); }
    b.onclick = () => onPick(id); wrap.appendChild(b);
  };
  add("", "Sistem", "Uygulamanın yazı tipi");
  for (const cat of ["Bilimsel","Sade","Teknik","Sıcak"]){
    const h = document.createElement("div"); h.className = "sh-l fi-cat"; h.textContent = cat === "Bilimsel" ? "Bilimsel ve akademik" : cat; wrap.appendChild(h);
    for (const f of FONTS.filter(f => f.cat === cat)) add(f.id, f.name, f.note);
  }
  return wrap;
}
function openFontPop(anchor, current, onPick){
  fontPop.innerHTML = '<div class="sh-h">Yazı tipi</div>'; fontPop.appendChild(fontList(current, id => { closePop(); onPick(id); }));
  openPop(fontPop, anchor); const on = fontPop.querySelector('[aria-pressed="true"]'); if (on) on.scrollIntoView({ block:"center" });
}
/* ---- wide colour palette: ready colours, any colour, recently used ---- */
const palPop = document.createElement("div"); palPop.className = "pop pal-pop"; palPop.hidden = true; palPop.setAttribute("role", "dialog"); document.body.appendChild(palPop);
function rememberColor(hex){ if (!isHex(hex)) return; hex = hex.toLowerCase(); S.recentColors = [hex, ...(S.recentColors || []).filter(c => c !== hex)].slice(0, 10); savePrefs(); }
/* opts: { title, named:[{k, hex, name}], more:[hex], current, onPick(value), back } ; value is a named key or "#rrggbb" */
function openPalette(anchor, o){
  palPop.innerHTML = "";
  const head = document.createElement("div"); head.className = "sh-h pal-h";
  if (o.back){ const bk = document.createElement("button"); bk.className = "icon-btn sm"; bk.innerHTML = '<svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6"/></svg>'; bk.title = "Geri"; bk.setAttribute("aria-label", "Geri"); bk.onclick = o.back; head.appendChild(bk); }
  const ht = document.createElement("span"); ht.textContent = o.title; head.appendChild(ht); palPop.appendChild(head);
  const pick = v => { if (isHex(v)) rememberColor(v); o.onPick(v); };
  const sw = (val, hex, name, wrap) => { const b = document.createElement("button"); b.className = "pal-sw"; b.style.setProperty("--sw", hex); b.title = name || hex.toUpperCase(); b.setAttribute("aria-label", b.title);
    b.setAttribute("aria-pressed", String((o.current || "").toLowerCase() === String(val).toLowerCase())); b.onclick = () => pick(val); wrap.appendChild(b); };
  const grid = t => { const l = document.createElement("div"); l.className = "sh-l"; l.textContent = t; palPop.appendChild(l); const g = document.createElement("div"); g.className = "pal-grid"; palPop.appendChild(g); return g; };
  const g1 = grid("Hazır renkler"); for (const n of o.named) sw(n.k, n.hex, n.name, g1); for (const h of o.more) sw(h, h, "", g1);
  const rec = (S.recentColors || []).filter(isHex);
  if (rec.length){ const g2 = grid("Son kullanılanlar"); for (const h of rec) sw(h, h, "", g2); }
  const l3 = document.createElement("div"); l3.className = "sh-l"; l3.textContent = "Özel renk"; palPop.appendChild(l3);
  const row = document.createElement("div"); row.className = "pal-custom";
  const cur = isHex(o.current) ? o.current : (o.named.find(n => n.k === o.current) || { hex:"#78b6ec" }).hex;
  const inp = document.createElement("input"); inp.type = "color"; inp.value = cur; inp.setAttribute("aria-label", "Renk seç");
  const hex = document.createElement("input"); hex.type = "text"; hex.className = "pal-hex"; hex.value = cur.toUpperCase(); hex.maxLength = 7; hex.spellcheck = false; hex.setAttribute("aria-label", "Renk kodu");
  const ok = document.createElement("button"); ok.className = "btn sm"; ok.textContent = "Uygula";
  const norm = v => { v = v.trim(); if (!v.startsWith("#")) v = "#" + v; if (/^#[0-9a-f]{3}$/i.test(v)) v = "#" + [...v.slice(1)].map(c => c + c).join(""); return isHex(v) ? v.toLowerCase() : null; };
  inp.oninput = () => { hex.value = inp.value.toUpperCase(); };
  inp.onchange = () => pick(inp.value.toLowerCase());
  hex.onkeydown = e => { if (e.key === "Enter"){ const v = norm(hex.value); if (v) pick(v); else hex.classList.add("bad"); } };
  hex.oninput = () => { hex.classList.remove("bad"); const v = norm(hex.value); if (v) inp.value = v; };
  ok.onclick = () => { const v = norm(hex.value); if (v) pick(v); else hex.classList.add("bad"); };
  row.append(inp, hex, ok); palPop.appendChild(row);
  openPop(palPop, anchor);
}
const ACCENT_NAMED = () => HL_COLORS.map(k => ({ k, hex:HL_HEX[k], name:CNAME[k] }));
const PAPER_NAMED = () => Object.entries(PAPER_COLORS).map(([k, p]) => ({ k, hex:p.l, name:p.name }));
const accentHex = it => isHex(it.cc) ? it.cc : HL_HEX[it.color] || HL_HEX.y;
const accentName = it => isHex(it.cc) ? it.cc.toUpperCase() : CNAME[it.color] || "";

/* ---- saved card styles (v6.9.6): a name and a look; shared through library.json ---- */
const STYLE_SEED = {
  "s-tanim":{ name:"Tanım", look:{ color:"b", cc:"#3e63dd", bg:"sky" } },
  "s-soru":{ name:"Soru", look:{ color:"o", bg:"cream" } },
  "s-onemli":{ name:"Önemli", look:{ color:"p", cc:"#e5484d", bg:"rose", frame:"thick" } },
  "s-formul":{ name:"Formül", look:{ color:"b", cc:"#8e4ec6", font:"stix-two-text" } },
  "s-fikir":{ name:"Fikir", look:{ color:"y", bg:"yellow" } }
};
function cardStyles(){
  const st = libState();
  if (!st.stylesSeeded){ for (const [k, v] of Object.entries(STYLE_SEED)) if (!st.styles[k]) st.styles[k] = { ...v, t:1 }; st.stylesSeeded = true; libSave(st, true); }
  return Object.entries(st.styles).filter(([, v]) => !v.del && v.look).map(([id, v]) => ({ id, ...v })).sort((a, b) => (a.o ?? a.t) - (b.o ?? b.t));
}
function saveCardStyle(id, val){ const st = libState(); st.styles[id] = val ? { ...val, t:Date.now() } : { del:true, t:Date.now() }; libSave(st); }
function styleChip(sty, onClick){
  const b = document.createElement("button"); b.className = "sty-chip"; const l = sty.look || {};
  const acc = isHex(l.cc) ? l.cc : HL_HEX[l.color] || HL_HEX.y, pb = paperOf(l.bg || "white") || PAPER_COLORS.white;
  b.style.setProperty("--sa", acc); b.style.setProperty("--sb", pb.l); b.style.setProperty("--sbd", pb.d); if (l.frame === "thick") b.classList.add("thick");
  const t = document.createElement("span"); t.textContent = sty.name; if (l.font) t.style.fontFamily = fontCss(l.font); b.appendChild(t);
  b.title = sty.name; b.onclick = onClick; return b;
}
/* ---- card look: copy, paste, take from another card ---- */
const LOOK_KEYS = ["color", "cc", "bg", "frame", "font", "fs"];
const lookOf = it => Object.fromEntries(LOOK_KEYS.filter(k => it[k] !== undefined).map(k => [k, it[k]]));
function applyLook(it, look){
  for (const k of LOOK_KEYS) if (k !== "color") delete it[k];
  for (const [k, v] of Object.entries(look)) it[k] = v;
  if (it.doc && look.color) renderDocPage(it.doc, it.page);
}
/* "take from another card": the next card tapped gives its look */
el.ws.addEventListener("pointerdown", e => {
  if (!S.pickLook) return;
  const c = e.target.closest && e.target.closest(".card"); e.preventDefault(); e.stopPropagation();
  const to = itemById(S.pickLook); S.pickLook = null; document.body.classList.remove("picking-look");
  if (!c || !to){ toast("Görünüm alma iptal edildi."); return; }
  const from = itemById(c.dataset.id); if (!from || from.id === to.id){ toast("Görünüm alma iptal edildi."); return; }
  applyLook(to, lookOf(from)); renderWs(); select(to.id); commit(); toast("Görünüm kopyalandı.");
}, true);

function openCardStyle(id, anchor){
  const it = itemById(id); if (!it) return;
  const reopen = () => { const c = cardEls.get(id); openCardStyle(id, (c && c.querySelector(".cst")) || anchor); };
  const apply = fn => { fn(it); renderWs(); select(id); commit(); savePrefs(); reopen(); };
  stylePop.innerHTML = "";
  const h = document.createElement("div"); h.className = "sh-h"; h.textContent = it.type === "image" ? "Görsel kartı" : it.type === "note" ? "Not kartı" : "Alıntı kartı"; stylePop.appendChild(h);
  const sec = t => { const l = document.createElement("div"); l.className = "sh-l"; l.textContent = t; stylePop.appendChild(l); const r = document.createElement("div"); r.className = "st-row"; stylePop.appendChild(r); return r; };
  /* saved styles: one tap applies colour, paper, frame, font and size together */
  const rs = sec("Stiller"); rs.classList.add("sty-row"); const editing = S.styEdit === id;
  for (const sty of cardStyles()){
    const chip = styleChip(sty, () => {
      if (editing){ askText("Stilin adı", sty.name, n => { saveCardStyle(sty.id, { name:n, look:sty.look, o:sty.o ?? sty.t }); reopen(); }); return; }
      apply(x => applyLook(x, { color:x.color, ...sty.look }));
    });
    if (editing){ const x = document.createElement("span"); x.className = "sty-del"; x.textContent = "×"; x.title = "Stili sil"; x.onclick = e => { e.stopPropagation(); saveCardStyle(sty.id, null); reopen(); }; chip.appendChild(x); chip.classList.add("editing"); }
    rs.appendChild(chip);
  }
  const add = document.createElement("button"); add.className = "sty-chip sty-add"; add.textContent = "+ Bu görünümü kaydet"; add.title = "Bu kartın görünümünü yeni stil olarak kaydet";
  add.onclick = () => askText("Yeni stilin adı (ör. Tanım, Soru, Önemli)", "", n => { const look = lookOf(it); saveCardStyle("s" + uid(), { name:n, look, o:Date.now() }); toast(`"${n}" stili kaydedildi.`); reopen(); });
  rs.appendChild(add);
  const ed = document.createElement("button"); ed.className = "link sty-edit"; ed.textContent = editing ? "Bitti" : "Düzenle"; ed.onclick = () => { S.styEdit = editing ? null : id; reopen(); }; rs.appendChild(ed);
  /* one button per colour; the wide palette opens from it */
  const colorBtn = (row, hex, name, onClick) => { const b = document.createElement("button"); b.className = "col-pick"; const d = document.createElement("i"); d.style.background = hex; const t = document.createElement("span"); t.textContent = name; b.append(d, t);
    const c = document.createElement("span"); c.className = "chev"; c.innerHTML = ICON.chevron; b.appendChild(c); b.onclick = () => onClick(b); row.appendChild(b); return b; };
  const r1 = sec("Renk (çerçeve ve başlık)");
  colorBtn(r1, accentHex(it), accentName(it), b => openPalette(b, { title:"Kart rengi", named:ACCENT_NAMED(), more:ACCENT_MORE, current:isHex(it.cc) ? it.cc : it.color, back:reopen,
    onPick:v => apply(x => { if (isHex(v)){ x.cc = v; S.lastCc = v; } else { x.color = v; delete x.cc; S.lastColor = v; S.lastCc = ""; if (x.doc) renderDocPage(x.doc, x.page); } }) }));
  const quick = document.createElement("span"); quick.className = "st-quick";
  for (const k of HL_COLORS){ const d = document.createElement("button"); d.className = "dot c-" + k + (!isHex(it.cc) && it.color === k ? " on" : ""); d.title = CNAME[k]; d.setAttribute("aria-label", CNAME[k]); d.onclick = () => apply(x => { x.color = k; delete x.cc; S.lastColor = k; S.lastCc = ""; if (x.doc) renderDocPage(x.doc, x.page); }); quick.appendChild(d); }
  r1.appendChild(quick);
  const r2 = sec("Kağıt"); const pb = paperOf(it.bg || "white") || PAPER_COLORS.white;
  colorBtn(r2, pb.l, pb.name, b => openPalette(b, { title:"Kart kağıdı", named:PAPER_NAMED(), more:PAPER_MORE, current:it.bg || "white", back:reopen,
    onPick:v => apply(x => { if (v === "white") delete x.bg; else x.bg = v; S.lastBg = v; }) }));
  const r3 = sec("Çerçeve"); const seg = document.createElement("span"); seg.className = "seg3"; r3.appendChild(seg);
  for (const [k, name] of Object.entries(FRAMES)){ const b = document.createElement("button"); b.textContent = name; b.setAttribute("aria-pressed", String((it.frame || "thin") === k)); b.onclick = () => apply(x => { if (k === "thin") delete x.frame; else x.frame = k; S.lastFrame = k; }); seg.appendChild(b); }
  const r4 = sec("Yazı tipi"); const fb = document.createElement("button"); fb.className = "font-pick"; fb.innerHTML = ICON.font; const fn = document.createElement("span"); fn.textContent = fontName(it.font); if (it.font) fn.style.fontFamily = fontCss(it.font); fb.appendChild(fn);
  fb.onclick = () => openFontPop(fb, it.font, fid => { if (fid) it.font = fid; else delete it.font; S.lastFont = fid; renderWs(); select(id); commit(); savePrefs(); });
  r4.appendChild(fb);
  const r6 = sec("Çıkartma"); const sb = document.createElement("button"); sb.className = "btn sm"; sb.textContent = "Karta çıkartma ekle"; sb.onclick = () => openStickerPick(sb, v => addSticker(v, { card:id })); r6.appendChild(sb);
  const r5 = sec("Görünüm"); const lk = document.createElement("span"); lk.className = "seg3 look-row"; r5.appendChild(lk);
  const lb = (t, title, fn, dis) => { const b = document.createElement("button"); b.textContent = t; b.title = title; if (dis) b.disabled = true; b.onclick = fn; lk.appendChild(b); };
  lb("Kopyala", "Bu kartın rengini, kağıdını, çerçevesini ve yazı tipini kopyala", () => { S.lookClip = lookOf(it); toast("Görünüm kopyalandı. Başka bir kartta Yapıştır'a bas."); reopen(); });
  lb("Yapıştır", "Kopyalanan görünümü bu karta uygula", () => apply(x => applyLook(x, S.lookClip)), !S.lookClip);
  lb("Karttan al", "Dokunacağın kartın görünümünü bu karta uygula", () => { closePop(); S.pickLook = id; document.body.classList.add("picking-look"); toast("Görünümünü almak istediğin karta dokun."); });
  const note = document.createElement("p"); note.className = "sh-note"; note.textContent = "Seçtiklerin yeni kartlarda da kullanılır."; stylePop.appendChild(note);
  openPop(stylePop, anchor);
}
function cardFont(id, dir){
  const it = itemById(id); if (!it) return;
  const i = FS_STEPS.indexOf(it.fs || 1), n = FS_STEPS[clamp((i < 0 ? 1 : i) + dir, 0, FS_STEPS.length - 1)];
  if (n === (it.fs || 1)) return;
  if (n === 1) delete it.fs; else it.fs = n;
  /* a bigger text needs a wider card: grow the width with the text, within the sheet */
  if (!it.group && dir > 0) it.w = Math.round(Math.min(900, Math.max(it.w, 250 * n), allowRegion().x2 - it.x));
  S.lastFs = n; savePrefs(); renderWs(); select(id); commit();
}
function startCardDrag(e, it, c){
  const s = view().s, start = { x:e.clientX, y:e.clientY };
  let moved = false, origin = { x:it.x, y:it.y }, target = null;
  const setTarget = t => { if (target === t) return; if (target) target.classList.remove("droptarget"); target = t; if (target) target.classList.add("droptarget"); };
  const mv = ev => {
    const dx = (ev.clientX - start.x) / s, dy = (ev.clientY - start.y) / s;
    if (!moved && Math.hypot(dx, dy) * s < 4) return;
    if (!moved){
      moved = true;
      if (it.group){
        const g = S.proj.groups.find(x => x.id === it.group), r = c.getBoundingClientRect(), pt = screenToPlane(r.left, r.top);
        delete it.group; delete it.ord; it.x = Math.round(pt.x); it.y = Math.round(pt.y); it.w = g ? Math.max(170, g.w - 16) : it.w; origin = { x:it.x, y:it.y };
        c.style.left = it.x + "px"; c.style.top = it.y + "px"; c.style.width = it.w + "px"; el.plane.insertBefore(c, el.wsInk);
      }
      c.classList.add("dragging");
    }
    ({ x:it.x, y:it.y } = clampBox(origin.x + dx, origin.y + dy, c.offsetWidth, c.offsetHeight)); growSheet(it.x, it.y, it.x + c.offsetWidth, it.y + c.offsetHeight); c.style.left = it.x + "px"; c.style.top = it.y + "px";
    c.style.pointerEvents = "none";
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    c.style.pointerEvents = "";
    const t = under && el.plane.contains(under) ? (under.closest(".card") || under.closest(".group")) : null;
    setTarget(t && t !== c ? t : null);
    drawLinks();
  };
  const up = () => {
    window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
    c.classList.remove("dragging"); const t = target; setTarget(null);
    if (!moved) return; lastDragEnd = Date.now();
    if (t) dropOn(it, t);
    normalizeGroups(); renderWs(); commit();
  };
  window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
}
function dropOn(it, tEl){
  if (!tEl.classList.contains("card")){
    const gid = tEl.dataset.gid; const mem = S.proj.items.filter(i => i.group === gid);
    it.group = gid; it.ord = mem.length ? Math.max(...mem.map(m => m.ord)) + 1 : 0; return;
  }
  const tIt = itemById(tEl.dataset.id); if (!tIt || tIt === it) return;
  if (tIt.group){ it.group = tIt.group; it.ord = tIt.ord + 0.5; return; }
  const g = { id:"g" + uid(), space:S.space, x:tIt.x, y:tIt.y, w:Math.max(tIt.w, 250) + 16, title:"", collapsed:false };
  S.proj.groups.push(g); tIt.group = g.id; tIt.ord = 0; it.group = g.id; it.ord = 1;
  toast("Kartlar gruplandı. Başlık verebilir ya da yığına çevirebilirsin.");
}
function select(id){ S.sel = id; S.selLink = null; cardEls.forEach((c, k) => c.classList.toggle("selected", k === id)); drawLinks(); }
function visibleCardNode(id){
  const n = cardEls.get(id); if (!n) return null;
  return n.getClientRects().length ? n : (n.closest(".group") || null);
}
function centerOf(id){
  const n = visibleCardNode(id); if (!n) return null;
  const r = n.getBoundingClientRect(); if (!r.width) return null;
  return screenToPlane(r.left + r.width / 2, r.top + r.height / 2);
}
function boxOf(id){
  const n = visibleCardNode(id); if (!n) return null; const r = n.getBoundingClientRect(); if (!r.width) return null;
  const a = screenToPlane(r.left, r.top), b = screenToPlane(r.right, r.bottom); return { x1:a.x, y1:a.y, x2:b.x, y2:b.y, cx:(a.x + b.x) / 2, cy:(a.y + b.y) / 2 };
}
/* a curve from box A to box B that leaves and enters at the facing edges, so an arrowhead stays visible */
/* link shapes (v6.9.6): curve (default), line (straight), elbow (right angles with rounded corners) */
const LINK_SHAPES = ["line", "elbow"];
function linkCurve(A, B, shape){
  const c = linkCurve0(A, B); if (!shape || shape === "curve") return c;
  const m = /^M([-\d.]+),([-\d.]+) C([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+)$/.exec(c.d); if (!m) return c;
  const [x1, y1, c1x, c1y, , , x2, y2] = m.slice(1).map(Number);
  if (shape === "line") return { d:`M${x1},${y1} L${x2},${y2}`, mx:(x1 + x2) / 2, my:(y1 + y2) / 2 };
  const horiz = c1y === y1; /* the curve leaves sideways: elbow goes across, down, across */
  if (horiz){
    const mx = c1x, dy = y2 - y1, sy = Math.sign(dy) || 1, sx1 = Math.sign(mx - x1) || 1, sx2 = Math.sign(x2 - mx) || 1, r = Math.min(10, Math.abs(dy) / 2, Math.abs(mx - x1), Math.abs(x2 - mx));
    if (Math.abs(dy) < 1) return { d:`M${x1},${y1} L${x2},${y2}`, mx, my:y1 };
    return { d:`M${x1},${y1} H${mx - sx1 * r} Q${mx},${y1} ${mx},${y1 + sy * r} V${y2 - sy * r} Q${mx},${y2} ${mx + sx2 * r},${y2} H${x2}`, mx, my:(y1 + y2) / 2 };
  }
  const my = c1y, dx = x2 - x1, sx = Math.sign(dx) || 1, sy1 = Math.sign(my - y1) || 1, sy2 = Math.sign(y2 - my) || 1, r = Math.min(10, Math.abs(dx) / 2, Math.abs(my - y1), Math.abs(y2 - my));
  if (Math.abs(dx) < 1) return { d:`M${x1},${y1} L${x2},${y2}`, mx:x1, my };
  return { d:`M${x1},${y1} V${my - sy1 * r} Q${x1},${my} ${x1 + sx * r},${my} H${x2 - sx * r} Q${x2},${my} ${x2},${my + sy2 * r} V${y2}`, mx:(x1 + x2) / 2, my };
}
function linkCurve0(A, B){
  const G = 18;
  if (B.x1 - A.x2 > G || A.x1 - B.x2 > G){
    const r = B.x1 > A.x2, x1 = r ? A.x2 : A.x1, x2 = r ? B.x1 : B.x2, y1 = A.cy, y2 = B.cy, mx = (x1 + x2) / 2;
    return { d:`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, mx, my:(y1 + y2) / 2 };
  }
  if (B.y1 - A.y2 > G || A.y1 - B.y2 > G){
    const dn = B.y1 > A.y2, y1 = dn ? A.y2 : A.y1, y2 = dn ? B.y1 : B.y2, x1 = A.cx, x2 = B.cx, my = (y1 + y2) / 2;
    return { d:`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`, mx:(x1 + x2) / 2, my };
  }
  const mx = (A.cx + B.cx) / 2; return { d:`M${A.cx},${A.cy} C${mx},${A.cy} ${mx},${B.cy} ${B.cx},${B.cy}`, mx, my:(A.cy + B.cy) / 2 };
}
/* ---- link look: colour, arrowheads, dashes ---- */
const LINK_COLORS = { r:"#e5534b", b:"#3a7fd5", g:"#3f9b62", o:"#e8892f", v:"#8a63d2" };
const LINK_CNAME = { "":"Varsayılan", r:"Kırmızı", b:"Mavi", g:"Yeşil", o:"Turuncu", v:"Mor" };
const HEADS = ["end", "start", "both", "none"];
/* old files keep their arrows: card links had "arrow", document links "to" */
function linkHeads(L){
  if (HEADS.includes(L.heads)) return L.heads;
  if (L.anchor) return L.to === "card" ? "end" : L.to === "anchor" ? "start" : "none";
  return L.arrow ? "end" : "none";
}
function setLinkHeads(L, h){
  L.heads = h;
  if (L.anchor){ if (h === "end" || h === "both") L.to = "card"; else if (h === "start") L.to = "anchor"; else delete L.to; }
  else if (h === "end" || h === "both") L.arrow = true; else delete L.arrow;
}
const markerPath = '<path d="M0,0.8 L10,5 L0,9.2 L2.6,5 Z"/>';
const ARROW_DEFS = id => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">${markerPath}</marker><marker id="${id}On" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">${markerPath}</marker>` +
  Object.entries(LINK_COLORS).map(([c, hex]) => `<marker id="${id}-${c}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse"><path style="fill:${hex}" d="M0,0.8 L10,5 L0,9.2 L2.6,5 Z"/></marker>`).join("") + `</defs>`;
/* applies colour, dashes and arrowheads to a drawn link */
function styleLink(path, L, base, on){
  const h = linkHeads(L), mk = `url(#${base}${L.color && LINK_COLORS[L.color] ? "-" + L.color : on ? "On" : ""})`;
  if (L.color && LINK_COLORS[L.color]) path.style.stroke = LINK_COLORS[L.color];
  if (L.dash) path.style.strokeDasharray = "7 5";
  if (h === "end" || h === "both") path.setAttribute("marker-end", mk);
  if (h === "start" || h === "both") path.setAttribute("marker-start", mk);
}
const selLinkObj = () => S.selLink && S.proj && S.proj.links.find(l => l.id === S.selLink);
const isWsLink = L => !L.anchor && !L.pins && !L.pin;
function pointBox(p){ return { x1:p.x, y1:p.y, x2:p.x, y2:p.y, cx:p.x, cy:p.y }; }
function drawLinks(){
  el.links.innerHTML = ARROW_DEFS("lkA"); el.plane.querySelectorAll(".lk-del,.lk-pt").forEach(n => n.remove());
  if (!S.proj) return;
  let mid = null;
  for (const L of S.proj.links){
    if (!isWsLink(L)) continue;
    const a = itemById(L.a); if (!a || a.space !== S.space) continue;
    let B;
    if (L.pt) B = pointBox(L.pt);
    else { const b = itemById(L.b); if (!b || b.space !== S.space) continue; B = boxOf(b.id); }
    const A = boxOf(a.id); if (!A || !B) continue;
    const { d, mx, my } = linkCurve(A, B, L.shape), on = S.selLink === L.id;
    if (on){ const halo = document.createElementNS(NS, "path"); halo.setAttribute("d", d); halo.setAttribute("class", "lk-halo"); el.links.appendChild(halo); }
    const vis = document.createElementNS(NS, "path"); vis.setAttribute("d", d); vis.setAttribute("class", "lk" + (on ? " on" : ""));
    styleLink(vis, L, "lkA", on);
    const hit = document.createElementNS(NS, "path"); hit.setAttribute("d", d); hit.setAttribute("class", "lk-hit");
    hit.addEventListener("pointerdown", e => { if (S.tool !== "select") return; e.stopPropagation(); selectLink(L.id); });
    el.links.append(vis, hit);
    if (L.pt) endDot(L, L.pt, on);
    if (on) mid = { x:mx, y:my };
  }
  /* workspace ends of book-to-workspace links */
  for (const L of S.proj.links) if (L.pin && L.at.space === S.space) endDot(L, L.at, S.selLink === L.id);
  const sl = selLinkObj();
  if (sl && isWsLink(sl)){ if (mid){ const r = el.ws.getBoundingClientRect(), v = view(); showLkBar(sl, r.left + v.tx + mid.x * v.s, r.top + v.ty + mid.y * v.s); } else hideLkBar(); }
  else if (!sl) hideLkBar();
  scheduleX();
}
/* the free end of a link on the workspace: a small dot, draggable when the link is selected */
function endDot(L, P, on){
  const dot = document.createElement("div"); dot.className = "lk-pt" + (on ? " on" : "") + (L.pin ? " pinend" : ""); dot.style.left = P.x + "px"; dot.style.top = P.y + "px";
  if (L.color && LINK_COLORS[L.color]) dot.style.setProperty("--lc", LINK_COLORS[L.color]);
  dot.title = on ? "Ucu taşı" : L.pin ? "Belgedeki yere git" : "Bağlantıyı seç";
  dot.addEventListener("pointerdown", e => {
    if (S.tool !== "select") return; e.stopPropagation(); e.preventDefault();
    if (S.selLink !== L.id){ selectLink(L.id); if (L.pin) goToPin(L.pin); return; }
    dot.setPointerCapture(e.pointerId); let moved = false;
    const mv = ev => { const p = screenToPlane(ev.clientX, ev.clientY); P.x = r2(p.x); P.y = r2(p.y); moved = true; growSheet(P.x - 20, P.y - 20, P.x + 20, P.y + 20); drawLinks(); };
    const up = () => { dot.removeEventListener("pointermove", mv); dot.removeEventListener("pointerup", up); dot.removeEventListener("pointercancel", up); if (moved){ renderSheet(); commit(); } };
    dot.addEventListener("pointermove", mv); dot.addEventListener("pointerup", up); dot.addEventListener("pointercancel", up);
  });
  el.plane.appendChild(dot);
}
async function goToPin(id){
  const n = S.proj.pins.find(x => x.id === id); if (!n) return;
  await revealInDoc(n.doc, n.page, n.y - 60);
  setTimeout(() => { const m = document.querySelector(`.pinmark[data-id="${id}"]`); if (m){ m.classList.add("pulse"); setTimeout(() => m.classList.remove("pulse"), 1600); } scheduleX(); }, 450);
}
function goToWsPoint(L){
  if (isNarrow()) setTab("ws");
  if (L.at.space !== S.space) switchSpace(L.at.space);
  requestAnimationFrame(() => {
    const r = el.ws.getBoundingClientRect(), v = view();
    v.tx = r.width / 2 - L.at.x * v.s; v.ty = r.height / 2 - L.at.y * v.s; applyView(); selectLink(L.id); save();
  });
}
function selectLink(id){
  S.selLink = id; S.sel = null; cardEls.forEach(c => c.classList.remove("selected"));
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  drawLinks(); scheduleX();
}
function deselectLink(){ if (!S.selLink) return; S.selLink = null; hideLkBar(); drawLinks(); scheduleX(); }

/* the small toolbar on a selected link */
const lkBar = (() => {
  const bar = document.createElement("div"); bar.className = "lkbar"; bar.id = "lkBar"; bar.hidden = true; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Bağlantı");
  const cols = document.createElement("div"); cols.className = "lkb-cols";
  for (const c of ["", ...Object.keys(LINK_COLORS)]){ const b = document.createElement("button"); b.className = "lkb-dot"; b.dataset.c = c; b.title = LINK_CNAME[c]; b.setAttribute("aria-label", LINK_CNAME[c]); if (c) b.style.background = LINK_COLORS[c]; b.onclick = () => editLink(L => { if (c) L.color = c; else delete L.color; S.lastLinkColor = c; savePrefs(); }); cols.appendChild(b); }
  const heads = document.createElement("div"); heads.className = "seg3 lkb-heads";
  const HI = { end:'<svg viewBox="0 0 24 24"><path d="M4 12h15M14 7l5 5-5 5"/></svg>', start:'<svg viewBox="0 0 24 24"><path d="M20 12H5M10 7l-5 5 5 5"/></svg>', both:'<svg viewBox="0 0 24 24"><path d="M5 12h14M9 8l-4 4 4 4M15 8l4 4-4 4"/></svg>', none:'<svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg>' };
  const HT = { end:"Ok sonda", start:"Ok başta", both:"İki uçta ok", none:"Oksuz" };
  for (const h of HEADS){ const b = document.createElement("button"); b.dataset.h = h; b.innerHTML = HI[h]; b.title = HT[h]; b.setAttribute("aria-label", HT[h]); b.onclick = () => editLink(L => setLinkHeads(L, h)); heads.appendChild(b); }
  const dash = document.createElement("button"); dash.className = "icon-btn sm lkb-dash"; dash.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 12h4M10 12h4M17 12h4"/></svg>'; dash.title = "Kesikli çizgi"; dash.setAttribute("aria-label", dash.title);
  dash.onclick = () => editLink(L => { if (L.dash) delete L.dash; else L.dash = true; S.lastLinkDash = !!L.dash; savePrefs(); });
  const shapes = document.createElement("div"); shapes.className = "seg3 lkb-shapes";
  const SI = { curve:'<svg viewBox="0 0 24 24"><path d="M4 17C10 17 14 7 20 7"/></svg>', line:'<svg viewBox="0 0 24 24"><path d="M4 17 20 7"/></svg>', elbow:'<svg viewBox="0 0 24 24"><path d="M4 17h6.5V7H20"/></svg>' };
  const ST = { curve:"Eğri çizgi", line:"Düz çizgi", elbow:"Köşeli çizgi" };
  for (const k of ["curve", "line", "elbow"]){ const b = document.createElement("button"); b.dataset.sh = k; b.innerHTML = SI[k]; b.title = ST[k]; b.setAttribute("aria-label", ST[k]);
    b.onclick = () => editLink(L => { if (k === "curve") delete L.shape; else L.shape = k; S.lastLinkShape = k === "curve" ? "" : k; savePrefs(); }); shapes.appendChild(b); }
  const del = document.createElement("button"); del.className = "icon-btn sm lkb-del"; del.innerHTML = ICON.del; del.title = "Bağlantıyı sil"; del.setAttribute("aria-label", del.title); del.onclick = () => { const id = S.selLink; hideLkBar(); if (id) removeLink(id); };
  const sep = () => { const s = document.createElement("span"); s.className = "lkb-sep"; return s; };
  bar.append(cols, sep(), heads, dash, sep(), shapes, sep(), del);
  bar.addEventListener("pointerdown", e => e.stopPropagation());
  document.body.appendChild(bar);
  return bar;
})();
function editLink(fn){ const L = selLinkObj(); if (!L) return; fn(L); drawLinks(); scheduleX(); if (L.pins || L.anchor) renderAllOverlays(); commit(); }
function showLkBar(L, x, y){
  lkBar.querySelectorAll(".lkb-dot").forEach(b => b.classList.toggle("on", (L.color || "") === b.dataset.c));
  const h = linkHeads(L); lkBar.querySelectorAll(".lkb-heads button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.h === h)));
  lkBar.querySelector(".lkb-dash").setAttribute("aria-pressed", String(!!L.dash));
  lkBar.querySelectorAll(".lkb-shapes button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.sh === (L.shape || "curve"))));
  lkBar.hidden = false;
  const w = lkBar.offsetWidth, hh = lkBar.offsetHeight;
  lkBar.style.left = clamp(x - w / 2, 8, window.innerWidth - w - 8) + "px";
  lkBar.style.top = clamp(y - hh - 16, 8, window.innerHeight - hh - 8) + "px";
}
function hideLkBar(){ lkBar.hidden = true; }
document.addEventListener("pointerdown", e => { if (S.selLink && !e.target.closest("#lkBar,.lk-hit,.xl-hit,.lk-pt")) deselectLink(); }, true);

/* ================= cross-pane links (card <-> document) ================= */
let xRaf = 0;
function scheduleX(){ if (!xRaf) xRaf = requestAnimationFrame(() => { xRaf = 0; drawX(); }); }
function visibleIn(rect, box){ return rect.width + rect.height > 0 && rect.bottom > box.top + 4 && rect.top < box.bottom - 4 && rect.right > box.left + 4 && rect.left < box.right - 4; }
function anchorEl(a){
  for (const v of S.viewers){ if (v.root.hidden || !v.fp) continue;
    const n = a.type === "ink" ? v.root.querySelector(`svg.ink path[data-id="${a.id}"]`) : a.type === "text" ? v.root.querySelector(`.tbox[data-id="${a.id}"]`) : a.type === "comment" ? v.root.querySelector(`.cpin[data-id="${a.id}"]`) : a.type === "pin" ? v.root.querySelector(`.pinmark[data-id="${a.id}"]`) : v.root.querySelector(`.hl[data-id="${a.id}"]`);
    if (n && visibleIn(n.getBoundingClientRect(), v.pane.getBoundingClientRect())) return n;
  }
  return null;
}
function drawX(){
  const svg = el.xlinks; svg.innerHTML = "";
  const sl = selLinkObj();
  if (!S.proj || document.body.dataset.view !== "editor" || isNarrow()){ if (sl && !isWsLink(sl)) hideLkBar(); return; }
  const mr = el.main.getBoundingClientRect(), wsBox = el.ws.getBoundingClientRect();
  let xmid = null;
  const hitFor = (d, L) => { const h = document.createElementNS(NS, "path"); h.setAttribute("d", d); h.setAttribute("class", "xl-hit"); h.addEventListener("pointerdown", e => { if (S.tool !== "select") return; e.stopPropagation(); e.preventDefault(); selectLink(L.id); }); return h; };
  const halo = (d, L) => { if (S.selLink !== L.id) return; const h = document.createElementNS(NS, "path"); h.setAttribute("d", d); h.setAttribute("class", "lk-halo"); svg.appendChild(h); };
  const pairs = [];
  svg.innerHTML = ARROW_DEFS("xlA");
  for (const L of S.proj.links) if (L.anchor){ const it = itemById(L.a); if (it && it.space === S.space) pairs.push({ card:L.a, a:L.anchor, cls:"xl", L }); }
  if (S.sel){ const it = itemById(S.sel); if (it && (it.type === "excerpt" || it.type === "image")) pairs.push({ card:it.id, a:{ type:"hl", id:it.id }, cls:"xl src" }); }
  /* document to document links, when both ends are on screen */
  for (const L of S.proj.links) if (L.pins){
    const a = anchorEl({ type:"pin", id:L.pins[0] }), b = anchorEl({ type:"pin", id:L.pins[1] }); if (!a || !b) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), x1 = ra.left + ra.width / 2 - mr.left, y1 = ra.top + ra.height / 2 - mr.top, x2 = rb.left + rb.width / 2 - mr.left, y2 = rb.top + rb.height / 2 - mr.top, mx = (x1 + x2) / 2;
    const d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`; halo(d, L);
    const path = document.createElementNS(NS, "path"); path.setAttribute("d", d); path.setAttribute("class", "xl dd"); styleLink(path, L, "xlA"); svg.append(path, hitFor(d, L));
    if (S.selLink === L.id) xmid = { x:mx + mr.left, y:(y1 + y2) / 2 + mr.top };
  }
  /* book to workspace point */
  for (const L of S.proj.links) if (L.pin && L.at.space === S.space){
    const a = anchorEl({ type:"pin", id:L.pin }); if (!a) continue;
    const v = view(), sx = wsBox.left + v.tx + L.at.x * v.s, sy = wsBox.top + v.ty + L.at.y * v.s;
    if (sx < wsBox.left || sx > wsBox.right || sy < wsBox.top || sy > wsBox.bottom) continue;
    const ra = a.getBoundingClientRect(), x1 = ra.left + ra.width / 2 - mr.left, y1 = ra.top + ra.height / 2 - mr.top, x2 = sx - mr.left, y2 = sy - mr.top, mx = (x1 + x2) / 2;
    const d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`; halo(d, L);
    const path = document.createElementNS(NS, "path"); path.setAttribute("d", d); path.setAttribute("class", "xl"); styleLink(path, L, "xlA"); svg.append(path, hitFor(d, L));
    if (S.selLink === L.id) xmid = { x:mx + mr.left, y:(y1 + y2) / 2 + mr.top };
  }
  for (const pr of pairs){
    const cn = visibleCardNode(pr.card); if (!cn) continue;
    const cr = cn.getBoundingClientRect(); if (!visibleIn(cr, wsBox)) continue;
    const an = anchorEl(pr.a); if (!an) continue;
    const ar = an.getBoundingClientRect();
    const x1 = ar.right - mr.left, y1 = ar.top + ar.height / 2 - mr.top, x2 = Math.max(wsBox.left, cr.left) - mr.left, y2 = cr.top + Math.min(26, cr.height / 2) - mr.top;
    const mx = (x1 + x2) / 2;
    const d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    if (pr.L) halo(d, pr.L);
    const path = document.createElementNS(NS, "path"); path.setAttribute("d", d); path.setAttribute("class", pr.cls); svg.appendChild(path);
    const h = pr.L ? linkHeads(pr.L) : "none";
    if (pr.L){ styleLink(path, pr.L, "xlA"); svg.appendChild(hitFor(d, pr.L)); if (S.selLink === pr.L.id) xmid = { x:mx + mr.left, y:(y1 + y2) / 2 + mr.top }; }
    for (const [x, y, end] of [[x1, y1, "start"], [x2, y2, "end"]]){ if (h === end || h === "both") continue; const c = document.createElementNS(NS, "circle"); c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", 3); c.setAttribute("class", "xl-dot"); if (pr.L && pr.L.color && LINK_COLORS[pr.L.color]) c.style.fill = LINK_COLORS[pr.L.color]; svg.appendChild(c); }
  }
  if (sl && !isWsLink(sl)){ if (xmid) showLkBar(sl, xmid.x, xmid.y); else hideLkBar(); }
}
window.addEventListener("resize", () => { if (!S.proj) return; applyView(); drawLinks(); scheduleX(); });

function startLink(id){ if (S.tool !== "select") setTool("select"); S.linkFrom = id; el.ws.classList.add("linking"); el.linkHint.hidden = false; select(id); }
function cancelLink(){ S.linkFrom = null; el.ws.classList.remove("linking"); el.linkHint.hidden = true; }
$("#linkCancel").onclick = cancelLink;
function completeLink(id){
  const a = S.linkFrom; cancelLink(); if (!a || a === id) return;
  if (S.proj.links.some(L => !L.anchor && ((L.a === a && L.b === id) || (L.a === id && L.b === a)))){ toast("Bu iki kart zaten bağlı"); return; }
  const L = { id:uid(), a, b:id, arrow:true, ...(S.lastLinkColor ? { color:S.lastLinkColor } : {}), ...(S.lastLinkDash ? { dash:true } : {}), ...(S.lastLinkShape ? { shape:S.lastLinkShape } : {}) }; S.proj.links.push(L); selectLink(L.id); commit();
}
function completeAnchor(anchor){
  const a = S.linkFrom; cancelLink(); if (!a) return;
  if (S.proj.links.some(L => L.anchor && L.a === a && L.anchor.id === anchor.id)){ toast("Bu bağlantı zaten var"); return; }
  S.proj.links.push({ id:uid(), a, anchor, to:"anchor", ...(S.lastLinkColor ? { color:S.lastLinkColor } : {}), ...(S.lastLinkDash ? { dash:true } : {}), ...(S.lastLinkShape ? { shape:S.lastLinkShape } : {}) }); S.sel = a; renderWs(); renderAllOverlays(); commit(); toast("Kart belgedeki işarete bağlandı");
}
function removeLink(id){ S.proj.links = S.proj.links.filter(l => l.id !== id); S.selLink = null; if (prunePins()) renderAllOverlays(); renderWs(); commit(); toast("Bağlantı silindi", { label:"Geri al", fn:undo }); }
/* jump to the other end of a document-to-document link, preferably in the other viewer */
async function followDocLink(L, fromId, fromIdx){
  const other = S.proj.pins.find(n => n.id === L.pins.find(id => id !== fromId)); if (!other) return;
  let v = S.viewers.find(x => !x.root.hidden && x.fp === other.doc && x.idx !== fromIdx) || S.viewers.find(x => !x.root.hidden && x.fp === other.doc);
  if (!v){ v = !S.viewers[1].root.hidden ? S.viewers[1 - fromIdx] : S.viewers[fromIdx]; await showDoc(v, other.doc); }
  S.av = v.idx; markActive(); await new Promise(r => requestAnimationFrame(r)); scrollToPage(v, other.page, other.y - 60, true);
  setTimeout(() => { const n = v.root.querySelector(`.pinmark[data-id="${other.id}"]`); if (n){ n.classList.add("pulse"); setTimeout(() => n.classList.remove("pulse"), 1600); } scheduleX(); }, 450);
  toast(`${docName(other.doc)} · s. ${other.page}`, { label:"Bağlantıyı kaldır", fn:() => removeLink(L.id) }, 4500);
}
async function goToAnchor(a){
  const o = anchorObj(a); if (!o) return;
  const y = a.type === "ink" ? Math.min(...o.pts.map(q => q[1])) : a.type === "text" || a.type === "pin" ? o.y : (o.rects[0] ? o.rects[0].y : 0);
  await revealInDoc(o.doc, o.page, y);
  setTimeout(() => { const n = anchorEl(a); if (n){ n.classList.add("pulse"); setTimeout(() => n.classList.remove("pulse"), 1600); } scheduleX(); }, 450);
}
function removeItem(id){
  const it = itemById(id); if (!it) return;
  S.proj.items = S.proj.items.filter(i => i.id !== id); S.proj.links = S.proj.links.filter(l => l.a !== id && l.b !== id);
  if (S.sel === id) S.sel = null; normalizeGroups(); if (prunePins()) renderAllOverlays();
  renderWs(); if (it.doc) renderDocPage(it.doc, it.page); commit();
  toast(it.type === "note" ? "Not silindi" : it.type === "image" ? "Görsel silindi" : "Alıntı silindi", { label:"Geri al", fn:undo });
}
function focusCard(id){
  const it = itemById(id); if (!it) return;
  if (it.space !== S.space) switchSpace(it.space);
  if (it.group){ const g = S.proj.groups.find(x => x.id === it.group); if (g && g.collapsed){ g.collapsed = false; renderWs(); } }
  if (isNarrow()) setTab("ws"); select(id);
  requestAnimationFrame(() => {
    const r = el.ws.getBoundingClientRect(), v = view(), c = centerOf(id); if (!c) return;
    v.tx = r.width / 2 - c.x * v.s; v.ty = r.height / 2 - c.y * v.s; applyView();
    const ce = cardEls.get(id); if (ce){ ce.classList.remove("flash"); void ce.offsetWidth; ce.classList.add("flash"); }
  });
}
async function goToExcerpt(id){
  const it = itemById(id); if (!it || !it.doc) return;
  S.flashId = id; await revealInDoc(it.doc, it.page, it.rects[0] ? it.rects[0].y : 0);
  renderDocPage(it.doc, it.page); setTimeout(() => { if (S.flashId === id){ S.flashId = null; } scheduleX(); }, 1700);
}
function addNote(pt){
  const p = pt ? clampBox(pt.x, pt.y, 230, 110) : defaultSpot();
  const it = stamp({ id:uid(), type:"note", note:"", color:S.lastColor, space:S.space, w:230, x:p.x, y:p.y });
  if (!it.font && S.lastFont) it.font = S.lastFont; if (!it.bg && S.lastBg && S.lastBg !== "white") it.bg = S.lastBg; if (!it.cc && S.lastCc) it.cc = S.lastCc; if (!it.frame && S.lastFrame && S.lastFrame !== "thin") it.frame = S.lastFrame; if (!it.fs && S.lastFs !== 1){ it.fs = S.lastFs; it.w = Math.round(Math.min(900, it.w * S.lastFs)); } S.proj.items.push(it); S.sel = it.id; renderWs(); commit(); if (isNarrow()) setTab("ws"); if (!pt) showCardIfHidden(it.id);
  const f = () => { const t = el.plane.querySelector(`.note-ed[data-note="${it.id}"]`); if (t && document.activeElement !== t) t.focus({ preventScroll:true }); }; f(); requestAnimationFrame(f);
}
$("#bNote").onclick = () => addNote();
function zoomAt(cx, cy, ns){ const r = el.ws.getBoundingClientRect(), v = view(); ns = clamp(ns, 0.1, 2.5); const px = (cx - r.left - v.tx) / v.s, py = (cy - r.top - v.ty) / v.s; v.s = ns; v.tx = cx - r.left - px * ns; v.ty = cy - r.top - py * ns; applyView(); }
function zoomCenter(f){ const r = el.ws.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, view().s * f); save(); }
$("#bWsIn").onclick = () => zoomCenter(1.2);
$("#bWsOut").onclick = () => zoomCenter(1 / 1.2);
function fitAll(){
  const r = el.ws.getBoundingClientRect(); if (!r.width) return;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  const v = view();
  el.plane.querySelectorAll(":scope > .card, :scope > .group").forEach(n => { const b = n.getBoundingClientRect(), a = screenToPlane(b.left, b.top), c = screenToPlane(b.right, b.bottom); x1 = Math.min(x1, a.x); y1 = Math.min(y1, a.y); x2 = Math.max(x2, c.x); y2 = Math.max(y2, c.y); });
  for (const st of S.proj.ink) if (st.where === "ws" && st.space === S.space) for (const q of st.pts){ x1 = Math.min(x1, q[0]); y1 = Math.min(y1, q[1]); x2 = Math.max(x2, q[0]); y2 = Math.max(y2, q[1]); }
  if (!isFinite(x1)){ const sh = sheet(); v.s = 1; v.tx = 40 - sh.x; v.ty = 70 - sh.y; applyView(); drawLinks(); return; }
  const pad = 56;
  v.s = clamp(Math.min((r.width - pad * 2) / Math.max(1, x2 - x1), (r.height - pad * 2 - 60) / Math.max(1, y2 - y1)), 0.2, 1.15);
  v.tx = (r.width - (x2 - x1) * v.s) / 2 - x1 * v.s; v.ty = (r.height - (y2 - y1) * v.s) / 2 - y1 * v.s + 10; applyView(); drawLinks();
}
$("#bFit").onclick = () => { fitAll(); save(); };
$("#bMini").onclick = () => toggleMini(); queueMicrotask(() => $("#bMini").setAttribute("aria-pressed", String(MINI.on)));

el.ws.addEventListener("pointerdown", e => {
  if (e.pointerType === "pen" && !S.penOnly) setPenOnly(true, true);
  if (!["pen","hl","eraser","text","lasso"].includes(S.tool)) return;
  if (e.target.closest(".hud,.link-hint,.lk-del,.lk-pt,.spaces,.wsfind,.isel")) return;
  if (S.tool === "text"){ if (e.target.closest(".card,.group")) return; e.stopPropagation(); e.preventDefault(); const pt = screenToPlane(e.clientX, e.clientY); addNote({ x:pt.x - 20, y:pt.y - 20 }); return; }
  if (e.pointerType === "touch" && S.penOnly) return;
  if (e.target.closest("textarea,input,[contenteditable=\"true\"]")) return;
  e.stopPropagation(); e.preventDefault(); el.ws.setPointerCapture(e.pointerId);
  const pt = screenToPlane(e.clientX, e.clientY);
  if (ISEL.on) iselClear();
  if (S.tool === "lasso"){ const path = document.createElementNS(NS, "path"); path.setAttribute("class", "lasso"); el.wsInk.appendChild(path); draw = { mode:"lasso", where:"ws", pts:[[pt.x, pt.y]], path, id:e.pointerId }; return; }
  if (S.tool === "eraser"){ draw = { mode:"erase", where:"ws", id:e.pointerId }; eraseAt("ws", null, null, [pt.x, pt.y]); } else beginStroke(e, "ws", null, null, [pt.x, pt.y]);
}, true);
const ptrs = new Map(); let pan = null, pinch = null;
el.ws.addEventListener("pointerdown", e => {
  if (e.target.closest(".card,.group,.hud,.lk-hit,.lk-del,.lk-pt,.link-hint,.spaces,.wsfind,.stk,.stk-bar")) return;
  if (S.selStk) stkSelect(null);
  if (S.linkFrom){
    /* linking and tapped an empty spot: the link ends right there */
    const from = S.linkFrom; cancelLink(); e.stopPropagation(); e.preventDefault();
    const p = screenToPlane(e.clientX, e.clientY), L = { id:uid(), a:from, pt:{ x:r2(p.x), y:r2(p.y) }, heads:"end", ...(S.lastLinkColor ? { color:S.lastLinkColor } : {}), ...(S.lastLinkDash ? { dash:true } : {}), ...(S.lastLinkShape ? { shape:S.lastLinkShape } : {}) };
    growSheet(p.x - 20, p.y - 20, p.x + 20, p.y + 20); S.proj.links.push(L); renderSheet(); selectLink(L.id); commit(); toast("Bağlantı masadaki noktada bitti. Ucunu sürükleyerek taşıyabilirsin."); return;
  }
  S.sel = null; S.selLink = null; cardEls.forEach(c => c.classList.remove("selected")); drawLinks();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  el.ws.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x:e.clientX, y:e.clientY });
  const v = view();
  if (ptrs.size === 1){ pan = { x:e.clientX, y:e.clientY, tx:v.tx, ty:v.ty, moved:false }; pinch = null; }
  else if (ptrs.size === 2){ const [a, b] = [...ptrs.values()], r = el.ws.getBoundingClientRect(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; pinch = { d:Math.hypot(a.x - b.x, a.y - b.y), s:v.s, px:(mx - r.left - v.tx) / v.s, py:(my - r.top - v.ty) / v.s }; pan = null; }
});
el.ws.addEventListener("pointermove", e => {
  if (draw && draw.where === "ws" && draw.id === e.pointerId && draw.mode === "lasso"){ const q = screenToPlane(e.clientX, e.clientY), l = draw.pts[draw.pts.length - 1]; if (Math.hypot(q.x - l[0], q.y - l[1]) > 1.5 / view().s){ draw.pts.push([q.x, q.y]); draw.path.setAttribute("d", polyD(draw.pts) + "Z"); } return; }
  if (draw && draw.where === "ws" && draw.id === e.pointerId){ for (const ce of pointsFrom(e)){ const pt = screenToPlane(ce.clientX, ce.clientY); if (draw.mode === "erase") eraseAt("ws", null, null, [pt.x, pt.y]); else extendStroke([pt.x, pt.y], ce.pressure, e, ce.timeStamp); } if (draw.mode === "stroke"){ predictStroke(e, ce => { const q = screenToPlane(ce.clientX, ce.clientY); return [q.x, q.y]; }); linkPreview(e); } return; }
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x:e.clientX, y:e.clientY }); const v = view();
  if (pinch && ptrs.size >= 2){ const [a, b] = [...ptrs.values()], r = el.ws.getBoundingClientRect(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; v.s = clamp(pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, 0.1, 2.5); v.tx = mx - r.left - pinch.px * v.s; v.ty = my - r.top - pinch.py * v.s; applyView(); }
  else if (pan){ if (Math.hypot(e.clientX - pan.x, e.clientY - pan.y) > 4) pan.moved = true; v.tx = pan.tx + e.clientX - pan.x; v.ty = pan.ty + e.clientY - pan.y; applyView(); }
});
function ptrEnd(e){
  if (draw && draw.where === "ws" && draw.id === e.pointerId && draw.mode === "lasso"){
    const d = draw; draw = null; d.path.remove(); if (d.pts.length < 4) return;
    const ss = strokesIn(d.pts, s => s.where === "ws" && s.space === S.space);
    if (ss.length) iselStart({ where:"ws", ids:ss.map(s => s.id) }); else toast("Seçilecek çizim yok. Kementle kalem çizimlerinin etrafını çiz.");
    return;
  }
  if (draw && draw.where === "ws" && draw.id === e.pointerId){ if (draw.mode === "erase"){ const er = draw.erased; draw = null; if (er) commit(); } else if (!tryInkLink(e)) endStroke(); el.wsEmpty.hidden = spaceItems().length > 0 || S.proj.ink.some(s => s.where === "ws" && s.space === S.space); return; }
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
  if (ptrs.size === 0){
    if (pan && !pan.moved && S.tool === "select"){ const pt = screenToPlane(e.clientX, e.clientY), r = 7 / view().s; const st = [...S.proj.ink].reverse().find(s => s.where === "ws" && s.space === S.space && s.rec && strokeHit(s, pt.x, pt.y, r)); if (st) playAt(st.rec, st.t); }
    if (pan && pan.moved) save(); pan = null;
  }
}
el.ws.addEventListener("pointerup", ptrEnd);
el.ws.addEventListener("pointercancel", ptrEnd);
el.ws.addEventListener("wheel", e => {
  if (e.target.closest(".spaces")) return;
  const q = e.target.closest(".quote"); if (q && !e.ctrlKey && !e.metaKey && q.scrollHeight > q.clientHeight) return;
  e.preventDefault(); const v = view();
  if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, v.s * Math.exp(-e.deltaY * 0.0018)); else { v.tx -= e.deltaX; v.ty -= e.deltaY; applyView(); }
  clearTimeout(el.ws._wt); el.ws._wt = setTimeout(save, 500);
}, { passive:false });

/* ================= audio: recording ================= */
const Rec = { active:null, mr:null, chunks:[], t0:0, stream:null, wake:null, tick:0, flush:0 };
/* while paused (for example while the phone camera records a video) the clock stands still, so notes keep matching the audio */
const recElapsed = () => ((Rec.pausedAt || performance.now()) - Rec.t0) / 1000;
function pauseRec(){
  if (!Rec.active || !Rec.mr || Rec.pausedAt) return false;
  try { if (Rec.mr.state === "recording") Rec.mr.pause(); } catch {}
  Rec.pausedAt = performance.now(); document.body.classList.add("rec-paused"); return true;
}
async function resumeRec(){
  if (!Rec.active || !Rec.pausedAt) return;
  const tr = Rec.stream && Rec.stream.getAudioTracks()[0];
  if (!tr || tr.readyState === "ended"){
    /* the camera took the microphone for good (iPhone, iPad): close this part and carry on in a new recording */
    const { mode, title } = Rec.active; Rec.t0 += performance.now() - Rec.pausedAt; Rec.pausedAt = 0; document.body.classList.remove("rec-paused");
    await stopRecording(true); await startRecording(mode, title.replace(/ \(devam( \d+)?\)$/, "") + " (devam)");
    return;
  }
  Rec.t0 += performance.now() - Rec.pausedAt; Rec.pausedAt = 0; document.body.classList.remove("rec-paused");
  try { if (Rec.mr.state === "paused") Rec.mr.resume(); } catch {}
  toast("Ses kaydı devam ediyor");
}
function stamp(o){ if (Rec.active){ o.rec = Rec.active.id; o.t = r2(recElapsed()); } return o; }
function renderRecModeIcon(){ el.recModeIcon.innerHTML = MODE[S.recMode].icon; el.recModeIcon.title = MODE[S.recMode].name; document.querySelectorAll("#recPop .modecard").forEach(b => b.setAttribute("aria-checked", String(b.dataset.mode === S.recMode))); }
document.querySelectorAll("#recPop .modecard").forEach(b => { b.querySelector(".mc-ico").innerHTML = MODE[b.dataset.mode].icon; b.onclick = () => { S.recMode = b.dataset.mode; ls.set("alinti:recMode", S.recMode); renderRecModeIcon(); }; });
el.rec.onclick = () => { if (Rec.active) stopRecording(); else { renderRecModeIcon(); openPop(el.recPop, el.rec); } };
$("#recStart").onclick = () => { closePop(); startRecording(S.recMode); };
async function startRecording(mode, title){
  if (!navigator.mediaDevices || !window.MediaRecorder){ toast("Bu tarayıcı ses kaydını desteklemiyor."); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } }); }
  catch { toast("Mikrofona erişilemedi. Tarayıcı ayarlarından mikrofon iznini aç.", null, 5000); return; }
  const mime = ["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus"].find(m => MediaRecorder.isTypeSupported(m)) || "";
  let mr; try { mr = new MediaRecorder(stream, mime ? { mimeType:mime, audioBitsPerSecond:48000 } : {}); } catch { mr = new MediaRecorder(stream); }
  const v = AV(); updatePgInfo(v);
  const rec = { id:"r" + uid(), title:title || "Kayıt " + (S.proj.recs.length + 1), doc:v.fp, page:v.curPage || 1, startedAt:new Date().toISOString(), dur:0, mime:(mr.mimeType || mime || "audio/webm").split(";")[0], mode };
  S.proj.recs.push(rec);
  Object.assign(Rec, { active:rec, mr, stream, chunks:[], t0:performance.now(), pausedAt:0 });
  mr.ondataavailable = e => { if (e.data && e.data.size) Rec.chunks.push(e.data); };
  mr.start(1000); Rec.tick = setInterval(updRecTime, 500); Rec.flush = setInterval(flushPartial, 30000);
  await acquireWake(); document.body.classList.add("recording"); el.recTime.hidden = false; updRecTime();
  renderAllOverlays(); save(); toast(`${rec.title} başladı · ${MODE[mode].name} modu`);
}
async function acquireWake(){ try { Rec.wake = navigator.wakeLock ? await navigator.wakeLock.request("screen") : null; } catch { Rec.wake = null; } }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && Rec.active) acquireWake(); });
function updRecTime(){ el.recTime.textContent = Rec.active ? fmtT(recElapsed()) : "00:00"; }
async function flushPartial(){ const r = Rec.active; if (!r || S.sample) return; r.dur = r2(recElapsed()); try { await DB.put("blobs", { id:r.id, blob:new Blob(Rec.chunks, { type:r.mime }), mime:r.mime }); save(); } catch {} }
async function stopRecording(quiet){
  const rec = Rec.active; if (!rec) return;
  if (Rec.pausedAt){ Rec.t0 += performance.now() - Rec.pausedAt; Rec.pausedAt = 0; document.body.classList.remove("rec-paused"); }
  /* a recorder whose microphone was taken away is already stopped and will not fire "stop" again */
  await new Promise(res => { if (!Rec.mr || Rec.mr.state === "inactive"){ res(); return; } Rec.mr.onstop = res; setTimeout(res, 4000); try { Rec.mr.stop(); } catch { res(); } });
  clearInterval(Rec.tick); clearInterval(Rec.flush);
  try { Rec.stream.getTracks().forEach(t => t.stop()); } catch {}
  try { Rec.wake && Rec.wake.release(); } catch {}
  rec.dur = r2(recElapsed()); const blob = new Blob(Rec.chunks, { type:rec.mime });
  Rec.active = null; Rec.chunks = []; document.body.classList.remove("recording"); el.recTime.hidden = true;
  try { await DB.put("blobs", { id:rec.id, blob, mime:rec.mime }); } catch (e){ console.error(e); toast("Ses dosyası kaydedilemedi. Cihazında yer kalmamış olabilir."); }
  renderWs(); renderAllOverlays(); save();
  if (!quiet) toast(`${rec.title} kaydedildi · ${fmtT(rec.dur)}`, { label:"Dinle", fn:() => openPlayer(rec.id, 0) });
}
window.addEventListener("beforeunload", e => { if (Rec.active){ e.preventDefault(); e.returnValue = ""; } });

/* ================= audio: playback ================= */
const P = { audio:new Audio(), rec:null, url:null, raf:0, ready:false, pend:0 };
P.audio.preload = "auto";
const pDur = () => { const d = P.audio.duration; return isFinite(d) && d > 0 ? d : (P.rec ? P.rec.dur : 0); };
P.audio.addEventListener("loadedmetadata", () => {
  if (!isFinite(P.audio.duration)){ P.audio.currentTime = 1e101; P.audio.addEventListener("timeupdate", function fix(){ P.audio.removeEventListener("timeupdate", fix); P.ready = true; P.audio.currentTime = P.pend; buildTicks(); }, { once:true }); }
  else { P.ready = true; P.audio.currentTime = P.pend; buildTicks(); }
});
P.audio.addEventListener("play", () => { el.player.classList.add("playing"); loop(); });
P.audio.addEventListener("pause", () => { el.player.classList.remove("playing"); updPlayerUI(); });
P.audio.addEventListener("ended", () => { el.player.classList.remove("playing"); updPlayerUI(); });
function stampedTimes(id){ const ts = []; for (const k of ["items","ink","texts","comments"]) for (const o of S.proj[k]) if (o.rec === id) ts.push(o.t); return ts.sort((a, b) => a - b); }
function buildTicks(){
  el.plTicks.innerHTML = ""; if (!P.rec) return; const d = pDur(); if (!d) return; let last = -1;
  for (const t of stampedTimes(P.rec.id)){ const x = t / d * 100; if (x - last < 0.6) continue; last = x; const i = document.createElement("i"); i.style.left = clamp(x, 0, 100) + "%"; el.plTicks.appendChild(i); }
}
function setPlayerMode(m){ if (!P.rec) return; P.rec.mode = m; document.querySelectorAll(".pl-mode").forEach(b => b.setAttribute("aria-checked", String(b.dataset.mode === m))); refreshReveal(); save(); }
document.querySelectorAll(".pl-mode").forEach(b => { b.innerHTML = MODE[b.dataset.mode].icon; b.onclick = () => { setPlayerMode(b.dataset.mode); toast(b.dataset.mode === "trace" ? "Dedektif: notlar kayıtla birlikte belirir" : "Beyin: tüm notlar görünür"); }; });
async function openPlayer(id, t = 0, autoplay = true){
  const rec = S.proj.recs.find(r => r.id === id); if (!rec) return;
  if (Rec.active && Rec.active.id === id){ toast("Kayıt sürerken dinlenemez."); return; }
  closePop();
  if (!P.rec || P.rec.id !== id){
    const b = await DB.get("blobs", id).catch(() => null);
    if (!b){ toast("Bu kaydın ses dosyası bu cihazda yok. Projeyi ses dosyalarıyla birlikte içe aktar.", null, 5000); return; }
    if (P.url) URL.revokeObjectURL(P.url);
    P.url = URL.createObjectURL(b.blob); P.rec = rec; P.ready = false; P.pend = t; P.audio.src = P.url; P.audio.playbackRate = +(el.plSpeed.dataset.rate || 1);
  } else { P.pend = t; if (P.ready) P.audio.currentTime = t; }
  el.plTitle.textContent = `${rec.title} · ${S.proj.docs.length > 1 ? docName(rec.doc) + " · " : ""}s. ${rec.page}`;
  el.player.hidden = false; setPlayerMode(rec.mode || "trace"); buildTicks(); updPlayerUI();
  if (rec.doc && !S.viewers.some(v => !v.root.hidden && v.fp === rec.doc)) revealInDoc(rec.doc, rec.page, 0);
  if (autoplay) P.audio.play().catch(() => {});
}
function playAt(id, t){ openPlayer(id, Math.max(0, (t || 0) - 1.5), true); }
function closePlayer(){ P.audio.pause(); el.player.hidden = true; P.rec = null; P.ready = false; if (P.url){ URL.revokeObjectURL(P.url); P.url = null; } P.audio.removeAttribute("src"); document.body.classList.remove("reveal"); document.querySelectorAll(".future,.now").forEach(n => n.classList.remove("future", "now")); }
function updPlayerUI(){
  if (!P.rec) return; const d = pDur(), c = P.ready ? P.audio.currentTime : P.pend;
  el.plTime.textContent = `${fmtT(c)} / ${fmtT(d)}`; el.plSeek.max = d || 1; if (!el.plSeek.matches(":active")) el.plSeek.value = c;
  el.plFill.style.width = (d ? clamp(c / d * 100, 0, 100) : 0) + "%"; applyReveal(c);
}
function loop(){ cancelAnimationFrame(P.raf); const f = () => { updPlayerUI(); if (!P.audio.paused) P.raf = requestAnimationFrame(f); }; P.raf = requestAnimationFrame(f); }
function applyReveal(cur){
  if (!P.rec) return; document.body.classList.toggle("reveal", P.rec.mode === "trace");
  document.querySelectorAll(`[data-rec="${P.rec.id}"]`).forEach(n => { const t = +n.dataset.t; n.classList.toggle("future", t > cur + 0.05); n.classList.toggle("now", t <= cur + 0.05 && cur - t < 2.5 && !P.audio.paused); });
}
function refreshReveal(){ if (P.rec && !el.player.hidden) updPlayerUI(); }
el.plPlay.onclick = () => { if (!P.rec) return; if (P.audio.paused){ if (P.audio.ended) P.audio.currentTime = 0; P.audio.play().catch(() => {}); } else P.audio.pause(); };
el.plSeek.addEventListener("input", () => { const t = +el.plSeek.value; P.pend = t; if (P.ready) P.audio.currentTime = t; updPlayerUI(); });
el.plSpeed.onclick = () => { const rates = [1, 1.25, 1.5, 2, 0.75], cur = +(el.plSpeed.dataset.rate || 1), nx = rates[(rates.indexOf(cur) + 1) % rates.length]; el.plSpeed.dataset.rate = nx; el.plSpeed.textContent = nx + "×"; P.audio.playbackRate = nx; };
$("#plClose").onclick = closePlayer;
$("#plList").onclick = () => openRecList($("#plList"), null, null);
function openRecList(anchor, fp, page){
  const recs = S.proj.recs.filter(r => (fp == null || r.doc === fp) && (page == null || r.page === page));
  el.recsTitle.textContent = page == null ? "Ses kayıtları" : `Sayfa ${page} kayıtları`;
  el.recList.innerHTML = ""; el.recListEmpty.hidden = recs.length > 0;
  for (const r of recs){
    const li = document.createElement("li"); li.className = "rl";
    const pb = document.createElement("button"); pb.className = "rl-play"; pb.innerHTML = ICON.play; pb.setAttribute("aria-label", r.title + " oynat"); pb.onclick = () => openPlayer(r.id, 0);
    const main = document.createElement("div"); main.className = "rl-main";
    const nm = document.createElement("div"); nm.className = "rl-name"; nm.textContent = r.title;
    const mt = document.createElement("div"); mt.className = "rl-meta"; const n = stampedTimes(r.id).length;
    mt.textContent = (S.proj.docs.length > 1 ? docName(r.doc) + " · " : "") + `s. ${r.page} · ${fmtT(r.dur)} · ${fmtDate(r.startedAt)}` + (n ? ` · ${n} işaret` : "") + (Rec.active && Rec.active.id === r.id ? " · kaydediliyor" : "");
    main.append(nm, mt);
    const del = document.createElement("button"); del.className = "btn sm"; del.textContent = "Sil";
    del.onclick = async () => {
      if (!del.classList.contains("danger")){ del.classList.add("danger"); del.textContent = "Emin misin?"; return; }
      if (Rec.active && Rec.active.id === r.id) await stopRecording();
      if (P.rec && P.rec.id === r.id) closePlayer();
      S.proj.recs = S.proj.recs.filter(x => x.id !== r.id);
      for (const k of ["items","ink","texts","comments"]) for (const o of S.proj[k]) if (o.rec === r.id){ delete o.rec; delete o.t; }
      DB.del("blobs", r.id).catch(() => {}); renderWs(); renderAllOverlays(); save(); li.remove();
      if (!el.recList.children.length) el.recListEmpty.hidden = false;
    };
    li.append(pb, main, del); el.recList.appendChild(li);
  }
  openPop(el.recsPop, anchor);
}

/* ================= menu ================= */
$("#bMore").onclick = () => openPop(el.morePop, $("#bMore"));
$("#mAddDoc").onclick = () => { closePop(); if (S.sample){ toast("Örnek projeye belge eklenemez. Kendi PDF'inle yeni proje aç."); return; } $("#filePdf").dataset.mode = "add"; $("#filePdf").click(); };
$("#mOpen").onclick = () => { closePop(); $("#filePdf").dataset.mode = "new"; $("#filePdf").click(); };
$("#mRecs").onclick = () => openRecList($("#bMore"), null, null);
$("#mFolder").onclick = linkFolder;
$("#mExport").onclick = () => { closePop(); exportZip(); };
$("#mMd").onclick = () => { closePop(); exportMd(); };
$("#mHelp").onclick = () => { closePop(); toast("V seç · P kalem · H fosforlu · E silgi · T metin · L kement · [ ] kalınlık · Shift düz çizgi · Ctrl+Z geri al · Ctrl+F tüm belgelerde ara · Boşluk oynat · Kartı başka karta sürükle: grup", null, 7000); };
$("#bHome").onclick = async () => { if (Rec.active) await stopRecording(); clearTimeout(saveTimer); try { await saveNow(); } catch {} S.proj = null; setView("home"); OD.soon(600); };
el.docTitle.addEventListener("click", () => {
  if (S.sample || el.docTitle.isContentEditable) return;
  el.docTitle.contentEditable = "true"; el.docTitle.focus();
  const r = document.createRange(); r.selectNodeContents(el.docTitle); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
});
el.docTitle.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); el.docTitle.blur(); } if (e.key === "Escape"){ el.docTitle.textContent = S.proj.name; el.docTitle.blur(); } });
el.docTitle.addEventListener("blur", () => { if (!el.docTitle.isContentEditable) return; el.docTitle.contentEditable = "false"; const n = el.docTitle.textContent.trim(); if (n){ S.proj.name = n; document.title = n + " · " + APP_NAME; save(); } else el.docTitle.textContent = S.proj.name; });

/* ================= export / import ================= */
/* inside the Android app there are no browser downloads: files are written to the app's cache and handed to the share sheet (Save to Files, Drive, WhatsApp...) */
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const capPlugin = n => window.Capacitor && ((window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || (window.Capacitor.registerPlugin && window.Capacitor.registerPlugin(n)));
const blobToB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = rej; r.readAsDataURL(b); });
async function nativeSave(blob, name){
  const FS = capPlugin("Filesystem"), SH = capPlugin("Share"), path = "export/" + String(name).replace(/[\\/:*?"<>|]+/g, "_");
  try { await FS.deleteFile({ path, directory:"CACHE" }); } catch {}
  const CH = 3 * 1024 * 1024; /* a multiple of 3 bytes, so every piece is valid base64 on its own */
  if (!blob.size) await FS.writeFile({ path, data:"", directory:"CACHE", recursive:true });
  for (let o = 0; o < blob.size; o += CH){
    const data = await blobToB64(blob.slice(o, o + CH));
    if (o === 0) await FS.writeFile({ path, data, directory:"CACHE", recursive:true }); else await FS.appendFile({ path, data, directory:"CACHE" });
  }
  const { uri } = await FS.getUri({ path, directory:"CACHE" });
  try { await SH.share({ title:name, files:[uri], dialogTitle:"Kaydet ya da gönder" }); } catch (e){ if (!/cancel/i.test(String(e && e.message))) throw e; }
}
function downloadBlob(blob, filename){
  if (NATIVE){ nativeSave(blob, filename).catch(e => { console.error(e); toast("Dosya hazırlanamadı."); }); return; } const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function buildZip(projRec){
  const data = projRec.data, zip = new JSZip();
  zip.file("mimetype", EDNOTE_MIME, { compression:"STORE" });
  zip.file("project.json", JSON.stringify({ ...data, app:"ednote", v:SCHEMA }, null, 1));
  for (const d of data.docs){ const p = await DB.get("pdfs", d.fp); if (p) zip.file("docs/" + d.fp + ".pdf", p.bytes); }
  for (const r of data.recs || []){ const b = await DB.get("blobs", r.id); if (b) zip.file("audio/" + r.id + audioExt(r.mime), b.blob); }
  for (const it of data.items || []) if (it.type === "video" && !it.local){ const b = await DB.get("blobs", it.vid); if (b) zip.file("media/" + it.vid + videoExt(it.mime), b.blob); }
  const body = await zip.generateAsync({ type:"blob", compression:"STORE" });
  return { blob:new Blob([EDNOTE_SIG, body], { type:EDNOTE_MIME }), name: safeName(projRec.name) + ".ednote" };
}
async function exportZip(id){
  if (!id && S.sample){ toast("Örnek proje dışa aktarılamaz. Kendi PDF'ini aç."); return; }
  if (!id){ clearTimeout(saveTimer); await saveNow(); id = S.proj.id; }
  toast("Proje hazırlanıyor…");
  try {
    const rec = await DB.get("projects", id); const { blob, name } = await buildZip(rec);
    const file = new File([blob], name, { type:EDNOTE_MIME });
    if (navigator.canShare && navigator.canShare({ files:[file] }) && matchMedia("(pointer:coarse)").matches){ try { await navigator.share({ files:[file], title:name }); return; } catch (e){ if (e && e.name === "AbortError") return; } }
    downloadBlob(blob, name); toast(`${name} indirildi. OneDrive'a koyup diğer cihazda "Projeyi içe aktar" ile açabilirsin.`, null, 5000);
  } catch (e){ console.error(e); toast("Dışa aktarılamadı."); }
}
function migrateV3(d3, fp, name){
  const sid = "s" + uid(), p = emptyProject(stripPdf(name || d3.pdfName));
  p.spaces = [{ id:sid, name:"Masa 1", view:d3.view || { tx:40, ty:60, s:1 } }];
  p.docs = [{ fp, name:name || d3.pdfName || "Belge.pdf" }];
  p.items = (d3.items || []).map(i => ({ ...i, doc:i.type === "note" ? undefined : fp, space:sid }));
  p.links = d3.links || [];
  p.ink = (d3.ink || []).map(s => s.where === "ws" ? { ...s, space:sid } : { ...s, doc:fp });
  p.texts = (d3.texts || []).map(t => ({ ...t, doc:fp }));
  p.recs = (d3.recs || []).map(r => ({ ...r, doc:fp }));
  p.ui = { space:sid, viewers:[fp], split:false };
  return p;
}
async function importZip(file){
  try {
    /* new files: signature line + zip; older files and anything renamed to .zip: a plain zip */
    let src = file; try { const head = new TextDecoder().decode(await file.slice(0, 32).arrayBuffer()); if (head.startsWith("EDNOTE/")){ const nl = head.indexOf("\n"); if (nl > 0) src = file.slice(nl + 1); } } catch {}
    let zip; try { zip = await JSZip.loadAsync(src); } catch { toast("Bu dosya bir ED Note projesi değil. .ednote ya da eski .alinti.zip dosyası seç.", null, 5000); return; }
    const pj = zip.file("project.json");
    if (!pj){ toast("Bu dosya bir ED Note projesi değil."); return; }
    let proj = JSON.parse(await pj.async("string"));
    for (const it of proj.items || []) if (it && it.type === "video" && it.vid){ const vf = zip.file("media/" + it.vid + videoExt(it.mime)); if (vf){ try { await DB.put("blobs", { id:it.vid, blob:new Blob([await vf.async("uint8array")], { type:it.mime || "video/mp4" }), mime:it.mime }); } catch (e){ it.local = true; } } }
    for (const r of proj.recs || []){ const af = zip.file("audio/" + r.id + audioExt(r.mime)) || zip.file(new RegExp("^audio/" + r.id + "\\."))[0]; if (af) await DB.put("blobs", { id:r.id, blob:new Blob([await af.async("uint8array")], { type:r.mime || "audio/webm" }), mime:r.mime }); }
    if (Array.isArray(proj.docs)){
      for (const d of proj.docs){ const f = zip.file("docs/" + d.fp + ".pdf"); if (f) await DB.put("pdfs", { fp:d.fp, name:d.name, bytes:await f.async("uint8array") }); }
    } else {
      const f = zip.file("document.pdf"); if (!f){ toast("Zip'te PDF bulunamadı."); return; }
      const bytes = await f.async("uint8array"); const { fp } = await ingestPdf(bytes, proj.pdfName || "Belge.pdf");
      proj = migrateV3(proj, fp, proj.pdfName);
    }
    if (!proj.id) proj.id = "p" + uid();
    const existing = await DB.get("projects", proj.id).catch(() => null);
    if (existing && existing.updated > Date.parse(proj.savedAt || 0) + 1000) toast("Bu cihazdaki sürüm daha yeniydi, içe aktarılan sürümle değiştirildi.", null, 5000);
    const clean = cleanProject(proj); delete clean.trashed;
    /* imported into the folder you are looking at; otherwise it keeps the folder it was exported from */
    if (LIB.view === "proj" && LIB.path) clean.folder = LIB.path; else if (existing && existing.data) { if (cleanPath(existing.data.folder)) clean.folder = cleanPath(existing.data.folder); else delete clean.folder; }
    await DB.put("projects", { id:clean.id, name:clean.name, updated:Date.now(), data:clean });
    await openProject(clean); toast("Proje içe aktarıldı");
  } catch (e){ console.error(e); toast("Proje dosyası okunamadı."); }
}
async function openFolderProject(){
  try {
    const dir = await window.showDirectoryPicker({ id:"alinti", mode:"readwrite" });
    let pj; try { pj = await (await dir.getFileHandle("project.json")).getFile(); } catch { toast('Bu klasörde proje yok. İçinde "project.json" olan proje klasörünü seç.', null, 5000); return; }
    let proj = JSON.parse(await pj.text());
    try { const ad = await dir.getDirectoryHandle("audio"); for (const r of proj.recs || []){ try { const f = await (await ad.getFileHandle(r.id + audioExt(r.mime))).getFile(); await DB.put("blobs", { id:r.id, blob:f, mime:r.mime }); } catch {} } } catch {}
    if (Array.isArray(proj.docs)){
      const dd = await dir.getDirectoryHandle("docs");
      for (const d of proj.docs){ try { const f = await (await dd.getFileHandle(d.fp + ".pdf")).getFile(); await DB.put("pdfs", { fp:d.fp, name:d.name, bytes:new Uint8Array(await f.arrayBuffer()) }); } catch {} }
    } else {
      const f = await (await dir.getFileHandle("document.pdf")).getFile(); const { fp } = await ingestPdf(new Uint8Array(await f.arrayBuffer()), proj.pdfName || "Belge.pdf");
      proj = migrateV3(proj, fp, proj.pdfName);
    }
    const clean = cleanProject(proj); delete clean.trashed; if (LIB.view === "proj" && LIB.path) clean.folder = LIB.path;
    await DB.put("projects", { id:clean.id, name:clean.name, updated:Date.now(), data:clean });
    await DB.put("meta", { k:"dir:" + clean.id, h:dir });
    await openProject(clean);
  } catch (e){ if (e && e.name !== "AbortError"){ console.error(e); toast("Klasör açılamadı."); } }
}
async function exportMd(){
  const p = S.proj; if (!p.items.length && !p.texts.length && !p.comments.length){ toast("Henüz not yok"); return; }
  let md = `# ${p.name}\n\n`;
  for (const d of p.docs){
    const ex = p.items.filter(i => i.doc === d.fp).sort((a, b) => a.page - b.page || (a.rects[0]?.y || 0) - (b.rects[0]?.y || 0));
    const cm = p.comments.filter(c => c.doc === d.fp && c.text.trim()).sort((a, b) => a.page - b.page);
    const tx = p.texts.filter(t => t.doc === d.fp && t.text.trim()).sort((a, b) => a.page - b.page || a.y - b.y);
    if (!ex.length && !cm.length && !tx.length) continue;
    md += `## ${stripPdf(d.name)}\n\n`;
    for (const it of ex) md += (it.photo ? `*[Fotoğraf]*` : it.type === "image" ? `*[Görsel alıntı]*` : `> ${it.text}`) + (it.photo ? "" : `\n\n*Sayfa ${it.page}*`) + (it.note ? `\n\n${mdNote(it)}` : "") + (it.tags ? `\n\n${it.tags.map(t => "#" + t.replace(/\s/g, "_")).join(" ")}` : "") + "\n\n---\n\n";
    if (cm.length){ md += `### Yorumlar\n\n`; for (const c of cm) md += `- s. ${c.page}: "${(c.quote || "").slice(0, 80)}" ${c.text.replace(/\n/g, " ")}\n`; md += "\n"; }
    if (tx.length){ md += `### Belge üzerindeki notlar\n\n`; for (const t of tx) md += `- s. ${t.page}: ${t.text.replace(/\n/g, " ")}\n`; md += "\n"; }
  }
  for (const sp of p.spaces){
    const notes = p.items.filter(i => i.type === "note" && i.space === sp.id && !i.group), groups = p.groups.filter(g => g.space === sp.id);
    if (!notes.length && !groups.length) continue;
    md += `## ${sp.name}\n\n`;
    for (const g of groups){ md += `### ${g.title || "Grup"}\n\n`; for (const it of p.items.filter(i => i.group === g.id).sort((a, b) => a.ord - b.ord)) md += `- ${(it.type === "note" ? it.note : it.text || "[görsel]").replace(/\n/g, " ").slice(0, 160)}\n`; md += "\n"; }
    for (const n of notes) md += `- ${mdNote(n).replace(/\n/g, " ") || "(boş not)"}\n`;
    md += "\n";
  }
  downloadBlob(new Blob([md], { type:"text/markdown" }), safeName(p.name) + "-notlar.md");
}

/* ================= annotated PDF export =================
   Document pages keep their original content; highlights, comments and ink become real PDF annotations
   (so Acrobat, Edge and Zotero can read them). Text boxes are drawn onto the page. Each workspace becomes
   its own page, sized to the area actually used (never above 2 m). Links between a card and a place in the
   document get the same number on both ends, and the numbers are clickable links in any PDF viewer. */
const loadScript = src => new Promise((res, rej) => {
  if (document.querySelector(`script[data-src="${src}"]`)) return res();
  const t = document.createElement("script"); t.src = src; t.dataset.src = src; t.onload = res; t.onerror = () => rej(new Error("yüklenemedi: " + src)); document.head.appendChild(t);
});
async function pdfLibs(){ if (!window.PDFLib) await loadScript("vendor/pdf-lib.min.js"); if (!window.fontkit) await loadScript("vendor/fontkit.umd.min.js"); return window.PDFLib; }
async function docBytes(fp){ const b = S.sampleBytes.get(fp); if (b) return b.slice(); const r = await DB.get("pdfs", fp).catch(() => null); return r ? r.bytes : null; }
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const SAFE_RE = /[^\n -~ -ſȘ-țΑ-ω‐-‧‰-›⁰-₟←-⋿™€]/g;
const safeTxt = t => String(t || "").replace(/\t/g, " ").replace(/\r/g, "").replace(SAFE_RE, "?");
function wrapText(text, font, size, maxW){
  const out = [];
  for (const para of safeTxt(text).split("\n")){
    let line = "";
    for (let w of para.split(/ +/)){
      while (w.length > 1 && font.widthOfTextAtSize(w, size) > maxW){
        let k = w.length - 1; while (k > 1 && font.widthOfTextAtSize(w.slice(0, k), size) > maxW) k--;
        if (line){ out.push(line); line = ""; } out.push(w.slice(0, k)); w = w.slice(k);
      }
      const t = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(t, size) <= maxW) line = t; else { if (line) out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}
async function pngBytesOf(src){
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0);
  const b = await new Promise(r => c.toBlob(r, "image/png")); return { bytes:new Uint8Array(await b.arrayBuffer()), w:img.naturalWidth, h:img.naturalHeight };
}
const rr = (x, y, w, h, r) => `M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} V${y + r} Q${x},${y} ${x + r},${y} Z`;
const n2 = v => (Math.round(v * 100) / 100).toString();
const trunc = (t, n) => t.length <= n ? t : t.slice(0, n - 1).trimEnd().replace(/[\s:;,.\-·]+$/, "") + "…";

async function buildAnnotatedPdf(proj){
  const L = await pdfLibs();
  const { PDFDocument, rgb, PDFName, PDFHexString, PDFString, LineCapStyle } = L;
  const out = await PDFDocument.create(); out.registerFontkit(window.fontkit);
  const [fr, fb] = await Promise.all(["DejaVuSans", "DejaVuSans-Bold"].map(n => fetch(`vendor/fonts/${n}.ttf`).then(r => { if (!r.ok) throw new Error("font"); return r.arrayBuffer(); })));
  const font = await out.embedFont(fr, { subset:true }), bold = await out.embedFont(fb, { subset:true });
  /* chosen fonts are embedded only if used; anything missing falls back to DejaVu */
  const fontsUsed = new Set([...proj.items.map(i => i.font), ...proj.items.flatMap(i => (richOf(i) || []).map(r => r.f)), ...proj.texts.map(t => t.font)].filter(id => FONT_IDS.has(id))), fontOf = new Map();
  for (const id of fontsUsed){ try { const r = await fetch(`vendor/fonts/ed/${id}.woff`); if (r.ok) fontOf.set(id, await out.embedFont(await r.arrayBuffer(), { subset:true })); } catch {} }
  const fontFor = id => fontOf.get(id) || font;
  /* draw text with the chosen font; characters it lacks (e.g. Greek in a handwriting font) fall back to DejaVu */
  const hasGlyph = (f, ch) => { try { const fk = f.embedder && f.embedder.font; return !fk || fk.hasGlyphForCodePoint(ch.codePointAt(0)); } catch { return true; } };
  const drawTxt = (page, str, o) => {
    const f = o.font; if (f === font){ page.drawText(str, o); return; }
    let x = o.x, run = "", rf = null;
    const flush = () => { if (!run) return; page.drawText(run, { ...o, x, font:rf }); x += rf.widthOfTextAtSize(run, o.size); run = ""; };
    for (const ch of str){ const cf = hasGlyph(f, ch) ? f : font; if (cf !== rf){ flush(); rf = cf; } run += ch; }
    flush();
  };
  const ctx = out.context, skipped = [], now = PDFString.fromDate(new Date());
  const INK = rgb(.11, .11, .12), INK2 = rgb(.43, .43, .45), HAIR = rgb(.82, .82, .80), ACC = rgb(.184, .42, .369), WHITE = rgb(1, 1, 1);
  const txt = s => PDFHexString.fromText(safeTxt(s));
  const addAnnot = (page, dict) => { const ref = ctx.register(ctx.obj({ Type:"Annot", F:4, M:now, T:txt(APP_NAME), ...dict })); page.node.addAnnot(ref); return ref; };
  const apForm = (bbox, ops, gs) => ctx.register(ctx.stream(ops, { Type:"XObject", Subtype:"Form", BBox:bbox, ...(gs ? { Resources:{ ExtGState:{ G0:{ Type:"ExtGState", ...gs } } } } : {}) }));
  const dest = (page, x, y) => ctx.obj([page.ref, "XYZ", Math.max(0, x), y, null]);
  const linkAnnot = (page, rect, d) => addAnnot(page, { Subtype:"Link", Rect:rect, Border:[0, 0, 0], Dest:d });

  /* 1. original document pages */
  const pagesOf = new Map(), vpOf = new Map();
  for (const d of proj.docs){
    const bytes = await docBytes(d.fp); if (!bytes){ skipped.push(d.name); continue; }
    let src; try { src = await PDFDocument.load(bytes, { ignoreEncryption:true }); } catch { skipped.push(d.name); continue; }
    const pages = await out.copyPages(src, src.getPageIndices()); pages.forEach(p => out.addPage(p)); pagesOf.set(d.fp, pages);
    const pdf = await loadPdfDoc(d.fp); const vps = [];
    for (let i = 1; i <= pdf.numPages; i++) vps.push((await pdf.getPage(i)).getViewport({ scale:1 }));
    vpOf.set(d.fp, vps);
  }
  const P = (fp, n, x, y) => vpOf.get(fp)[n - 1].convertToPdfPoint(x, y);
  const boxPdf = (fp, n, r) => { const [ax, ay] = P(fp, n, r.x, r.y), [bx, by] = P(fp, n, r.x + r.w, r.y + r.h); return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)]; };
  const hasPage = (fp, n) => pagesOf.has(fp) && pagesOf.get(fp)[n - 1];

  /* 2. numbering of card <-> document links */
  const anchorPos = a => { const o = anchorObj(a); if (!o) return null;
    if (a.type === "pin") return { o, x:o.x, y:o.y };
    if (a.type === "ink") return { o, x:o.pts[0][0], y:o.pts[0][1] };
    if (a.type === "text") return { o, x:o.x - 6, y:o.y };
    return { o, x:(o.rects[0] || { x:0 }).x - 8, y:(o.rects[0] || { y:0 }).y }; };
  const docIdx = fp => proj.docs.findIndex(d => d.fp === fp);
  const numbered = proj.links.filter(l => l.anchor).map(l => ({ l, pos:anchorPos(l.anchor), card:proj.items.find(i => i.id === l.a) }))
    .filter(x => x.pos && x.card && hasPage(x.pos.o.doc, x.pos.o.page))
    .sort((a, b) => docIdx(a.pos.o.doc) - docIdx(b.pos.o.doc) || a.pos.o.page - b.pos.o.page || a.pos.y - b.pos.y);
  numbered.forEach((x, i) => x.n = i + 1);

  /* 3. workspace layout (computed from data, 1 unit = 1 pt) */
  const QS = 11, QL = 15.5, NS = 10.5, NL = 14.5, HS = 8.5, PAD = 12;
  /* formulas: MathJax SVG -> PNG, rendered once per formula */
  const mathPng = new Map(), mathEmb = new Map();
  const mathNotes = proj.items.filter(i => hasMath(i.note));
  if (mathNotes.length){
    try { await loadMathJax(); } catch {}
    for (const it of mathNotes) for (const seg of parseMath(it.note)) if (seg.t === "math"){
      const key = (seg.display ? "D|" : "I|") + seg.tex; if (mathPng.has(key) || !window.MathJax || !window.MathJax.tex2svg) continue;
      try {
        const node = window.MathJax.tex2svg(seg.tex, { display:seg.display }); if (node.querySelector("[data-mjx-error], merror")) continue;
        const svg = node.querySelector("svg");
        const wEx = parseFloat(svg.getAttribute("width")), hEx = parseFloat(svg.getAttribute("height")), va = parseFloat(String(svg.style.verticalAlign || "0").replace("ex", "")) || 0;
        svg.setAttribute("width", wEx * 36); svg.setAttribute("height", hEx * 36); svg.setAttribute("color", "#1d1d1f"); svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        const png = await pngBytesOf("data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg)));
        mathPng.set(key, { bytes:png.bytes, wEx, hEx, va });
      } catch (e){ console.warn("formül", seg.tex, e); }
    }
  }
  /* lay out a note that mixes words and formulas into rows */
  /* the font a piece of formatted text is drawn with: its own font, or the card's; bold uses DejaVu Bold where there is no other bold */
  const pieceFont = (st, f) => { const base = st && st.f ? fontFor(st.f) : f; return st && st.b && base === font ? bold : base; };
  function mathFlow(text, f, size, lh, maxW, runs, noMath){
    const sty = runs ? rtStyleAt(runs) : null, wOf = p => pieceFont(p.st, f).widthOfTextAtSize(p.s, size);
    const ex = size * 0.45, space = f.widthOfTextAtSize(" ", size), rows = []; let row = { items:[], w:0, asc:size * 0.8, desc:size * 0.25, center:false };
    const push = () => { rows.push(row); row = { items:[], w:0, asc:size * 0.8, desc:size * 0.25, center:false }; };
    const add = (item, w) => { if (row.items.length && row.w + w > maxW) push(); item.x = row.w; row.items.push(item); row.w += w; };
    for (const seg of (noMath ? [{ t:"text", s:text, idx:Array.from({ length:text.length }, (_, n) => n) }] : parseMath(text))){
      if (seg.t === "text"){
        /* words made of pieces: a word may change style in the middle */
        const txt = safeTxt(seg.s); let word = [];
        const endWord = () => { if (!word.length) return; let w = 0; for (const p of word) w += wOf(p); add({ k:"w", pieces:word }, w); word = []; };
        for (let j = 0; j < txt.length; j++){
          const ch = txt[j];
          if (ch === "\n"){ endWord(); push(); continue; }
          if (ch === " "){ endWord(); if (row.items.length) row.w += space; continue; }
          const st = sty ? sty(seg.idx[j]) : null, l = word[word.length - 1];
          if (l && rtSame(l.st, st)) l.s += ch; else word.push({ s:ch, st });
        }
        endWord();
        continue;
      }
      const m = mathPng.get((seg.display ? "D|" : "I|") + seg.tex);
      if (!m){ add({ k:"w", pieces:[{ s:safeTxt(seg.tex), st:null }] }, f.widthOfTextAtSize(safeTxt(seg.tex), size)); continue; }
      let w = m.wEx * ex, h = m.hEx * ex; if (w > maxW){ h *= maxW / w; w = maxW; }
      const depth = -m.va * ex, item = { k:"m", key:(seg.display ? "D|" : "I|") + seg.tex, w, h, depth };
      if (seg.display){ if (row.items.length) push(); add(item, w); row.center = true; row.asc = Math.max(row.asc, h - depth); row.desc = Math.max(row.desc, depth); push(); }
      else { add(item, w); row.asc = Math.max(row.asc, h - depth); row.desc = Math.max(row.desc, depth); }
    }
    if (row.items.length) push();
    let y = 0; for (const r of rows){ const rh = Math.max(lh, r.asc + r.desc + 3); r.base = y + (rh - r.asc - r.desc) / 2 + r.asc; r.top = y; y += rh; if (r.center){ const off = (maxW - r.w) / 2; r.items.forEach(i => i.x += off); } }
    return { rows, h:y };
  }
  const stkEmb = new Map();
  async function emojiPng(t){
    const c = document.createElement("canvas"); c.width = c.height = 160; const x = c.getContext("2d");
    x.font = `124px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(t, 80, 88);
    const b = await new Promise(r => c.toBlob(r, "image/png")); return new Uint8Array(await b.arrayBuffer());
  }
  const imgs = new Map();
  for (const it of proj.items) if (it.type === "image" || (it.type === "video" && it.poster)){ try { imgs.set(it.id, await pngBytesOf(it.type === "video" ? it.poster : it.src)); } catch {} }
  function cardLayout(it, w){
    const f = it.fs || 1, qs = QS * f, ql = QL * f, ns = NS * f, nl = NL * f, cf = fontFor(it.font);
    const inner = w - PAD * 2, parts = []; let h = PAD + 12;
    if (it.type === "excerpt"){ const lines = wrapText(it.text, cf, qs, inner - 8); parts.push({ k:"quote", lines, y:h + 6, s:qs, l:ql }); h += 8 + lines.length * ql; }
    if (it.type === "image" || it.type === "video"){ const im = imgs.get(it.id); const ih = im ? inner * im.h / im.w : 60; parts.push({ k:"img", y:h + 6, h:ih, video:it.type === "video" }); h += 10 + ih; }
    const rich = richOf(it), useMath = hasMath(it.note) && mathPng.size;
    if (useMath || rich){ const fl = mathFlow(it.note, cf, ns, nl, inner, rich, !useMath); parts.push({ k:"mnote", rows:fl.rows, y:h + 8, s:ns }); h += 10 + fl.h; }
    else if ((it.note || "").trim()){ const lines = wrapText(it.note, cf, ns, inner); parts.push({ k:"note", lines, y:h + 8, s:ns, l:nl }); h += 10 + lines.length * nl; }
    return { h:h + PAD, parts };
  }
  const wsPages = [];
  for (const sp of proj.spaces){
    const items = proj.items.filter(i => i.space === sp.id), inks = proj.ink.filter(s => s.where === "ws" && s.space === sp.id);
    if (!items.length && !inks.length && !proj.links.some(l => l.at && l.at.space === sp.id) && !(proj.stickers || []).some(x => !x.card && x.space === sp.id)) continue;
    const boxes = new Map(), groups = [];
    for (const it of items) if (!it.group){ const lay = cardLayout(it, it.w); boxes.set(it.id, { it, x:it.x, y:it.y, w:it.w, h:lay.h, lay }); }
    for (const g of proj.groups.filter(g => g.space === sp.id)){
      const mem = items.filter(i => i.group === g.id).sort((a, b) => a.ord - b.ord); if (!mem.length) continue;
      let y = g.y + 34; const w = g.w - 16;
      for (const it of mem){ const lay = cardLayout(it, w); boxes.set(it.id, { it, x:g.x + 8, y, w, h:lay.h, lay }); y += lay.h + 8; }
      groups.push({ g, n:mem.length, x:g.x, y:g.y, w:g.w, h:y - g.y });
    }
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity; const grow = (a, b, c, d) => { x1 = Math.min(x1, a); y1 = Math.min(y1, b); x2 = Math.max(x2, c); y2 = Math.max(y2, d); };
    boxes.forEach(b => grow(b.x, b.y, b.x + b.w, b.y + b.h)); groups.forEach(b => grow(b.x, b.y, b.x + b.w, b.y + b.h));
    for (const st of inks) for (const q of st.pts) grow(q[0] - st.w, q[1] - st.w, q[0] + st.w, q[1] + st.w);
    for (const l of proj.links) if (l.pt && boxes.has(l.a)) grow(l.pt.x - 10, l.pt.y - 10, l.pt.x + 10, l.pt.y + 10);
    for (const l of proj.links) if (l.at && l.at.space === sp.id) grow(l.at.x - 14, l.at.y - 14, l.at.x + 14, l.at.y + 14);
    for (const kx of proj.stickers || []) if (!kx.card && kx.space === sp.id) grow(kx.x - kx.s * 0.75, kx.y - kx.s * 0.75, kx.x + kx.s * 0.75, kx.y + kx.s * 0.75);
    const sh = sp.sheet || { x:x1 - 40, y:y1 - 40, w:x2 - x1 + 80, h:y2 - y1 + 80 };
    let cx1 = Math.max(sh.x, x1 - 36), cy1 = Math.max(sh.y, y1 - 60), cx2 = Math.min(sh.x + sh.w, x2 + 36), cy2 = Math.min(sh.y + sh.h, y2 + 36);
    if (cx2 - cx1 < 595){ const add = 595 - (cx2 - cx1); cx2 = Math.min(sh.x + sh.w, cx2 + add); cx1 = Math.max(sh.x, cx2 - 595); }
    if (cy2 - cy1 < 420){ const add = 420 - (cy2 - cy1); cy2 = Math.min(sh.y + sh.h, cy2 + add); cy1 = Math.max(sh.y, cy2 - 420); }
    const k = Math.min(1, PDF_PAGE_MAX / (cx2 - cx1), PDF_PAGE_MAX / (cy2 - cy1));
    const W = (cx2 - cx1) * k, H = (cy2 - cy1) * k;
    const page = out.addPage([W, H]);
    wsPages.push({ sp, page, boxes, groups, inks, k, cx1, cy1, W, H, sh });
  }

  /* 4. annotations on document pages */
  const outline = [];
  for (const d of proj.docs){ const pg = pagesOf.get(d.fp); if (pg) outline.push({ title:stripPdf(d.name), page:pg[0], top:pg[0].getHeight() }); }
  for (const it of proj.items){
    if ((it.type !== "excerpt" && it.type !== "image") || !hasPage(it.doc, it.page) || !it.rects.length) continue;
    const page = pagesOf.get(it.doc)[it.page - 1], boxes = it.rects.map(r => boxPdf(it.doc, it.page, r));
    const bb = [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))];
    if (it.type === "excerpt"){
      const col = hexRgb(HL_HEX[it.color] || HL_HEX.y);
      const ops = `/G0 gs ${col.map(n2).join(" ")} rg ` + boxes.map(b => `${n2(b[0])} ${n2(b[1])} ${n2(b[2] - b[0])} ${n2(b[3] - b[1])} re`).join(" ") + " f";
      addAnnot(page, { Subtype:"Highlight", Rect:bb, QuadPoints:boxes.flatMap(b => [b[0], b[3], b[2], b[3], b[0], b[1], b[2], b[1]]), C:col, CA:0.45, Contents:txt(it.note || ""), NM:txt(it.id),
        AP:{ N:apForm(bb, ops, { BM:"Multiply", ca:0.45, CA:0.45 }) } });
    } else {
      const col = hexRgb(HL_HEX.b), b = bb;
      addAnnot(page, { Subtype:"Square", Rect:[b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1], C:col, BS:{ W:1.5 }, Contents:txt(it.note || "Görsel alıntı"), NM:txt(it.id),
        AP:{ N:apForm([b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1], `${col.map(n2).join(" ")} RG 1.5 w ${n2(b[0])} ${n2(b[1])} ${n2(b[2] - b[0])} ${n2(b[3] - b[1])} re S`) } });
    }
  }
  for (const c of proj.comments){
    if (!hasPage(c.doc, c.page) || !c.rects.length) continue;
    const page = pagesOf.get(c.doc)[c.page - 1], boxes = c.rects.map(r => boxPdf(c.doc, c.page, r)), col = hexRgb(HL_HEX.o);
    const bb = [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])) - 2, Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))];
    const ops = `${col.map(n2).join(" ")} RG 1.2 w ` + boxes.map(b => `${n2(b[0])} ${n2(b[1] + 0.6)} m ${n2(b[2])} ${n2(b[1] + 0.6)} l S`).join(" ");
    addAnnot(page, { Subtype:"Underline", Rect:bb, QuadPoints:boxes.flatMap(b => [b[0], b[3], b[2], b[3], b[0], b[1], b[2], b[1]]), C:col, Contents:txt(c.text), NM:txt(c.id), AP:{ N:apForm(bb, ops) } });
  }
  for (const st of proj.ink){
    if (st.where !== "pdf" || !hasPage(st.doc, st.page)) continue;
    const page = pagesOf.get(st.doc)[st.page - 1], pts = st.pts.map(q => P(st.doc, st.page, q[0], q[1])), w = st.pr ? st.w * 0.9 : st.w;
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), bb = [Math.min(...xs) - w, Math.min(...ys) - w, Math.max(...xs) + w, Math.max(...ys) + w];
    const col = hexRgb(inkHex(st));
    let path = `${n2(pts[0][0])} ${n2(pts[0][1])} m `; if (pts.length === 1) path += `${n2(pts[0][0] + 0.01)} ${n2(pts[0][1])} l `; for (let i = 1; i < pts.length; i++) path += `${n2(pts[i][0])} ${n2(pts[i][1])} l `;
    let ops = `${st.kind === "hl" ? "/G0 gs " : ""}${col.map(n2).join(" ")} RG ${n2(w)} w 1 J 1 j ${path}S`;
    /* calligraphy: the appearance is the filled nib shape */
    if (st.tip === "callig" && st.pts.length > 1){ const { L, R } = outlineSides(st.pts, st.w, st.pr, true), poly = [...L, ...R.reverse()].map(q => P(st.doc, st.page, q[0], q[1]));
      ops = `${col.map(n2).join(" ")} rg ` + poly.map((q, i) => `${n2(q[0])} ${n2(q[1])} ${i ? "l" : "m"}`).join(" ") + " h f"; }
    addAnnot(page, { Subtype:"Ink", Rect:bb, InkList:[pts.flat()], C:col, BS:{ W:w }, ...(st.kind === "hl" ? { CA:0.42 } : {}), NM:txt(st.id),
      AP:{ N:apForm(bb, ops, st.kind === "hl" ? { BM:"Multiply", CA:0.42, ca:0.42 } : null) } });
  }
  for (const t of proj.texts){
    if (!hasPage(t.doc, t.page) || !t.text.trim()) continue;
    const page = pagesOf.get(t.doc)[t.page - 1], [x, top] = P(t.doc, t.page, t.x, t.y), col = rgb(...hexRgb(isHex(t.color) ? t.color : PEN_HEX[t.color] || PEN_HEX.k));
    const tf = fontFor(t.font); wrapText(t.text, tf, t.size, t.w).forEach((ln, i) => drawTxt(page, ln, { x, y:top - t.size * (i + 1) * 1.22, size:t.size, font:tf, color:col }));
  }
  for (const b of proj.bookmarks){ const pg = hasPage(b.doc, b.page); if (pg) outline.push({ title:`${stripPdf((proj.docs.find(d => d.fp === b.doc) || {}).name || "")} · ${b.title}`, page:pg, top:pg.getHeight() }); }

  /* 5. workspace pages */
  const badge = (page, x, y, n, r = 8) => {
    page.drawCircle({ x, y, size:r, color:ACC, borderColor:WHITE, borderWidth:1.2 });
    const s = String(n), fs = s.length > 2 ? 6.5 : 8; page.drawText(s, { x:x - bold.widthOfTextAtSize(s, fs) / 2, y:y - fs * 0.36, size:fs, font:bold, color:WHITE });
    return [x - r, y - r, x + r, y + r];
  };
  const cardBadge = new Map();
  for (const wp of wsPages){
    const { page, k, cx1, cy1, H, sh, sp } = wp;
    const X = x => (x - cx1) * k, Y = y => H - (y - cy1) * k;
    const svg = (d, opt) => page.drawSvgPath(d, { x:-cx1 * k, y:H + cy1 * k, scale:k, ...opt });
    outline.push({ title:`Masa: ${sp.name}`, page, top:H });
    const paperHex = (paperOf(sp.paper) || { l:"#fdfdfb" }).l;
    page.drawRectangle({ x:0, y:0, width:wp.W, height:H, color:rgb(...hexRgb(paperHex === "#ffffff" ? "#fdfdfb" : paperHex)) });
    /* notebook pattern, aligned to the sheet like in the app */
    const pat = sp.pattern || "dot", gx = (step, from) => { const a = []; for (let v = from + Math.ceil((cx1 - from) / step) * step; v <= cx1 + wp.W / k; v += step) a.push(v); return a; };
    const gy = (step, from) => { const a = []; for (let v = from + Math.ceil((cy1 - from) / step) * step; v <= cy1 + H / k; v += step) a.push(v); return a; };
    const x2p = cx1 + wp.W / k, y2p = cy1 + H / k;
    const lines = (vals, vert, col, w, op) => { if (!vals.length) return; svg(vals.map(v => vert ? `M${v},${cy1} V${y2p}` : `M${cx1},${v} H${x2p}`).join(" "), { borderColor:col, borderWidth:w, borderOpacity:op }); };
    if (pat === "dot"){ const d = []; for (const x of gx(5 * MM, sh.x + 2.5 * MM)) for (const y of gy(5 * MM, sh.y + 2.5 * MM)) d.push(`M${n2(x)},${n2(y)} l0.01,0`); if (d.length) svg(d.join(""), { borderColor:rgb(0, 0, 0), borderWidth:1.6, borderOpacity:0.16, borderLineCap:LineCapStyle.Round }); }
    if (pat === "grid"){ lines(gx(5 * MM, sh.x), true, rgb(0, 0, 0), 0.5, 0.09); lines(gy(5 * MM, sh.y), false, rgb(0, 0, 0), 0.5, 0.09); }
    if (pat === "lined"){ lines(gy(8 * MM, sh.y + 8 * MM), false, rgb(.17, .36, .63), 0.6, 0.22); if (sh.x + 25 * MM >= cx1) lines([sh.x + 25 * MM], true, rgb(.8, .27, .24), 0.9, 0.4); }
    if (pat === "mm"){ lines(gx(MM, sh.x), true, rgb(.18, .42, .37), 0.25, 0.1); lines(gy(MM, sh.y), false, rgb(.18, .42, .37), 0.25, 0.1); lines(gx(10 * MM, sh.x), true, rgb(.18, .42, .37), 0.6, 0.28); lines(gy(10 * MM, sh.y), false, rgb(.18, .42, .37), 0.6, 0.28); }
    page.drawText(safeTxt(sp.name), { x:18, y:H - 26, size:11, font:bold, color:INK });
    page.drawText(safeTxt(proj.name), { x:24 + bold.widthOfTextAtSize(safeTxt(sp.name), 11), y:H - 26, size:9, font, color:INK2 });
    /* groups */
    for (const g of wp.groups){
      const gc = isHex(g.g.c) ? rgb(...hexRgb(g.g.c)) : null, gpp = g.g.bg && paperOf(g.g.bg);
      svg(rr(g.x, g.y, g.w, g.h, 10), { color:gpp ? rgb(...hexRgb(gpp.l)) : gc ? rgb(...hexRgb(mixHex(g.g.c, "#ffffff", 0.86))) : rgb(.945, .945, .93), borderColor:gc || HAIR, borderWidth:gc ? 1.4 : 0.6 });
      page.drawText(safeTxt(g.g.title || "Grup"), { x:X(g.x + 12), y:Y(g.y + 20), size:10 * k, font:bold, color:INK });
      const cnt = `${g.n} kart`; page.drawText(cnt, { x:X(g.x + g.w - 12) - font.widthOfTextAtSize(cnt, 8 * k), y:Y(g.y + 20), size:8 * k, font, color:INK2 });
    }
    /* card to card links (drawn under the cards) */
    for (const l of proj.links){
      if (l.anchor || l.pins) continue; const A = wp.boxes.get(l.a), B = l.pt ? null : wp.boxes.get(l.b); if (!A || (!B && !l.pt)) continue;
      const bx = b => ({ x1:b.x, y1:b.y, x2:b.x + b.w, y2:b.y + b.h, cx:b.x + b.w / 2, cy:b.y + b.h / 2 });
      const col = l.color && LINK_COLORS[l.color] ? rgb(...hexRgb(LINK_COLORS[l.color])) : rgb(.55, .55, .57), hd = linkHeads(l);
      const { d } = linkCurve(bx(A), l.pt ? pointBox(l.pt) : bx(B), l.shape); svg(d, { borderColor:col, borderWidth:l.color ? 1.6 : 1.2, ...(l.dash ? { borderDashArray:[6, 4] } : {}) });
      const m = d.match(/^M([-\d.]+),([-\d.]+) C([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+)$/);
      const head = (ax, ay, ex, ey) => { const ang = Math.atan2(ey - ay, ex - ax) || 0, s = 9, p1 = [ex - s * Math.cos(ang - 0.42), ey - s * Math.sin(ang - 0.42)], p2 = [ex - s * Math.cos(ang + 0.42), ey - s * Math.sin(ang + 0.42)];
        svg(`M${ex},${ey} L${p1[0]},${p1[1]} L${p2[0]},${p2[1]} Z`, { color:col }); };
      if (m){ const v = m.slice(1).map(Number);
        if (hd === "end" || hd === "both") head(v[4], v[5], v[6], v[7]);
        if (hd === "start" || hd === "both") head(v[2], v[3], v[0], v[1]);
        if (l.pt && hd !== "end" && hd !== "both") svg(`M${l.pt.x - 2.5},${l.pt.y} a2.5,2.5 0 1,0 5,0 a2.5,2.5 0 1,0 -5,0`, { color:col }); }
    }
    /* cards */
    for (const b of wp.boxes.values()){
      const { it, x, y, w, h, lay } = b;
      const dotCol = rgb(...hexRgb(isHex(it.cc) ? it.cc : HL_HEX[it.color] || HL_HEX.y)), frame = it.frame || "thin";
      svg(rr(x, y, w, h, 9), { color:rgb(...hexRgb((paperOf(it.bg) || PAPER_COLORS.white).l)) });
      /* coloured header strip and frame, like in the app */
      svg(`M${x},${y + 9} Q${x},${y} ${x + 9},${y} H${x + w - 9} Q${x + w},${y} ${x + w},${y + 9} V${y + PAD + 15} H${x} Z`, { color:dotCol, opacity:0.24 });
      if (frame === "none") svg(rr(x, y, w, h, 9), { borderColor:HAIR, borderWidth:0.7 });
      else svg(rr(x, y, w, h, 9), { borderColor:dotCol, borderWidth:frame === "thick" ? 4.5 : 2.2, borderOpacity:0.8 });
      const label = it.type === "note" ? "NOT" : it.photo ? "FOTOĞRAF" : it.type === "video" ? "VİDEO · " + fmtT(it.dur) : `${it.type === "image" ? "Görsel · " : ""}${proj.docs.length > 1 ? trunc(stripPdf((proj.docs.find(dd => dd.fp === it.doc) || {}).name || ""), 30) + " · " : ""}s. ${it.page}`;
      page.drawText(safeTxt(label), { x:X(x + PAD), y:Y(y + PAD + 7), size:HS * k, font, color:INK2 });
      if (it.doc && !it.photo && it.type !== "video" && hasPage(it.doc, it.page)){
        const tgt = pagesOf.get(it.doc)[it.page - 1], r0 = it.rects[0], top = r0 ? boxPdf(it.doc, it.page, r0)[3] + 40 : tgt.getHeight();
        linkAnnot(page, [X(x + PAD), Y(y + PAD + 12), X(x + PAD) + font.widthOfTextAtSize(safeTxt(label), HS * k), Y(y + PAD - 2)], dest(tgt, 0, Math.min(tgt.getHeight(), top)));
      }
      for (const part of lay.parts){
        if (part.k === "quote"){
          svg(`M${x + PAD + 1},${y + part.y - 2} V${y + part.y + part.lines.length * part.l - 4}`, { borderColor:dotCol, borderWidth:2.2 });
          part.lines.forEach((ln, i) => drawTxt(page, ln, { x:X(x + PAD + 9), y:Y(y + part.y + (i + 1) * part.l - 4), size:part.s * k, font:fontFor(it.font), color:INK }));
        }
        if (part.k === "img"){ const im = imgs.get(it.id); if (im){ const emb = await out.embedPng(im.bytes); page.drawImage(emb, { x:X(x + PAD), y:Y(y + part.y + part.h), width:(w - PAD * 2) * k, height:part.h * k }); } }
        if (part.k === "mnote") for (const row of part.rows) for (const item of row.items){
          if (item.k === "w"){
            let px = x + PAD + item.x; const by = y + part.y + row.base, base = it.type === "note" ? INK : INK2;
            for (const pc of item.pieces){
              const st = pc.st || {}, pf = pieceFont(st, fontFor(it.font)), w = pf.widthOfTextAtSize(pc.s, part.s), col = st.c ? rgb(...hexRgb(st.c)) : base;
              const o = { x:X(px), y:Y(by), size:part.s * k, font:pf, color:col, ...(st.i ? { ySkew:L.degrees(12) } : {}) };
              drawTxt(page, pc.s, o);
              if (st.b && pf !== bold) drawTxt(page, pc.s, { ...o, x:o.x + 0.35 * k }); /* no bold cut of this font: draw twice */
              if (st.u) page.drawLine({ start:{ x:X(px), y:Y(by + part.s * 0.14) }, end:{ x:X(px + w), y:Y(by + part.s * 0.14) }, thickness:Math.max(0.5, part.s * 0.06 * k), color:col });
              px += w;
            }
          }
          else { let e = mathEmb.get(item.key); if (!e){ e = await out.embedPng(mathPng.get(item.key).bytes); mathEmb.set(item.key, e); }
            page.drawImage(e, { x:X(x + PAD + item.x), y:Y(y + part.y + row.base + item.depth), width:item.w * k, height:item.h * k }); }
        }
        if (part.k === "note") part.lines.forEach((ln, i) => drawTxt(page, ln, { x:X(x + PAD), y:Y(y + part.y + (i + 1) * part.l - 3), size:part.s * k, font:fontFor(it.font), color:it.type === "note" ? INK : INK2 }));
      }
      wp.boxes.get(it.id).page = page;
    }
    /* workspace ink */
    for (const st of wp.inks){
      const col = rgb(...hexRgb(inkHex(st)));
      if (st.tip === "callig") svg(outlineD(st.pts, st.w, st.pr, true), { color:col });
      else svg(inkD(st), { borderColor:col, borderWidth:(st.pr ? st.w * 0.9 : st.w), borderOpacity:st.kind === "hl" ? 0.42 : st.tip === "pencil" ? 0.82 : 1, borderLineCap:LineCapStyle.Round });
    }
    /* stickers (v6.9.6): emoji are drawn to a picture first, so the PDF shows them in colour */
    for (const kx of proj.stickers || []){
      let cx, cy;
      if (kx.card){ const b = wp.boxes.get(kx.card); if (!b) continue; cx = b.x + kx.fx * b.w; cy = b.y + kx.y; }
      else if (kx.space === wp.sp.id){ cx = kx.x; cy = kx.y; } else continue;
      try {
        const key = kx.img || "e:" + kx.e; let emb = stkEmb.get(key);
        if (!emb){ const png = kx.img ? (await pngBytesOf(kx.img)).bytes : await emojiPng(kx.e); emb = await out.embedPng(png); stkEmb.set(key, emb); }
        const sz = kx.s * k, ar = emb.height / emb.width, w = kx.img ? (ar > 1 ? sz / ar : sz) : sz, h = kx.img ? w * ar : sz;
        const th = -(kx.r || 0) * Math.PI / 180, PX = X(cx), PY = Y(cy);
        page.drawImage(emb, { x:PX - (w / 2 * Math.cos(th) - h / 2 * Math.sin(th)), y:PY - (w / 2 * Math.sin(th) + h / 2 * Math.cos(th)), width:w, height:h, rotate:L.degrees(-(kx.r || 0)) });
      } catch (e){ console.warn("sticker", e); }
    }
    for (const b of wp.boxes.values()) cardBadge.set(b.it.id, { wp, b, used:0, total:numbered.filter(x => x.card.id === b.it.id).length });
  }

  /* 6. matching numbers on both ends, each a link to the other end */
  for (const x of numbered){
    const cb = cardBadge.get(x.card.id); if (!cb) continue;
    const { wp, b } = cb, { k, cx1, cy1, H } = wp, X = v => (v - cx1) * k, Y = v => H - (v - cy1) * k;
    const bx = X(b.x + b.w - 14 - (cb.total - 1 - cb.used) * 20), by = Y(b.y), dp = pagesOf.get(x.pos.o.doc)[x.pos.o.page - 1];
    const [px, py] = P(x.pos.o.doc, x.pos.o.page, x.pos.x, x.pos.y); cb.used++;
    const r1 = badge(wp.page, bx, by, x.n), r2b = badge(dp, px, py, x.n);
    linkAnnot(wp.page, r1, dest(dp, px - 60, Math.min(dp.getHeight(), py + 80)));
    linkAnnot(dp, r2b, dest(wp.page, bx - 120, Math.min(H, by + 120)));
  }

  /* 6b. document to document links: the same number at both places, each a link to the other */
  let nn = numbered.length;
  for (const L of proj.links){
    if (!L.pins) continue;
    const [A, B] = L.pins.map(id => proj.pins.find(n => n.id === id)); if (!A || !B || !hasPage(A.doc, A.page) || !hasPage(B.doc, B.page)) continue;
    const n = ++nn, pa = pagesOf.get(A.doc)[A.page - 1], pb = pagesOf.get(B.doc)[B.page - 1], [ax, ay] = P(A.doc, A.page, A.x, A.y), [bx, by] = P(B.doc, B.page, B.x, B.y);
    const ra = badge(pa, ax, ay, n), rb2 = badge(pb, bx, by, n);
    linkAnnot(pa, ra, dest(pb, bx - 60, Math.min(pb.getHeight(), by + 80))); linkAnnot(pb, rb2, dest(pa, ax - 60, Math.min(pa.getHeight(), ay + 80)));
  }

  /* 6c. book to workspace point: the same number at both places */
  for (const L of proj.links){
    if (!L.pin) continue;
    const A = proj.pins.find(n => n.id === L.pin), wp = wsPages.find(w => w.sp.id === L.at.space); if (!A || !wp || !hasPage(A.doc, A.page)) continue;
    const n = ++nn, pa = pagesOf.get(A.doc)[A.page - 1], [ax, ay] = P(A.doc, A.page, A.x, A.y), wx = (L.at.x - wp.cx1) * wp.k, wy = wp.H - (L.at.y - wp.cy1) * wp.k;
    const ra = badge(pa, ax, ay, n), rw = badge(wp.page, wx, wy, n);
    linkAnnot(pa, ra, dest(wp.page, wx - 120, Math.min(wp.H, wy + 120))); linkAnnot(wp.page, rw, dest(pa, ax - 60, Math.min(pa.getHeight(), ay + 80)));
  }

  /* 7. outline (bookmarks panel) and metadata */
  if (outline.length){
    const root = ctx.nextRef(), refs = outline.map(() => ctx.nextRef());
    outline.forEach((e, i) => ctx.assign(refs[i], ctx.obj({ Title:txt(e.title), Parent:root, Dest:dest(e.page, 0, e.top), ...(i ? { Prev:refs[i - 1] } : {}), ...(i < refs.length - 1 ? { Next:refs[i + 1] } : {}) })));
    ctx.assign(root, ctx.obj({ Type:"Outlines", First:refs[0], Last:refs[refs.length - 1], Count:refs.length }));
    out.catalog.set(PDFName.of("Outlines"), root); out.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
  }
  out.setTitle(safeTxt(proj.name)); out.setCreator(`${APP_NAME} ${APP_VERSION}`); out.setProducer(`${APP_NAME} ${APP_VERSION}`);
  return { bytes:await out.save(), skipped, wsCount:wsPages.length, links:numbered.length };
}
async function exportPdf(){
  if (!S.proj) return;
  if (!S.sample){ clearTimeout(saveTimer); await saveNow().catch(() => {}); }
  toast("Notlu PDF hazırlanıyor…", null, 20000);
  try {
    const { bytes, skipped } = await buildAnnotatedPdf(S.proj);
    const name = safeName(S.proj.name) + " (notlu).pdf", blob = new Blob([bytes], { type:"application/pdf" });
    const file = new File([blob], name, { type:"application/pdf" });
    if (navigator.canShare && navigator.canShare({ files:[file] }) && matchMedia("(pointer:coarse)").matches){ try { await navigator.share({ files:[file], title:name }); toast("PDF hazır"); return; } catch (e){ if (e && e.name === "AbortError"){ el.toast.hidden = true; return; } } }
    downloadBlob(blob, name);
    toast(skipped.length ? `${name} indirildi. Şu belgeler eklenemedi: ${skipped.join(", ")}` : `${name} indirildi`, null, 5000);
  } catch (e){ console.error(e); toast("PDF oluşturulamadı. Belge şifreli ya da bozuk olabilir.", null, 5000); }
}
$("#mPdf").onclick = () => { closePop(); exportPdf(); };
window.EDNoteBuildPdf = () => buildAnnotatedPdf(S.proj);

/* ================= project state ================= */
const cleanRects = rs => Array.isArray(rs) ? rs.filter(r => r && isFinite(r.x)).map(r => ({ x:+r.x, y:+r.y, w:+r.w, h:+r.h })) : [];
const recOf = o => (typeof o.rec === "string" && isFinite(o.t)) ? { rec:o.rec, t:+o.t } : {};
/* rough content bounds of a space from data alone (used when a file has no sheet yet, i.e. files from v5 and earlier) */
function estCardH(it, w){ const f = it.fs || 1, per = Math.max(8, (w - 24) / (6.6 * f)); const lines = t => String(t || "").split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / per)), 0);
  return 44 + (it.type === "excerpt" ? lines(it.text) * 20 * f : 0) + (it.type === "image" ? w * 0.7 : 0) + (it.note ? lines(it.note) * 19 * f : 22) + 36; }
function dataBounds(q, sid){
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity; const add = (a, b, c, d) => { x1 = Math.min(x1, a); y1 = Math.min(y1, b); x2 = Math.max(x2, c); y2 = Math.max(y2, d); };
  for (const it of q.items) if (it.space === sid && !it.group) add(it.x, it.y, it.x + it.w, it.y + estCardH(it, it.w));
  for (const g of q.groups) if (g.space === sid){ const h = q.items.filter(i => i.group === g.id).reduce((n, i) => n + estCardH(i, g.w - 16) + 10, 44); add(g.x, g.y, g.x + g.w, g.y + h); }
  for (const st of q.ink) if (st.where === "ws" && st.space === sid) for (const pt of st.pts) add(pt[0] - st.w, pt[1] - st.w, pt[0] + st.w, pt[1] + st.w);
  return isFinite(x1) ? { x1, y1, x2, y2 } : null;
}
/* never cut content: a sheet always grows to hold everything already on the space.
   Files without a sheet (v5 and earlier) get one around their content; an existing sheet only grows
   when something really lies outside it, so loading the same file twice never changes it. */
function fitSheetToContent(q, sp){
  const m = 60;
  if (!sp.sheet){
    const b = dataBounds(q, sp.id);
    sp.sheet = { x:b ? Math.min(0, Math.floor(b.x1 - m)) : 0, y:b ? Math.min(0, Math.floor(b.y1 - m)) : 0, w:SHEET_DEF.w, h:SHEET_DEF.h };
    if (b){ sp.sheet.w = Math.ceil(Math.max(sp.sheet.w, b.x2 + m - sp.sheet.x)); sp.sheet.h = Math.ceil(Math.max(sp.sheet.h, b.y2 + m - sp.sheet.y)); }
    return;
  }
  const sh = sp.sheet; let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  const add = (a, b, c, d) => { x1 = Math.min(x1, a); y1 = Math.min(y1, b); x2 = Math.max(x2, c); y2 = Math.max(y2, d); };
  for (const it of q.items) if (it.space === sp.id && !it.group) add(it.x, it.y, it.x + it.w, it.y + 40);
  for (const g of q.groups) if (g.space === sp.id) add(g.x, g.y, g.x + g.w, g.y + 40);
  for (const st of q.ink) if (st.where === "ws" && st.space === sp.id) for (const pt of st.pts) add(pt[0], pt[1], pt[0], pt[1]);
  if (!isFinite(x1)) return;
  if (x1 < sh.x){ sh.w += sh.x - Math.floor(x1 - m); sh.x = Math.floor(x1 - m); }
  if (y1 < sh.y){ sh.h += sh.y - Math.floor(y1 - m); sh.y = Math.floor(y1 - m); }
  if (x2 > sh.x + sh.w) sh.w = Math.ceil(x2 + m - sh.x);
  if (y2 > sh.y + sh.h) sh.h = Math.ceil(y2 + m - sh.y);
}
function linkLook(l){ return { ...(LINK_COLORS[l.color] ? { color:l.color } : {}), ...(HEADS.includes(l.heads) ? { heads:l.heads } : {}), ...(l.dash ? { dash:true } : {}), ...(LINK_SHAPES.includes(l.shape) ? { shape:l.shape } : {}) }; }
function cleanTags(t){ if (!Array.isArray(t)) return {}; const out = [...new Set(t.map(normTag).filter(Boolean))].slice(0, 30); return out.length ? { tags:out } : {}; }
function cleanProject(p){
  const q = emptyProject(p.name);
  q.id = String(p.id || q.id); q.name = String(p.name || "Proje");
  q.docs = (p.docs || []).filter(d => d && d.fp).map(d => ({ fp:String(d.fp), name:String(d.name || "Belge.pdf") }));
  q.spaces = (p.spaces || []).filter(s => s && s.id).map(s => ({ id:String(s.id), name:String(s.name || "Masa"), view: s.view && isFinite(s.view.s) ? { tx:+s.view.tx || 0, ty:+s.view.ty || 0, s:clamp(+s.view.s, 0.1, 2.5) } : { tx:40, ty:60, s:1 },
    sheet: s.sheet && [s.sheet.x, s.sheet.y, s.sheet.w, s.sheet.h].every(isFinite) && s.sheet.w > 0 && s.sheet.h > 0 ? { x:+s.sheet.x, y:+s.sheet.y, w:+s.sheet.w, h:+s.sheet.h } : null,
    ...(DESKS[s.desk] && s.desk !== "plain" ? { desk:s.desk } : {}), ...(s.grain ? { grain:true } : {}),
    pattern: PATTERNS[s.pattern] ? s.pattern : "dot", ...(okPaper(s.paper) ? { paper:s.paper } : {}) }));
  if (!q.spaces.length) q.spaces = emptyProject().spaces;
  const sids = new Set(q.spaces.map(s => s.id)), fps = new Set(q.docs.map(d => d.fp)), s0 = q.spaces[0].id;
  q.groups = (p.groups || []).filter(g => g && g.id).map(g => ({ id:String(g.id), space:sids.has(g.space) ? g.space : s0, x:+g.x || 0, y:+g.y || 0, w:clamp(+g.w || 280, 200, 960), title:String(g.title || ""), collapsed:!!g.collapsed, ...(isHex(g.c) ? { c:g.c.toLowerCase() } : {}), ...(okPaper(g.bg) || g.bg === "white" ? { bg:g.bg } : {}) }));
  const gids = new Set(q.groups.map(g => g.id));
  q.items = (p.items || []).filter(i => i && typeof i.id === "string" && ["excerpt","note","image","video"].includes(i.type) && (i.type !== "image" || /^data:image\/(png|webp|jpeg);base64,/.test(i.src || "")) && (i.type === "note" || i.type === "video" || fps.has(i.doc))).map(i => ({
    id:i.id, type:i.type, text:String(i.text || ""), note:String(i.note || ""), ...(i.type !== "note" && i.type !== "video" ? { doc:i.doc, page:+i.page || 1, rects:cleanRects(i.rects) } : {}), ...(i.type === "image" ? { src:i.src } : {}),
    ...(i.type === "video" ? { vid:String(i.vid || i.id), name:String(i.name || "video.mp4"), mime:String(i.mime || "video/mp4"), size:+i.size || 0, dur:+i.dur || 0, vw:+i.vw || 0, vh:+i.vh || 0, ...(/^data:image\/jpeg;base64,/.test(i.poster || "") ? { poster:i.poster } : {}), ...(i.local ? { local:true } : {}) } : {}),
    space:sids.has(i.space) ? i.space : s0, color:HL_COLORS.includes(i.color) ? i.color : "y", x:+i.x || 0, y:+i.y || 0, w:clamp(+i.w || 240, 170, 900),
    ...(isFinite(i.fs) && +i.fs !== 1 ? { fs:clamp(+i.fs, 0.7, 3) } : {}),
    ...(okPaper(i.bg) ? { bg:i.bg } : {}), ...(isHex(i.cc) ? { cc:i.cc.toLowerCase() } : {}), ...cleanRich(i), ...(FRAMES[i.frame] && i.frame !== "thin" ? { frame:i.frame } : {}), ...(FONT_IDS.has(i.font) ? { font:i.font } : {}),
    ...(gids.has(i.group) ? { group:i.group, ord:+i.ord || 0 } : {}), ...cleanTags(i.tags), ...(i.type === "image" && i.photo ? { photo:true } : {}), ...recOf(i) }));
  const ids = new Set(q.items.map(i => i.id));
  q.ink = (p.ink || []).filter(s => s && Array.isArray(s.pts) && s.pts.length && ((s.where === "pdf" && fps.has(s.doc)) || s.where === "ws")).map(s => ({
    id:String(s.id || uid()), where:s.where, ...(s.where === "pdf" ? { doc:s.doc, page:+s.page || 1 } : { space:sids.has(s.space) ? s.space : s0 }), kind:s.kind === "hl" ? "hl" : "pen",
    color:(s.kind === "hl" ? HL_COLORS : PEN_COLORS).includes(s.color) ? s.color : isHex(s.color) ? s.color.toLowerCase() : (s.kind === "hl" ? "y" : "k"), w:clamp(+s.w || 2, 0.5, 40), pr:!!s.pr, ...(s.sh ? { sh:1 } : {}),
    ...(s.kind !== "hl" && TIPS.includes(s.tip) ? { tip:s.tip } : {}),
    pts:s.pts.filter(v => Array.isArray(v) && isFinite(v[0]) && isFinite(v[1])).map(v => [+v[0], +v[1], +(v[2] ?? 0.5)]), ...recOf(s) }));
  q.texts = (p.texts || []).filter(t => t && typeof t.text === "string" && fps.has(t.doc)).map(t => ({ id:String(t.id || uid()), doc:t.doc, page:+t.page || 1, x:+t.x || 0, y:+t.y || 0, w:clamp(+t.w || 180, 40, 600), text:t.text, color:PEN_COLORS.includes(t.color) ? t.color : isHex(t.color) ? t.color.toLowerCase() : "k", size:clamp(+t.size || 11, 6, 40), ...(FONT_IDS.has(t.font) ? { font:t.font } : {}), ...recOf(t) }));
  q.comments = (p.comments || []).filter(c => c && fps.has(c.doc)).map(c => ({ id:String(c.id || uid()), doc:c.doc, page:+c.page || 1, rects:cleanRects(c.rects), quote:String(c.quote || ""), text:String(c.text || ""), ...recOf(c) }));
  q.pins = (p.pins || []).filter(n => n && fps.has(n.doc) && isFinite(n.x) && isFinite(n.y)).map(n => ({ id:String(n.id || uid()), doc:n.doc, page:+n.page || 1, x:+n.x, y:+n.y, ...recOf(n) }));
  q.bookmarks = (p.bookmarks || []).filter(b => b && fps.has(b.doc)).map(b => ({ id:String(b.id || uid()), doc:b.doc, page:+b.page || 1, title:String(b.title || "Yer imi") }));
  const anchorIds = new Set([...q.ink, ...q.texts, ...q.comments, ...q.pins].map(o => o.id)), pinIds = new Set(q.pins.map(n => n.id));
  const docLinks = (p.links || []).filter(l => l && Array.isArray(l.pins) && l.pins.length === 2 && l.pins.every(id => pinIds.has(id)) && l.pins[0] !== l.pins[1])
    .map(l => ({ id:String(l.id || uid()), pins:[l.pins[0], l.pins[1]], arrow:l.arrow !== false, ...linkLook(l) }));
  q.links = (p.links || []).filter(l => l && !l.pins && ids.has(l.a) && (l.anchor ? anchorIds.has(l.anchor.id) && ["ink","text","comment","pin"].includes(l.anchor.type) : l.pt ? isFinite(l.pt.x) && isFinite(l.pt.y) : ids.has(l.b))).map(l => l.anchor
    ? { id:String(l.id || uid()), a:l.a, anchor:{ type:l.anchor.type, id:l.anchor.id }, ...(l.to === "card" || l.to === "anchor" ? { to:l.to } : {}), ...linkLook(l) }
    : l.pt ? { id:String(l.id || uid()), a:l.a, pt:{ x:+l.pt.x, y:+l.pt.y }, ...linkLook(l) }
    : { id:String(l.id || uid()), a:l.a, b:l.b, ...(l.arrow ? { arrow:true } : {}), ...linkLook(l) });
  q.links.push(...docLinks);
  q.links.push(...(p.links || []).filter(l => l && typeof l.pin === "string" && pinIds.has(l.pin) && l.at && sids.has(l.at.space) && isFinite(l.at.x) && isFinite(l.at.y))
    .map(l => ({ id:String(l.id || uid()), pin:l.pin, at:{ space:l.at.space, x:+l.at.x, y:+l.at.y }, ...linkLook(l) })));
  q.pins = q.pins.filter(n => pinUsed(q.links, n.id));
  q.recs = (p.recs || []).filter(r => r && typeof r.id === "string").map(r => ({ id:r.id, title:String(r.title || "Kayıt"), doc:fps.has(r.doc) ? r.doc : (q.docs[0] && q.docs[0].fp), page:+r.page || 1, startedAt:r.startedAt || new Date().toISOString(), dur:+r.dur || 0, mime:String(r.mime || "audio/webm"), mode:r.mode === "keep" ? "keep" : "trace" }));
  for (const sp of q.spaces) fitSheetToContent(q, sp);
  /* v6.9.6 stickers */
  { const sids2 = new Set(q.spaces.map(x => x.id)), ids2 = new Set(q.items.map(x => x.id)), out = [];
    for (const k of Array.isArray(p.stickers) ? p.stickers : []){
      if (!k || typeof k.id !== "string") continue;
      const look = /^data:image\/(png|webp|jpeg);base64,/.test(k.img || "") ? { img:k.img } : typeof k.e === "string" && k.e.trim() && k.e.length <= 16 ? { e:k.e } : null; if (!look) continue;
      const base = { id:k.id, ...look, s:clamp(+k.s || 64, 16, 400), r:clamp(+k.r || 0, -180, 180) };
      if (ids2.has(k.card)) out.push({ ...base, card:k.card, fx:clamp(+k.fx || 0, -0.5, 1.5), y:+k.y || 0 });
      else if (sids2.has(k.space) && isFinite(k.x) && isFinite(k.y)) out.push({ ...base, space:k.space, x:+k.x, y:+k.y });
    }
    if (out.length) q.stickers = out; }
  if (cleanPath(p.folder)) q.folder = cleanPath(p.folder); if (isFinite(p.trashed) && +p.trashed > 0) q.trashed = +p.trashed;
  /* v6.9.5 library looks: label colour, star, pin, cover, reading progress (older versions ignore them) */
  if (isHex(p.label)) q.label = p.label.toLowerCase(); if (p.star) q.star = true; if (p.pin) q.pin = true;
  if (p.cover && typeof p.cover === "object"){
    if (/^data:image\/(jpeg|png|webp);base64,/.test(p.cover.img || "")) q.cover = { img:p.cover.img };
    else if (q.docs.some(d => d.fp === p.cover.fp) && +p.cover.page >= 1) q.cover = { fp:p.cover.fp, page:Math.floor(+p.cover.page) };
  }
  if (p.read && typeof p.read === "object"){ const rd = {}; for (const d of q.docs){ const x = p.read[d.fp]; if (Array.isArray(x) && +x[1] > 0) rd[d.fp] = [clamp(Math.floor(+x[0] || 0), 0, +x[1]), Math.floor(+x[1])]; } if (Object.keys(rd).length) q.read = rd; }
  const ui = p.ui || {}; q.ui = { space:sids.has(ui.space) ? ui.space : s0, viewers:(ui.viewers || []).filter(f => fps.has(f)), split:!!ui.split && q.docs.length > 0 };
  return q;
}
async function openProject(data, opts = {}){
  if (Rec.active) await stopRecording();
  closePlayer(); closePop(); hideBanner(); toggleSearch(false); textCache.clear(); if (WF.open) closeWsFind(); closeExam();
  const proj = cleanProject(data);
  if (!proj.docs.length){ toast("Projede belge yok."); return; }
  if (!opts.sample) markOpened(proj.id);
  S.proj = proj; S.sample = !!opts.sample; S.space = proj.ui.space; S.sel = null; S.selLink = null; cancelLink();
  el.docTitle.textContent = proj.name; el.docTitle.title = S.sample ? "" : "Adı değiştirmek için tıkla"; document.title = proj.name + " · " + APP_NAME;
  setView("editor"); setTab("pdf");
  initViewers(); S.av = 0;
  const split = proj.ui.split && !isNarrow();
  el.pdfArea.classList.toggle("dual", split); S.viewers[1].root.hidden = !split; markActive();
  renderSpaces(); renderWs(); resetHistory();
  await showDoc(S.viewers[0], proj.ui.viewers[0] || proj.docs[0].fp);
  if (split) await showDoc(S.viewers[1], proj.ui.viewers[1] || (proj.docs[1] || proj.docs[0]).fp);
  renderWs(); resetHistory();
  S.needFit = isNarrow() && spaceItems().length > 0;
  if (!isNarrow() && (opts.sample || opts.fit)) requestAnimationFrame(fitAll);
  if (S.sample) setSaveState("Örnek proje, kaydedilmez"); else { save(); ls.set("alinti:last", proj.id); }
  await restoreFolder();
}
async function openPdfFile(file, mode){
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { fp } = await ingestPdf(bytes, file.name);
    if (mode === "add" && S.proj && !S.sample){
      const isNew = !S.proj.docs.some(d => d.fp === fp);
      if (isNew) S.proj.docs.push({ fp, name:file.name });
      renderTabs(); await showDoc(AV(), fp); commit();
      toast(isNew ? `"${stripPdf(file.name)}" projeye eklendi. Yan yana görmek için ⧉ düğmesine bas.` : "Bu belge zaten projede", null, 4500);
      return;
    }
    const all = await DB.all("projects").catch(() => []);
    const hit = all.sort((a, b) => b.updated - a.updated).find(r => (r.data.docs || []).some(d => d.fp === fp));
    if (hit){ await openProject(hit.data); const v = S.viewers[0]; if (v.fp !== fp) await showDoc(v, fp); toast(`"${hit.name}" projesinde açıldı`); return; }
    const p = emptyProject(stripPdf(file.name)); p.docs = [{ fp, name:file.name }]; p.ui = { space:p.spaces[0].id, viewers:[fp], split:false }; if (LIB.view === "proj" && LIB.path) p.folder = LIB.path;
    await openProject(p);
  } catch (e){ console.error(e); toast("Bu PDF açılamadı. Dosya bozuk ya da şifreli olabilir.", null, 5000); }
}

/* several PDFs at once: they all go into one project and meet on the same workspace */
async function openPdfFiles(files, mode){
  const docs = [];
  for (const f of files){
    try { const { fp } = await ingestPdf(new Uint8Array(await f.arrayBuffer()), f.name); if (!docs.some(d => d.fp === fp)) docs.push({ fp, name:f.name }); }
    catch (e){ console.error(e); toast(`"${f.name}" açılamadı. Dosya bozuk ya da şifreli olabilir.`, null, 4500); }
  }
  if (!docs.length) return;
  if (mode === "add" && S.proj && !S.sample){
    let added = 0; for (const d of docs) if (!S.proj.docs.some(x => x.fp === d.fp)){ S.proj.docs.push(d); added++; }
    renderTabs(); await showDoc(AV(), docs[0].fp); commit(); toast(`${added} belge projeye eklendi`); return;
  }
  const p = emptyProject(stripPdf(docs[0].name) + (docs.length > 1 ? ` ve ${docs.length - 1} belge daha` : ""));
  p.docs = docs; p.ui = { space:p.spaces[0].id, viewers:docs.slice(0, 2).map(d => d.fp), split:docs.length > 1 && !isNarrow() }; if (LIB.view === "proj" && LIB.path) p.folder = LIB.path;
  await openProject(p); toast(`${docs.length} belge tek projede açıldı. Alıntıların hepsi aynı masada buluşur.`, null, 5000);
}

/* ================= home ================= */
async function migrateOld(){
  try {
    const projs = await DB.all("projects"); if (projs.length) return;
    const old = await DB.all("docs"); if (!old.length) return;
    for (const d of old){ const p = migrateV3(d.data || {}, d.fp, d.name); p.name = stripPdf(d.name); await DB.put("projects", { id:p.id, name:p.name, updated:d.updated || Date.now(), data:p }); }
  } catch (e){ console.warn("migration", e); }
}
/* ================= library (home): folders, recent, trash ================= */
const LIB = { view:"proj", path:"", q:"", sort:ls.get("ednote:libSort") || "opened", list:ls.get("ednote:libView") === "list", recs:[] };
const TRASH_DAYS = 30;
const cleanPath = p => String(p || "").split("/").map(x => x.replace(/[\\:*?"<>|]+/g, "").trim().slice(0, 60)).filter(Boolean).slice(0, 6).join("/");
const parentOf = p => p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
const baseOf = p => p.slice(p.lastIndexOf("/") + 1);
const openedMap = () => { try { return JSON.parse(ls.get("ednote:opened") || "{}"); } catch { return {}; } };
function markOpened(id){ const m = openedMap(); m[id] = Date.now(); ls.set("ednote:opened", JSON.stringify(m)); }
/* ---- library state kept on this device and shared through OneDrive (library.json):
   folders (also empty ones), each folder's look, and the app's look. Every entry has a time stamp t; the newer one wins.
   A removed folder stays as { del:true, t } so the removal reaches the other devices too. ---- */
const LIBS_KEY = "ednote:lib";
function libState(){
  let st = null; try { st = JSON.parse(ls.get(LIBS_KEY) || "null"); } catch {}
  if (!st || typeof st !== "object"){ /* first run of v6.9.5: take over the old list of empty folders */
    st = { v:1, folders:{}, looks:{}, app:{} };
    try { for (const f of JSON.parse(ls.get("ednote:folders") || "[]")){ const c = cleanPath(f); if (c) st.folders[c] = { t:1 }; } } catch {}
    ls.set(LIBS_KEY, JSON.stringify(st));
  }
  st.folders = st.folders || {}; st.looks = st.looks || {}; st.app = st.app || {}; st.styles = st.styles || {}; st.pens = st.pens || {};
  return st;
}
function libSave(st, quiet){ ls.set(LIBS_KEY, JSON.stringify(st)); if (!quiet) try { OD.soon(4000); } catch {} }
const savedFolders = () => Object.entries(libState().folders).filter(([, v]) => !v.del).map(([k]) => cleanPath(k)).filter(Boolean);
function saveFolders(a){
  const st = libState(), want = new Set(a.map(cleanPath).filter(Boolean)), now = Date.now();
  for (const f of want) if (!st.folders[f] || st.folders[f].del) st.folders[f] = { t:now };
  for (const [f, v] of Object.entries(st.folders)) if (!v.del && !want.has(f)) st.folders[f] = { del:true, t:now };
  libSave(st);
}
/* merge two library states: for every folder, look and the app look, the newer entry wins */
function mergeLib(a, b){
  const out = { v:1, folders:{}, looks:{}, styles:{}, pens:{}, reads:{}, app:{} };
  for (const k of ["folders", "looks", "styles", "pens", "reads"]){ const A = (a && a[k]) || {}, B = (b && b[k]) || {};
    for (const key of new Set([...Object.keys(A), ...Object.keys(B)])){ const x = A[key], y = B[key]; out[k][key] = !x ? y : !y ? x : (+y.t || 0) > (+x.t || 0) ? y : x; } }
  const x = (a && a.app) || {}, y = (b && b.app) || {}; out.app = (+y.t || 0) > (+x.t || 0) ? y : x;
  return out;
}
const libKey = st => JSON.stringify(st, (k, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([p], [q]) => p < q ? -1 : p > q ? 1 : 0)) : v);
const folderLook = path => { const l = libState().looks[path]; return l && !l.del ? l : {}; };
function setFolderLook(path, look){ const st = libState(); st.looks[path] = { ...look, t:Date.now() }; libSave(st); }
function moveFolderLooks(from, to){
  const st = libState(), now = Date.now();
  for (const [k, v] of Object.entries(st.looks)){
    if (v.del || !(k === from || k.startsWith(from + "/"))) continue;
    const nk = to ? to + k.slice(from.length) : null; if (nk) st.looks[nk] = { ...v, t:now }; st.looks[k] = { del:true, t:now };
  }
  libSave(st);
}
function allFolders(recs){
  const set = new Set(savedFolders());
  for (const r of recs){ let f = cleanPath(r.data && r.data.folder); while (f){ set.add(f); f = parentOf(f); } }
  for (const f of [...set]){ let p = parentOf(f); while (p){ set.add(p); p = parentOf(p); } }
  return [...set].sort((a, b) => a.localeCompare(b, "tr"));
}
const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? "az önce" : s < 3600 ? Math.round(s / 60) + " dk önce" : s < 86400 ? Math.round(s / 3600) + " saat önce" : s < 7 * 86400 ? Math.round(s / 86400) + " gün önce" : fmtDate(t); };
async function updateRec(id, fn){
  const r = await DB.get("projects", id).catch(() => null); if (!r || !r.data) return;
  fn(r.data); r.name = r.data.name || r.name; r.updated = Date.now(); await DB.put("projects", r); OD.soon(3000);
}
/* first page of the first document as a small picture, made once and kept */
const thumbQ = []; let thumbBusy = false;
async function pumpThumbs(){
  if (thumbBusy) return; thumbBusy = true;
  while (thumbQ.length){
    const { fp, img, page:pn = 1 } = thumbQ.shift(), key = "thumb:" + fp + (pn > 1 ? ":" + pn : "");
    try {
      let t = await DB.get("meta", key).catch(() => null);
      if (!t){
        const rec = await DB.get("pdfs", fp).catch(() => null); if (!rec) continue;
        const pdf = await pdfjsLib.getDocument({ data:rec.bytes.slice ? rec.bytes.slice() : new Uint8Array(rec.bytes), isEvalSupported:false }).promise;
        const page = await pdf.getPage(clamp(pn, 1, pdf.numPages)), vp1 = page.getViewport({ scale:1 }), vp = page.getViewport({ scale:260 / vp1.width });
        const c = document.createElement("canvas"); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
        const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext:x, viewport:vp }).promise; pdf.destroy();
        t = { k:key, src:c.toDataURL("image/jpeg", 0.7) }; await DB.put("meta", t);
      }
      img.src = t.src;
    } catch (e){ console.warn("thumb", e); }
  }
  thumbBusy = false;
}
/* ---- covers: a chosen page, an own photo, or the first page ---- */
function coverOf(r){ const d = (r && r.data) || {}; return !!((d.cover && d.cover.img) || (d.docs && d.docs[0] && d.docs[0].fp)); }
function queueCover(r, img){
  const d = r.data || {}, c = d.cover;
  img.addEventListener("load", () => { const rc = img.closest(".rc"); if (rc) rc.classList.add("has-thumb"); }, { once:true });
  if (c && c.img){ img.src = c.img; return; }
  const docs = d.docs || []; if (!docs.length) return;
  const fp = c && docs.some(x => x.fp === c.fp) ? c.fp : docs[0].fp;
  thumbQ.push({ fp, page:c && c.fp === fp ? +c.page || 1 : 1, img });
}
const pinFirst = (a, b) => (b.data.pin ? 1 : 0) - (a.data.pin ? 1 : 0);
function sortedIn(path){
  const op = openedMap();
  return (LIB.recs || []).filter(r => !r.data.trashed && (cleanPath(r.data.folder) === path || cleanPath(r.data.folder).startsWith(path + "/")))
    .sort((a, b) => pinFirst(a, b) || (op[b.id] || b.updated) - (op[a.id] || a.updated));
}
/* reading progress: furthest page reached in each document */
function progressOf(d){
  let got = 0, all = 0;
  for (const x of d.docs || []){ const r = d.read && d.read[x.fp]; if (r && r[1] > 0){ got += Math.min(r[0], r[1]); all += r[1]; } }
  return all ? got / all : 0;
}
/* ---- folder art: soft filled folder (no outline), any colour, a sticker on it or instead of it, a peek of the first project ---- */
const FOLDER_DEF = "#7fa89c";
const STICKERS = [
  ["Ders", "📚 📖 📝 ✏️ 🖊️ 📒 📓 🎓 🧮 📐 📏 🗂️ 🗃️ 📎 🖇️ 🔖"],
  ["Bilim ve mühendislik", "🔬 🧪 ⚗️ 🧬 ⚙️ 🔧 🛠️ 🔩 🧲 ⚛️ 🔭 📡 💻 🖥️ 📊 📈"],
  ["İşaretler", "⭐ 🌟 ❤️ 🔥 ✅ ❗ ❓ 💡 📌 🏷️ 🎯 🚀 🏆 💎 ⚡ 🔒"],
  ["Doğa", "🌱 🌿 🍀 🌸 🌻 🌲 🌊 ☀️ 🌙 ❄️ 🌈 🍁 🐢 🦉 🐝 🦋"],
  ["Diğer", "✈️ 🚲 🚗 🏛️ 🎨 🎵 🎬 📷 ☕ 🍕 🧳 🗺️ 🏠 💼 🧠 👋"]
];
function folderArt(look, peekImg){
  const wrap = document.createElement("span"); wrap.className = "fold-art";
  if (isHex(look.c)) wrap.style.setProperty("--fc", look.c); /* no colour chosen: follows the accent colour (CSS) */
  const sticker = look.img || look.st;
  if (look.pos === "full" && sticker){
    /* the folder is replaced by the picture or the sticker; a small folder mark says it is still a folder */
    wrap.classList.add("full");
    if (look.img){ const im = document.createElement("img"); im.className = "fold-full-img"; im.alt = ""; im.src = look.img; wrap.appendChild(im); }
    else { const e = document.createElement("span"); e.className = "fold-full-emo"; e.textContent = look.st; wrap.appendChild(e); }
    const mark = document.createElement("span"); mark.className = "fold-mark"; mark.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h4l2 2h7A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></svg>'; wrap.appendChild(mark);
    return wrap;
  }
  wrap.insertAdjacentHTML("beforeend", '<svg class="fold-back" viewBox="0 0 100 80" aria-hidden="true"><path d="M5 13a6 6 0 0 1 6-6h21.5c1.9 0 3.6.9 4.8 2.3L42 15h47a6 6 0 0 1 6 6v46a6 6 0 0 1-6 6H11a6 6 0 0 1-6-6z"/></svg>');
  const paper = document.createElement("span"); paper.className = "fold-paper"; wrap.appendChild(paper);
  if (peekImg && look.peek !== false){ peekImg.className = "fold-peek"; peekImg.alt = ""; wrap.appendChild(peekImg); }
  wrap.insertAdjacentHTML("beforeend", '<svg class="fold-front" viewBox="0 0 100 80" aria-hidden="true"><path d="M3 30a6 6 0 0 1 6-6h82a6 6 0 0 1 6 6v37a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6z"/><path class="fold-shine" d="M9 26.5h82"/></svg>');
  if (sticker){
    const st = document.createElement("span"); st.className = "fold-st " + (look.pos === "center" ? "center" : "corner");
    if (look.img){ const im = document.createElement("img"); im.alt = ""; im.src = look.img; st.appendChild(im); } else st.textContent = look.st;
    wrap.appendChild(st);
  }
  return wrap;
}
/* ================= the app's own look: accent colour, interface font, density (v6.9.5) ================= */
const SYS_F = '-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI Variable Text","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
const ACCENTS = [["#2f6b5e","Yosun"],["#2b5cab","Gece mavisi"],["#1f7a8c","Petrol"],["#6a4bb5","Mor"],["#b8467e","Gül"],["#9b2f45","Bordo"],["#c0612b","Kiremit"],["#8a6d1f","Hardal"],["#3f7d3a","Orman"],["#4a4a50","Grafit"]];
const ACC_DEF = "#2f6b5e";
const appLook = () => { const a = libState().app || {}; return { accent:isHex(a.accent) ? a.accent.toLowerCase() : "", font:FONT_IDS.has(a.font) ? a.font : "", density:a.density === "compact" ? "compact" : "" }; };
function setAppLook(patch){ const st = libState(); const a = { ...appLook(), ...patch }; for (const k of Object.keys(a)) if (!a[k]) delete a[k]; st.app = { ...a, t:Date.now() }; libSave(st); applyAppLook(); }
function applyAppLook(){
  const a = appLook(); let css = "";
  if (a.accent){
    const P = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const light = a.accent, dark = mixHex(a.accent, "#ffffff", 0.42), L = P(light), D = P(dark);
    const vars = (c, rgb, ink) => `--accent:${c};--accent-ink:${ink};--accent-soft:rgba(${rgb},.12);--sel:rgba(${rgb},.3)`;
    const lv = vars(light, L.join(","), lum(L) > 0.6 ? "#111111" : "#ffffff"), dv = vars(dark, D.join(","), "#0c0c0e");
    css += `:root{${lv}}:root[data-theme="sepia"]{${lv}}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]):not([data-theme="sepia"]){${dv}}}:root[data-theme="dark"]{${dv}}`;
  }
  if (a.font) css += `:root{--f:'edf-${a.font}',${SYS_F};--f-d:'edf-${a.font}',${SYS_F}}`;
  let tag = document.getElementById("userLook"); if (!tag){ tag = document.createElement("style"); tag.id = "userLook"; document.head.appendChild(tag); }
  tag.textContent = css;
  if (a.density) document.body.dataset.density = a.density; else delete document.body.dataset.density;
}
const appPop = document.createElement("div"); appPop.className = "pop app-pop"; appPop.hidden = true; appPop.setAttribute("role", "dialog"); appPop.setAttribute("aria-label", "Görünüm"); document.body.appendChild(appPop);
function openAppLook(anchor){
  const a = appLook(), re = () => openAppLook(anchor);
  appPop.innerHTML = "";
  const h = document.createElement("div"); h.className = "sh-h"; h.textContent = "Görünüm"; appPop.appendChild(h);
  const sec = t => { const l = document.createElement("div"); l.className = "sh-l"; l.textContent = t; appPop.appendChild(l); const r = document.createElement("div"); r.className = "st-row"; appPop.appendChild(r); return r; };
  const r1 = sec("Vurgu rengi"), cur = a.accent || ACC_DEF;
  for (const [c, n] of ACCENTS){ const b = document.createElement("button"); b.className = "pal-sw acc-sw"; b.style.setProperty("--sw", c); b.title = n; b.setAttribute("aria-label", n); b.setAttribute("aria-pressed", String(cur === c)); b.onclick = () => { setAppLook({ accent:c === ACC_DEF ? "" : c }); re(); }; r1.appendChild(b); }
  const more = document.createElement("button"); more.className = "pal-sw acc-sw pal-more"; more.title = "Başka renk"; more.setAttribute("aria-label", "Başka renk"); more.textContent = "+";
  if (!ACCENTS.some(([c]) => c === cur)){ more.style.setProperty("--sw", cur); more.textContent = ""; more.setAttribute("aria-pressed", "true"); }
  more.onclick = () => openPalette(more, { title:"Vurgu rengi", named:[{ k:ACC_DEF, hex:ACC_DEF, name:"Yosun (varsayılan)" }], more:ACCENT_MORE.filter(c => c !== "#1d1d1f"), current:cur, back:re, onPick:v => { setAppLook({ accent:v === ACC_DEF ? "" : v }); re(); } });
  r1.appendChild(more);
  const r2 = sec("Tema"); const sg = document.createElement("span"); sg.className = "seg3"; r2.appendChild(sg);
  for (const [m, n] of [["", "Sistem"], ["night", "Koyu"], ["sepia", "Sepya"]]){ const b = document.createElement("button"); b.textContent = n; b.setAttribute("aria-pressed", String((S.readMode || "") === m)); b.onclick = () => { setReadMode(m); re(); }; sg.appendChild(b); }
  const r3 = sec("Arayüz yazı tipi"); const fb = document.createElement("button"); fb.className = "font-pick"; fb.innerHTML = ICON.font; const fn = document.createElement("span"); fn.textContent = a.font ? fontName(a.font) : "Sistem"; if (a.font) fn.style.fontFamily = fontCss(a.font); fb.appendChild(fn);
  fb.onclick = () => openFontPop(fb, a.font, id => { setAppLook({ font:id || "" }); re(); }); r3.appendChild(fb);
  const r4 = sec("Yoğunluk"); const sd = document.createElement("span"); sd.className = "seg3"; r4.appendChild(sd);
  for (const [k, n] of [["", "Ferah"], ["compact", "Sıkı"]]){ const b = document.createElement("button"); b.textContent = n; b.setAttribute("aria-pressed", String(a.density === k)); b.onclick = () => { setAppLook({ density:k }); re(); }; sd.appendChild(b); }
  const note = document.createElement("p"); note.className = "sh-note"; note.textContent = "Renk ve yazı tipi OneDrive'a bağlı diğer cihazlarına da gelir."; appPop.appendChild(note);
  openPop(appPop, document.contains(anchor) ? anchor : document.body);
}
/* ---- pictures chosen by the user are made small before they are stored (they travel with OneDrive too) ---- */
function pickImageFile(){
  return new Promise(res => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = () => res(inp.files[0] || null); inp.click(); });
}
async function shrinkImage(file, max, alpha){
  const url = URL.createObjectURL(file);
  try {
    const im = new Image(); im.src = url; await im.decode();
    const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
    const x = c.getContext("2d"); if (!alpha){ x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); } x.drawImage(im, 0, 0, c.width, c.height);
    let out = c.toDataURL(alpha ? "image/webp" : "image/jpeg", 0.85);
    if (alpha && !out.startsWith("data:image/webp")) out = c.toDataURL("image/png"); /* keeps the see-through parts of a sticker */
    return out;
  } finally { URL.revokeObjectURL(url); }
}

/* ---- folder look window ---- */
const lookPop = document.createElement("div"); lookPop.className = "pop look-pop"; lookPop.hidden = true; lookPop.setAttribute("role", "dialog"); lookPop.setAttribute("aria-label", "Klasör görünümü"); document.body.appendChild(lookPop);
const FOLDER_QUICK = ["#7fa89c","#6f9fd8","#9a86d6","#e08aa8","#e6a25a","#e3c45a","#78b67a","#9aa3ad","#3d4a5c"];
function openFolderLook(path, anchor, tab){
  const look = { ...folderLook(path) }; delete look.t;
  const set = patch => { const n = { ...look, ...patch }; for (const k of Object.keys(n)) if (n[k] === undefined || n[k] === null || n[k] === "") delete n[k]; setFolderLook(path, n); renderHome(); openFolderLook(path, anchor, curTab); };
  let curTab = tab || 0;
  lookPop.innerHTML = "";
  const h = document.createElement("div"); h.className = "sh-h"; h.textContent = baseOf(path); lookPop.appendChild(h);
  /* preview */
  const pv = document.createElement("div"); pv.className = "look-prev"; const first = sortedIn(path)[0], peek = first && coverOf(first) ? document.createElement("img") : null;
  pv.appendChild(folderArt(look, peek)); if (peek) queueCover(first, peek); lookPop.appendChild(pv); pumpThumbs();
  const sec = t => { const l = document.createElement("div"); l.className = "sh-l"; l.textContent = t; lookPop.appendChild(l); const r = document.createElement("div"); r.className = "st-row"; lookPop.appendChild(r); return r; };
  /* colour */
  const rc = sec("Renk");
  { const b = document.createElement("button"); b.className = "pal-sw sm fold-def-sw"; b.title = "Vurgu rengine uysun"; b.setAttribute("aria-label", b.title); b.setAttribute("aria-pressed", String(!look.c)); b.onclick = () => set({ c:undefined }); rc.appendChild(b); }
  for (const c of FOLDER_QUICK.slice(1)){ const b = document.createElement("button"); b.className = "pal-sw sm"; b.style.setProperty("--sw", c); b.title = c.toUpperCase(); b.setAttribute("aria-label", "Renk " + c); b.setAttribute("aria-pressed", String(look.c === c)); b.onclick = () => set({ c }); rc.appendChild(b); }
  const more = document.createElement("button"); more.className = "pal-sw sm pal-more"; more.textContent = "+"; more.title = "Başka renk"; more.setAttribute("aria-label", "Başka renk");
  if (look.c && !FOLDER_QUICK.slice(1).includes(look.c)){ more.style.setProperty("--sw", look.c); more.setAttribute("aria-pressed", "true"); more.textContent = ""; }
  more.onclick = () => openPalette(more, { title:"Klasör rengi", named:[], more:[...FOLDER_QUICK.slice(1), ...ACCENT_MORE], current:look.c || "",
    back:() => openFolderLook(path, anchor, curTab), onPick:v => set({ c:v }) });
  rc.appendChild(more);
  /* sticker */
  { const l = document.createElement("div"); l.className = "sh-l"; l.textContent = "Çıkartma"; lookPop.appendChild(l); }
  const tabs = document.createElement("div"); tabs.className = "look-tabs"; lookPop.appendChild(tabs);
  const grid = document.createElement("div"); grid.className = "look-emo"; lookPop.appendChild(grid);
  const fill = i => {
    curTab = i; tabs.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-pressed", String(i === j))); grid.innerHTML = "";
    for (const e of STICKERS[i][1].split(" ")){ const b = document.createElement("button"); b.textContent = e; b.setAttribute("aria-label", e); b.setAttribute("aria-pressed", String(!look.img && look.st === e)); b.onclick = () => set({ st:e, img:undefined, pos:look.pos || "corner" }); grid.appendChild(b); }
  };
  STICKERS.forEach(([name], i) => { const b = document.createElement("button"); b.textContent = name; b.onclick = () => fill(i); tabs.appendChild(b); });
  fill(curTab);
  const own = document.createElement("div"); own.className = "look-own";
  const inp = document.createElement("input"); inp.type = "text"; inp.placeholder = "Kendi emojin"; inp.maxLength = 8; inp.setAttribute("aria-label", "Kendi emojin");
  inp.onkeydown = e => { if (e.key === "Enter" && inp.value.trim()) set({ st:[...inp.value.trim()].slice(0, 3).join(""), img:undefined, pos:look.pos || "corner" }); };
  const ok = document.createElement("button"); ok.className = "btn sm"; ok.textContent = "Ekle"; ok.onclick = () => { if (inp.value.trim()) set({ st:[...inp.value.trim()].slice(0, 3).join(""), img:undefined, pos:look.pos || "corner" }); };
  const up = document.createElement("button"); up.className = "btn sm"; up.textContent = "Görsel yükle";
  up.onclick = async () => { const f = await pickImageFile(); if (!f) return; try { set({ img:await shrinkImage(f, 420, true), st:undefined, pos:look.pos || "full" }); } catch { toast("Bu görsel açılamadı."); } };
  own.append(inp, ok, up);
  if (look.st || look.img){ const rm = document.createElement("button"); rm.className = "btn sm"; rm.textContent = "Kaldır"; rm.onclick = () => set({ st:undefined, img:undefined, pos:undefined }); own.appendChild(rm); }
  lookPop.appendChild(own);
  /* where the sticker sits */
  if (look.st || look.img){
    const rp = sec("Yerleşim"); const seg = document.createElement("span"); seg.className = "seg3"; rp.appendChild(seg);
    for (const [k, n] of [["corner", "Köşede"], ["center", "Ortada"], ["full", "Klasörün yerine"]]){ const b = document.createElement("button"); b.textContent = n; b.setAttribute("aria-pressed", String((look.pos || "corner") === k)); b.onclick = () => set({ pos:k }); seg.appendChild(b); }
  }
  /* peek of the first project */
  if (look.pos !== "full" || !(look.st || look.img)){
    const rk = sec(""); rk.previousSibling.remove();
    const lab = document.createElement("label"); lab.className = "look-chk"; const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = look.peek !== false;
    cb.onchange = () => set({ peek:cb.checked ? undefined : false }); lab.append(cb, document.createTextNode(" İçindeki projenin kapağı görünsün")); rk.appendChild(lab);
  }
  const rs = document.createElement("button"); rs.className = "link look-reset"; rs.textContent = "Varsayılana dön"; rs.onclick = () => { setFolderLook(path, {}); renderHome(); openFolderLook(path, anchor, curTab); };
  lookPop.appendChild(rs);
  openPop(lookPop, document.contains(anchor) ? anchor : $("#recent"));
}

/* ---- cover picker for a project: any page of its documents, or an own photo ---- */
const coverPop = document.createElement("div"); coverPop.className = "pop cover-pop"; coverPop.hidden = true; coverPop.setAttribute("role", "dialog"); coverPop.setAttribute("aria-label", "Kapak seç"); document.body.appendChild(coverPop);
let coverGen = 0;
async function openCoverPick(r, anchor, docIdx = 0, upto = 24){
  const d = r.data, docs = d.docs || [], gen = ++coverGen;
  coverPop.innerHTML = "";
  const h = document.createElement("div"); h.className = "sh-h"; h.textContent = "Kapak"; coverPop.appendChild(h);
  const top = document.createElement("div"); top.className = "cover-top";
  const def = document.createElement("button"); def.className = "btn sm"; def.textContent = "İlk sayfa"; def.onclick = async () => { closePop(); await updateRec(r.id, x => { delete x.cover; }); renderHome(); };
  const ph = document.createElement("button"); ph.className = "btn sm"; ph.textContent = "Fotoğraf yükle";
  ph.onclick = async () => { const f = await pickImageFile(); if (!f) return; try { const img = await shrinkImage(f, 520, false); closePop(); await updateRec(r.id, x => { x.cover = { img }; }); renderHome(); } catch { toast("Bu görsel açılamadı."); } };
  top.append(def, ph);
  if (docs.length > 1){ const sel = document.createElement("select"); sel.className = "cover-doc"; docs.forEach((x, i) => { const o = document.createElement("option"); o.value = i; o.textContent = stripPdf(x.name); sel.appendChild(o); }); sel.value = docIdx; sel.onchange = () => openCoverPick(r, anchor, +sel.value); top.appendChild(sel); }
  coverPop.appendChild(top);
  const grid = document.createElement("div"); grid.className = "cover-grid"; coverPop.appendChild(grid);
  openPop(coverPop, document.contains(anchor) ? anchor : $("#recent"));
  const doc = docs[docIdx]; if (!doc) return;
  const rec = await DB.get("pdfs", doc.fp).catch(() => null); if (!rec){ grid.textContent = "Bu belge bu cihazda yok."; return; }
  const pdf = await pdfjsLib.getDocument({ data:rec.bytes.slice ? rec.bytes.slice() : new Uint8Array(rec.bytes), isEvalSupported:false }).promise;
  const n = Math.min(pdf.numPages, upto), cur = d.cover && d.cover.fp === doc.fp ? +d.cover.page || 1 : !d.cover && docIdx === 0 ? 1 : 0;
  const cells = [];
  for (let i = 1; i <= n; i++){ const b = document.createElement("button"); b.className = "cover-cell"; b.setAttribute("aria-pressed", String(i === cur)); b.title = "Sayfa " + i;
    const c = document.createElement("canvas"); const lab = document.createElement("span"); lab.textContent = i; b.append(c, lab);
    b.onclick = async () => { closePop(); await updateRec(r.id, x => { if (docIdx === 0 && i === 1) delete x.cover; else x.cover = { fp:doc.fp, page:i }; }); renderHome(); };
    grid.appendChild(b); cells.push(c); }
  if (pdf.numPages > n){ const m = document.createElement("button"); m.className = "btn sm cover-more"; m.textContent = `Daha fazla sayfa (${pdf.numPages - n})`; m.onclick = () => { pdf.destroy(); openCoverPick(r, anchor, docIdx, upto + 48); }; coverPop.appendChild(m); }
  for (let i = 0; i < cells.length; i++){
    if (gen !== coverGen || coverPop.hidden) break;
    try { const pg = await pdf.getPage(i + 1), v1 = pg.getViewport({ scale:1 }), vp = pg.getViewport({ scale:120 / v1.width }), c = cells[i];
      c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height); const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext:x, viewport:vp }).promise; } catch {}
  }
  if (gen === coverGen) try { pdf.destroy(); } catch {}
}
function libMenu(anchor, items){
  const m = $("#libMenu"); m.innerHTML = "";
  for (const it of items){
    if (it === "-"){ const s = document.createElement("div"); s.className = "menu-sep"; m.appendChild(s); continue; }
    const b = document.createElement("button"); b.className = "menu-item" + (it.danger ? " danger" : ""); b.textContent = it.label; b.onclick = () => { closePop(); it.fn(); }; m.appendChild(b);
  }
  openPop(m, anchor);
}
function askText(title, value, ok){
  const v = prompt(title, value || ""); if (v === null) return; const t = v.trim(); if (t) ok(t);
}
function moveMenu(anchor, rec){
  const folders = allFolders(LIB.recs), cur = cleanPath(rec.data.folder);
  const items = [{ label:(cur ? "" : "✓ ") + "Projelerim (en üst)", fn:() => moveTo(rec.id, "") }];
  for (const f of folders) items.push({ label:(f === cur ? "✓ " : "") + "  ".repeat(f.split("/").length - 1) + baseOf(f), fn:() => moveTo(rec.id, f) });
  items.push("-", { label:"Yeni klasöre taşı…", fn:() => askText("Yeni klasörün adı", "", n => { const f = cleanPath((LIB.path ? LIB.path + "/" : "") + n); saveFolders([...savedFolders(), f]); moveTo(rec.id, f); }) });
  libMenu(anchor, items);
}
async function moveTo(id, folder){ await updateRec(id, d => { if (folder) d.folder = folder; else delete d.folder; }); toast(folder ? `"${baseOf(folder)}" klasörüne taşındı` : "Projelerim'e taşındı"); renderHome(); }
async function trashProject(id){ await updateRec(id, d => { d.trashed = Date.now(); }); toast("Çöp kutusuna atıldı. 30 gün içinde geri alabilirsin.", { label:"Geri al", fn:() => restoreProject(id) }); renderHome(); }
async function restoreProject(id){ await updateRec(id, d => { delete d.trashed; }); toast("Geri alındı"); renderHome(); }
async function purgeProject(id){ await deleteLocalProject(id); await OD.forget(id); const m = openedMap(); delete m[id]; ls.set("ednote:opened", JSON.stringify(m)); }
async function renameFolder(path){
  askText("Klasörün yeni adı", baseOf(path), async n => {
    const np = cleanPath((parentOf(path) ? parentOf(path) + "/" : "") + n); if (!np || np === path) return;
    const swap = f => f === path ? np : f.startsWith(path + "/") ? np + f.slice(path.length) : f;
    for (const r of LIB.recs){ const f = cleanPath(r.data.folder); if (f && (f === path || f.startsWith(path + "/"))) await updateRec(r.id, d => { d.folder = swap(f); }); }
    saveFolders(savedFolders().map(swap)); moveFolderLooks(path, np); if (LIB.path === path || LIB.path.startsWith(path + "/")) LIB.path = swap(LIB.path); renderHome();
  });
}
async function deleteFolder(path){
  const inside = LIB.recs.filter(r => { const f = cleanPath(r.data.folder); return !r.data.trashed && f && (f === path || f.startsWith(path + "/")); });
  if (inside.length && !confirm(`"${baseOf(path)}" klasöründeki ${inside.length} proje çöp kutusuna atılacak (30 gün içinde geri alınabilir). Devam edilsin mi?`)) return;
  for (const r of inside) await updateRec(r.id, d => { d.trashed = Date.now(); delete d.folder; });
  saveFolders(savedFolders().filter(f => f !== path && !f.startsWith(path + "/"))); moveFolderLooks(path, null);
  if (LIB.path === path || LIB.path.startsWith(path + "/")) LIB.path = parentOf(path);
  toast(inside.length ? "Klasör silindi, projeler çöp kutusunda" : "Klasör silindi"); renderHome();
}
function projTile(r, opts = {}){
  const d = r.data || {}, li = document.createElement("li"); li.className = "rc proj"; li.dataset.id = r.id;
  const main = document.createElement("button"); main.className = "rc-main";
  const th = document.createElement("span"); th.className = "thumb"; const img = document.createElement("img"); img.alt = ""; th.appendChild(img);
  const ph = document.createElement("span"); ph.className = "thumb-ph"; ph.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4"/></svg>'; th.appendChild(ph);
  const nm = document.createElement("span"); nm.className = "rc-name"; nm.textContent = r.name;
  /* label colour, star, pin, reading progress */
  if (isHex(d.label)){ li.style.setProperty("--lc", d.label); li.classList.add("labeled"); const rb = document.createElement("span"); rb.className = "rc-label"; th.appendChild(rb); }
  if (d.star){ const sb = document.createElement("span"); sb.className = "rc-star"; sb.title = "Yıldızlı"; sb.textContent = "★"; th.appendChild(sb); }
  if (d.pin){ const pn = document.createElement("span"); pn.className = "rc-pin"; pn.title = "En üste sabitlendi"; pn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 3 3v1.5H7V13l3-3z"/><path d="M12 14.5V20"/></svg>'; nm.prepend(pn); }
  const prog = progressOf(d);
  if (prog > 0){ const pb = document.createElement("span"); pb.className = "rc-prog"; pb.title = `%${Math.round(prog * 100)} okundu`; const f = document.createElement("i"); f.style.width = Math.max(4, Math.round(prog * 100)) + "%"; pb.appendChild(f); th.appendChild(pb); }
  const it = d.items || [], ex = it.filter(i => i.type !== "note").length, nt = it.filter(i => i.type === "note").length, nd = (d.docs || []).length;
  const op = openedMap()[r.id];
  const parts = [d.trashed ? `${Math.max(0, TRASH_DAYS - Math.floor((Date.now() - d.trashed) / 864e5))} gün sonra silinecek` : LIB.sort === "updated" || !op ? ago(r.updated) : ago(op)];
  if (nd > 1) parts.push(nd + " belge"); if (ex) parts.push(ex + " alıntı"); if (nt) parts.push(nt + " not"); if (prog >= 0.995) parts.push("bitti"); else if (prog > 0) parts.push(`%${Math.round(prog * 100)}`);
  if (opts.showPath && d.folder) parts.push(d.folder.replace(/\//g, " › "));
  const mt = document.createElement("span"); mt.className = "rc-meta"; mt.textContent = parts.join(" · ");
  main.append(th, nm, mt);
  main.onclick = () => { if (d.trashed){ toast("Açmak için önce geri al.", { label:"Geri al", fn:() => restoreProject(r.id) }); return; } openProject(d); };
  const acts = document.createElement("div"); acts.className = "rc-acts";
  if (d.trashed){
    const rs = document.createElement("button"); rs.className = "btn sm"; rs.textContent = "Geri al"; rs.onclick = () => restoreProject(r.id);
    const del = document.createElement("button"); del.className = "icon-btn sm"; del.title = "Kalıcı olarak sil"; del.setAttribute("aria-label", del.title); del.innerHTML = ICON.del;
    del.onclick = async () => { if (!confirm(`"${r.name}" kalıcı olarak silinsin mi? Bu geri alınamaz.`)) return; await purgeProject(r.id); renderHome(); };
    acts.append(rs, del);
  } else {
    const mb = document.createElement("button"); mb.className = "icon-btn sm rc-more"; mb.title = "Seçenekler"; mb.setAttribute("aria-label", "Seçenekler"); mb.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></svg>';
    mb.onclick = () => libMenu(mb, [
      { label:"Aç", fn:() => openProject(d) },
      { label:"Yeniden adlandır", fn:() => askText("Projenin yeni adı", r.name, async n => { await updateRec(r.id, x => { x.name = n; }); renderHome(); }) },
      { label:"Taşı…", fn:() => moveMenu(mb, r) },
      "-",
      { label:d.star ? "Yıldızı kaldır" : "Yıldızla", fn:async () => { await updateRec(r.id, x => { if (x.star) delete x.star; else x.star = true; }); renderHome(); } },
      { label:d.pin ? "Sabitlemeyi kaldır" : "En üste sabitle", fn:async () => { await updateRec(r.id, x => { if (x.pin) delete x.pin; else x.pin = true; }); renderHome(); } },
      { label:"Renk etiketi…", fn:() => openPalette(mb, { title:"Renk etiketi", named:[{ k:"none", hex:"#ffffff", name:"Etiket yok" }], more:LABEL_COLORS, current:d.label || "none",
        onPick:async v => { closePop(); await updateRec(r.id, x => { if (isHex(v)) x.label = v; else delete x.label; }); renderHome(); } }) },
      { label:"Kapak seç…", fn:() => openCoverPick(r, mb) },
      "-",
      { label:"Dışa aktar (.ednote)", fn:() => exportZip(r.id) },
      "-",
      { label:"Çöp kutusuna at", danger:true, fn:() => trashProject(r.id) }
    ]);
    acts.appendChild(mb);
    li.draggable = !matchMedia("(pointer:coarse)").matches;
    li.addEventListener("dragstart", e => { e.dataTransfer.setData("text/ednote-project", r.id); e.dataTransfer.effectAllowed = "move"; li.classList.add("dragging"); });
    li.addEventListener("dragend", () => li.classList.remove("dragging"));
  }
  li.append(main, acts);
  if (coverOf(r)) queueCover(r, img);
  return li;
}
function dropTarget(node, folder){
  node.addEventListener("dragover", e => { if ([...e.dataTransfer.types].includes("text/ednote-project")){ e.preventDefault(); node.classList.add("drop"); } });
  node.addEventListener("dragleave", () => node.classList.remove("drop"));
  node.addEventListener("drop", e => { node.classList.remove("drop"); const id = e.dataTransfer.getData("text/ednote-project"); if (id){ e.preventDefault(); moveTo(id, folder); } });
}
function folderTile(path, count){
  const li = document.createElement("li"); li.className = "rc fold"; li.dataset.folder = path;
  const main = document.createElement("button"); main.className = "rc-main";
  const th = document.createElement("span"); th.className = "thumb fold-th";
  const look = folderLook(path), first = sortedIn(path)[0], fp = first && coverOf(first);
  const peek = fp ? document.createElement("img") : null; th.appendChild(folderArt(look, peek));
  if (peek) queueCover(first, peek);
  const nm = document.createElement("span"); nm.className = "rc-name"; nm.textContent = baseOf(path);
  const mt = document.createElement("span"); mt.className = "rc-meta"; mt.textContent = count ? count + " proje" : "Boş";
  main.append(th, nm, mt); main.onclick = () => { LIB.path = path; LIB.q = ""; $("#libQ").value = ""; renderHome(); };
  const acts = document.createElement("div"); acts.className = "rc-acts";
  const mb = document.createElement("button"); mb.className = "icon-btn sm rc-more"; mb.title = "Seçenekler"; mb.setAttribute("aria-label", "Seçenekler"); mb.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></svg>';
  mb.onclick = () => libMenu(mb, [{ label:"Aç", fn:() => main.click() }, { label:"Görünüm…", fn:() => openFolderLook(path, mb) }, { label:"Yeniden adlandır", fn:() => renameFolder(path) }, "-", { label:"Klasörü sil", danger:true, fn:() => deleteFolder(path) }]);
  th.addEventListener("contextmenu", e => { e.preventDefault(); openFolderLook(path, th); });
  acts.appendChild(mb); li.append(main, acts); dropTarget(li, path);
  return li;
}
/* ================= visual overview (v6.9.9) =================
   1. density strip on the right edge of each PDF: where the excerpts, notes, comments and ink are
   2. minimap of the desk
   3. reading log per device and day, merged across devices through library.json; shown on the library's "Okuma" page */
let densT = 0;
function densSoon(){ clearTimeout(densT); densT = setTimeout(() => { S.viewers.forEach(v => { if (!v.root.hidden) renderDensity(v); }); if (MINI.on) renderMini(); }, 250); }
addEventListener("resize", () => densSoon());
function pageMarks(fp){
  const m = {}, at = n => m[n] || (m[n] = { ex:0, im:0, cm:0, ink:0, hl:0 });
  if (!S.proj) return m;
  for (const it of S.proj.items){ if (it.doc === fp && it.page){ if (it.type === "excerpt") at(it.page).ex++; else if (it.type === "image") at(it.page).im++; } }
  for (const c of S.proj.comments) if (c.doc === fp) at(c.page).cm++;
  for (const st of S.proj.ink) if (st.where === "pdf" && st.doc === fp){ if (st.kind === "hl") at(st.page).hl++; else at(st.page).ink++; }
  return m;
}
function renderDensity(v){
  const d = v.dens; if (!d) return; d.innerHTML = "";
  if (!v.pdf || !v.pages.length || S.densOff){ d.hidden = true; return; }
  const marks = pageMarks(v.fp), keys = Object.keys(marks); d.hidden = !keys.length; if (!keys.length) return;
  const H = v.pagesEl.scrollHeight || 1, top = v.pane.offsetTop, h = v.pane.clientHeight, sb = v.pane.offsetWidth - v.pane.clientWidth;
  d.style.top = top + "px"; d.style.height = h + "px"; d.style.right = sb + "px";
  let mx = 1; for (const k of keys){ const q = marks[k]; mx = Math.max(mx, q.ex + q.im + q.cm + Math.ceil(q.ink / 4) + Math.ceil(q.hl / 2)); }
  for (const k of keys){
    const p = v.pages[+k - 1]; if (!p) continue; const q = marks[k], tot = q.ex + q.im + q.cm + Math.ceil(q.ink / 4) + Math.ceil(q.hl / 2);
    const b = document.createElement("button"); b.className = "dmark " + (q.ex + q.im ? "dx" : q.cm ? "dc" : q.hl ? "dh" : "di");
    b.style.top = (p.div.offsetTop / H * 100) + "%"; b.style.height = `max(3px, ${p.div.offsetHeight / H * 100 * 0.8}%)`; b.style.width = (4 + 6 * tot / mx) + "px";
    const t = []; if (q.ex) t.push(q.ex + " alıntı"); if (q.im) t.push(q.im + " görsel"); if (q.cm) t.push(q.cm + " yorum"); if (q.hl) t.push(q.hl + " vurgu"); if (q.ink) t.push(q.ink + " çizim");
    b.title = `Sayfa ${k}: ${t.join(", ")}`; b.setAttribute("aria-label", b.title);
    b.onclick = () => { v.pane.scrollTo({ top:p.div.offsetTop - 12, behavior:"smooth" }); };
    d.appendChild(b);
  }
}

/* ---- minimap ---- */
const MINI = { on: ls.get("ednote:mini") === "1" };
function renderMini(){
  let m = $("#miniMap");
  if (!MINI.on || !S.proj){ if (m) m.hidden = true; return; }
  if (!m){
    m = document.createElement("canvas"); m.id = "miniMap"; m.className = "minimap"; m.title = "Mini harita: dokun ya da sürükle"; el.ws.appendChild(m);
    const go = e => { const k = MINI.k; if (!k) return; const r = m.getBoundingClientRect(), wx = MINI.x0 + (e.clientX - r.left) / k, wy = MINI.y0 + (e.clientY - r.top) / k, vw = view(), wr = el.ws.getBoundingClientRect();
      vw.tx = wr.width / 2 - wx * vw.s; vw.ty = wr.height / 2 - wy * vw.s; applyView(); };
    m.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); m.setPointerCapture && m.setPointerCapture(e.pointerId); MINI.drag = true; go(e); });
    m.addEventListener("pointermove", e => { if (MINI.drag){ e.stopPropagation(); go(e); } });
    const end = () => { MINI.drag = false; save(); }; m.addEventListener("pointerup", end); m.addEventListener("pointercancel", end);
    m.addEventListener("wheel", e => e.stopPropagation(), { passive:true });
  }
  m.hidden = false; cancelAnimationFrame(MINI.raf); MINI.raf = requestAnimationFrame(drawMini);
}
function drawMini(){
  const m = $("#miniMap"); if (!m || m.hidden) return;
  const wr = el.ws.getBoundingClientRect(), vw = view(), cards = [...el.plane.querySelectorAll(".card")];
  const vx1 = -vw.tx / vw.s, vy1 = -vw.ty / vw.s, vx2 = vx1 + wr.width / vw.s, vy2 = vy1 + wr.height / vw.s;
  let x1 = vx1, y1 = vy1, x2 = vx2, y2 = vy2; const R = [];
  for (const c of cards){ const r = { x:c.offsetLeft, y:c.offsetTop, w:c.offsetWidth, h:c.offsetHeight, col:getComputedStyle(c).borderTopColor }; R.push(r); x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y); x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h); }
  const pad = 40; x1 -= pad; y1 -= pad; x2 += pad; y2 += pad;
  const W = Math.min(190, wr.width * 0.34), k = Math.min(W / (x2 - x1), W * 0.8 / (y2 - y1)), cw = Math.round((x2 - x1) * k), ch = Math.round((y2 - y1) * k), dpr = devicePixelRatio || 1;
  m.style.width = cw + "px"; m.style.height = ch + "px"; m.width = cw * dpr; m.height = ch * dpr;
  Object.assign(MINI, { k, x0:x1, y0:y1 });
  const g = m.getContext("2d"); g.scale(dpr, dpr); g.clearRect(0, 0, cw, ch);
  for (const r of R){ g.fillStyle = r.col; g.globalAlpha = .75; g.fillRect((r.x - x1) * k, (r.y - y1) * k, Math.max(2, r.w * k), Math.max(2, r.h * k)); }
  g.globalAlpha = 1; const acc = getComputedStyle(document.body).getPropertyValue("--accent").trim() || "#2f6fde";
  g.strokeStyle = acc; g.lineWidth = 1.5; g.fillStyle = acc; g.globalAlpha = .1; g.fillRect((vx1 - x1) * k, (vy1 - y1) * k, (vx2 - vx1) * k, (vy2 - vy1) * k);
  g.globalAlpha = 1; g.strokeRect((vx1 - x1) * k + .75, (vy1 - y1) * k + .75, (vx2 - vx1) * k - 1.5, (vy2 - vy1) * k - 1.5);
}
function toggleMini(on){ MINI.on = on ?? !MINI.on; ls.set("ednote:mini", MINI.on ? "1" : "0"); renderMini(); const b = $("#bMini"); if (b) b.setAttribute("aria-pressed", String(MINI.on)); }

/* ---- reading log: pages looked at and minutes spent, per device and day ---- */
const DEV_ID = (() => { let d = ls.get("ednote:devId"); if (!d){ d = Math.random().toString(36).slice(2, 10); ls.set("ednote:devId", d); } return d; })();
const dayKey = (t = new Date()) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
const READ = { seen:new Set(), day:"", p:0, m:0, dirty:false, t:0, act:Date.now() };
function readLoad(){ const d = dayKey(); if (READ.day === d) return; if (READ.dirty) readFlush(); READ.day = d; READ.seen = new Set(); const r = (libState().reads || {})[DEV_ID + "|" + d]; READ.p = r ? +r.p || 0 : 0; READ.m = r ? +r.m || 0 : 0; }
function readTick(fp, n){ readLoad(); const k = fp + ":" + n; if (READ.seen.has(k)) return; READ.seen.add(k); READ.p++; readDirty(); }
function readDirty(){ READ.dirty = true; if (!READ.t) READ.t = setTimeout(readFlush, 60000); }
function readFlush(){
  clearTimeout(READ.t); READ.t = 0; if (!READ.dirty || !READ.day) return; READ.dirty = false;
  const st = libState(); st.reads = st.reads || {}; st.reads[DEV_ID + "|" + READ.day] = { p:READ.p, m:Math.round(READ.m * 10) / 10, t:Date.now() }; libSave(st);
}
["pointerdown", "keydown", "wheel"].forEach(t => document.addEventListener(t, () => { READ.act = Date.now(); }, { capture:true, passive:true }));
document.addEventListener("scroll", () => { READ.act = Date.now(); }, { capture:true, passive:true });
setInterval(() => { if (S.proj && !S.sample && !document.hidden && $("#home").hidden && Date.now() - READ.act < 120000){ readLoad(); READ.m += 0.5; readDirty(); } }, 30000);
document.addEventListener("visibilitychange", () => { if (document.hidden) readFlush(); });
addEventListener("pagehide", readFlush);
function readDays(){ const out = {}; for (const [k, r] of Object.entries(libState().reads || {})){ if (!r || r.del) continue; const d = k.split("|")[1]; if (!d) continue; const o = out[d] || (out[d] = { p:0, m:0 }); o.p += +r.p || 0; o.m += +r.m || 0; }
  if (READ.day){ const mine = (libState().reads || {})[DEV_ID + "|" + READ.day], o = out[READ.day] || (out[READ.day] = { p:0, m:0 }); o.p += READ.p - (mine ? +mine.p || 0 : 0); o.m += READ.m - (mine ? +mine.m || 0 : 0); }
  return out; }
function renderStats(box){
  const days = readDays(), today = new Date(); today.setHours(12, 0, 0, 0);
  const at = i => { const t = new Date(today); t.setDate(t.getDate() - i); return t; };
  let week = 0, weekM = 0, month = 0, streak = 0;
  for (let i = 0; i < 7; i++){ const d = days[dayKey(at(i))]; if (d){ week += d.p; weekM += d.m; } }
  for (let i = 0; i < 30; i++){ const d = days[dayKey(at(i))]; if (d) month += d.p; }
  for (let i = days[dayKey(at(0))] ? 0 : 1; i < 800; i++){ if (days[dayKey(at(i))] && days[dayKey(at(i))].p > 0) streak++; else break; }
  const tday = days[dayKey(at(0))] || { p:0, m:0 }, fmtM = m => m >= 60 ? `${Math.floor(m / 60)} sa ${Math.round(m % 60)} dk` : `${Math.round(m)} dk`;
  /* heatmap: 26 weeks, Monday on top */
  const WEEKS = 26, dow = (today.getDay() + 6) % 7, startBack = WEEKS * 7 - 7 + dow;
  let mxp = 1; for (let i = 0; i <= startBack; i++){ const d = days[dayKey(at(i))]; if (d) mxp = Math.max(mxp, d.p); }
  let cells = "", months = "", lastM = -1; const MN = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  for (let w = 0; w < WEEKS; w++){
    const first = at(startBack - w * 7); if (first.getMonth() !== lastM){ lastM = first.getMonth(); if (w < WEEKS - 2 && (w > 0 || first.getDate() <= 10)) months += `<span style="grid-column:${w + 1} / span 3">${MN[lastM]}</span>`; }
    for (let r = 0; r < 7; r++){ const i = startBack - w * 7 - r; if (i < 0) continue; const t = at(i), d = days[dayKey(t)], lv = !d || !d.p ? 0 : Math.min(4, 1 + Math.floor(3.999 * d.p / mxp));
      cells += `<i class="hm l${lv}" style="grid-column:${w + 1};grid-row:${r + 1}" title="${t.toLocaleDateString("tr", { day:"numeric", month:"long", weekday:"short" })}: ${d ? d.p : 0} sayfa${d && d.m ? ", " + fmtM(d.m) : ""}"></i>`; }
  }
  /* progress per project */
  const live = (LIB.recs || []).filter(r => !r.data.trashed), op = openedMap();
  const rows = live.map(r => { let a = 0, b = 0; for (const x of Object.values(r.data.read || {})){ if (Array.isArray(x)){ a += +x[0] || 0; b += +x[1] || 0; } } const it = r.data.items || [];
    return { r, pct:b ? Math.round(a / b * 100) : 0, a, b, ex:it.filter(i => i.type === "excerpt").length, no:it.filter(i => i.type === "note").length, t:op[r.id] || r.updated || 0 }; })
    .filter(x => x.b).sort((p, q) => q.t - p.t).slice(0, 12);
  const totEx = live.reduce((s, r) => s + (r.data.items || []).filter(i => i.type === "excerpt").length, 0), totNo = live.reduce((s, r) => s + (r.data.items || []).filter(i => i.type === "note").length, 0);
  box.innerHTML = `<div class="st-tiles">
    <div class="st-tile"><b>${tday.p}</b><span>bugün sayfa</span><small>${fmtM(tday.m)}</small></div>
    <div class="st-tile"><b>${week}</b><span>bu hafta sayfa</span><small>${fmtM(weekM)}</small></div>
    <div class="st-tile"><b>${streak}</b><span>gün üst üste</span><small>son 30 gün: ${month} sayfa</small></div>
    <div class="st-tile"><b>${totEx}</b><span>alıntı</span><small>${totNo} not, ${live.length} proje</small></div></div>
    <h3 class="st-h">Son 6 ay</h3>
    <div class="st-heat"><div class="hm-days"><span>Pzt</span><span></span><span>Çar</span><span></span><span>Cum</span><span></span><span></span></div><div><div class="hm-months">${months}</div><div class="hm-grid">${cells}</div></div></div>
    <div class="hm-key">Az <i class="hm l0"></i><i class="hm l1"></i><i class="hm l2"></i><i class="hm l3"></i><i class="hm l4"></i> Çok</div>
    <h3 class="st-h">Projelerde ilerleme</h3>
    <ul class="st-prog">${rows.map(x => `<li data-id="${x.r.id}"><span class="sp-name">${x.r.name.replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" })[c])}</span><span class="sp-bar"><i style="width:${x.pct}%"></i></span><span class="sp-pct">%${x.pct}</span><span class="sp-meta">${x.a}/${x.b} sayfa · ${x.ex} alıntı · ${x.no} not</span></li>`).join("") || '<li class="quiet">Henüz okunmuş sayfa yok.</li>'}</ul>
    <p class="quiet st-foot">Sayfa sayısı: o gün göz attığın farklı sayfalar. Süre: uygulama açıkken ve sen bir şey yaparken geçen zaman. Tüm cihazların toplamıdır; OneDrive bağlıysa birleşir.</p>`;
  box.querySelectorAll(".st-prog li[data-id]").forEach(li => li.onclick = () => { const r = live.find(x => x.id === li.dataset.id); if (r) openProject(r.data); });
}
async function renderHome(){
  let recs = []; try { recs = await DB.all("projects"); } catch {}
  /* empty the bin: projects trashed more than 30 days ago */
  for (const r of recs) if (r.data && r.data.trashed && Date.now() - r.data.trashed > TRASH_DAYS * 864e5) await purgeProject(r.id);
  recs = recs.filter(r => r.data && !(r.data.trashed && Date.now() - r.data.trashed > TRASH_DAYS * 864e5));
  LIB.recs = recs; thumbQ.length = 0;
  const live = recs.filter(r => !r.data.trashed), trash = recs.filter(r => r.data.trashed), op = openedMap();
  $("#trashCount").textContent = trash.length || "";
  document.querySelectorAll(".lib-nav button").forEach(b => b.toggleAttribute("aria-current", b.dataset.v === LIB.view));
  const folders = allFolders(recs); if (LIB.path && !folders.includes(LIB.path)) LIB.path = "";
  const q = LIB.q.trim().toLocaleLowerCase("tr").replace(/ı/g, "i");
  const byName = (a, b) => a.name.localeCompare(b.name, "tr"), byTime = (a, b) => LIB.sort === "updated" ? b.updated - a.updated : (op[b.id] || b.updated) - (op[a.id] || a.updated);
  const sortP = a => a.sort((x, y) => pinFirst(x, y) || (LIB.sort === "name" ? byName : byTime)(x, y));
  /* top bar */
  const crumb = $("#libCrumb"); crumb.innerHTML = "";
  const addCrumb = (label, path, last) => { const b = document.createElement(last ? "span" : "button"); b.className = "crumb" + (last ? " cur" : ""); b.textContent = label; if (!last){ b.onclick = () => { LIB.path = path; renderHome(); }; dropTarget(b, path); } crumb.appendChild(b); if (!last){ const s = document.createElement("span"); s.className = "crumb-sep"; s.textContent = "›"; crumb.appendChild(s); } };
  if (LIB.view === "proj"){
    const segs = LIB.path ? LIB.path.split("/") : [];
    addCrumb("Projelerim", "", !segs.length); segs.forEach((sg, i) => addCrumb(sg, segs.slice(0, i + 1).join("/"), i === segs.length - 1));
  } else addCrumb(LIB.view === "stats" ? "Okuma" : LIB.view === "recent" ? "Son açılanlar" : LIB.view === "star" ? "Yıldızlı" : "Çöp kutusu", "", true);
  $("#libUp").hidden = !(LIB.view === "proj" && LIB.path && !q);
  $("#libNewFolder").hidden = LIB.view !== "proj"; $("#libEmptyTrash").hidden = !(LIB.view === "trash" && trash.length);
  $("#libSort").value = LIB.sort; $("#libSort").hidden = LIB.view === "trash";
  el.recent.classList.toggle("list", LIB.list);
  const note = $("#libNote"); note.hidden = true;
  const stb = $("#libStats"), statsV = LIB.view === "stats" && !q; stb.hidden = !statsV; el.recent.hidden = statsV; $("#libSort").hidden = $("#libSort").hidden || statsV; $("#libView").hidden = statsV;
  if (statsV){ readFlush(); renderStats(stb); $("#recentEmpty").hidden = true; return; }
  /* items */
  el.recent.innerHTML = ""; let count = 0;
  const add = n => { el.recent.appendChild(n); count++; };
  if (LIB.view === "trash"){
    note.hidden = !trash.length; note.textContent = `Çöp kutusundaki projeler ${TRASH_DAYS} gün sonra kendiliğinden silinir.`;
    for (const r of trash.sort((a, b) => b.data.trashed - a.data.trashed)) add(projTile(r));
  } else if (q){
    for (const f of folders.filter(f => f.toLocaleLowerCase("tr").replace(/ı/g, "i").includes(q))) add(folderTile(f, live.filter(r => cleanPath(r.data.folder) === f).length));
    for (const r of sortP(live.filter(r => r.name.toLocaleLowerCase("tr").replace(/ı/g, "i").includes(q) || (r.data.docs || []).some(d => (d.name || "").toLocaleLowerCase("tr").replace(/ı/g, "i").includes(q))))) add(projTile(r, { showPath:true }));
  } else if (LIB.view === "star"){
    for (const r of sortP(live.filter(r => r.data.star))) add(projTile(r, { showPath:true }));
  } else if (LIB.view === "recent"){
    for (const r of live.filter(r => op[r.id]).sort((a, b) => op[b.id] - op[a.id]).slice(0, 24)) add(projTile(r, { showPath:true }));
  } else {
    for (const f of folders.filter(f => parentOf(f) === LIB.path)) add(folderTile(f, live.filter(r => { const x = cleanPath(r.data.folder); return x === f || x.startsWith(f + "/"); }).length));
    for (const r of sortP(live.filter(r => cleanPath(r.data.folder) === LIB.path))) add(projTile(r));
  }
  const empty = $("#recentEmpty"); empty.hidden = count > 0;
  if (!count) empty.innerHTML = q ? "Aramayla eşleşen proje yok." : LIB.view === "trash" ? "Çöp kutusu boş." : LIB.view === "recent" ? "Henüz açılmış proje yok." : LIB.view === "star" ? "Yıldızlı proje yok. Bir projenin ⋯ menüsünden <b>Yıldızla</b>." : LIB.path ? "Bu klasör boş. Projeleri buraya ⋯ menüsündeki <b>Taşı</b> ile ya da sürükleyerek getirebilirsin." : "Henüz bir proje yok. <b>PDF aç</b> ile başla; birden fazla PDF seçersen hepsi aynı projeye girer.";
  pumpThumbs();
}
document.querySelectorAll(".lib-nav button").forEach(b => b.onclick = () => { LIB.view = b.dataset.v; LIB.q = ""; $("#libQ").value = ""; renderHome(); });
$("#libUp").onclick = () => { LIB.path = parentOf(LIB.path); renderHome(); };
$("#libQ").addEventListener("input", e => { LIB.q = e.target.value; if (LIB.view === "trash" || LIB.view === "stats") LIB.view = "proj"; renderHome(); });
$("#libSort").onchange = e => { LIB.sort = e.target.value; ls.set("ednote:libSort", LIB.sort); renderHome(); };
$("#libView").onclick = () => { LIB.list = !LIB.list; ls.set("ednote:libView", LIB.list ? "list" : "grid"); renderHome(); };
$("#libNewFolder").onclick = () => askText("Yeni klasörün adı", "", n => { const f = cleanPath((LIB.path ? LIB.path + "/" : "") + n); if (!f) return; saveFolders([...savedFolders(), f]); renderHome(); });
$("#libEmptyTrash").onclick = async () => { const t = LIB.recs.filter(r => r.data.trashed); if (!t.length || !confirm(`Çöp kutusundaki ${t.length} proje kalıcı olarak silinsin mi? Bu geri alınamaz.`)) return; for (const r of t) await purgeProject(r.id); renderHome(); };
$("#hOpen").onclick = () => { $("#filePdf").dataset.mode = "new"; $("#filePdf").click(); };
$("#hImport").onclick = () => $("#fileZip").click();
$("#hFolder").hidden = !FS.supported; $("#hFolder").onclick = openFolderProject;
$("#hSample").onclick = () => openSample();
$("#bStk").onclick = () => openStickerPick($("#bStk"), v => addSticker(v));
$("#grainChk").onchange = e => { if (e.target.checked) curSpace().grain = true; else delete curSpace().grain; renderSheet(); save(); };
$("#hLook").onclick = () => openAppLook($("#hLook"));
$("#mLook").onclick = () => { const b = $("#bMore"); closePop(); openAppLook(b); };
/* v6.9.9: on small and touch screens the tool menu closes when you tap elsewhere (drawing on the page, the desk, ...) */
const optsFoldMQ = matchMedia("(max-width:900px), (max-height:500px), (pointer:coarse)");
document.addEventListener("pointerdown", e => {
  const t = e.target;
  if (t.closest && t.closest("#tools button")){ document.body.classList.remove("opts-shut"); return; }
  if (!optsFoldMQ.matches || el.opts.hidden || document.body.classList.contains("opts-shut")) return;
  if (t.closest && t.closest(".subbar, .pop, .sheet, .modal, [role=dialog], #toast")) return;
  document.body.classList.add("opts-shut");
}, true);
$("#mRec").onclick = () => { closePop(); if (Rec.active) stopRecording(); else { renderRecModeIcon(); openPop(el.recPop, $("#bMore")); } };
$("#mFocus").onclick = () => { closePop(); setFocus(true); toast("Tam ekran. Çubukları geri getirmek için sağ üstteki düğmeye dokun."); };
$("#focusExit").onclick = () => setFocus(false);
$("#fUndo").onclick = () => $("#bUndo").click(); $("#fRedo").onclick = () => $("#bRedo").click();
new MutationObserver(() => { $("#fUndo").disabled = $("#bUndo").disabled; $("#fRedo").disabled = $("#bRedo").disabled; }).observe($("#bUndo").parentNode, { attributes:true, subtree:true, attributeFilter:["disabled"] });
const SPLIT_DIRS = { auto:"otomatik", h:"yan yana", v:"üst üste" };
const splitDirLabel = () => { $("#mSplitDir").textContent = "Bölme yönü: " + SPLIT_DIRS[ls.get("ednote:splitDir") || "auto"]; };
$("#mSplitDir").onclick = () => { const cur = ls.get("ednote:splitDir") || "auto", next = cur === "auto" ? "h" : cur === "h" ? "v" : "auto"; ls.set("ednote:splitDir", next === "auto" ? "" : next); splitDirLabel(); if (window.splitApply) window.splitApply(); toast("Bölme yönü: " + SPLIT_DIRS[next]); };
splitDirLabel();
if (ls.get("ednote:focus")) document.body.classList.add("focus");
$("#filePdf").addEventListener("change", e => { const fs = [...e.target.files], mode = e.target.dataset.mode || "new"; e.target.value = ""; if (fs.length === 1) openPdfFile(fs[0], mode); else if (fs.length > 1) openPdfFiles(fs, mode); });
$("#fileZip").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) importZip(f); });

/* ================= keyboard ================= */
document.addEventListener("keydown", e => {
  if (document.body.dataset.view !== "editor") return;
  const t = e.target;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f"){ e.preventDefault(); toggleSearch(true); return; }
  if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)){ if (e.key === "Escape" && t !== el.q) t.blur(); return; }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z"){ e.preventDefault(); undo(); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))){ e.preventDefault(); redo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === " " && P.rec && !el.player.hidden){ e.preventDefault(); el.plPlay.click(); return; }
  if (e.key === "[" || e.key === "]"){ nudgeSize(e.key === "]" ? 1 : -1); return; }
  if (S.sel && S.tool === "select" && (e.key === "+" || e.key === "=" || e.key === "-")){ e.preventDefault(); cardFont(S.sel, e.key === "-" ? -1 : 1); return; }
  const keys = { v:"select", p:"pen", h:"hl", e:"eraser", t:"text", l:"lasso" };
  if (keys[e.key.toLowerCase()]){ setTool(keys[e.key.toLowerCase()]); return; }
  if (e.key === "Escape"){ closePop(); cancelLink(); hideChip(); select(null); iselClear(); }
  else if (e.key === "Delete" || e.key === "Backspace"){ if (ISEL.on){ e.preventDefault(); iselDelete(); } else if (S.selStk){ e.preventDefault(); S.proj.stickers = stkList().filter(x => x.id !== S.selStk); S.selStk = null; renderStickers(); commit(); } else if (S.selLink){ e.preventDefault(); removeLink(S.selLink); } else if (S.sel){ e.preventDefault(); removeItem(S.sel); } }
});

/* ================= tags ================= */
const normTag = t => String(t || "").trim().replace(/^#+/, "").replace(/\s+/g, " ").slice(0, 40);
const allTags = () => { const m = new Map(); for (const i of S.proj.items) for (const t of i.tags || []) m.set(t, (m.get(t) || 0) + 1); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr")); };
function setTags(it, set){ if (set.size) it.tags = [...set]; else delete it.tags; renderWs(); if (WF.open) runWsFind(true); commit(); }
function openTagPop(id, anchor){
  const it = itemById(id); if (!it) return;
  const pop = $("#tagPop"), box = $("#tagChips"), inp = $("#tagNew");
  const draw = () => {
    box.innerHTML = ""; const tags = allTags(), mine = new Set(it.tags || []);
    for (const [t, n] of tags){ const b = document.createElement("button"); b.className = "tchip" + (mine.has(t) ? " on" : ""); b.setAttribute("aria-pressed", String(mine.has(t)));
      b.innerHTML = `<span></span><small>${n}</small>`; b.firstChild.textContent = "#" + t;
      b.onclick = () => { const s = new Set(it.tags || []); s.has(t) ? s.delete(t) : s.add(t); setTags(it, s); draw(); }; box.appendChild(b); }
    $("#tagEmpty").hidden = tags.length > 0;
  };
  inp.value = "";
  inp.onkeydown = e => {
    if (e.key === "Enter"){ e.preventDefault(); const t = normTag(inp.value); if (!t) return; const s = new Set(it.tags || []); s.add(t); inp.value = ""; setTags(it, s); draw(); }
    else if (e.key === "Escape"){ e.preventDefault(); closePop(); }
  };
  draw(); openPop(pop, anchor);
  if (!matchMedia("(pointer:coarse)").matches) inp.focus();
}

/* ================= workspace search and tag filter ================= */
const WF = { open:false, q:"", tags:new Set(), hits:[], idx:-1 };
const wfActive = () => WF.open && !!(WF.q || WF.tags.size);
function wfMatch(i){
  if (WF.tags.size && !(i.tags && [...WF.tags].every(t => i.tags.includes(t)))) return false;
  if (!WF.q) return true;
  const hay = ((i.text || "") + " " + (i.note || "") + " " + (i.tags || []).map(t => "#" + t).join(" ") + (i.photo ? " fotoğraf" : "")).toLocaleLowerCase("tr").replace(/ı/g, "i");
  return WF.q.split(/\s+/).every(w => hay.includes(w));
}
function openWsFind(o = {}){
  if (isNarrow()) setTab("ws");
  WF.open = true; $("#wsFind").hidden = false; el.ws.classList.add("finding");
  if (o.tag){ WF.tags = new Set([o.tag]); $("#wsQ").value = ""; }
  runWsFind();
  if (!o.tag && !matchMedia("(pointer:coarse)").matches) $("#wsQ").focus();
  if (o.tag && WF.hits.length) wfGo(1);
}
function closeWsFind(){ WF.open = false; WF.tags.clear(); WF.hits = []; WF.idx = -1; $("#wsQ").value = ""; $("#wsFind").hidden = true; el.ws.classList.remove("finding"); applyWsFilter(); }
function runWsFind(keep){
  if (!S.proj) return;
  WF.q = $("#wsQ").value.trim().toLocaleLowerCase("tr").replace(/ı/g, "i");
  for (const t of [...WF.tags]) if (!S.proj.items.some(i => i.tags && i.tags.includes(t))) WF.tags.delete(t);
  const order = new Map(S.proj.spaces.map((s, k) => [s.id, k])), prev = WF.hits[WF.idx];
  WF.hits = wfActive() ? S.proj.items.filter(wfMatch).sort((a, b) => (order.get(a.space) - order.get(b.space)) || (a.y - b.y) || (a.x - b.x)).map(i => i.id) : [];
  WF.idx = keep && prev ? WF.hits.indexOf(prev) : -1;
  drawWfTags(); applyWsFilter();
}
function drawWfTags(){
  const box = $("#wsTags"); box.innerHTML = ""; const tags = allTags(); box.hidden = !tags.length;
  for (const [t, n] of tags){ const b = document.createElement("button"); b.className = "tchip" + (WF.tags.has(t) ? " on" : ""); b.setAttribute("aria-pressed", String(WF.tags.has(t)));
    b.innerHTML = `<span></span><small>${n}</small>`; b.firstChild.textContent = "#" + t;
    b.onclick = () => { WF.tags.has(t) ? WF.tags.delete(t) : WF.tags.add(t); runWsFind(); if (WF.hits.length && !WF.hits.some(id => (itemById(id) || {}).space === S.space)) wfGo(1); }; box.appendChild(b); }
}
function applyWsFilter(){
  if (!S.proj) return;
  const on = wfActive(), hit = new Set(WF.hits), cur = WF.hits[WF.idx];
  cardEls.forEach((c, id) => { c.classList.toggle("dim", on && !hit.has(id)); c.classList.toggle("found", on && hit.has(id)); c.classList.toggle("cur-hit", on && cur === id); });
  el.plane.querySelectorAll(".group").forEach(g => g.classList.toggle("dim", on && !g.querySelector(".card.found")));
  el.ws.classList.toggle("filtering", on);
  const cnt = $("#wsCount"); if (!cnt) return;
  if (!on){ cnt.textContent = ""; return; }
  const here = WF.hits.filter(id => (itemById(id) || {}).space === S.space).length, other = WF.hits.length - here;
  cnt.textContent = !WF.hits.length ? "Sonuç yok" : (WF.idx >= 0 ? `${WF.idx + 1} / ${WF.hits.length}` : `${WF.hits.length} kart`) + (other ? ` · ${other} diğer masada` : "");
}
function wfGo(d){
  if (!WF.hits.length) return;
  WF.idx = WF.idx < 0 ? (d > 0 ? 0 : WF.hits.length - 1) : (WF.idx + d + WF.hits.length) % WF.hits.length;
  const it = itemById(WF.hits[WF.idx]); if (!it) return;
  if (it.space !== S.space) switchSpace(it.space);
  applyWsFilter(); centerCard(it.id);
}
function centerCard(id){
  requestAnimationFrame(() => {
    let c = cardEls.get(id); if (!c) return; if (!c.offsetParent || !c.offsetWidth) c = c.closest(".group") || c;
    const cr = c.getBoundingClientRect(), wr = el.ws.getBoundingClientRect(), v = view();
    v.tx += (wr.left + wr.width / 2) - (cr.left + cr.width / 2); v.ty += (wr.top + wr.height / 2 + 30) - (cr.top + Math.min(cr.height, wr.height - 160) / 2);
    applyView(); drawLinks(); save();
  });
}
$("#bWsFind").onclick = () => WF.open ? closeWsFind() : openWsFind();
$("#wsClose").onclick = closeWsFind;
$("#wsPrev").onclick = () => wfGo(-1); $("#wsNext").onclick = () => wfGo(1);
$("#wsQ").addEventListener("input", () => runWsFind());
$("#wsQ").addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); wfGo(e.shiftKey ? -1 : 1); } else if (e.key === "Escape"){ e.preventDefault(); closeWsFind(); } });
$("#wsExam").onclick = () => openExam();
for (const ev of ["pointerdown", "wheel", "dblclick"]) $("#wsFind").addEventListener(ev, e => e.stopPropagation(), { passive:true });

/* ================= exam mode: cards as flashcards ================= */
const EX = { ids:[], queue:[], cur:null, flipped:false, missed:new Set(), firstTry:0, done:0, first:"note", title:"" };
function examSides(it, first){
  const note = (it.note || "").trim();
  if (it.type === "note"){
    const parts = note.split(/\n\s*-{3,}\s*\n/);
    if (parts.length > 1) return { q:{ t:"text", s:parts[0] }, a:{ t:"text", s:parts.slice(1).join("\n") } };
    const lines = note.split("\n"), head = lines[0].trim(), rest = lines.slice(1).join("\n").trim();
    if (head && rest) return { q:{ t:"text", s:head }, a:{ t:"text", s:rest } };
    return { q:{ t:"text", s:note }, a:null };
  }
  const main = it.type === "image" ? { t:"img", src:it.src } : it.type === "video" ? { t:"img", src:it.poster || "" } : { t:"quote", s:it.text };
  if (!note) return { q:main, a:null };
  const n = { t:"text", s:note };
  return first === "note" ? { q:n, a:main } : { q:main, a:n };
}
function examFill(box, side, it){
  box.innerHTML = ""; box.style.fontFamily = it.font ? fontCss(it.font) : "";
  if (side.t === "img"){ const im = document.createElement("img"); im.src = side.src; im.alt = ""; box.appendChild(im); return; }
  const d = document.createElement("div"); d.className = side.t === "quote" ? "ex-quote" : "ex-text";
  if (side.t === "quote") d.textContent = side.s; else renderMathInto(d, side.s);
  box.appendChild(d);
}
function openExam(){
  if (!S.proj) return; closePop();
  const pool = wfActive() ? WF.hits.map(itemById).filter(Boolean) : spaceItems();
  const usable = pool.filter(i => (i.note || "").trim() || i.type !== "note");
  if (!usable.length){ toast(wfActive() ? "Bulunan kartlarda çalışılacak bir şey yok." : "Bu masada kart yok."); return; }
  EX.ids = usable.map(i => i.id);
  EX.title = wfActive() ? ([...WF.tags].map(t => "#" + t).join(" ") || "Arama sonuçları") : curSpace().name;
  $("#exSetupTitle").textContent = EX.title;
  const two = usable.filter(i => examSides(i, "note").a).length;
  $("#exInfo").textContent = `${usable.length} kart` + (two ? `, ${two} tanesinin arka yüzü var` : "") + ".";
  $("#exFirst").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.f === EX.first)));
  $("#exSetup").hidden = false; $("#exCard").hidden = true; $("#exEnd").hidden = true; $("#exActs").hidden = true;
  $("#exProg").textContent = ""; $("#exBar").style.width = "0";
  $("#exam").hidden = false; document.body.classList.add("examining");
  $("#exStart").focus();
}
function startExam(ids){
  EX.queue = [...ids]; if ($("#exShuffle").checked) for (let i = EX.queue.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [EX.queue[i], EX.queue[j]] = [EX.queue[j], EX.queue[i]]; }
  EX.total = EX.queue.length; EX.missed = new Set(); EX.firstTry = 0; EX.done = 0;
  $("#exSetup").hidden = true; $("#exEnd").hidden = true; $("#exCard").hidden = false; $("#exActs").hidden = false;
  nextExamCard();
}
function nextExamCard(){
  $("#exProg").textContent = `${Math.min(EX.done + 1, EX.total)} / ${EX.total}`; $("#exBar").style.width = (EX.done / EX.total * 100) + "%";
  if (!EX.queue.length){ endExam(); return; }
  const it = itemById(EX.queue[0]); if (!it){ EX.queue.shift(); nextExamCard(); return; }
  EX.cur = it; EX.flipped = false;
  const { q, a } = examSides(it, EX.first);
  const meta = it.photo ? "Fotoğraf" : it.type === "note" ? "Not" : (S.proj.docs.length > 1 ? docName(it.doc).slice(0, 40) + " · " : "") + "s. " + it.page;
  $("#exMeta").textContent = meta + (it.tags ? "  " + it.tags.map(t => "#" + t).join(" ") : "") + (EX.missed.has(it.id) ? "  · tekrar" : "");
  $("#exCard").dataset.color = it.color;
  examFill($("#exFront"), q, it);
  if (a){ examFill($("#exBack"), a, it); } else $("#exBack").innerHTML = "";
  $("#exBack").hidden = true; $("#exCard").classList.toggle("single", !a);
  $("#exShow").hidden = !a; $("#exAgain").hidden = !!a; $("#exKnow").hidden = !!a;
  (a ? $("#exShow") : $("#exKnow")).focus({ preventScroll:true });
}
function flipExam(){ if (EX.flipped || !EX.cur) return; EX.flipped = true; $("#exBack").hidden = false; $("#exShow").hidden = true; $("#exAgain").hidden = false; $("#exKnow").hidden = false; $("#exKnow").focus({ preventScroll:true }); }
function answerExam(ok){
  const id = EX.queue.shift(); if (!id) return;
  if (ok){ if (!EX.missed.has(id)) EX.firstTry++; EX.done++; }
  else { EX.missed.add(id); EX.queue.splice(Math.min(EX.queue.length, 3 + Math.floor(Math.random() * 3)), 0, id); }
  nextExamCard();
}
function endExam(){
  $("#exCard").hidden = true; $("#exActs").hidden = true; $("#exEnd").hidden = false; $("#exBar").style.width = "100%"; $("#exProg").textContent = "";
  $("#exResult").textContent = `${EX.total} kartın ${EX.firstTry} tanesini ilk seferde bildin.` + (EX.missed.size ? ` ${EX.missed.size} kartta zorlandın.` : " Hepsini ilk seferde bildin.");
  $("#exRetry").hidden = !EX.missed.size; (EX.missed.size ? $("#exRetry") : $("#exDone")).focus();
}
function closeExam(){ $("#exam").hidden = true; document.body.classList.remove("examining"); EX.cur = null; }
$("#exFirst").querySelectorAll("button").forEach(b => b.onclick = () => { EX.first = b.dataset.f; $("#exFirst").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); });
$("#exStart").onclick = () => startExam(EX.ids);
$("#exShow").onclick = flipExam; $("#exAgain").onclick = () => answerExam(false); $("#exKnow").onclick = () => answerExam(true);
$("#exRetry").onclick = () => startExam([...EX.missed]); $("#exRestart").onclick = () => startExam(EX.ids);
$("#exDone").onclick = closeExam; $("#exClose").onclick = closeExam;
$("#exCard").addEventListener("click", e => { if (!e.target.closest("button")) flipExam(); });
$("#mExam").onclick = () => openExam();
document.addEventListener("keydown", e => {
  if ($("#exam").hidden) return;
  e.stopImmediatePropagation();
  if (e.key === "Escape"){ e.preventDefault(); closeExam(); return; }
  if ($("#exCard").hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === " " || e.key === "Enter"){ e.preventDefault(); if (!EX.flipped && EX.cur && !$("#exShow").hidden) flipExam(); else if (e.key === "Enter" && document.activeElement && document.activeElement.tagName === "BUTTON") document.activeElement.click(); return; }
  if (e.key === "1" && !$("#exAgain").hidden){ e.preventDefault(); answerExam(false); }
  if (e.key === "2" && !$("#exKnow").hidden){ e.preventDefault(); answerExam(true); }
}, true);

/* ================= photos (from camera or gallery; during a recording they are tied to that moment) ================= */
async function downscaleImage(file, max, q){
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    return { src:c.toDataURL("image/jpeg", q), w:c.width, h:c.height };
  } finally { URL.revokeObjectURL(url); }
}
function addPhoto({ src, w:iw, h:ih }){
  const v = AV(), fp = (v && v.fp) || (S.proj.docs[0] && S.proj.docs[0].fp);
  const p = defaultSpot({ w:300, h:Math.round(272 * ih / iw) + 90 });
  const it = stamp({ id:uid(), type:"image", photo:true, src, doc:fp, page:v && v.fp === fp ? v.curPage : 1, rects:[], space:S.space, color:S.lastColor, note:"", w:300, x:p.x, y:p.y });
  if (S.lastBg && S.lastBg !== "white") it.bg = S.lastBg; if (S.lastCc) it.cc = S.lastCc; if (S.lastFrame && S.lastFrame !== "thin") it.frame = S.lastFrame; if (S.lastFont) it.font = S.lastFont;
  S.proj.items.push(it); S.sel = it.id; renderWs(); commit(); showCardIfHidden(it.id);
  toast(it.rec ? "Fotoğraf kaydın bu anına bağlandı" : "Fotoğraf masaya eklendi");
}
/* on a laptop the file picker cannot take a photo, so the camera opens here; phones use their own camera screen */
/* laptop camera: photo or video. One press = one photo; in video mode the same button starts and stops recording */
const CAM = { stream:null, mode:"photo", busy:false, rec:null, chunks:[], t0:0, tick:0, st:null, paused:false };
async function openCamera(){
  const phone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (phone || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ $("#filePhoto").click(); return; }
  $("#cam").hidden = false; $("#camErr").hidden = true; $("#camShot").disabled = true; $("#camVideo").hidden = false; CAM.busy = false;
  setCamMode(CAM.mode);
  try {
    CAM.stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:"environment" }, width:{ ideal:1920 }, height:{ ideal:1080 } }, audio:false });
    if ($("#cam").hidden){ closeCamera(); return; }
    const v = $("#camVideo"); v.srcObject = CAM.stream; await v.play(); $("#camShot").disabled = false; $("#camShot").focus();
  } catch (e){
    $("#camVideo").hidden = true;
    $("#camErr").textContent = e && e.name === "NotAllowedError" ? "Kamera izni verilmedi. Adres çubuğundaki kamera simgesinden izin verebilir ya da fotoğrafı dosyadan seçebilirsin." : "Kamera bulunamadı ya da başka bir uygulama kullanıyor. Fotoğrafı dosyadan seçebilirsin.";
    $("#camErr").hidden = false;
  }
}
function setCamMode(m){
  if (CAM.rec) return;
  CAM.mode = m; $("#cam").dataset.mode = m;
  $("#camModes").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === m)));
  const t = m === "video" ? "Videoyu başlat (Boşluk)" : "Fotoğraf çek (Boşluk)"; $("#camShot").title = t; $("#camShot").setAttribute("aria-label", t);
  $("#camTime").hidden = true;
}
$("#camModes").querySelectorAll("button").forEach(b => b.onclick = () => setCamMode(b.dataset.m));
async function startCamVideo(){
  if (CAM.rec || !CAM.stream || !window.MediaRecorder) return;
  CAM.busy = true;
  let mic = null;
  try { mic = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true } }); } catch { toast("Mikrofona erişilemedi, video sessiz kaydedilecek."); }
  const tracks = [...CAM.stream.getVideoTracks(), ...(mic ? mic.getAudioTracks() : [])], ms = new MediaStream(tracks);
  const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(m => MediaRecorder.isTypeSupported(m)) || "";
  let mr; try { mr = new MediaRecorder(ms, mime ? { mimeType:mime, videoBitsPerSecond:5e6 } : {}); } catch { mr = new MediaRecorder(ms); }
  CAM.st = Rec.active ? { rec:Rec.active.id, t:r2(recElapsed()) } : null;
  CAM.paused = pauseRec(); if (CAM.paused) toast("Ses kaydı video çekilirken duraklatıldı");
  CAM.rec = mr; CAM.mic = mic; CAM.chunks = []; CAM.t0 = performance.now();
  mr.ondataavailable = e => { if (e.data && e.data.size) CAM.chunks.push(e.data); };
  mr.start(1000);
  $("#cam").classList.add("recording"); $("#camTime").hidden = false; $("#camTime").textContent = "00:00";
  CAM.tick = setInterval(() => { $("#camTime").textContent = fmtT((performance.now() - CAM.t0) / 1000) + " · " + fmtMB(CAM.chunks.reduce((a, c) => a + c.size, 0)); }, 500);
  const t = "Videoyu durdur (Boşluk)"; $("#camShot").title = t; $("#camShot").setAttribute("aria-label", t);
  setTimeout(() => CAM.busy = false, 800);
}
async function stopCamVideo(){
  const mr = CAM.rec; if (!mr) return; CAM.busy = true;
  await new Promise(res => { if (mr.state === "inactive"){ res(); return; } mr.onstop = res; setTimeout(res, 4000); try { mr.stop(); } catch { res(); } });
  clearInterval(CAM.tick); if (CAM.mic) CAM.mic.getTracks().forEach(t => t.stop());
  const type = (mr.mimeType || "video/webm").split(";")[0], blob = new Blob(CAM.chunks, { type });
  const file = new File([blob], `ED Note video ${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}${videoExt(type)}`, { type });
  const st = CAM.st, paused = CAM.paused, dur = (performance.now() - CAM.t0) / 1000;
  CAM.rec = null; CAM.mic = null; CAM.chunks = []; CAM.st = null; CAM.paused = false; $("#cam").classList.remove("recording");
  closeCamera();
  if (paused) resumeRec();
  if (blob.size && S.proj) await addVideo(file, st, { dur });
}
function closeCamera(){
  if (CAM.rec){ stopCamVideo(); return; } /* closing while recording keeps the video */
  if (CAM.stream){ CAM.stream.getTracks().forEach(t => t.stop()); CAM.stream = null; }
  $("#camVideo").srcObject = null; $("#cam").hidden = true; $("#cam").classList.remove("recording"); CAM.busy = false;
}
function takeCamPhoto(){
  const v = $("#camVideo"), w = v.videoWidth, h = v.videoHeight; if (!w || !S.proj) return;
  CAM.busy = true; $("#camShot").disabled = true;
  const k = Math.min(1, 1600 / Math.max(w, h)), c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  $("#cam").classList.add("flash"); setTimeout(() => $("#cam").classList.remove("flash"), 180);
  addPhoto({ src:c.toDataURL("image/jpeg", 0.85), w:c.width, h:c.height }); setTimeout(closeCamera, 200);
}
/* one action per press: repeats and the button's own Space activation are ignored */
function camAction(){
  if (CAM.busy || $("#camShot").disabled) return;
  if (CAM.mode === "photo") takeCamPhoto(); else if (CAM.rec) stopCamVideo(); else startCamVideo();
}
$("#camShot").onclick = e => { e.preventDefault(); camAction(); };
$("#camFile").onclick = () => { if (CAM.rec) return; closeCamera(); $("#filePhoto").click(); };
$("#camClose").onclick = () => closeCamera();
document.addEventListener("keydown", e => {
  if ($("#cam").hidden) return; e.stopImmediatePropagation();
  if (e.key === "Escape"){ e.preventDefault(); closeCamera(); return; }
  if (e.key === " " || e.key === "Enter"){
    const a = document.activeElement; if (a && a !== $("#camShot") && a.tagName === "BUTTON" && e.key === "Enter") return;
    e.preventDefault(); if (e.repeat) return; camAction();
  }
}, true);
document.addEventListener("keyup", e => { if (!$("#cam").hidden && (e.key === " " || e.key === "Enter")) e.preventDefault(); }, true);
const isPhoneLike = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
$("#bPhoto").onclick = () => { if (isNarrow()) setTab("ws"); if (isPhoneLike()) openPop($("#shotPop"), $("#bPhoto")); else openCamera(); };
$("#shotPhoto").onclick = () => { closePop(); $("#fileShot").click(); };
$("#shotFiles").onclick = () => { closePop(); $("#filePhoto").click(); };
/* recording a video with the phone camera: the audio recording pauses meanwhile, so neither loses its sound */
let clipCtx = null;
$("#shotVideo").onclick = () => {
  closePop();
  const st = Rec.active ? { rec:Rec.active.id, t:r2(recElapsed()) } : null;
  const paused = pauseRec(); clipCtx = { st, paused, done:false };
  if (paused) toast("Ses kaydı video çekilirken duraklatıldı");
  $("#fileClip").click();
};
function clipBack(){ if (!clipCtx || clipCtx.done) return; clipCtx.done = true; if (clipCtx.paused) resumeRec(); }
$("#fileClip").addEventListener("change", async e => { const f = e.target.files[0], st = clipCtx && clipCtx.st; e.target.value = ""; clipBack(); if (f && S.proj) await addVideo(f, st); });
$("#fileClip").addEventListener("cancel", clipBack);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && clipCtx && !clipCtx.done) setTimeout(clipBack, 1500); });
$("#fileShot").addEventListener("change", async e => { const f = e.target.files[0]; e.target.value = ""; if (!f || !S.proj) return; try { addPhoto(await downscaleImage(f, 1600, 0.85)); } catch { toast("Bu fotoğraf açılamadı."); } });
$("#filePhoto").onchange = async e => {
  const files = [...e.target.files]; e.target.value = ""; if (!files.length || !S.proj) return;
  for (const f of files){
    if (/^video\//.test(f.type) || /\.(mp4|mov|m4v|webm|3gp)$/i.test(f.name)){ await addVideo(f); continue; }
    try { addPhoto(await downscaleImage(f, 1600, 0.85)); } catch (err){ console.error(err); toast("Bu fotoğraf açılamadı."); }
  }
};

/* ================= videos: kept apart from the project like recordings; if the browser has no room, the video is saved on the device instead ================= */
const fmtMB = b => b >= 1e9 ? (b / 1e9).toFixed(1).replace(".", ",") + " GB" : Math.max(1, Math.round((b || 0) / 1e6)) + " MB";
const videoExt = m => /quicktime/.test(m || "") ? ".mov" : /webm/.test(m || "") ? ".webm" : /3gpp/.test(m || "") ? ".3gp" : ".mp4";
const isApple = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
async function freeSpace(){ try { const e = await navigator.storage.estimate(); return e.quota ? e.quota - (e.usage || 0) : Infinity; } catch { return Infinity; } }
async function videoMeta(file){
  const url = URL.createObjectURL(file), v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
  try {
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error("video")); setTimeout(() => rej(new Error("timeout")), 20000); });
    const dur = isFinite(v.duration) ? v.duration : 0, vw = v.videoWidth, vh = v.videoHeight; let poster = "";
    try {
      if (dur > 1){ v.currentTime = Math.min(1, dur / 4); await new Promise(res => { v.onseeked = res; setTimeout(res, 3000); }); }
      const k = Math.min(1, 480 / Math.max(vw, vh, 1)), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(vw * k)); c.height = Math.max(1, Math.round(vh * k));
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height); poster = c.toDataURL("image/jpeg", 0.75);
    } catch {}
    return { dur, vw, vh, poster };
  } finally { v.removeAttribute("src"); v.load(); URL.revokeObjectURL(url); }
}
async function saveToDevice(file){
  if (isApple() && navigator.canShare && navigator.canShare({ files:[file] })){ try { await navigator.share({ files:[file], title:file.name }); return true; } catch (e){ if (e && e.name === "AbortError") return false; } }
  downloadBlob(file, file.name); return true;
}
function videoCard(meta, file, vid, local, st){
  const p = defaultSpot({ w:300, h:Math.round(272 * (meta.vh || 9) / (meta.vw || 16)) + 90 });
  const it = (st && st.rec ? o => Object.assign(o, st) : stamp)({ id:uid(), type:"video", vid, name:file.name, mime:file.type || "video/mp4", size:file.size, dur:r2(meta.dur), vw:meta.vw, vh:meta.vh, ...(meta.poster ? { poster:meta.poster } : {}), ...(local ? { local:true } : {}), space:S.space, color:S.lastColor, note:"", w:300, x:p.x, y:p.y });
  if (S.lastBg && S.lastBg !== "white") it.bg = S.lastBg; if (S.lastCc) it.cc = S.lastCc; if (S.lastFrame && S.lastFrame !== "thin") it.frame = S.lastFrame; if (S.lastFont) it.font = S.lastFont;
  S.proj.items.push(it); S.sel = it.id; renderWs(); commit(); showCardIfHidden(it.id); return it;
}
async function addVideo(f, st, hint){
  if (!S.proj) return;
  const name = f.name && f.name !== "blob" ? f.name : `ED Note video ${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}${videoExt(f.type)}`;
  const file = f.name === name ? f : new File([f], name, { type:f.type || "video/mp4" });
  toast("Video hazırlanıyor…");
  let meta; try { meta = await videoMeta(file); } catch { meta = { dur:0, vw:0, vh:0, poster:"" }; }
  if (!meta.dur && hint && hint.dur) meta.dur = hint.dur; /* videos recorded in the browser carry no length in the file */
  const need = file.size + 30e6, free = await freeSpace(), vid = "v" + uid();
  let stored = false;
  if (free > need){ try { await DB.put("blobs", { id:vid, blob:file, mime:file.type }); stored = true; } catch (e){ console.warn("video store", e); } }
  if (stored){ const it = videoCard(meta, file, vid, false, st); toast(it.rec ? "Video kaydın bu anına bağlandı" : "Video masaya eklendi"); return; }
  /* no room in the browser: offer to keep the video on the device and put only its card on the workspace */
  banner(`Tarayıcıdaki alan bu video için yetmiyor (video ${fmtMB(file.size)}${isFinite(free) ? ", boş alan " + fmtMB(Math.max(0, free)) : ""}). Videoyu cihazına kaydedip masaya kartını ekleyeyim mi?`, [
    { label:"Cihaza kaydet", primary:true, fn: async () => { if (await saveToDevice(file)){ videoCard(meta, file, vid, true, st); toast("Video cihazına kaydedildi. Karta dokununca dosyayı seçip izleyebilirsin.", null, 5000); } else toast("Video eklenmedi."); } },
    { label:"Vazgeç", fn:() => toast("Video eklenmedi.") }
  ], "err");
}
const VP = { url:null, it:null, file:null };
async function openVideo(it){
  const b = it.local ? null : await DB.get("blobs", it.vid).catch(() => null);
  if (!b){
    /* the video lives on the device (or another device): let the user pick the file */
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "video/*";
    inp.onchange = () => { const f = inp.files[0]; if (f) showVideo(it, f, true); };
    toast(it.local ? `Bu video cihazında kayıtlı: ${it.name}. Dosyayı seç.` : `Video bu cihazda yok (${it.name}). Varsa dosyayı seç.`, null, 4000);
    inp.click(); return;
  }
  showVideo(it, b.blob, false);
}
function showVideo(it, blob, fromDevice){
  closeVideo(); VP.it = it; VP.file = blob; VP.url = URL.createObjectURL(blob);
  const v = $("#vpVideo"); v.src = VP.url; $("#vpName").textContent = `${it.name} · ${fmtT(it.dur)} · ${fmtMB(blob.size || it.size)}`;
  $("#vpSave").hidden = fromDevice; $("#vpKeep").hidden = !fromDevice;
  $("#vplay").hidden = false; v.play().catch(() => {});
}
function closeVideo(){ const v = $("#vpVideo"); v.pause(); v.removeAttribute("src"); v.load(); if (VP.url) URL.revokeObjectURL(VP.url); VP.url = null; VP.it = null; VP.file = null; $("#vplay").hidden = true; }
$("#vpClose").onclick = closeVideo;
$("#vplay").addEventListener("click", e => { if (e.target === $("#vplay")) closeVideo(); });
$("#vpSave").onclick = async () => { if (!VP.file || !VP.it) return; const f = VP.file instanceof File ? VP.file : new File([VP.file], VP.it.name, { type:VP.it.mime }); await saveToDevice(f); };
$("#vpKeep").onclick = async () => {
  const it = VP.it, f = VP.file; if (!it || !f) return;
  if (await freeSpace() < f.size + 30e6){ toast("Tarayıcıda hâlâ yeterli yer yok."); return; }
  try { await DB.put("blobs", { id:it.vid, blob:f, mime:it.mime }); delete it.local; it.size = f.size; renderWs(); commit(); $("#vpKeep").hidden = true; $("#vpSave").hidden = false; toast("Video projeye alındı."); }
  catch { toast("Tarayıcıda hâlâ yeterli yer yok."); }
};
document.addEventListener("keydown", e => { if ($("#vplay").hidden) return; if (e.key === "Escape"){ e.stopImmediatePropagation(); closeVideo(); } }, true);

/* ================= reading modes for PDF pages: normal, night, sepia ================= */
function setReadMode(m){
  S.readMode = m || ""; document.body.classList.toggle("rm-night", m === "night"); document.body.classList.toggle("rm-sepia", m === "sepia");
  if (m === "night") document.documentElement.dataset.theme = "dark"; else if (m === "sepia") document.documentElement.dataset.theme = "sepia"; else delete document.documentElement.dataset.theme;
  const tc = m === "night" ? "#0f0f10" : m === "sepia" ? "#ede2c9" : null; document.querySelectorAll('meta[name="theme-color"]').forEach(x => { if (!x.dataset.orig) x.dataset.orig = x.content; x.content = tc || x.dataset.orig; });
  $("#readSeg").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === S.readMode)));
  savePrefs();
}
$("#readSeg").querySelectorAll("button").forEach(b => b.onclick = () => setReadMode(b.dataset.m));

/* ================= OneDrive sync =================
   Files live in the app's own folder on the user's OneDrive (Apps/ED Note):
     projects/<id>.json   the project (notes, cards, links, settings)
     pdfs/<fp>.pdf        each PDF once, shared by projects
     audio/<rec>.<ext>    recordings
   Nothing is ever lost on a clash: if a project changed on two devices, this device keeps its version
   and the other one is saved next to it as a copy. Only real content counts as a change; panning and zooming do not. */
async function deleteLocalProject(id){
  const r = await DB.get("projects", id).catch(() => null); if (!r) return;
  const d = r.data || {};
  for (const x of d.recs || []) await DB.del("blobs", x.id).catch(() => {});
  for (const x of d.items || []) if (x.type === "video" && x.vid) await DB.del("blobs", x.vid).catch(() => {});
  const others = (await DB.all("projects").catch(() => [])).filter(o => o.id !== id).flatMap(o => ((o.data && o.data.docs) || []).map(z => z.fp));
  for (const z of d.docs || []) if (!others.includes(z.fp)) await DB.del("pdfs", z.fp).catch(() => {});
  await DB.del("projects", id).catch(() => {}); await DB.del("meta", "dir:" + id).catch(() => {});
}
const OD = (() => {
  const CFG = window.ED_CONFIG || {}, CID = String(CFG.onedriveClientId || "").trim();
  const AUTH = "https://login.microsoftonline.com/" + (CFG.onedriveTenant || "common") + "/oauth2/v2.0";
  const G = "https://graph.microsoft.com/v1.0", ROOT = G + "/me/drive/special/approot";
  const SCOPE = "Files.ReadWrite.AppFolder User.Read offline_access openid profile";
  const SMALL = +CFG.odSmallLimit || 4 * 1024 * 1024, CHUNK = 327680 * 16;
  const st = { auth:null, busy:false, again:false, timer:null, last:0, err:"", needLogin:false, progress:"", ctl:null, beat:0, sending:0, moved:0, fails:0, total:0, done:0, running:0, flash:"", flashT:null };
  const WORKERS = 3, CALL_MS = 60000, BODY_MS = 90000, STALE_MS = 4 * 60000;
  const enabled = () => !!CID && /^https?:$/.test(location.protocol);
  /* every request has a time limit and belongs to the running sync, so a request that hangs
     (for example when Android pauses the app in the background) can never leave the sync stuck */
  async function tfetch(url, opts = {}, ms = CALL_MS){
    const c = new AbortController(), outer = st.ctl, kill = () => c.abort();
    if (outer){ if (outer.signal.aborted) kill(); else outer.signal.addEventListener("abort", kill, { once:true }); }
    const t = setTimeout(kill, ms);
    try { const r = await fetch(url, { ...opts, signal:c.signal }); st.beat = Date.now(); return r; }
    finally { clearTimeout(t); if (outer) outer.signal.removeEventListener("abort", kill); }
  }
  /* reads a download piece by piece; gives up only if nothing arrives for BODY_MS */
  async function readBody(r, type){
    if (!r.body || !r.body.getReader) return r.blob();
    const rd = r.body.getReader(), parts = [], outer = st.ctl, size = +r.headers.get("Content-Length") || 0; let t, dead = false, got = 0, shown = 0;
    const kill = () => { dead = true; rd.cancel().catch(() => {}); };
    if (outer) outer.signal.addEventListener("abort", kill, { once:true });
    try {
      for (;;){
        t = setTimeout(kill, BODY_MS);
        const { done, value } = await rd.read(); clearTimeout(t);
        if (dead) throw new Error("download stalled");
        if (done) break; parts.push(value); st.beat = Date.now();
        got += value.length; if (size > 4e6 && st.label && Date.now() - shown > 400){ shown = Date.now(); st.progress = st.label + " · %" + Math.round(got / size * 100); ui(); }
      }
    } finally { clearTimeout(t); if (outer) outer.signal.removeEventListener("abort", kill); }
    if (dead) throw new Error("download stalled");
    return new Blob(parts, { type:type || r.headers.get("Content-Type") || "" });
  }
  /* the same file is never sent or fetched twice at once by parallel workers */
  const flight = new Map();
  const once = (key, fn) => { if (!flight.has(key)) flight.set(key, fn().finally(() => flight.delete(key))); return flight.get(key); };
  const isFatal = e => e instanceof NeedLogin || (st.ctl && st.ctl.signal.aborted);
  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, "");
  const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const rand = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  class NeedLogin extends Error {}

  /* ---------- sign in (authorization code + PKCE, no server needed) ---------- */
  async function login(){
    if (!enabled()) return;
    if (S.proj && !S.sample){ clearTimeout(saveTimer); try { await saveNow(); } catch {} }
    const verifier = rand(48), state = rand(16), challenge = b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    ls.set("od:pkce", JSON.stringify({ verifier, state, back:S.proj && !S.sample && document.body.dataset.view === "editor" ? S.proj.id : null, t:Date.now() }));
    const q = new URLSearchParams({ client_id:CID, response_type:"code", redirect_uri:redirectUri(), scope:SCOPE, state, code_challenge:challenge, code_challenge_method:"S256", response_mode:"query", prompt:"select_account" });
    location.assign(AUTH + "/authorize?" + q);
  }
  async function saveAuth(){ if (st.auth) await DB.put("meta", { k:"od:auth", ...st.auth }); else await DB.del("meta", "od:auth").catch(() => {}); }
  async function setTokens(j){
    st.auth = { ...(st.auth || {}), access:j.access_token, exp:Date.now() + (Math.max(300, +j.expires_in || 3600) - 120) * 1000, ...(j.refresh_token ? { refresh:j.refresh_token } : {}) };
    st.needLogin = false; await saveAuth();
  }
  async function tokenCall(params){
    const r = await tfetch(AUTH + "/token", { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body:new URLSearchParams({ client_id:CID, scope:SCOPE, ...params }) });
    const j = await r.json().catch(() => ({})); if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || "token " + r.status); return j;
  }
  /* back from Microsoft's sign-in page: ?code=…&state=… */
  async function handleRedirect(){
    const u = new URL(location.href), code = u.searchParams.get("code"), err = u.searchParams.get("error");
    if (!code && !err) return null;
    let pk = null; try { pk = JSON.parse(ls.get("od:pkce") || "null"); } catch {}
    ls.set("od:pkce", ""); history.replaceState(null, "", redirectUri());
    if (!enabled() || !pk) return null;
    if (err){ toast(err === "access_denied" ? "OneDrive bağlantısı iptal edildi." : "OneDrive'a bağlanılamadı.", null, 4000); return null; }
    if (u.searchParams.get("state") !== pk.state){ toast("OneDrive girişi doğrulanamadı, tekrar dene."); return null; }
    try {
      await setTokens(await tokenCall({ grant_type:"authorization_code", code, redirect_uri:redirectUri(), code_verifier:pk.verifier }));
      try { const me = await (await gfetch(G + "/me?$select=displayName,userPrincipalName,mail")).json(); st.auth.account = me.userPrincipalName || me.mail || me.displayName || ""; await saveAuth(); } catch {}
      /* sync records from an earlier sign-in are kept only for the same account */
      const prev = ls.get("od:metaAcct") || "";
      if (!st.auth.account || (prev && prev.toLowerCase() !== st.auth.account.toLowerCase())) await clearSyncMeta();
      if (st.auth.account) ls.set("od:metaAcct", st.auth.account);
      toast("OneDrive'a bağlandı. Projelerin eşitleniyor…", null, 3500);
      return { back:pk.back };
    } catch (e){ console.error(e); toast("OneDrive'a bağlanılamadı: " + e.message, null, 5000); return null; }
  }
  async function token(force){
    if (!st.auth) throw new NeedLogin();
    if (!force && st.auth.access && Date.now() < st.auth.exp) return st.auth.access;
    if (!st.auth.refresh){ st.needLogin = true; throw new NeedLogin(); }
    try { await setTokens(await tokenCall({ grant_type:"refresh_token", refresh_token:st.auth.refresh })); return st.auth.access; }
    catch (e){ if (!navigator.onLine) throw e; st.needLogin = true; ui(); throw new NeedLogin(); }
  }
  async function gfetch(url, opts = {}, again = true, ms = CALL_MS){
    const r = await tfetch(url, { ...opts, headers:{ ...(opts.headers || {}), Authorization:"Bearer " + await token() } }, ms);
    if (r.status === 401 && again){ await token(true); return gfetch(url, opts, false, ms); }
    if ((r.status === 429 || r.status === 503) && again){ await sleep(Math.min(30, +r.headers.get("Retry-After") || 5) * 1000); return gfetch(url, opts, false, ms); }
    return r;
  }

  /* ---------- files in the app folder ---------- */
  async function list(folder, folders){
    const out = new Map(); let url = folder ? ROOT + ":/" + folder + ":/children?$top=999" : ROOT + "/children?$top=999";
    while (url){
      const r = await gfetch(url); if (r.status === 404) return out; if (!r.ok) throw new Error("list " + r.status);
      const j = await r.json(); for (const it of j.value || []) if (folders ? it.folder : it.file) out.set(it.name, it); url = j["@odata.nextLink"] || null;
    }
    return out;
  }
  const conflictErr = () => Object.assign(new Error("changed elsewhere"), { conflict:true });
  /* time allowed for one upload request: enough for a slow phone connection (about 0.3 Mbit/s) */
  const upMs = bytes => Math.max(CALL_MS, bytes / 40 + 30000);
  async function put(path, blob, ifMatch){
    st.sending++;
    try {
      const h = ifMatch ? { "If-Match":ifMatch } : {};
      if (blob.size <= SMALL){
        const r = await gfetch(ROOT + ":/" + path + ":/content", { method:"PUT", headers:{ ...h, "Content-Type":blob.type || "application/octet-stream" }, body:blob }, true, upMs(blob.size));
        if (r.status === 412) throw conflictErr(); if (!r.ok) throw new Error("upload " + r.status); return await r.json();
      }
      const s = await gfetch(ROOT + ":/" + path + ":/createUploadSession", { method:"POST", headers:{ ...h, "Content-Type":"application/json" }, body:JSON.stringify({ item:{ "@microsoft.graph.conflictBehavior":"replace" } }) });
      if (s.status === 412) throw conflictErr(); if (!s.ok) throw new Error("session " + s.status);
      const { uploadUrl } = await s.json();
      for (let o = 0; o < blob.size; o += CHUNK){
        const end = Math.min(blob.size, o + CHUNK);
        /* a piece that fails on a shaky connection is sent again (up to 3 tries) */
        let r = null;
        for (let k = 0; k < 3; k++){
          try { r = await tfetch(uploadUrl, { method:"PUT", headers:{ "Content-Range":`bytes ${o}-${end - 1}/${blob.size}` }, body:blob.slice(o, end) }, upMs(end - o)); }
          catch (e){ if (isFatal(e) || k === 2) throw e; r = null; }
          if (r && (r.ok || r.status === 412 || (r.status < 500 && r.status !== 408 && r.status !== 429))) break;
          await sleep(2000 * (k + 1));
        }
        if (r.status === 412) throw conflictErr(); if (!r.ok) throw new Error("chunk " + r.status);
        if (end === blob.size) return await r.json();
        if (st.label) { st.progress = st.label + " · %" + Math.round(end / blob.size * 100); ui(); }
      }
    } finally { st.sending--; }
  }
  /* returns the file's content as a Blob */
  async function get(item, path, type){
    const dl = item && item["@microsoft.graph.downloadUrl"];
    let r = dl ? await tfetch(dl) : await gfetch(ROOT + ":/" + path + ":/content");
    if (dl && (r.status === 401 || r.status === 403 || r.status === 404)) r = await gfetch(ROOT + ":/" + path + ":/content"); /* the ready-made download link can expire */
    if (!r.ok) throw new Error("download " + r.status);
    return readBody(r, type);
  }
  const getJson = async (item, path) => JSON.parse(await (await get(item, path)).text());
  async function remove(path){ const r = await gfetch(ROOT + ":/" + path, { method:"DELETE" }); if (!r.ok && r.status !== 404) throw new Error("delete " + r.status); }

  /* ---------- what counts as a change: content only, not the view ---------- */
  async function contentHash(data){
    const c = cleanProject(JSON.parse(JSON.stringify(data)));
    delete c.ui; for (const sp of c.spaces) delete sp.view;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(c)));
    return b64u(buf).slice(0, 32);
  }
  const metaOf = id => DB.get("meta", "od:p:" + id).catch(() => null);
  const setMeta = (id, eTag, hash) => DB.put("meta", { k:"od:p:" + id, eTag, hash });

  const step = txt => { st.label = txt; st.progress = txt; ui(); };
  async function pushAssets(data, R){
    for (const d of data.docs || []){
      const fn = d.fp + ".pdf"; if (R.pdfs.has(fn)) continue;
      await once("up:pdfs/" + fn, async () => {
        if (R.pdfs.has(fn)) return;
        const p = await DB.get("pdfs", d.fp).catch(() => null); if (!p) return;
        step("PDF gönderiliyor: " + (d.name || "").slice(0, 30));
        R.pdfs.set(fn, await put("pdfs/" + fn, new Blob([p.bytes], { type:"application/pdf" }))); st.moved++;
      });
    }
    for (const r of data.recs || []){
      const fn = r.id + audioExt(r.mime); if (R.audio.has(fn) || (Rec.active && Rec.active.id === r.id)) continue;
      await once("up:audio/" + fn, async () => {
        if (R.audio.has(fn)) return;
        const b = await DB.get("blobs", r.id).catch(() => null); if (!b) return;
        step("Ses kaydı gönderiliyor");
        R.audio.set(fn, await put("audio/" + fn, b.blob)); st.moved++;
      });
    }
    for (const it of data.items || []){
      if (it.type !== "video" || it.local) continue; const fn = it.vid + videoExt(it.mime); if (R.media.has(fn)) continue;
      await once("up:media/" + fn, async () => {
        if (R.media.has(fn)) return;
        const b = await DB.get("blobs", it.vid).catch(() => null); if (!b) return;
        step("Video gönderiliyor: " + it.name.slice(0, 30));
        R.media.set(fn, await put("media/" + fn, b.blob)); st.moved++;
      });
    }
  }
  async function pullAssets(data, R){
    for (const d of data.docs || []){
      if (await DB.get("pdfs", d.fp).catch(() => null)) continue;
      const it = R.pdfs.get(d.fp + ".pdf"); if (!it) continue;
      await once("dn:pdf:" + d.fp, async () => {
        if (await DB.get("pdfs", d.fp).catch(() => null)) return;
        step("PDF alınıyor: " + (d.name || "").slice(0, 30));
        const blob = await get(it, "pdfs/" + d.fp + ".pdf", "application/pdf");
        await DB.put("pdfs", { fp:d.fp, name:d.name, bytes:new Uint8Array(await blob.arrayBuffer()) }); st.moved++;
      });
    }
    for (const r of data.recs || []){
      if (await DB.get("blobs", r.id).catch(() => null)) continue;
      const fn = r.id + audioExt(r.mime), it = R.audio.get(fn); if (!it) continue;
      await once("dn:blob:" + r.id, async () => {
        if (await DB.get("blobs", r.id).catch(() => null)) return;
        await DB.put("blobs", { id:r.id, blob:await get(it, "audio/" + fn, r.mime), mime:r.mime }); st.moved++;
      });
    }
    for (const v of data.items || []){
      if (v.type !== "video" || v.local || await DB.get("blobs", v.vid).catch(() => null)) continue;
      const fn = v.vid + videoExt(v.mime), it = R.media.get(fn); if (!it) continue;
      if (await freeSpace() < it.size + 30e6) continue; /* no room on this device: the card says so and the video stays on OneDrive */
      await once("dn:blob:" + v.vid, async () => {
        if (await DB.get("blobs", v.vid).catch(() => null)) return;
        step("Video alınıyor: " + v.name.slice(0, 30));
        try { await DB.put("blobs", { id:v.vid, blob:await get(it, "media/" + fn, v.mime), mime:v.mime }); st.moved++; } catch (e){ if (isFatal(e)) throw e; console.warn("video", e); }
      });
    }
  }
  /* a project that is already in step can still miss a file (an earlier sync was cut off): fill the gaps both ways */
  async function heal(rec, R){
    const d = rec.data;
    const needUp = (d.docs || []).some(x => !R.pdfs.has(x.fp + ".pdf")) || (d.recs || []).some(x => !R.audio.has(x.id + audioExt(x.mime))) || (d.items || []).some(x => x.type === "video" && !x.local && !R.media.has(x.vid + videoExt(x.mime)));
    if (needUp) await pushAssets(d, R);
    await pullAssets(d, R);
  }
  async function upload(rec, R, ifMatch){
    await pushAssets(rec.data, R);
    st.progress = "Proje gönderiliyor: " + rec.name; ui();
    const item = await put("projects/" + rec.id + ".json", new Blob([JSON.stringify(rec.data)], { type:"application/json" }), ifMatch);
    R.projects.set(rec.id + ".json", item); return item;
  }
  async function storeLocal(data, R){
    await pullAssets(data, R);
    const clean = cleanProject(data);
    await DB.put("projects", { id:clean.id, name:clean.name, updated:Date.now(), data:{ app:"ednote", v:SCHEMA, appVersion:APP_VERSION, savedAt:new Date().toISOString(), ...clean } });
    return clean;
  }
  const isOpen = id => S.proj && S.proj.id === id && document.body.dataset.view === "editor";

  const refreshHome = () => { clearTimeout(st.rh); st.rh = setTimeout(() => { if (document.body.dataset.view === "home") renderHome(); }, 500); };
  async function syncLibrary(){
    const files = await list(""), it = files.get("library.json");
    const remote = it ? await getJson(it, "library.json") : null, local = libState();
    const merged = mergeLib(local, remote), mk = libKey(merged);
    if (mk !== libKey(local)){ libSave(merged, true); applyAppLook(); if (document.body.dataset.view === "home") refreshHome(); }
    if (!remote || mk !== libKey(mergeLib(remote, {}))){
      step("Klasörler gönderiliyor");
      await put("library.json", new Blob([JSON.stringify(merged)], { type:"application/json" }), it ? it.eTag : undefined);
    }
  }
  /* runs the jobs WORKERS at a time; one failing job does not stop the others */
  async function pool(jobs){
    let i = 0, fatal = null; const failed = [];
    const run = async () => {
      while (i < jobs.length && !fatal){
        const j = jobs[i++];
        st.running++;
        try { await j.run(); }
        catch (e){ if (isFatal(e)){ fatal = fatal || e; st.running--; return; } console.warn("OneDrive", j.name, e); failed.push(j.name); }
        st.running--; st.done++; ui();
      }
    };
    await Promise.all(Array.from({ length:Math.min(WORKERS, jobs.length) }, run));
    if (fatal) throw fatal;
    return failed;
  }

  /* ---------- one full sync ---------- */
  async function sync(manual){
    if (!enabled() || !st.auth) return;
    if (!navigator.onLine){ if (manual) toast("İnternet yok. Bağlantı gelince eşitlenecek."); return; }
    if (st.busy){
      /* a sync that has heard nothing for minutes is stuck (the app was paused in the background): stop it and start again */
      if (Date.now() - st.beat > STALE_MS && st.ctl){ st.ctl.abort(); st.again = true; }
      else { st.again = true; if (manual) toast("Eşitleme zaten sürüyor."); }
      return;
    }
    st.busy = true; st.err = ""; st.beat = Date.now(); st.moved = 0; st.total = 0; st.done = 0; st.running = 0; st.flash = ""; st.ctl = new AbortController(); st.progress = "OneDrive'a bakılıyor…"; ui();
    let got = 0, sent = 0, copies = 0, removed = 0, reopen = null, failed = [];
    try {
      if (S.proj && !S.sample){ clearTimeout(saveTimer); await saveNow(); }
      const tick = S.editTick || 0;
      const top = await list("", true), sub = n => top.has(n) ? list(n) : new Map();
      const R = { projects:await sub("projects"), pdfs:await sub("pdfs"), audio:await sub("audio"), media:await sub("media") };
      /* deletions made on this device */
      for (const t of (await DB.all("meta")).filter(m => m.k.startsWith("od:del:"))){
        const id = t.k.slice(7), it = R.projects.get(id + ".json");
        if (it && it.eTag === t.eTag){ await remove("projects/" + id + ".json"); R.projects.delete(id + ".json"); }
        await DB.del("meta", t.k);
      }
      /* folders (also empty ones), folder looks and the app look: library.json in the app folder */
      try { await syncLibrary(); } catch (e){ if (isFatal(e)) throw e; console.warn("OneDrive library", e); failed.push("Klasörler ve görünüm"); }
      const locals = await DB.all("projects"), seen = new Set(locals.map(r => r.id)), jobs = [];
      for (const rec of locals){
        if (!rec.data) continue;
        jobs.push({ name:rec.name || rec.id, run:async () => {
          const m = await metaOf(rec.id), it = R.projects.get(rec.id + ".json"), lh = await contentHash(rec.data);
          if (!it){
            if (m && m.hash === lh && !isOpen(rec.id)){ await deleteLocalProject(rec.id); await DB.del("meta", "od:p:" + rec.id); removed++; return; }
            const n = await upload(rec, R); await setMeta(rec.id, n.eTag, lh); sent++; return;
          }
          if (m && it.eTag === m.eTag){
            if (m.hash !== lh){ const n = await upload(rec, R, it.eTag); await setMeta(rec.id, n.eTag, lh); sent++; }
            else await heal(rec, R);
            return;
          }
          const remote = await getJson(it, "projects/" + rec.id + ".json"), rh = await contentHash(remote);
          if (rh === lh){ await setMeta(rec.id, it.eTag, lh); await heal(rec, R); return; }
          if (m && lh === m.hash){
            if (isOpen(rec.id) && (S.editTick || 0) !== tick){ st.again = true; return; }
            const clean = await storeLocal(remote, R); await setMeta(rec.id, it.eTag, rh); got++;
            if (isOpen(rec.id)) reopen = clean; return;
          }
          if (m && rh === m.hash){ const n = await upload(rec, R, it.eTag); await setMeta(rec.id, n.eTag, lh); sent++; return; }
          /* changed on both devices: keep ours, save theirs next to it */
          const copy = { ...remote, id:"p" + uid(), name:(remote.name || rec.name) + " (diğer cihaz, " + new Date().toLocaleDateString("tr-TR") + ")" };
          const cc = await storeLocal(copy, R); const n2 = await upload({ id:cc.id, name:cc.name, data:(await DB.get("projects", cc.id)).data }, R); await setMeta(cc.id, n2.eTag, await contentHash(cc));
          const n = await upload(rec, R, it.eTag); await setMeta(rec.id, n.eTag, lh); copies++; sent++;
        } });
      }
      /* new on OneDrive */
      for (const [name, it] of R.projects){
        const id = name.replace(/\.json$/, ""); if (seen.has(id) || !/\.json$/.test(name)) continue;
        jobs.push({ name, run:async () => {
          const remote = await getJson(it, "projects/" + name); if (!remote || remote.id !== id) return;
          const clean = await storeLocal(remote, R); await setMeta(id, it.eTag, await contentHash(clean)); got++;
          refreshHome(); /* show each project as soon as it arrives */
        } });
      }
      st.total = jobs.length; st.done = 0; st.progress = ""; ui();
      failed = [...failed, ...await pool(jobs)];
      if (failed.length){
        st.fails++; st.err = failed.length + " proje eşitlenemedi, yeniden denenecek";
        if (manual) toast(`${failed.length} proje eşitlenemedi (${failed.slice(0, 2).join(", ")}${failed.length > 2 ? "…" : ""}). Biraz sonra kendiliğinden tekrar denenecek.`, null, 6000);
      } else { st.fails = 0; st.last = Date.now(); ls.set("od:last", String(st.last)); }
      if (reopen){ await openProject(reopen); toast("Diğer cihazdaki değişiklikler alındı."); }
      if (copies) toast(`${copies} proje iki cihazda da değişmişti. Diğer cihazdaki sürüm "(diğer cihaz)" adıyla ayrıca kaydedildi.`, null, 7000);
      else if (manual && !failed.length) toast(got || sent || removed ? `Eşitlendi: ${got} alındı, ${sent} gönderildi.` : "Her şey güncel.");
      if (document.body.dataset.view === "home" && (got || copies || removed)) renderHome();
    } catch (e){
      if (e instanceof NeedLogin){ st.needLogin = true; if (manual) login(); }
      else if (st.ctl.signal.aborted){ console.warn("OneDrive: stuck sync stopped"); }
      else { console.warn("OneDrive", e); st.fails++; st.err = navigator.onLine ? "Eşitlenemedi, yeniden denenecek" : "İnternet yok"; if (manual) toast("OneDrive ile eşitlenemedi. Biraz sonra kendiliğinden tekrar denenecek."); }
    }
    st.busy = false; st.progress = ""; st.ctl = null;
    /* a short "done" or "problem" state on the button so the end of a sync is visible too */
    if (st.auth && !st.needLogin){ st.flash = st.err ? "err" : "ok"; clearTimeout(st.flashT); st.flashT = setTimeout(() => { st.flash = ""; ui(); }, st.err ? 4000 : 2200); }
    ui();
    /* try again soon after a problem: 30 s, 1 min, 2 min, then every 5 min */
    if (st.again){ st.again = false; soon(4000); }
    else if (st.fails && !st.needLogin) soon(Math.min(5 * 60000, 30000 * 2 ** (st.fails - 1)));
  }
  function soon(ms = 15000){ if (!enabled() || !st.auth || st.needLogin) return; clearTimeout(st.timer); st.timer = setTimeout(() => sync(false), ms); }
  async function forget(id){ const m = await metaOf(id); if (m){ await DB.put("meta", { k:"od:del:" + id, eTag:m.eTag }); await DB.del("meta", "od:p:" + id); soon(2000); } }
  /* what this device knows about OneDrive (which version of each project it last saw) stays after disconnecting,
     so reconnecting the same account does not have to compare everything again. Another account starts clean. */
  async function clearSyncMeta(){ for (const m of await DB.all("meta").catch(() => [])) if (/^od:(p|del):/.test(m.k)) await DB.del("meta", m.k).catch(() => {}); }
  async function logout(){
    if (st.ctl) st.ctl.abort();
    if (st.auth && st.auth.account) ls.set("od:metaAcct", st.auth.account); else await clearSyncMeta();
    st.auth = null; await saveAuth();
    ui(); toast("OneDrive bağlantısı kesildi. Projeler bu cihazda kaldı.");
  }

  /* ---------- status on the home screen and in the editor ---------- */
  const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? "az önce" : s < 3600 ? Math.round(s / 60) + " dk önce" : s < 86400 ? Math.round(s / 3600) + " saat önce" : new Date(t).toLocaleDateString("tr-TR"); };
  function ui(){
    const row = $("#odRow"), on = enabled(); row.hidden = !on; $("#mSync").hidden = !on;
    if (!on) return;
    const txt = $("#odText"), btn = $("#odBtn"), off = $("#odOff");
    btn.classList.remove("syncing", "sync-ok", "sync-err"); row.classList.remove("syncing");
    if (!st.auth){ txt.textContent = "Projelerini cihazların arasında eşitle"; btn.textContent = "Bağlan"; btn.onclick = login; off.hidden = true; $("#mSync").textContent = "OneDrive'a bağlan"; return; }
    off.hidden = false; $("#mSync").textContent = "OneDrive ile şimdi eşitle";
    if (st.needLogin){ txt.textContent = (st.auth.account ? st.auth.account + " · " : "") + "oturumu yenilemek gerekiyor"; btn.textContent = "Yeniden giriş"; btn.onclick = login; $("#mSync").textContent = "OneDrive'a yeniden giriş yap"; return; }
    /* rough share: finished projects plus a little for the ones being worked on */
    const frac = st.total ? Math.min(0.99, (st.done + 0.3 * st.running) / st.total) : 0, count = st.total > 1 ? `${st.done}/${st.total} proje` : "";
    const busyTxt = [st.progress || (st.total ? "eşitleniyor" : "OneDrive'a bakılıyor…"), count, st.moved ? st.moved + " dosya tamam" : ""].filter(Boolean).join(" · ");
    txt.textContent = st.busy ? busyTxt : (st.err ? st.err : st.last ? "eşitlendi, " + ago(st.last) : "bağlı") + (st.auth.account ? " · " + st.auth.account : "");
    txt.title = st.auth.account || "";
    btn.disabled = false; btn.onclick = () => sync(true);
    btn.classList.toggle("syncing", st.busy); btn.classList.toggle("sync-ok", !st.busy && st.flash === "ok"); btn.classList.toggle("sync-err", !st.busy && st.flash === "err");
    btn.style.setProperty("--odp", st.busy ? Math.max(0.03, frac).toFixed(3) : "0");
    btn.textContent = st.busy ? (st.total > 1 ? `Eşitleniyor %${Math.round(frac * 100)}` : "Eşitleniyor…") : st.flash === "ok" ? "✓ Eşitlendi" : st.flash === "err" ? "Tekrar dene" : "Şimdi eşitle";
    btn.setAttribute("aria-busy", st.busy ? "true" : "false");
    $("#odRow").classList.toggle("syncing", st.busy);
    $("#mSync").textContent = st.busy ? "OneDrive: eşitleniyor" + (st.total > 1 ? ` (%${Math.round(frac * 100)})` : "…") : "OneDrive ile şimdi eşitle";
    if (S.proj && !S.sample && document.body.dataset.view === "editor" && !st.busy && st.last && !st.err && el.saveState.textContent.startsWith("Kaydedildi")) setSaveState("Kaydedildi · OneDrive");
  }
  let booted = false;
  async function boot(){
    if (booted) return null; booted = true; /* runs once: at start, or right after the licence is entered */
    if (!enabled()){ ui(); return null; }
    try { const a = await DB.get("meta", "od:auth"); if (a && a.access) { const { k, ...rest } = a; st.auth = rest; } } catch {}
    if (st.auth && st.auth.account && !ls.get("od:metaAcct")) ls.set("od:metaAcct", st.auth.account);
    st.last = +ls.get("od:last") || 0;
    const back = await handleRedirect();
    ui();
    if (st.auth){ await sync(false); }
    window.addEventListener("online", () => soon(1500));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden"){ sync(false); return; }
      /* back from the background: a sync that was paused there is restarted at once */
      if (st.busy && Date.now() - st.beat > 30000 && st.ctl){ st.ctl.abort(); st.again = true; } else soon(1500);
    });
    setInterval(() => { if (document.visibilityState === "visible") sync(false); }, 3 * 60 * 1000);
    /* closing the page while files are still going up: ask first (the rest would wait until ED Note is opened again) */
    window.addEventListener("beforeunload", e => { if (st.sending > 0){ e.preventDefault(); e.returnValue = ""; } });
    setInterval(ui, 60 * 1000);
    return back;
  }
  $("#odOff").onclick = () => { if (!$("#odOff").dataset.arm){ $("#odOff").dataset.arm = "1"; toast("Bağlantıyı kesmek için tekrar dokun. Projeler bu cihazda kalır."); setTimeout(() => delete $("#odOff").dataset.arm, 4000); return; } logout(); };
  $("#mSync").onclick = () => { closePop(); st.auth && !st.needLogin ? sync(true) : login(); };
  return { boot, sync, soon, forget, login, ui, enabled, _st:st };
})();

/* ================= licence: a personal code, checked against Ekrem's list about once a day; 7 days of grace offline ================= */
const LIC = (() => {
  const CFG = window.ED_CONFIG || {}, LIST = String(CFG.licenseListUrl || ""), API = String(CFG.licenseApiUrl || "").replace(/\/+$/, ""), ON = !!(LIST || API);
  const KEY = "ednote:lic", DAY = 864e5, GRACE = 7 * DAY;
  const ALPH = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const norm = c => String(c || "").toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V").replace(/[^0-9A-Z]/g, "").replace(/^EDN/, "");
  const pretty = c => "EDN-" + (norm(c).match(/.{1,4}/g) || []).join("-");
  async function hashOf(c){ const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ednote-v1:" + norm(c))); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
  const load = () => { try { return JSON.parse(ls.get(KEY) || "null"); } catch { return null; } };
  const store = st => ls.set(KEY, JSON.stringify(st));
  /* v6.9.1: with licenseApiUrl each code is bound to one Microsoft account (Cloudflare server). The same account works on any number of devices. */
  const CID = String(CFG.onedriveClientId || "").trim(), MS = "https://login.microsoftonline.com/common/oauth2/v2.0", MS_SCOPE = "openid profile email";
  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, "");
  const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const devName = () => { const u = navigator.userAgent; const a = u.match(/Android[^;)]*;\s*([^;)]+?)(?:\s+Build|\))/); return (a ? a[1] : /iPad/.test(u) ? "iPad" : /iPhone/.test(u) ? "iPhone" : /Windows/.test(u) ? "Windows" : /Mac/.test(u) ? "Mac" : /Linux/.test(u) ? "Linux" : "Cihaz") + (NATIVE ? " (uygulama)" : " (tarayıcı)"); };
  async function post(path, body){
    const r = await fetch(API + path, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ ...body, m:devName() }), cache:"no-store" });
    if (!r.ok) throw new Error("api " + r.status); return r.json();
  }
  async function msLogin(code){
    const verifier = b64u(crypto.getRandomValues(new Uint8Array(48))), state = b64u(crypto.getRandomValues(new Uint8Array(16)));
    const challenge = b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    ls.set("lic:pkce", JSON.stringify({ verifier, state, code:norm(code), t:Date.now() }));
    location.assign(MS + "/authorize?" + new URLSearchParams({ client_id:CID, response_type:"code", redirect_uri:redirectUri(), scope:MS_SCOPE, state, code_challenge:challenge, code_challenge_method:"S256", response_mode:"query", prompt:"select_account" }));
  }
  /* back from Microsoft: null when the address is not ours (OneDrive handles its own), otherwise "ok", "taken", "bad", "cancel" or "error" */
  async function handleRedirect(){
    if (!API) return null;
    const u = new URL(location.href), c = u.searchParams.get("code"), err = u.searchParams.get("error");
    let pk = null; try { pk = JSON.parse(ls.get("lic:pkce") || "null"); } catch {}
    if ((!c && !err) || !pk || u.searchParams.get("state") !== pk.state) return null;
    ls.set("lic:pkce", ""); history.replaceState(null, "", redirectUri());
    if (err) return "cancel";
    try {
      const r = await fetch(MS + "/token", { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body:new URLSearchParams({ client_id:CID, scope:MS_SCOPE, grant_type:"authorization_code", code:c, redirect_uri:redirectUri(), code_verifier:pk.verifier }) });
      const j = await r.json().catch(() => ({})); if (!j.id_token) throw new Error(j.error || "token");
      const b = await post("/bind", { code:pk.code, idt:j.id_token });
      if (!b.ok) return b.reason === "taken" ? "taken" : b.reason === "bad" ? "bad" : "error";
      const now = Date.now(); store({ code:pretty(pk.code), h:await hashOf(pk.code), ok:now, chk:now, ticket:b.ticket, name:b.name || "" }); updates(); return "ok";
    } catch (e){ console.warn(e); return "error"; }
  }
  const updates = () => { if (LIST) list().then(j => offerUpdate(j.latest), () => {}); };
  async function list(){
    const r = await fetch(LIST + (LIST.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache:"no-store" });
    if (!r.ok) throw new Error("list " + r.status);
    const j = await r.json(); if (!j || !Array.isArray(j.codes)) throw new Error("list format"); return j;
  }
  /* "ok", "none" (no code yet), "revoked" (removed from the list), "stale" (no check for over 7 days) */
  async function state(force){
    if (!ON) return "ok";
    const st = load(); if (!st || !st.h) return "none";
    const now = Date.now();
    if (force || now - (st.chk || 0) > DAY / 2){
      if (API){
        if (st.ticket){
          try { const r = await post("/check", { ticket:st.ticket }); st.chk = now; if (r.ok){ st.ok = now; st.name = r.name || ""; delete st.rev; } else if (r.reason === "unbound") delete st.ticket; else st.rev = true; store(st); updates(); }
          catch { /* offline: try again later */ }
        }
      } else {
        try { const j = await list(); st.chk = now; if (j.codes.includes(st.h)){ st.ok = now; delete st.rev; } else st.rev = true; store(st); offerUpdate(j.latest); }
        catch { /* offline: try again later */ }
      }
    }
    if (st.rev) return "revoked";
    if (API && !st.ticket) return "login";   /* not yet bound to a Microsoft account (codes from before 6.9.1, or Ekrem released the binding) */
    return now - (st.ok || 0) <= GRACE ? "ok" : "stale";
  }
  async function activate(code){
    const n = norm(code); if (n.length < 12 || [...n].some(ch => !ALPH.includes(ch))) return "bad";
    const h = await hashOf(n), now = Date.now();
    if (API){
      let r; try { r = await post("/precheck", { code:n }); } catch { return "offline"; }
      if (!r.ok) return "bad";
      if (!CID) return "error";
      await msLogin(n); return "redirect";
    }
    let j; try { j = await list(); } catch { return "offline"; }
    if (!j.codes.includes(h)) return "bad";
    store({ code:pretty(n), h, ok:now, chk:now }); offerUpdate(j.latest); return "ok";
  }
  const info = () => { const st = load(); return st && st.code ? (st.name ? "Lisans: " + st.name : st.code) : ""; };
  const relogin = () => { const st = load(); return st && st.code && CID ? msLogin(st.code) : null; };
  return { ON, API:!!API, state, activate, info, pretty, hashOf, norm, handleRedirect, relogin, code:() => (load() || {}).code || "" };
})();
/* ================= app updates (Android): the same list says which build is the newest and where to get it ================= */
const BUILD = window.ED_BUILD || null; /* written into the app when GitHub builds the APK */
function offerUpdate(latest){
  if (!NATIVE || !BUILD || !latest || !(+latest.build > +BUILD.run) || !/^https:\/\//.test(latest.url || "")) return;
  let snooze = 0; try { snooze = +JSON.parse(ls.get("ednote:upd") || "{}")[latest.build] || 0; } catch {}
  if (Date.now() < snooze) return;
  const bar = $("#updBar");
  $("#updMsg").textContent = `Yeni sürüm hazır: ${latest.version || ""}${latest.notes ? " · " + latest.notes : ""}`;
  $("#updGo").onclick = () => { bar.hidden = true; toast("İndirme tarayıcıda başlıyor. Bitince dosyaya dokunup kur; notların silinmez.", null, 6000); window.location.href = latest.url; };
  $("#updLater").onclick = () => { bar.hidden = true; try { ls.set("ednote:upd", JSON.stringify({ [latest.build]:Date.now() + 864e5 })); } catch {} };
  bar.hidden = false;
}
let licShown = false;
function showLicGate(kind){
  const g = $("#licGate"); licShown = true; document.body.classList.add("lic-locked");
  const T = {
    none:["Lisans kodu", "ED Note'u kullanmak için sana verilen lisans kodunu gir. Kod EDN- ile başlar."],
    revoked:["Lisans geçerli değil", "Bu cihazdaki lisans kodu artık geçerli değil. Yeni bir kod girebilirsin. Notların bu cihazda duruyor; aşağıdan dışa aktarabilirsin."],
    stale:["İnternete bağlan", "Lisans 7 günden uzun süredir doğrulanamadı. İnternete bağlanıp Tekrar dene'ye bas. Notların bu cihazda güvende."],
    login:["Microsoft hesabınla doğrula", "Lisansın artık bir Microsoft hesabına bağlanıyor. Kişisel hesabını (outlook, hotmail ya da Microsoft hesabı açtığın e-posta) kullanman önerilir; okul hesapları mezuniyetle kapanır. Bir kere giriş yapman yeterli; sonra aynı hesapla istediğin kadar cihazda kullanırsın. Notların bu cihazda duruyor."]
  }[kind] || ["Lisans kodu", ""];
  if (kind === "none" && LIC.API) T[1] += " Sonra Microsoft hesabınla bir kere giriş yapacaksın; kod o hesaba bağlanır.";
  $("#licTitle").textContent = T[0]; $("#licText").textContent = T[1]; $("#licMsg").textContent = "";
  $("#licCode").hidden = kind === "login"; $("#licGo").textContent = kind === "login" ? "Microsoft ile giriş yap" : "Etkinleştir"; $("#licGate").dataset.kind = kind;
  $("#licRetry").hidden = kind !== "stale"; $("#licExport").hidden = kind === "none";
  g.hidden = false; if (kind !== "stale" && !matchMedia("(pointer:coarse)").matches) $("#licCode").focus();
}
function hideLicGate(){ $("#licGate").hidden = true; licShown = false; document.body.classList.remove("lic-locked"); OD.boot().catch(() => {}); $("#appVer").textContent = "ED Note " + APP_VERSION + (LIC.info() ? " · " + LIC.info() : ""); }
async function licCheck(force){
  if (!LIC.ON) return true;
  const st = await LIC.state(force);
  if (st === "ok"){ if (licShown) hideLicGate(); else $("#appVer").textContent = "ED Note " + APP_VERSION + " · " + LIC.info(); return true; }
  if (Rec.active) await stopRecording(); if (S.proj && !S.sample){ clearTimeout(saveTimer); try { await saveNow(); } catch {} }
  if (document.body.dataset.view === "editor"){ S.proj = null; setView("home"); }
  showLicGate(st); return false;
}
const licMsgFor = r => ({ offline:"İnternet bağlantısı yok. Etkinleştirmek için internet gerekiyor.", taken:"Bu kod başka bir Microsoft hesabına bağlı. Kendi kodunu kullan ya da Ekrem'e yaz.", cancel:"Microsoft girişi iptal edildi. Tekrar deneyebilirsin.", error:"Microsoft girişi doğrulanamadı. Biraz sonra tekrar dene." })[r] || "Bu kod geçerli değil. Harfleri kontrol et ya da Ekrem'den yeni kod iste.";
$("#licGo").onclick = async () => {
  const b = $("#licGo"); b.disabled = true; $("#licMsg").textContent = "Kontrol ediliyor…";
  if ($("#licGate").dataset.kind === "login"){ $("#licMsg").textContent = "Microsoft'a yönlendiriliyorsun…"; await LIC.relogin(); return; }
  const r = await LIC.activate($("#licCode").value); b.disabled = false;
  if (r === "redirect"){ $("#licMsg").textContent = "Microsoft'a yönlendiriliyorsun…"; return; }
  if (r === "ok"){ hideLicGate(); toast("Lisans etkinleştirildi. Hoş geldin!"); return; }
  $("#licMsg").textContent = licMsgFor(r);
};
$("#licCode").addEventListener("keydown", e => { if (e.key === "Enter") $("#licGo").click(); });
$("#licCode").addEventListener("input", e => { const t = e.target, n = LIC.norm(t.value); if (n.length >= 4 && !/[^0-9A-Z-]/.test(t.value.toUpperCase())) t.value = LIC.pretty(n); });
$("#licRetry").onclick = () => licCheck(true);
$("#licExport").onclick = async () => { const rs = await DB.all("projects").catch(() => []); if (!rs.length){ toast("Bu cihazda proje yok."); return; } for (const r of rs) await exportZip(r.id); };
document.addEventListener("keydown", e => { if (licShown && !(e.target && e.target.closest && e.target.closest("#licGate"))) e.stopImmediatePropagation(); }, true);

/* ================= Android: "open with ED Note" and "share to ED Note" (.ednote, .zip, .pdf) ================= */
async function openIncoming(file){
  if (licShown){ toast("Önce lisans kodunu gir, sonra dosyayı tekrar aç.", null, 5000); return; }
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer()), txt = String.fromCharCode(...head);
  if (txt.startsWith("%PDF") || /\.pdf$/i.test(file.name)){ if (document.body.dataset.view === "editor"){ clearTimeout(saveTimer); try { await saveNow(); } catch {} } await openPdfFile(file); return; }
  await importZip(file);
}
if (NATIVE){
  const In = capPlugin("EdIncoming");
  if (In && In.addListener) In.addListener("file", async ({ path, name }) => {
    try {
      const blob = await (await fetch(window.Capacitor.convertFileSrc(path))).blob();
      await openIncoming(new File([blob], name || "dosya.ednote"));
    } catch (e){ console.error(e); toast("Dosya açılamadı.", null, 4000); }
  });
}

/* ================= Android: back button ================= */
if (NATIVE){
  const App = capPlugin("App");
  if (App && App.addListener) App.addListener("backButton", () => {
    if (!$("#vplay").hidden) closeVideo(); else if (!$("#cam").hidden) closeCamera(); else if (!$("#exam").hidden) closeExam();
    else if (openPopEl) closePop(); else if (document.body.dataset.view === "editor") $("#bHome").click(); else App.exitApp();
  });
}

/* ================= splitter: drag to set the sizes; drag all the way to an edge to hide the workspace or the document =================
   v6.9.8: on tall screens (phones and tablets held upright) the document is on top and the workspace below. */
(function(){
  const main = $("#main"), split = $("#split"), SNAP = 70, MIN_WS = 150;
  const savedL = parseFloat(ls.get("alinti:split")); if (savedL >= 12 && savedL <= 95) main.style.setProperty("--left", savedL + "%");
  const savedT = parseFloat(ls.get("ednote:splitV")); if (savedT >= 12 && savedT <= 95) main.style.setProperty("--top", savedT + "%");
  let collapse = ls.get("ednote:collapse") || "";
  const dirPref = () => ls.get("ednote:splitDir") || "auto";
  const vert = () => { const d = dirPref(); if (d === "v") return true; if (d === "h") return false; return innerHeight > innerWidth * 1.1 && innerWidth < 1100; };
  const apply = () => {
    main.classList.toggle("vert", vert());
    if (collapse) main.dataset.collapse = collapse; else delete main.dataset.collapse;
    const v = main.classList.contains("vert");
    split.title = collapse === "ws" ? "Masayı aç" : collapse === "pdf" ? "Belgeyi aç" : v ? "Yüksekliği ayarla (kenara kadar sürükleyince o taraf kapanır)" : "Genişliği ayarla (kenara kadar sürükleyince o taraf kapanır)";
    requestAnimationFrame(() => { S.viewers.forEach(v => v.fp && !v.root.hidden && fitWidth(v)); if (S.proj){ applyView(); drawLinks(); } scheduleX(); });
  };
  window.splitApply = apply;
  const setCollapse = c => { collapse = c; ls.set("ednote:collapse", c); apply(); };
  let rt; addEventListener("resize", () => { const was = main.classList.contains("vert"); if (vert() !== was){ clearTimeout(rt); rt = setTimeout(apply, 120); } });
  apply();
  split.addEventListener("pointerdown", e => {
    split.setPointerCapture(e.pointerId);
    const V = main.classList.contains("vert"), p0 = V ? e.clientY : e.clientX, was = collapse; let moved = false, snap = "";
    const move = ev => {
      const pos = V ? ev.clientY : ev.clientX; if (!moved && Math.abs(pos - p0) < 4) return; moved = true;
      const b = main.getBoundingClientRect(), size = V ? b.height : b.width, x = pos - (V ? b.top : b.left);
      snap = x > size - SNAP ? "ws" : x < SNAP ? "pdf" : "";
      if (snap){ if (collapse !== snap){ collapse = snap; apply(); } return; }
      if (collapse){ collapse = ""; apply(); }
      const maxPct = (size - MIN_WS - 14) / size * 100;
      main.style.setProperty(V ? "--top" : "--left", clamp(x / size * 100, 15, maxPct) + "%"); scheduleX();
    };
    const up = () => {
      split.removeEventListener("pointermove", move); split.removeEventListener("pointerup", up); split.removeEventListener("pointercancel", up);
      if (!moved){ if (was) setCollapse(""); return; } /* a tap on the bar re-opens a hidden side */
      const key = V ? "ednote:splitV" : "alinti:split", prop = V ? "--top" : "--left";
      if (snap){ const sv = parseFloat(ls.get(key)); main.style.setProperty(prop, (sv >= 12 && sv <= 95 ? sv : V ? 50 : 54) + "%"); } /* re-opening goes back to the last size */
      setCollapse(snap);
      if (!snap) ls.set(key, String(parseFloat(main.style.getPropertyValue(prop)) || (V ? 50 : 54)));
      if (snap) toast(snap === "ws" ? "Masa gizlendi. Açmak için kenardaki çubuğa dokun." : "Belge gizlendi. Açmak için kenardaki çubuğa dokun.");
    };
    split.addEventListener("pointermove", move); split.addEventListener("pointerup", up); split.addEventListener("pointercancel", up);
  });
})();

/* ================= focus mode (v6.9.8): hide the top bar, keep the tools at the side, use the whole screen ================= */
function setFocus(on){
  document.body.classList.toggle("focus", on); ls.set("ednote:focus", on ? "1" : "");
  try { if (on && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch {}
  if (window.splitApply) window.splitApply();
}

/* ================= sample project ================= */
const HW = {" ":278,"!":278,'"':355,"#":556,"$":556,"%":889,"&":667,"'":191,"(":333,")":333,"*":389,"+":584,",":278,"-":333,".":278,"/":278,":":278,";":278,"<":584,"=":584,">":584,"?":556,"@":1015,"[":278,"\\":278,"]":278,"^":469,"_":556,"`":333,"{":334,"|":260,"}":334,"~":584,
  a:556,b:556,c:500,d:556,e:556,f:278,g:556,h:556,i:222,j:222,k:500,l:222,m:833,n:556,o:556,p:556,q:556,r:333,s:500,t:278,u:556,v:500,w:722,x:500,y:500,z:500,
  A:667,B:667,C:722,D:722,E:667,F:611,G:778,H:722,I:278,J:500,K:667,L:556,M:833,N:722,O:778,P:667,Q:778,R:722,S:667,T:611,U:722,V:667,W:944,X:667,Y:667,Z:611};
const textW = (s, size) => [...s].reduce((w, ch) => w + (HW[ch] ?? 556), 0) * size / 1000;
const SAMPLE = [
  { title:"Classical Lamination Theory: A Short Primer", lines:[
    "## 1  Introduction","A laminate is a stack of thin unidirectional plies, each oriented at its own angle.",
    "Classical Lamination Theory (CLT) links the in-plane forces and bending moments","acting on the laminate to the strains and curvatures of its mid-plane.","",
    "## 2  The ABD matrix","The stiffness of the whole stack is summarised by three 3x3 matrices: A for",
    "in-plane stiffness, B for coupling between stretching and bending, and D for","bending stiffness. Each entry is a sum over the plies, weighted by ply thickness.","",
    "For a symmetric laminate the B matrix vanishes, so in-plane loads produce no","bending. This is why most structural layups are designed to be symmetric.","",
    "## 3  Limits of the theory","CLT assumes perfect bonding between plies and plane sections that stay plane.",
    "Near free edges and holes, interlaminar stresses appear that CLT cannot predict.","For these regions a three-dimensional finite element model is usually required." ]},
  { title:"Double-Double Laminates", lines:[
    "## 1  Concept","Double-double (DD) laminates repeat one thin four-ply building block,",
    "written as [+phi/-phi/+psi/-psi], instead of mixing 0, 45 and 90 degree plies.","",
    "## 2  Homogenisation","Because the same block repeats, the laminate behaves as homogeneous once the",
    "number of repeats is large enough. The coupling terms in B shrink as the block","repeats, so the stack approaches the behaviour of a balanced, symmetric layup.","",
    "## 3  Design consequences","With only two angles to choose, the design space becomes small and continuous.",
    "Ply drops are simpler, and thickness can be tapered by removing whole blocks.","The trade-off is that thin plies are needed to reach enough repeats in thin parts." ]}
];
const PH = 842, BASE0 = 744, LEAD = 15, FSZ = 11, X0 = 60;
function buildSamplePdf(pg, k){
  const esc = s => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  let c = `BT /F2 17 Tf ${X0} 780 Td (${esc(pg.title)}) Tj ET\nBT /F1 ${FSZ} Tf ${LEAD} TL ${X0} ${BASE0} Td\n`;
  pg.lines.forEach((ln, j) => { const bold = ln.startsWith("## "), t = bold ? ln.slice(3) : ln; c += (j ? "T* " : "") + (bold ? `/F2 ${FSZ} Tf (${esc(t)}) Tj /F1 ${FSZ} Tf\n` : `(${esc(t)}) Tj\n`); });
  c += "ET";
  const objs = [null, "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [5 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>`, `<< /Length ${c.length} >>\nstream\n${c}\nendstream`];
  let out = "%PDF-1.4\n"; const off = [];
  for (let i = 1; i < objs.length; i++){ off[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = out.length; out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) out += String(off[i]).padStart(10, "0") + " 00000 n \n";
  const id = ("a11ce" + k).padEnd(32, "0");
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R /ID [<${id}> <${id}>] >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}
const lineTop = j => PH - (BASE0 - j * LEAD) - 9.5;
async function openSample(){
  const fps = [];
  for (let i = 0; i < SAMPLE.length; i++){ const pg = SAMPLE[i]; const { fp } = await ingestPdf(buildSamplePdf(pg, i + 1), pg.title + ".pdf", { sample:true }); fps.push(fp); }
  const p = emptyProject("Örnek: Laminat notları"), sid = p.spaces[0].id;
  p.spaces.push(newSpace("Tez fikirleri"));
  p.docs = SAMPLE.map((pg, i) => ({ fp:fps[i], name:pg.title + ".pdf" }));
  const ex = (di, idx, color, x, y, note) => { const lines = idx.map(j => SAMPLE[di].lines[j]); return { id:uid(), type:"excerpt", text:lines.join(" "), doc:fps[di], page:1, space:sid, rects:idx.map((j, k) => ({ x:X0 - 1, y:r2(lineTop(j)), w:r2(textW(lines[k], FSZ) + 2), h:12.5 })), color, note, x, y, w:250 }; };
  const e1 = ex(0, [10, 11], "y", 40, 60, "Simetrik layup: B = 0, uzama ile eğilme arasında kuplaj yok.");
  const e2 = ex(0, [15, 16], "p", 40, 360, "Kenar bölgeleri için 3B FEA gerekiyor.");
  const e4 = ex(1, [5, 6, 7], "g", 0, 0, "DD: tekrar sayısı arttıkça B küçülüyor.");
  const e3 = ex(1, [12], "b", 0, 0, "Bisiklet tüpünün cidarına kaç tekrar sığar?");
  const g = { id:"g" + uid(), space:sid, x:350, y:60, w:282, title:"Double-Double", collapsed:false };
  e4.group = g.id; e4.ord = 0; e3.group = g.id; e3.ord = 1;
  const n1 = { id:uid(), type:"note", note:"Bisiklet şasesi: tüp rijitliğini CLT ile hesapla, layup için DD dene.", color:"o", space:sid, x:690, y:240, w:230 };
  const hw = textW("2  The ABD matrix", FSZ) * 1.08, cx = X0 + hw / 2, cy = lineTop(5) + 6.5, rx = hw / 2 + 10, ry = 12, circ = [];
  for (let i = 0; i <= 44; i++){ const a = -0.4 + i / 44 * Math.PI * 2.08; circ.push([r2(cx + rx * Math.cos(a)), r2(cy + ry * Math.sin(a)), r2(0.35 + 0.4 * Math.sin(i / 44 * Math.PI))]); }
  const inkCirc = { id:uid(), where:"pdf", doc:fps[0], page:1, kind:"pen", color:"r", w:1.8, pr:true, pts:circ };
  p.items = [e1, e2, e4, e3, n1]; p.groups = [g];
  p.links = [{ id:uid(), a:e1.id, b:e4.id, arrow:true }, { id:uid(), a:e2.id, b:n1.id, arrow:true }, { id:uid(), a:n1.id, anchor:{ type:"ink", id:inkCirc.id }, to:"anchor" }];
  p.ink = [inkCirc];
  p.texts = [{ id:uid(), doc:fps[0], page:1, x:r2(X0 + hw + 26), y:r2(lineTop(5) - 2), w:150, text:"sınavda çıkar!", color:"r", size:11 }];
  const cl = SAMPLE[0].lines[14];
  p.comments = [{ id:uid(), doc:fps[0], page:1, rects:[{ x:X0 - 1, y:r2(lineTop(14)), w:r2(textW(cl, FSZ) + 2), h:12.5 }], quote:cl, text:"Bu varsayım sandviç yapılarda geçerli mi? Hocaya sor." }];
  p.bookmarks = [{ id:uid(), doc:fps[1], page:1, title:"DD özeti" }];
  p.ui = { space:sid, viewers:fps.slice(), split:!isNarrow() };
  await openProject(p, { sample:true });
}

/* ================= boot ================= */
async function boot(){
  loadPrefs(); setReadMode(S.readMode); applyAppLook(); setTool("select");
  if (ls.get("alinti:penOnly") === "1") setPenOnly(true, false);
  S.recMode = ls.get("alinti:recMode") === "keep" ? "keep" : "trace"; renderRecModeIcon();
  await migrateOld();
  setView("home"); $("#appVer").textContent = "ED Note " + APP_VERSION;
  const licBack = LIC.ON ? await LIC.handleRedirect() : null;
  const licOk = await licCheck(false);
  if (licBack === "ok" && licOk) toast("Lisans hesabına bağlandı. Hoş geldin!");
  else if (licBack && licBack !== "ok" && !licOk) $("#licMsg").textContent = licMsgFor(licBack);
  setInterval(() => licCheck(false), 6 * 3600e3);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") licCheck(false); });
  (licOk ? OD.boot() : Promise.resolve(null)).then(async back => { if (back && back.back){ const r = await DB.get("projects", back.back).catch(() => null); if (r && r.data && document.body.dataset.view === "home") openProject(r.data); } }).catch(e => console.warn(e));
  if ("launchQueue" in window) window.launchQueue.setConsumer(async lp => { if (lp.files && lp.files.length){ const f = await lp.files[0].getFile(); if (/\.(ednote|zip)$/i.test(f.name)) importZip(f); else openPdfFile(f, "new"); } });
  if ("serviceWorker" in navigator && /^https?:/.test(location.protocol) && location.hostname !== "localhost" && location.hostname !== "127.0.0.1"){
    navigator.serviceWorker.register("sw.js").then(reg => {
      reg.addEventListener("updatefound", () => { const nw = reg.installing; if (!nw) return; nw.addEventListener("statechange", () => { if (nw.state === "installed" && navigator.serviceWorker.controller) toast("Yeni sürüm hazır", { label:"Yenile", fn:() => location.reload() }, 10000); }); });
    }).catch(() => {});
  }
}
window.EDNote = window.AlintiMasasi = { version:APP_VERSION, _S:S, _OD:OD, _Rec:Rec, _save:nativeSave, _DB:DB, _ingest:ingestPdf, _empty:emptyProject };
boot();
})();
