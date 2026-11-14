/* ED Note, v5: projects with several PDFs, side-by-side viewers, groups, workspaces, comments, bookmarks,
   adjustable stroke sizes, straight lines and the .ednote file format */
(() => {
"use strict";
const APP_VERSION = "6.7.1";
/* COMPATIBILITY RULE: every release must open and edit files from every earlier release.
   SCHEMA is the data version written to project.json. cleanProject() upgrades any older shape
   (v3 single-PDF files go through migrateV3 first) and never drops user content. Fixture files from
   each release are checked by an automated test before shipping. */
const SCHEMA = 8; /* 7: card text size (fs), document-to-document links (links with pins:[a,b]); 8: card paper/frame/font, text box font, workspace paper colour */
const APP_NAME = "ED Note";
const EDNOTE_MIME = "application/vnd.ednote+zip";
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
  font:'<svg viewBox="0 0 24 24"><path d="M4 19 9.5 5h1L16 19M6.2 14h7.6M17 19v-7.5M17 12.5c0-1.6 1-2.5 2.5-2.5"/></svg>',
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
const narrowMQ = window.matchMedia("(max-width: 820px)");
const isNarrow = () => narrowMQ.matches;

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
const SNAP_KEYS = ["docs","items","links","groups","ink","texts","comments","bookmarks","pins"];
const snap = () => JSON.stringify(SNAP_KEYS.map(k => S.proj[k]));
function updUndo(){ el.undo.disabled = !Hist.past.length; el.redo.disabled = !Hist.future.length; }
function resetHistory(){ Hist.past = []; Hist.future = []; Hist.last = snap(); updUndo(); }
function commit(){
  const s = snap();
  if (s !== Hist.last){ if (Hist.last !== null){ Hist.past.push(Hist.last); if (Hist.past.length > 50) Hist.past.shift(); } Hist.future = []; Hist.last = s; }
  updUndo(); save();
}
function restoreSnap(s){
  const d = JSON.parse(s); SNAP_KEYS.forEach((k, i) => S.proj[k] = d[i]); S.sel = null; S.selLink = null;
  renderTabs(); for (const v of S.viewers) if (!v.root.hidden && !S.proj.docs.some(x => x.fp === v.fp)) showDoc(v, S.proj.docs[0].fp);
  renderWs(); renderAllOverlays(); save(); updUndo();
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
function savePrefs(){ ls.set("ednote:prefs", JSON.stringify({ presets:S.presets, sizeIdx:S.sizeIdx, lineMode:S.lineMode, lastFs:S.lastFs, lastBg:S.lastBg, lastFrame:S.lastFrame, lastFont:S.lastFont, textFont:S.textFont, readMode:S.readMode || "", lastLinkColor:S.lastLinkColor || "", lastLinkDash:!!S.lastLinkDash })); }
function loadPrefs(){
  try {
    const p = JSON.parse(ls.get("ednote:prefs") || "null"); if (!p) return;
    if (p.readMode === "night" || p.readMode === "sepia") S.readMode = p.readMode;
    if (LINK_COLORS[p.lastLinkColor]) S.lastLinkColor = p.lastLinkColor; S.lastLinkDash = !!p.lastLinkDash;
    for (const k of Object.keys(SIZE_DEF)){
      if (Array.isArray(p.presets && p.presets[k]) && p.presets[k].length === 3) S.presets[k] = p.presets[k].map(v => clamp(+v || SIZE_DEF[k][1], ...SIZE_RANGE[k]));
      if (p.sizeIdx && [0, 1, 2].includes(p.sizeIdx[k])) S.sizeIdx[k] = p.sizeIdx[k];
    }
    for (const k of ["pen","hl"]) if (p.lineMode && (p.lineMode[k] === "line" || p.lineMode[k] === "free")) S.lineMode[k] = p.lineMode[k];
    if (FS_STEPS.includes(p.lastFs)) S.lastFs = p.lastFs;
    if (PAPER_COLORS[p.lastBg]) S.lastBg = p.lastBg; if (FRAMES[p.lastFrame]) S.lastFrame = p.lastFrame;
    if (FONT_IDS.has(p.lastFont)) S.lastFont = p.lastFont; if (FONT_IDS.has(p.textFont)) S.textFont = p.textFont;
  } catch {}
}
const dotPx = (k, v) => Math.round(5 + 15 * toSlider(k, v) / 100);
function renderOpts(){
  const sw = $("#swatches"), sz = $("#sizes"); sw.innerHTML = ""; sz.innerHTML = "";
  const t = S.tool, kind = ["hl","pen","text","eraser"].includes(t) ? t : null;
  el.opts.hidden = !kind; if (!kind) return;
  el.opts.dataset.kind = kind;
  if (kind === "text"){
    /* font for new text boxes */
    const fb = document.createElement("button"); fb.className = "font-pick sm"; fb.innerHTML = ICON.font; const n = document.createElement("span"); n.textContent = fontName(S.textFont); if (S.textFont) n.style.fontFamily = fontCss(S.textFont); fb.appendChild(n);
    fb.title = "Yeni metin kutularının yazı tipi"; fb.onclick = () => openFontPop(fb, S.textFont, fid => { S.textFont = fid; savePrefs(); renderOpts(); });
    queueMicrotask(() => { const sz = $("#sizes"); const sep = document.createElement("span"); sep.className = "vsep"; sz.append(sep, fb); });
  }
  if (kind !== "eraser"){
    const cols = kind === "hl" ? HL_COLORS : PEN_COLORS, hex = kind === "hl" ? HL_HEX : PEN_HEX, cur = kind === "hl" ? S.hlColor : S.penColor;
    for (const k of cols){
      const b = document.createElement("button"); b.className = "sw"; b.style.background = hex[k]; b.title = CNAME[k]; b.setAttribute("aria-label", CNAME[k]); b.setAttribute("aria-pressed", String(k === cur));
      b.onclick = () => { if (kind === "hl") S.hlColor = k; else S.penColor = k; renderOpts(); }; sw.appendChild(b);
    }
  }
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
  root.append(head, pane);
  Object.assign(v, { root, head, tabs, pane, pagesEl:pages, pgEl:pg });
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
  renderTabs(); fitWidth(v, true); renderViewerOverlays(v); scheduleX();
  if (!S.sample) save();
}
function fitWidth(v, initial){ if (!v.pdf) return; const avail = (v.pane.clientWidth || window.innerWidth / (S.viewers[1].root.hidden ? 1 : 2)) - 70; setScale(v, clamp(avail / v.maxW, 0.35, 2.2), initial); }
function setScale(v, s, initial){
  if (!v.pdf) return;
  const rel = initial ? 0 : v.pane.scrollTop / Math.max(1, v.pane.scrollHeight);
  v.scale = s;
  for (const p of v.pages){ p.div.style.width = Math.round(p.w * s) + "px"; p.div.style.height = Math.round(p.h * s) + "px"; p.div.style.setProperty("--scale-factor", s); p.rendered = 0; renderHL(v, p); renderCM(v, p); }
  if (!initial) v.pane.scrollTop = rel * v.pane.scrollHeight;
  v.root.querySelectorAll(".tbox textarea").forEach(autosize);
  observePages(v); updatePgInfo(v); scheduleX();
}
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
function renderInkP(v, p){ p.ink.innerHTML = ""; for (const st of S.proj.ink) if (st.where === "pdf" && st.doc === v.fp && st.page === p.n) p.ink.appendChild(inkPath(st)); }
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
function outlineD(pts, w, pressure){
  const n = pts.length, rad = i => (pressure ? w * (0.35 + 1.0 * (pts[i][2] ?? 0.5)) : w) / 2;
  if (n === 1){ const [x, y] = pts[0], r = r2(rad(0)); return `M${r2(x - r)},${y}a${r},${r} 0 1,0 ${r2(2*r)},0a${r},${r} 0 1,0 ${r2(-2*r)},0Z`; }
  const L = [], R = [];
  for (let i = 0; i < n; i++){ const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len; const r = rad(i); L.push([r2(pts[i][0] - dy * r), r2(pts[i][1] + dx * r)]); R.push([r2(pts[i][0] + dy * r), r2(pts[i][1] - dx * r)]); }
  const rs = r2(rad(0)), re = r2(rad(n - 1)); let d = `M${L[0][0]},${L[0][1]}`;
  for (let i = 1; i < n; i++) d += `L${L[i][0]},${L[i][1]}`;
  d += `A${re},${re} 0 0,1 ${R[n-1][0]},${R[n-1][1]}`; for (let i = n - 2; i >= 0; i--) d += `L${R[i][0]},${R[i][1]}`;
  return d + `A${rs},${rs} 0 0,1 ${L[0][0]},${L[0][1]}Z`;
}
function polyD(pts){
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}l0.01,0`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++){ d += `Q${pts[i][0]},${pts[i][1]} ${r2((pts[i][0] + pts[i+1][0]) / 2)},${r2((pts[i][1] + pts[i+1][1]) / 2)}`; }
  const l = pts[pts.length - 1]; return d + `L${l[0]},${l[1]}`;
}
/* pressure strokes are filled outlines; everything else is a round-capped stroke, which stays clean at any width */
const strokeD = st => st.kind === "hl" || !st.pr ? polyD(st.pts) : outlineD(st.pts, st.w, st.pr);
function inkPath(st){
  const path = document.createElementNS(NS, "path");
  if (st.kind === "hl"){ path.setAttribute("d", polyD(st.pts)); path.setAttribute("class", "ihl hc-" + st.color); path.setAttribute("stroke-width", st.w); }
  else if (!st.pr){ path.setAttribute("d", polyD(st.pts)); path.setAttribute("class", "ips ik-" + st.color); path.setAttribute("stroke-width", st.w); }
  else { path.setAttribute("d", outlineD(st.pts, st.w, st.pr)); path.setAttribute("class", "ipen ik-" + st.color); }
  path.dataset.id = st.id; recAttr(path, st); return path;
}
function renderWsInk(){ el.wsInk.innerHTML = ""; if (!S.proj) return; for (const st of S.proj.ink) if (st.where === "ws" && st.space === S.space) el.wsInk.appendChild(inkPath(st)); }
function distSeg(px, py, a, b){ const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx*dx + dy*dy, t = l2 ? clamp(((px - a[0]) * dx + (py - a[1]) * dy) / l2, 0, 1) : 0; return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy)); }
function strokeHit(st, x, y, r){ const pts = st.pts, pad = r + st.w / 2; if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) <= pad; for (let i = 1; i < pts.length; i++) if (distSeg(x, y, pts[i-1], pts[i]) <= pad) return true; return false; }

/* ================= drawing on PDF ================= */
let draw = null;
const pointsFrom = e => (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
function pagePoint(v, p, e){ const r = p.div.getBoundingClientRect(); return [ r2((e.clientX - r.left) / v.scale), r2((e.clientY - r.top) / v.scale) ]; }
function pageAt(v, e){ const d = e.target.closest && e.target.closest(".page"); return d && v.pagesEl.contains(d) ? v.pages[+d.dataset.page - 1] : null; }
function beginStroke(e, where, v, p, pt){
  const kind = S.tool === "hl" ? "hl" : "pen";
  const st = stamp({ id:uid(), where, kind, color: kind === "hl" ? S.hlColor : S.penColor, w:curSize(kind), pr: kind === "pen" && e.pointerType === "pen", pts:[] });
  if (where === "pdf"){ st.doc = v.fp; st.page = p.n; } else st.space = S.space;
  if (where === "ws") pt = clampPt(pt);
  st.pts.push([pt[0], pt[1], r2(e.pressure || 0.5)]);
  const path = inkPath(st); (where === "pdf" ? p.ink : el.wsInk).appendChild(path);
  draw = { mode:"stroke", st, path, where, v, p, id:e.pointerId, start:st.pts[0], straight:false, sx:e.clientX, sy:e.clientY,
    srcCard: where === "ws" && e.target.closest && e.target.closest(".card") ? e.target.closest(".card").dataset.id : null };
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
  const look = { ...(S.lastLinkColor ? { color:S.lastLinkColor } : {}), ...(S.lastLinkDash ? { dash:true } : {}) };
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
  if (S.lastLinkColor) link.color = S.lastLinkColor; if (S.lastLinkDash) link.dash = true;
  S.proj.links.push(link); if (pin) renderDocPage(pin.doc, pin.page); if (pin2) renderDocPage(pin2.doc, pin2.page);
  if (link.pins){ S.selLink = null; commit(); scheduleX(); toast("İki belge birbirine bağlandı. İşarete dokununca karşı uca gidersin."); return true; }
  if (link.pin){ growSheet(link.at.x - 20, link.at.y - 20, link.at.x + 20, link.at.y + 20); renderSheet(); S.selLink = null; drawLinks(); commit(); toast("Belgedeki yer masadaki noktaya bağlandı. İki uçtaki işarete dokununca karşı uca gidersin.", null, 4500); return true; }
  S.sel = link.a; S.selLink = null; renderWs(); commit(); toast(pin ? "Kart belgedeki yere bağlandı" : "Kartlar bağlandı");
  return true;
}
function makeStraight(){ draw.straight = true; draw.st.pr = false; draw.st.pts = [draw.start]; const np = inkPath(draw.st); draw.path.replaceWith(np); draw.path = np; }
/* snap a straight line to 0/45/90 degrees when it is within 6 degrees of one */
function snapLine(a, b){
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); if (len < 0.01) return b;
  const ang = Math.atan2(dy, dx), step = Math.PI / 4, near = Math.round(ang / step) * step;
  if (Math.abs(ang - near) > 6 * Math.PI / 180) return b;
  return [r2(a[0] + Math.cos(near) * len), r2(a[1] + Math.sin(near) * len)];
}
function extendStroke(pt, pressure, ev){
  const st = draw.st; if (draw.where === "ws") pt = clampPt(pt);
  if (!draw.straight && ev && ev.shiftKey) makeStraight();
  if (draw.straight){
    const b = snapLine(draw.start, pt); st.pts = [draw.start, [b[0], b[1], draw.start[2]]];
    if (!draw.raf) draw.raf = requestAnimationFrame(() => { if (!draw || draw.mode !== "stroke") return; draw.raf = 0; draw.path.setAttribute("d", strokeD(st)); });
    return;
  }
  const last = st.pts[st.pts.length - 1], minD = draw.where === "pdf" ? 0.6 / draw.v.scale : 0.6 / view().s;
  if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) < minD) return;
  st.pts.push([pt[0], pt[1], r2(pressure || 0.5)]);
  if (!draw.raf) draw.raf = requestAnimationFrame(() => { if (!draw || draw.mode !== "stroke") return; draw.raf = 0; draw.path.setAttribute("d", strokeD(st)); });
}
function endStroke(){
  const st = draw.st; cancelAnimationFrame(draw.raf);
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
    if (e.target.closest(".tbox,.pnum,.cpin")) return;
    if (e.button && e.button !== 0) return;
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
    if (draw.mode === "stroke"){ for (const ce of pointsFrom(e)) extendStroke(pagePoint(v, p, ce), ce.pressure, e); linkPreview(e); }
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

/* ================= lasso -> image ================= */
async function finishLasso(v, p, pts){
  if (pts.length < 4) return;
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
      if (st.kind === "hl"){ ctx.save(); ctx.globalAlpha = .42; ctx.globalCompositeOperation = "multiply"; ctx.strokeStyle = HL_HEX[st.color]; ctx.lineWidth = st.w; ctx.lineCap = ctx.lineJoin = "round"; ctx.stroke(new Path2D(polyD(st.pts))); ctx.restore(); }
      else if (!st.pr){ ctx.save(); ctx.strokeStyle = PEN_HEX[st.color]; ctx.lineWidth = st.w; ctx.lineCap = ctx.lineJoin = "round"; ctx.stroke(new Path2D(polyD(st.pts))); ctx.restore(); }
      else { ctx.fillStyle = PEN_HEX[st.color]; ctx.fill(new Path2D(outlineD(st.pts, st.w, st.pr))); }
    }
    let src = c.toDataURL("image/webp", 0.9); if (!src.startsWith("data:image/webp")) src = c.toDataURL("image/png");
    const sp = defaultSpot();
    const it = stamp({ id:uid(), type:"image", src, doc:v.fp, page:p.n, space:S.space, rects:[{ x:r2(x1), y:r2(y1), w:r2(bw), h:r2(bh) }], color:"b", note:"", w:clamp(Math.round(bw * 1.3), 170, 380), x:sp.x, y:sp.y });
    if (!it.font && S.lastFont) it.font = S.lastFont; if (!it.bg && S.lastBg && S.lastBg !== "white") it.bg = S.lastBg; if (!it.frame && S.lastFrame && S.lastFrame !== "thin") it.frame = S.lastFrame; if (!it.fs && S.lastFs !== 1) it.fs = S.lastFs; S.proj.items.push(it); S.sel = it.id; renderWs(); renderDocPage(v.fp, p.n); commit();
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
  const d = document.createElement("div"); d.className = "tbox tc-" + t.color; d.dataset.id = t.id; recAttr(d, t);
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
  if (!it.font && S.lastFont) it.font = S.lastFont; if (!it.bg && S.lastBg && S.lastBg !== "white") it.bg = S.lastBg; if (!it.frame && S.lastFrame && S.lastFrame !== "thin") it.frame = S.lastFrame; if (!it.fs && S.lastFs !== 1) it.fs = S.lastFs; S.proj.items.push(it); if (!c.text.trim()) c.text = " ";
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
  q = q.trim().toLocaleLowerCase("tr"); clearSearch(); if (!q || !S.proj) return;
  S.search.q = q; const hits = [];
  for (const d of S.proj.docs){
    const pdf = await loadPdfDoc(d.fp); if (!pdf) continue;
    for (let n = 1; n <= pdf.numPages; n++){
      const strs = await pageStrings(d.fp, n); if (S.search.q !== q) return;
      let k = 0; for (const s of strs){ const i = s.toLocaleLowerCase("tr").indexOf(q); if (i >= 0) hits.push({ fp:d.fp, page:n, k:k++, s, i }); }
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
function spanHits(p){ if (!p.text || !S.search.q) return []; return [...p.text.querySelectorAll("span:not(.markedContent)")].filter(s => s.textContent.length && s.textContent.toLocaleLowerCase("tr").includes(S.search.q)); }
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
  if (e.key === "Enter"){ e.preventDefault(); clearTimeout(qTimer); if (S.search.q !== el.q.value.trim().toLocaleLowerCase("tr")) runSearch(el.q.value).then(() => gotoHit(0)); else { closePop(); gotoHit(S.search.idx + (e.shiftKey ? -1 : 1)); } }
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
  if (!it.font && S.lastFont) it.font = S.lastFont; if (!it.bg && S.lastBg && S.lastBg !== "white") it.bg = S.lastBg; if (!it.frame && S.lastFrame && S.lastFrame !== "thin") it.frame = S.lastFrame; if (!it.fs && S.lastFs !== 1) it.fs = S.lastFs; S.proj.items.push(it); S.sel = it.id; S.selLink = null;
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
  const pr = $("#paperRow");
  if (rebuild){ pr.innerHTML = ""; for (const [k, p] of Object.entries(PAPER_COLORS)){ const b = document.createElement("button"); b.className = "paper-sw"; b.dataset.k = k; b.style.setProperty("--pl", p.l); b.style.setProperty("--pd", p.d); b.title = p.name; b.setAttribute("aria-label", p.name);
    b.onclick = () => { if (k === "white") delete curSpace().paper; else curSpace().paper = k; renderSheet(); save(); fillSheetPop(false); }; pr.appendChild(b); } }
  pr.querySelectorAll(".paper-sw").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === (sp.paper || "white"))));
  const land = sh.w >= sh.h, wmm = Math.round(sh.w / MM), hmm = Math.round(sh.h / MM);
  const hit = Object.entries(PAPER).find(([, [a, b]]) => Math.abs(Math.min(wmm, hmm) - a) <= 2 && Math.abs(Math.max(wmm, hmm) - b) <= 2);
  $("#shPreset").value = hit ? hit[0] : "custom";
  $("#shOrient").querySelectorAll("button").forEach(b => b.setAttribute("aria-checked", String((b.dataset.o === "land") === land)));
  $("#shW").value = toCm(sh.w); $("#shH").value = toCm(sh.h);
}
function openSheetPop(anchor){ closePop(); fillSheetPop(true); openPop($("#sheetPop"), anchor); }
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
const sheetEl = document.createElement("div"); sheetEl.id = "sheet"; el.plane.insertBefore(sheetEl, el.plane.firstChild);
const sheet = () => curSpace().sheet;
function renderSheet(){
  const sp = curSpace(), sh = sp.sheet; Object.assign(sheetEl.style, { left:sh.x + "px", top:sh.y + "px", width:sh.w + "px", height:sh.h + "px" }); sheetEl.dataset.pat = sp.pattern;
  const pc = PAPER_COLORS[sp.paper]; if (pc && sp.paper !== "white"){ sheetEl.style.setProperty("--pl", pc.l); sheetEl.style.setProperty("--pd", pc.d); sheetEl.classList.add("tinted"); } else { sheetEl.style.removeProperty("--pl"); sheetEl.style.removeProperty("--pd"); sheetEl.classList.remove("tinted"); }
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
  el.plane.style.transform = `translate(${v.tx}px,${v.ty}px) scale(${v.s})`;
  el.ws.dataset.zoom = v.s < 0.45 ? "far" : v.s < 0.9 ? "mid" : "near";
  el.zl.textContent = Math.round(v.s * 100) + "%"; scheduleX();
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
  renderSheet(); renderWsInk(); if (growToContent()) save(); applyView(); drawLinks(); refreshReveal(); applyWsFilter();
}
function autosize(t){ t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }
function groupEl(g, mem){
  const ge = document.createElement("div"); ge.className = "group" + (g.collapsed ? " collapsed" : ""); ge.dataset.gid = g.id;
  ge.style.left = g.x + "px"; ge.style.top = g.y + "px"; ge.style.width = g.w + "px";
  const head = document.createElement("div"); head.className = "g-head";
  const title = document.createElement("input"); title.className = "g-title"; title.value = g.title || ""; title.placeholder = "Grup başlığı"; title.setAttribute("aria-label", "Grup başlığı");
  title.addEventListener("input", () => { g.title = title.value; save(); }); title.addEventListener("change", commit);
  const cnt = document.createElement("span"); cnt.className = "g-count"; cnt.textContent = mem.length + " kart";
  const col = document.createElement("button"); col.className = "mini"; col.style.opacity = 1; col.innerHTML = ICON.chevron; col.title = g.collapsed ? "Grubu aç" : "Yığına dönüştür"; col.setAttribute("aria-label", col.title);
  col.style.transform = g.collapsed ? "rotate(-90deg)" : ""; col.onclick = () => { g.collapsed = !g.collapsed; renderWs(); commit(); };
  const ug = document.createElement("button"); ug.className = "mini"; ug.style.opacity = 1; ug.innerHTML = ICON.ungroup; ug.title = "Grubu dağıt"; ug.setAttribute("aria-label", ug.title); ug.onclick = () => ungroup(g.id);
  head.append(title, cnt, col, ug); ge.appendChild(head);
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
function cardEl(it, inGroup){
  const c = document.createElement("div"); c.className = "card" + (it.type === "note" ? " isnote" : "") + (S.sel === it.id ? " selected" : ""); c.dataset.id = it.id; recAttr(c, it);
  if (it.fs && it.fs !== 1) c.style.setProperty("--fs", it.fs);
  c.dataset.color = it.color; c.dataset.frame = it.frame || "thin";
  if (it.bg && PAPER_COLORS[it.bg]){ c.style.setProperty("--cbg-l", PAPER_COLORS[it.bg].l); c.style.setProperty("--cbg-d", PAPER_COLORS[it.bg].d); c.classList.add("tinted"); }
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
  const ta = document.createElement("textarea"); ta.className = "note"; ta.rows = 1; ta.setAttribute("aria-label", "Kart notu");
  ta.placeholder = it.type === "note" ? "Düşünceni yaz… (formül için $E = mc^2$)" : "Not ekle…"; ta.value = it.note || ""; ta.dataset.note = it.id;
  ta.addEventListener("input", () => { it.note = ta.value; autosize(ta); drawLinks(); save(); });
  ta.addEventListener("change", commit); ta.addEventListener("focus", () => select(it.id));
  c.appendChild(ta);
  /* when a note has formulas, show them rendered; a tap switches back to editing */
  const mv = document.createElement("div"); mv.className = "note mview"; mv.title = "Düzenlemek için dokun";
  const showMath = () => { const on = hasMath(it.note) && document.activeElement !== ta; mv.hidden = !on; ta.hidden = on; if (on) renderMathInto(mv, it.note); };
  mv.addEventListener("click", () => { if (Date.now() - lastDragEnd < 350 || S.linkFrom) return; mv.hidden = true; ta.hidden = false; autosize(ta); ta.focus(); });
  ta.addEventListener("blur", () => { showMath(); drawLinks(); });
  c.appendChild(mv); showMath();
  if (it.tags && it.tags.length){
    const tr = document.createElement("div"); tr.className = "ctags";
    for (const t of it.tags){ const b = document.createElement("button"); b.className = "tchip sm"; b.textContent = "#" + t; b.title = "Bu etiketli kartları göster"; b.onclick = () => openWsFind({ tag:t }); tr.appendChild(b); }
    c.appendChild(tr);
  }
  const cols = document.createElement("div"); cols.className = "colors";
  for (const k of HL_COLORS){ const d = document.createElement("button"); d.className = "dot c-" + k + (it.color === k ? " on" : ""); d.title = CNAME[k]; d.setAttribute("aria-label", CNAME[k]); d.onclick = () => { it.color = k; S.lastColor = k; renderWs(); if (it.doc) renderDocPage(it.doc, it.page); commit(); }; cols.appendChild(d); }
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
    if (e.target.closest("button,textarea,input")){ e.stopPropagation(); return; }
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
function parseMath(t){
  const out = []; let i = 0, buf = "";
  while (i < t.length){
    if (t[i] === "\\" && t[i + 1] === "$"){ buf += "$"; i += 2; continue; }
    if (t[i] === "$"){
      const disp = t[i + 1] === "$", open = disp ? 2 : 1, close = disp ? t.indexOf("$$", i + 2) : inlineClose(t, i + 1);
      if (close > i + open && (disp || !t.slice(i + 1, close).includes("\n"))){
        if (disp) buf = buf.replace(/\n$/, "");
        if (buf) out.push({ t:"text", s:buf }); buf = ""; out.push({ t:"math", tex:t.slice(i + open, close).trim(), display:disp }); i = close + open;
        if (disp && t[i] === "\n") i++;
        continue;
      }
    }
    buf += t[i++];
  }
  if (buf) out.push({ t:"text", s:buf });
  return out;
}
let mjLoad = null;
function loadMathJax(){
  if (window.MathJax && window.MathJax.tex2svg) return Promise.resolve();
  if (!mjLoad){ window.MathJax = { svg:{ fontCache:"none" }, startup:{ typeset:false } };
    mjLoad = loadScript("vendor/mathjax/tex-svg.js").then(() => window.MathJax.startup.promise).then(() => { try { document.head.appendChild(window.MathJax.svgStylesheet()); } catch {} }); }
  return mjLoad;
}
function renderMathInto(box, text){
  box.textContent = "";
  for (const seg of parseMath(text)){
    if (seg.t === "text"){ box.appendChild(document.createTextNode(seg.s)); continue; }
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
function openCardStyle(id, anchor){
  const it = itemById(id); if (!it) return;
  const apply = fn => { fn(it); renderWs(); select(id); commit(); savePrefs(); openCardStyle(id, cardEls.get(id).querySelector(".cst") || anchor); };
  stylePop.innerHTML = "";
  const h = document.createElement("div"); h.className = "sh-h"; h.textContent = it.type === "image" ? "Görsel kartı" : it.type === "note" ? "Not kartı" : "Alıntı kartı"; stylePop.appendChild(h);
  const sec = t => { const l = document.createElement("div"); l.className = "sh-l"; l.textContent = t; stylePop.appendChild(l); const r = document.createElement("div"); r.className = "st-row"; stylePop.appendChild(r); return r; };
  const r1 = sec("Renk (çerçeve ve başlık)");
  for (const k of HL_COLORS){ const d = document.createElement("button"); d.className = "dot c-" + k + (it.color === k ? " on" : ""); d.title = CNAME[k]; d.setAttribute("aria-label", CNAME[k]); d.onclick = () => apply(x => { x.color = k; S.lastColor = k; if (x.doc) renderDocPage(x.doc, x.page); }); r1.appendChild(d); }
  const r2 = sec("Kağıt");
  for (const [k, p] of Object.entries(PAPER_COLORS)){ const b = document.createElement("button"); b.className = "paper-sw"; b.style.setProperty("--pl", p.l); b.style.setProperty("--pd", p.d); b.title = p.name; b.setAttribute("aria-label", p.name); b.setAttribute("aria-pressed", String((it.bg || "white") === k));
    b.onclick = () => apply(x => { if (k === "white") delete x.bg; else x.bg = k; S.lastBg = k; }); r2.appendChild(b); }
  const r3 = sec("Çerçeve"); const seg = document.createElement("span"); seg.className = "seg3"; r3.appendChild(seg);
  for (const [k, name] of Object.entries(FRAMES)){ const b = document.createElement("button"); b.textContent = name; b.setAttribute("aria-pressed", String((it.frame || "thin") === k)); b.onclick = () => apply(x => { if (k === "thin") delete x.frame; else x.frame = k; S.lastFrame = k; }); seg.appendChild(b); }
  const r4 = sec("Yazı tipi"); const fb = document.createElement("button"); fb.className = "font-pick"; fb.innerHTML = ICON.font; const fn = document.createElement("span"); fn.textContent = fontName(it.font); if (it.font) fn.style.fontFamily = fontCss(it.font); fb.appendChild(fn);
  fb.onclick = () => openFontPop(fb, it.font, fid => { if (fid) it.font = fid; else delete it.font; S.lastFont = fid; renderWs(); select(id); commit(); savePrefs(); });
  r4.appendChild(fb);
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
function linkCurve(A, B){
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
    const { d, mx, my } = linkCurve(A, B), on = S.selLink === L.id;
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
  const del = document.createElement("button"); del.className = "icon-btn sm lkb-del"; del.innerHTML = ICON.del; del.title = "Bağlantıyı sil"; del.setAttribute("aria-label", del.title); del.onclick = () => { const id = S.selLink; hideLkBar(); if (id) removeLink(id); };
  const sep = () => { const s = document.createElement("span"); s.className = "lkb-sep"; return s; };
  bar.append(cols, sep(), heads, dash, sep(), del);
  bar.addEventListener("pointerdown", e => e.stopPropagation());
  document.body.appendChild(bar);
  return bar;
})();
function editLink(fn){ const L = selLinkObj(); if (!L) return; fn(L); drawLinks(); scheduleX(); if (L.pins || L.anchor) renderAllOverlays(); commit(); }
function showLkBar(L, x, y){
  lkBar.querySelectorAll(".lkb-dot").forEach(b => b.classList.toggle("on", (L.color || "") === b.dataset.c));
  const h = linkHeads(L); lkBar.querySelectorAll(".lkb-heads button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.h === h)));
  lkBar.querySelector(".lkb-dash").setAttribute("aria-pressed", String(!!L.dash));
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
  const L = { id:uid(), a, b:id, arrow:true, ...(S.lastLinkColor ? { color:S.lastLinkColor } : {}), ...(S.lastLinkDash ? { dash:true } : {}) }; S.proj.links.push(L); selectLink(L.id); commit();
}
function completeAnchor(anchor){
  const a = S.linkFrom; cancelLink(); if (!a) return;
  if (S.proj.links.some(L => L.anchor && L.a === a && L.anchor.id === anchor.id)){ toast("Bu bağlantı zaten var"); return; }
  S.proj.links.push({ id:uid(), a, anchor, to:"anchor", ...(S.lastLinkColor ? { color:S.lastLinkColor } : {}), ...(S.lastLinkDash ? { dash:true } : {}) }); S.sel = a; renderWs(); renderAllOverlays(); commit(); toast("Kart belgedeki işarete bağlandı");
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
  if (!it.font && S.lastFont) it.font = S.lastFont; if (!it.bg && S.lastBg && S.lastBg !== "white") it.bg = S.lastBg; if (!it.frame && S.lastFrame && S.lastFrame !== "thin") it.frame = S.lastFrame; if (!it.fs && S.lastFs !== 1){ it.fs = S.lastFs; it.w = Math.round(Math.min(900, it.w * S.lastFs)); } S.proj.items.push(it); S.sel = it.id; renderWs(); commit(); if (isNarrow()) setTab("ws"); if (!pt) showCardIfHidden(it.id);
  const f = () => { const t = el.plane.querySelector(`textarea[data-note="${it.id}"]`); if (t && document.activeElement !== t) t.focus({ preventScroll:true }); }; f(); requestAnimationFrame(f);
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

el.ws.addEventListener("pointerdown", e => {
  if (e.pointerType === "pen" && !S.penOnly) setPenOnly(true, true);
  if (!["pen","hl","eraser","text"].includes(S.tool)) return;
  if (e.target.closest(".hud,.link-hint,.lk-del,.lk-pt,.spaces,.wsfind")) return;
  if (S.tool === "text"){ if (e.target.closest(".card,.group")) return; e.stopPropagation(); e.preventDefault(); const pt = screenToPlane(e.clientX, e.clientY); addNote({ x:pt.x - 20, y:pt.y - 20 }); return; }
  if (e.pointerType === "touch" && S.penOnly) return;
  if (e.target.closest("textarea,input")) return;
  e.stopPropagation(); e.preventDefault(); el.ws.setPointerCapture(e.pointerId);
  const pt = screenToPlane(e.clientX, e.clientY);
  if (S.tool === "eraser"){ draw = { mode:"erase", where:"ws", id:e.pointerId }; eraseAt("ws", null, null, [pt.x, pt.y]); } else beginStroke(e, "ws", null, null, [pt.x, pt.y]);
}, true);
const ptrs = new Map(); let pan = null, pinch = null;
el.ws.addEventListener("pointerdown", e => {
  if (e.target.closest(".card,.group,.hud,.lk-hit,.lk-del,.lk-pt,.link-hint,.spaces,.wsfind")) return;
  if (S.linkFrom){
    /* linking and tapped an empty spot: the link ends right there */
    const from = S.linkFrom; cancelLink(); e.stopPropagation(); e.preventDefault();
    const p = screenToPlane(e.clientX, e.clientY), L = { id:uid(), a:from, pt:{ x:r2(p.x), y:r2(p.y) }, heads:"end", ...(S.lastLinkColor ? { color:S.lastLinkColor } : {}), ...(S.lastLinkDash ? { dash:true } : {}) };
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
  if (draw && draw.where === "ws" && draw.id === e.pointerId){ for (const ce of pointsFrom(e)){ const pt = screenToPlane(ce.clientX, ce.clientY); if (draw.mode === "erase") eraseAt("ws", null, null, [pt.x, pt.y]); else extendStroke([pt.x, pt.y], ce.pressure, e); } if (draw.mode === "stroke") linkPreview(e); return; }
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x:e.clientX, y:e.clientY }); const v = view();
  if (pinch && ptrs.size >= 2){ const [a, b] = [...ptrs.values()], r = el.ws.getBoundingClientRect(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; v.s = clamp(pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, 0.1, 2.5); v.tx = mx - r.left - pinch.px * v.s; v.ty = my - r.top - pinch.py * v.s; applyView(); }
  else if (pan){ if (Math.hypot(e.clientX - pan.x, e.clientY - pan.y) > 4) pan.moved = true; v.tx = pan.tx + e.clientX - pan.x; v.ty = pan.ty + e.clientY - pan.y; applyView(); }
});
function ptrEnd(e){
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
function downloadBlob(blob, filename){ const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function buildZip(projRec){
  const data = projRec.data, zip = new JSZip();
  zip.file("mimetype", EDNOTE_MIME, { compression:"STORE" });
  zip.file("project.json", JSON.stringify({ ...data, app:"ednote", v:SCHEMA }, null, 1));
  for (const d of data.docs){ const p = await DB.get("pdfs", d.fp); if (p) zip.file("docs/" + d.fp + ".pdf", p.bytes); }
  for (const r of data.recs || []){ const b = await DB.get("blobs", r.id); if (b) zip.file("audio/" + r.id + audioExt(r.mime), b.blob); }
  for (const it of data.items || []) if (it.type === "video" && !it.local){ const b = await DB.get("blobs", it.vid); if (b) zip.file("media/" + it.vid + videoExt(it.mime), b.blob); }
  return { blob: await zip.generateAsync({ type:"blob", compression:"STORE", mimeType:EDNOTE_MIME }), name: safeName(projRec.name) + ".ednote" };
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
    let zip; try { zip = await JSZip.loadAsync(file); } catch { toast("Bu dosya bir ED Note projesi değil. .ednote ya da eski .alinti.zip dosyası seç.", null, 5000); return; }
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
    const clean = cleanProject(proj);
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
    const clean = cleanProject(proj);
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
    for (const it of ex) md += (it.photo ? `*[Fotoğraf]*` : it.type === "image" ? `*[Görsel alıntı]*` : `> ${it.text}`) + (it.photo ? "" : `\n\n*Sayfa ${it.page}*`) + (it.note ? `\n\n${it.note}` : "") + (it.tags ? `\n\n${it.tags.map(t => "#" + t.replace(/\s/g, "_")).join(" ")}` : "") + "\n\n---\n\n";
    if (cm.length){ md += `### Yorumlar\n\n`; for (const c of cm) md += `- s. ${c.page}: "${(c.quote || "").slice(0, 80)}" ${c.text.replace(/\n/g, " ")}\n`; md += "\n"; }
    if (tx.length){ md += `### Belge üzerindeki notlar\n\n`; for (const t of tx) md += `- s. ${t.page}: ${t.text.replace(/\n/g, " ")}\n`; md += "\n"; }
  }
  for (const sp of p.spaces){
    const notes = p.items.filter(i => i.type === "note" && i.space === sp.id && !i.group), groups = p.groups.filter(g => g.space === sp.id);
    if (!notes.length && !groups.length) continue;
    md += `## ${sp.name}\n\n`;
    for (const g of groups){ md += `### ${g.title || "Grup"}\n\n`; for (const it of p.items.filter(i => i.group === g.id).sort((a, b) => a.ord - b.ord)) md += `- ${(it.type === "note" ? it.note : it.text || "[görsel]").replace(/\n/g, " ").slice(0, 160)}\n`; md += "\n"; }
    for (const n of notes) md += `- ${n.note.replace(/\n/g, " ") || "(boş not)"}\n`;
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
  const fontsUsed = new Set([...proj.items.map(i => i.font), ...proj.texts.map(t => t.font)].filter(id => FONT_IDS.has(id))), fontOf = new Map();
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
  function mathFlow(text, f, size, lh, maxW){
    const ex = size * 0.45, space = f.widthOfTextAtSize(" ", size), rows = []; let row = { items:[], w:0, asc:size * 0.8, desc:size * 0.25, center:false };
    const push = () => { rows.push(row); row = { items:[], w:0, asc:size * 0.8, desc:size * 0.25, center:false }; };
    const add = (item, w) => { if (row.items.length && row.w + w > maxW) push(); item.x = row.w; row.items.push(item); row.w += w; };
    for (const seg of parseMath(text)){
      if (seg.t === "text"){
        const parts = safeTxt(seg.s).split(/(\n| )/);
        for (const p of parts){ if (p === "\n"){ push(); continue; } if (p === " "){ if (row.items.length) row.w += space; continue; } if (!p) continue; add({ k:"w", s:p }, f.widthOfTextAtSize(p, size)); }
        continue;
      }
      const m = mathPng.get((seg.display ? "D|" : "I|") + seg.tex);
      if (!m){ add({ k:"w", s:safeTxt(seg.tex) }, f.widthOfTextAtSize(safeTxt(seg.tex), size)); continue; }
      let w = m.wEx * ex, h = m.hEx * ex; if (w > maxW){ h *= maxW / w; w = maxW; }
      const depth = -m.va * ex, item = { k:"m", key:(seg.display ? "D|" : "I|") + seg.tex, w, h, depth };
      if (seg.display){ if (row.items.length) push(); add(item, w); row.center = true; row.asc = Math.max(row.asc, h - depth); row.desc = Math.max(row.desc, depth); push(); }
      else { add(item, w); row.asc = Math.max(row.asc, h - depth); row.desc = Math.max(row.desc, depth); }
    }
    if (row.items.length) push();
    let y = 0; for (const r of rows){ const rh = Math.max(lh, r.asc + r.desc + 3); r.base = y + (rh - r.asc - r.desc) / 2 + r.asc; r.top = y; y += rh; if (r.center){ const off = (maxW - r.w) / 2; r.items.forEach(i => i.x += off); } }
    return { rows, h:y };
  }
  const imgs = new Map();
  for (const it of proj.items) if (it.type === "image" || (it.type === "video" && it.poster)){ try { imgs.set(it.id, await pngBytesOf(it.type === "video" ? it.poster : it.src)); } catch {} }
  function cardLayout(it, w){
    const f = it.fs || 1, qs = QS * f, ql = QL * f, ns = NS * f, nl = NL * f, cf = fontFor(it.font);
    const inner = w - PAD * 2, parts = []; let h = PAD + 12;
    if (it.type === "excerpt"){ const lines = wrapText(it.text, cf, qs, inner - 8); parts.push({ k:"quote", lines, y:h + 6, s:qs, l:ql }); h += 8 + lines.length * ql; }
    if (it.type === "image" || it.type === "video"){ const im = imgs.get(it.id); const ih = im ? inner * im.h / im.w : 60; parts.push({ k:"img", y:h + 6, h:ih, video:it.type === "video" }); h += 10 + ih; }
    if (hasMath(it.note) && mathPng.size){ const fl = mathFlow(it.note, cf, ns, nl, inner); parts.push({ k:"mnote", rows:fl.rows, y:h + 8, s:ns }); h += 10 + fl.h; }
    else if ((it.note || "").trim()){ const lines = wrapText(it.note, cf, ns, inner); parts.push({ k:"note", lines, y:h + 8, s:ns, l:nl }); h += 10 + lines.length * nl; }
    return { h:h + PAD, parts };
  }
  const wsPages = [];
  for (const sp of proj.spaces){
    const items = proj.items.filter(i => i.space === sp.id), inks = proj.ink.filter(s => s.where === "ws" && s.space === sp.id);
    if (!items.length && !inks.length && !proj.links.some(l => l.at && l.at.space === sp.id)) continue;
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
    const col = hexRgb(st.kind === "hl" ? HL_HEX[st.color] : PEN_HEX[st.color]);
    let path = `${n2(pts[0][0])} ${n2(pts[0][1])} m `; if (pts.length === 1) path += `${n2(pts[0][0] + 0.01)} ${n2(pts[0][1])} l `; for (let i = 1; i < pts.length; i++) path += `${n2(pts[i][0])} ${n2(pts[i][1])} l `;
    const ops = `${st.kind === "hl" ? "/G0 gs " : ""}${col.map(n2).join(" ")} RG ${n2(w)} w 1 J 1 j ${path}S`;
    addAnnot(page, { Subtype:"Ink", Rect:bb, InkList:[pts.flat()], C:col, BS:{ W:w }, ...(st.kind === "hl" ? { CA:0.42 } : {}), NM:txt(st.id),
      AP:{ N:apForm(bb, ops, st.kind === "hl" ? { BM:"Multiply", CA:0.42, ca:0.42 } : null) } });
  }
  for (const t of proj.texts){
    if (!hasPage(t.doc, t.page) || !t.text.trim()) continue;
    const page = pagesOf.get(t.doc)[t.page - 1], [x, top] = P(t.doc, t.page, t.x, t.y), col = rgb(...hexRgb(PEN_HEX[t.color] || PEN_HEX.k));
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
    const paperHex = (PAPER_COLORS[sp.paper] || { l:"#fdfdfb" }).l;
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
      svg(rr(g.x, g.y, g.w, g.h, 10), { color:rgb(.945, .945, .93), borderColor:HAIR, borderWidth:0.6 });
      page.drawText(safeTxt(g.g.title || "Grup"), { x:X(g.x + 12), y:Y(g.y + 20), size:10 * k, font:bold, color:INK });
      const cnt = `${g.n} kart`; page.drawText(cnt, { x:X(g.x + g.w - 12) - font.widthOfTextAtSize(cnt, 8 * k), y:Y(g.y + 20), size:8 * k, font, color:INK2 });
    }
    /* card to card links (drawn under the cards) */
    for (const l of proj.links){
      if (l.anchor || l.pins) continue; const A = wp.boxes.get(l.a), B = l.pt ? null : wp.boxes.get(l.b); if (!A || (!B && !l.pt)) continue;
      const bx = b => ({ x1:b.x, y1:b.y, x2:b.x + b.w, y2:b.y + b.h, cx:b.x + b.w / 2, cy:b.y + b.h / 2 });
      const col = l.color && LINK_COLORS[l.color] ? rgb(...hexRgb(LINK_COLORS[l.color])) : rgb(.55, .55, .57), hd = linkHeads(l);
      const { d } = linkCurve(bx(A), l.pt ? pointBox(l.pt) : bx(B)); svg(d, { borderColor:col, borderWidth:l.color ? 1.6 : 1.2, ...(l.dash ? { borderDashArray:[6, 4] } : {}) });
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
      const dotCol = rgb(...hexRgb(HL_HEX[it.color] || HL_HEX.y)), frame = it.frame || "thin";
      svg(rr(x, y, w, h, 9), { color:rgb(...hexRgb((PAPER_COLORS[it.bg] || PAPER_COLORS.white).l)) });
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
          if (item.k === "w") drawTxt(page, item.s, { x:X(x + PAD + item.x), y:Y(y + part.y + row.base), size:part.s * k, font:fontFor(it.font), color:it.type === "note" ? INK : INK2 });
          else { let e = mathEmb.get(item.key); if (!e){ e = await out.embedPng(mathPng.get(item.key).bytes); mathEmb.set(item.key, e); }
            page.drawImage(e, { x:X(x + PAD + item.x), y:Y(y + part.y + row.base + item.depth), width:item.w * k, height:item.h * k }); }
        }
        if (part.k === "note") part.lines.forEach((ln, i) => drawTxt(page, ln, { x:X(x + PAD), y:Y(y + part.y + (i + 1) * part.l - 3), size:part.s * k, font:fontFor(it.font), color:it.type === "note" ? INK : INK2 }));
      }
      wp.boxes.get(it.id).page = page;
    }
    /* workspace ink */
    for (const st of wp.inks){
      const col = rgb(...hexRgb(st.kind === "hl" ? HL_HEX[st.color] : PEN_HEX[st.color]));
      svg(polyD(st.pts), { borderColor:col, borderWidth:(st.pr ? st.w * 0.9 : st.w), borderOpacity:st.kind === "hl" ? 0.42 : 1, borderLineCap:LineCapStyle.Round });
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
function linkLook(l){ return { ...(LINK_COLORS[l.color] ? { color:l.color } : {}), ...(HEADS.includes(l.heads) ? { heads:l.heads } : {}), ...(l.dash ? { dash:true } : {}) }; }
function cleanTags(t){ if (!Array.isArray(t)) return {}; const out = [...new Set(t.map(normTag).filter(Boolean))].slice(0, 30); return out.length ? { tags:out } : {}; }
function cleanProject(p){
  const q = emptyProject(p.name);
  q.id = String(p.id || q.id); q.name = String(p.name || "Proje");
  q.docs = (p.docs || []).filter(d => d && d.fp).map(d => ({ fp:String(d.fp), name:String(d.name || "Belge.pdf") }));
  q.spaces = (p.spaces || []).filter(s => s && s.id).map(s => ({ id:String(s.id), name:String(s.name || "Masa"), view: s.view && isFinite(s.view.s) ? { tx:+s.view.tx || 0, ty:+s.view.ty || 0, s:clamp(+s.view.s, 0.1, 2.5) } : { tx:40, ty:60, s:1 },
    sheet: s.sheet && [s.sheet.x, s.sheet.y, s.sheet.w, s.sheet.h].every(isFinite) && s.sheet.w > 0 && s.sheet.h > 0 ? { x:+s.sheet.x, y:+s.sheet.y, w:+s.sheet.w, h:+s.sheet.h } : null,
    pattern: PATTERNS[s.pattern] ? s.pattern : "dot", ...(PAPER_COLORS[s.paper] && s.paper !== "white" ? { paper:s.paper } : {}) }));
  if (!q.spaces.length) q.spaces = emptyProject().spaces;
  const sids = new Set(q.spaces.map(s => s.id)), fps = new Set(q.docs.map(d => d.fp)), s0 = q.spaces[0].id;
  q.groups = (p.groups || []).filter(g => g && g.id).map(g => ({ id:String(g.id), space:sids.has(g.space) ? g.space : s0, x:+g.x || 0, y:+g.y || 0, w:clamp(+g.w || 280, 200, 960), title:String(g.title || ""), collapsed:!!g.collapsed }));
  const gids = new Set(q.groups.map(g => g.id));
  q.items = (p.items || []).filter(i => i && typeof i.id === "string" && ["excerpt","note","image","video"].includes(i.type) && (i.type !== "image" || /^data:image\/(png|webp|jpeg);base64,/.test(i.src || "")) && (i.type === "note" || i.type === "video" || fps.has(i.doc))).map(i => ({
    id:i.id, type:i.type, text:String(i.text || ""), note:String(i.note || ""), ...(i.type !== "note" && i.type !== "video" ? { doc:i.doc, page:+i.page || 1, rects:cleanRects(i.rects) } : {}), ...(i.type === "image" ? { src:i.src } : {}),
    ...(i.type === "video" ? { vid:String(i.vid || i.id), name:String(i.name || "video.mp4"), mime:String(i.mime || "video/mp4"), size:+i.size || 0, dur:+i.dur || 0, vw:+i.vw || 0, vh:+i.vh || 0, ...(/^data:image\/jpeg;base64,/.test(i.poster || "") ? { poster:i.poster } : {}), ...(i.local ? { local:true } : {}) } : {}),
    space:sids.has(i.space) ? i.space : s0, color:HL_COLORS.includes(i.color) ? i.color : "y", x:+i.x || 0, y:+i.y || 0, w:clamp(+i.w || 240, 170, 900),
    ...(isFinite(i.fs) && +i.fs !== 1 ? { fs:clamp(+i.fs, 0.7, 3) } : {}),
    ...(PAPER_COLORS[i.bg] && i.bg !== "white" ? { bg:i.bg } : {}), ...(FRAMES[i.frame] && i.frame !== "thin" ? { frame:i.frame } : {}), ...(FONT_IDS.has(i.font) ? { font:i.font } : {}),
    ...(gids.has(i.group) ? { group:i.group, ord:+i.ord || 0 } : {}), ...cleanTags(i.tags), ...(i.type === "image" && i.photo ? { photo:true } : {}), ...recOf(i) }));
  const ids = new Set(q.items.map(i => i.id));
  q.ink = (p.ink || []).filter(s => s && Array.isArray(s.pts) && s.pts.length && ((s.where === "pdf" && fps.has(s.doc)) || s.where === "ws")).map(s => ({
    id:String(s.id || uid()), where:s.where, ...(s.where === "pdf" ? { doc:s.doc, page:+s.page || 1 } : { space:sids.has(s.space) ? s.space : s0 }), kind:s.kind === "hl" ? "hl" : "pen",
    color:(s.kind === "hl" ? HL_COLORS : PEN_COLORS).includes(s.color) ? s.color : (s.kind === "hl" ? "y" : "k"), w:clamp(+s.w || 2, 0.5, 40), pr:!!s.pr,
    pts:s.pts.filter(v => Array.isArray(v) && isFinite(v[0]) && isFinite(v[1])).map(v => [+v[0], +v[1], +(v[2] ?? 0.5)]), ...recOf(s) }));
  q.texts = (p.texts || []).filter(t => t && typeof t.text === "string" && fps.has(t.doc)).map(t => ({ id:String(t.id || uid()), doc:t.doc, page:+t.page || 1, x:+t.x || 0, y:+t.y || 0, w:clamp(+t.w || 180, 40, 600), text:t.text, color:PEN_COLORS.includes(t.color) ? t.color : "k", size:clamp(+t.size || 11, 6, 40), ...(FONT_IDS.has(t.font) ? { font:t.font } : {}), ...recOf(t) }));
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
  const ui = p.ui || {}; q.ui = { space:sids.has(ui.space) ? ui.space : s0, viewers:(ui.viewers || []).filter(f => fps.has(f)), split:!!ui.split && q.docs.length > 0 };
  return q;
}
async function openProject(data, opts = {}){
  if (Rec.active) await stopRecording();
  closePlayer(); closePop(); hideBanner(); toggleSearch(false); textCache.clear(); if (WF.open) closeWsFind(); closeExam();
  const proj = cleanProject(data);
  if (!proj.docs.length){ toast("Projede belge yok."); return; }
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
    const p = emptyProject(stripPdf(file.name)); p.docs = [{ fp, name:file.name }]; p.ui = { space:p.spaces[0].id, viewers:[fp], split:false };
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
  p.docs = docs; p.ui = { space:p.spaces[0].id, viewers:docs.slice(0, 2).map(d => d.fp), split:docs.length > 1 && !isNarrow() };
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
async function renderHome(){
  let projs = []; try { projs = (await DB.all("projects")).sort((a, b) => b.updated - a.updated); } catch {}
  el.recent.innerHTML = ""; el.recentEmpty.hidden = projs.length > 0;
  for (const r of projs){
    const d = r.data || {}; const li = document.createElement("li"); li.className = "rc";
    const main = document.createElement("button"); main.className = "rc-main";
    const nm = document.createElement("span"); nm.className = "rc-name"; nm.textContent = r.name;
    const it = d.items || [], ex = it.filter(i => i.type !== "note").length, nt = it.filter(i => i.type === "note").length, nd = (d.docs || []).length, rc = (d.recs || []).length;
    const parts = [fmtDate(r.updated)]; if (nd > 1) parts.push(nd + " belge"); if (ex) parts.push(ex + " alıntı"); if (nt) parts.push(nt + " not"); if (rc) parts.push(rc + " kayıt");
    const mt = document.createElement("span"); mt.className = "rc-meta"; mt.textContent = parts.join(" · ");
    main.append(nm, mt); main.onclick = () => openProject(d);
    const acts = document.createElement("div"); acts.className = "rc-acts";
    const ex2 = document.createElement("button"); ex2.className = "icon-btn sm"; ex2.title = "Dışa aktar (.ednote)"; ex2.setAttribute("aria-label", ex2.title); ex2.innerHTML = ICON.download; ex2.onclick = () => exportZip(r.id);
    const del = document.createElement("button"); del.className = "icon-btn sm"; del.title = "Bu cihazdan sil"; del.setAttribute("aria-label", del.title); del.innerHTML = ICON.del;
    del.onclick = async () => {
      if (!del.dataset.arm){ del.dataset.arm = "1"; del.style.color = "var(--rec)"; toast(OD.enabled() && OD._st.auth ? "Silmek için tekrar dokun. Proje bu cihazdan ve OneDrive'dan kaldırılır." : "Silmek için tekrar dokun. Proje ve notları bu cihazdan kaldırılır."); setTimeout(() => { delete del.dataset.arm; del.style.color = ""; }, 4000); return; }
      await deleteLocalProject(r.id); await OD.forget(r.id); renderHome();
    };
    acts.append(ex2, del); li.append(main, acts); el.recent.appendChild(li);
  }
}
$("#hOpen").onclick = () => { $("#filePdf").dataset.mode = "new"; $("#filePdf").click(); };
$("#hImport").onclick = () => $("#fileZip").click();
$("#hFolder").hidden = !FS.supported; $("#hFolder").onclick = openFolderProject;
$("#hSample").onclick = () => openSample();
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
  if (e.key === "Escape"){ closePop(); cancelLink(); hideChip(); select(null); }
  else if (e.key === "Delete" || e.key === "Backspace"){ if (S.selLink){ e.preventDefault(); removeLink(S.selLink); } else if (S.sel){ e.preventDefault(); removeItem(S.sel); } }
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
  const hay = ((i.text || "") + " " + (i.note || "") + " " + (i.tags || []).map(t => "#" + t).join(" ") + (i.photo ? " fotoğraf" : "")).toLocaleLowerCase("tr");
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
  WF.q = $("#wsQ").value.trim().toLocaleLowerCase("tr");
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
  if (S.lastBg && S.lastBg !== "white") it.bg = S.lastBg; if (S.lastFrame && S.lastFrame !== "thin") it.frame = S.lastFrame; if (S.lastFont) it.font = S.lastFont;
  S.proj.items.push(it); S.sel = it.id; renderWs(); commit(); showCardIfHidden(it.id);
  toast(it.rec ? "Fotoğraf kaydın bu anına bağlandı" : "Fotoğraf masaya eklendi");
}
/* on a laptop the file picker cannot take a photo, so the camera opens here; phones use their own camera screen */
const CAM = { stream:null };
async function openCamera(){
  const phone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (phone || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ $("#filePhoto").click(); return; }
  $("#cam").hidden = false; $("#camErr").hidden = true; $("#camShot").disabled = true; $("#camVideo").hidden = false;
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
function closeCamera(){ if (CAM.stream){ CAM.stream.getTracks().forEach(t => t.stop()); CAM.stream = null; } $("#camVideo").srcObject = null; $("#cam").hidden = true; }
$("#camShot").onclick = () => {
  const v = $("#camVideo"), w = v.videoWidth, h = v.videoHeight; if (!w || !S.proj) return;
  const k = Math.min(1, 1600 / Math.max(w, h)), c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  $("#cam").classList.add("flash"); setTimeout(() => $("#cam").classList.remove("flash"), 180);
  addPhoto({ src:c.toDataURL("image/jpeg", 0.85), w:c.width, h:c.height }); setTimeout(closeCamera, 200);
};
$("#camFile").onclick = () => { closeCamera(); $("#filePhoto").click(); };
$("#camClose").onclick = closeCamera;
document.addEventListener("keydown", e => {
  if ($("#cam").hidden) return; e.stopImmediatePropagation();
  if (e.key === "Escape"){ e.preventDefault(); closeCamera(); } else if ((e.key === " " || e.key === "Enter") && !$("#camShot").disabled && document.activeElement !== $("#camFile") && document.activeElement !== $("#camClose")){ e.preventDefault(); $("#camShot").click(); }
}, true);
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
  if (S.lastBg && S.lastBg !== "white") it.bg = S.lastBg; if (S.lastFrame && S.lastFrame !== "thin") it.frame = S.lastFrame; if (S.lastFont) it.font = S.lastFont;
  S.proj.items.push(it); S.sel = it.id; renderWs(); commit(); showCardIfHidden(it.id); return it;
}
async function addVideo(f, st){
  if (!S.proj) return;
  const name = f.name && f.name !== "blob" ? f.name : `ED Note video ${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}${videoExt(f.type)}`;
  const file = f.name === name ? f : new File([f], name, { type:f.type || "video/mp4" });
  toast("Video hazırlanıyor…");
  let meta; try { meta = await videoMeta(file); } catch { meta = { dur:0, vw:0, vh:0, poster:"" }; }
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
  const st = { auth:null, busy:false, again:false, timer:null, last:0, err:"", needLogin:false, progress:"" };
  const enabled = () => !!CID && /^https?:$/.test(location.protocol);
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
    const r = await fetch(AUTH + "/token", { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body:new URLSearchParams({ client_id:CID, scope:SCOPE, ...params }) });
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
  async function gfetch(url, opts = {}, again = true){
    const r = await fetch(url, { ...opts, headers:{ ...(opts.headers || {}), Authorization:"Bearer " + await token() } });
    if (r.status === 401 && again){ await token(true); return gfetch(url, opts, false); }
    if ((r.status === 429 || r.status === 503) && again){ await sleep(Math.min(30, +r.headers.get("Retry-After") || 5) * 1000); return gfetch(url, opts, false); }
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
  async function put(path, blob, ifMatch){
    const h = ifMatch ? { "If-Match":ifMatch } : {};
    if (blob.size <= SMALL){
      const r = await gfetch(ROOT + ":/" + path + ":/content", { method:"PUT", headers:{ ...h, "Content-Type":blob.type || "application/octet-stream" }, body:blob });
      if (r.status === 412) throw conflictErr(); if (!r.ok) throw new Error("upload " + r.status); return r.json();
    }
    const s = await gfetch(ROOT + ":/" + path + ":/createUploadSession", { method:"POST", headers:{ ...h, "Content-Type":"application/json" }, body:JSON.stringify({ item:{ "@microsoft.graph.conflictBehavior":"replace" } }) });
    if (s.status === 412) throw conflictErr(); if (!s.ok) throw new Error("session " + s.status);
    const { uploadUrl } = await s.json();
    for (let o = 0; o < blob.size; o += CHUNK){
      const end = Math.min(blob.size, o + CHUNK);
      const r = await fetch(uploadUrl, { method:"PUT", headers:{ "Content-Range":`bytes ${o}-${end - 1}/${blob.size}` }, body:blob.slice(o, end) });
      if (r.status === 412) throw conflictErr(); if (!r.ok) throw new Error("chunk " + r.status);
      if (end === blob.size) return r.json();
    }
  }
  async function get(item, path){
    const dl = item && item["@microsoft.graph.downloadUrl"];
    const r = dl ? await fetch(dl) : await gfetch(ROOT + ":/" + path + ":/content"); if (!r.ok) throw new Error("download " + r.status); return r;
  }
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

  async function pushAssets(data, R){
    for (const d of data.docs || []){
      if (R.pdfs.has(d.fp + ".pdf")) continue;
      const p = await DB.get("pdfs", d.fp).catch(() => null); if (!p) continue;
      st.progress = "PDF gönderiliyor: " + (d.name || "").slice(0, 30); ui();
      R.pdfs.set(d.fp + ".pdf", await put("pdfs/" + d.fp + ".pdf", new Blob([p.bytes], { type:"application/pdf" })));
    }
    for (const r of data.recs || []){
      const fn = r.id + audioExt(r.mime); if (R.audio.has(fn) || (Rec.active && Rec.active.id === r.id)) continue;
      const b = await DB.get("blobs", r.id).catch(() => null); if (!b) continue;
      st.progress = "Ses kaydı gönderiliyor"; ui();
      R.audio.set(fn, await put("audio/" + fn, b.blob));
    }
    for (const it of data.items || []){
      if (it.type !== "video" || it.local) continue; const fn = it.vid + videoExt(it.mime); if (R.media.has(fn)) continue;
      const b = await DB.get("blobs", it.vid).catch(() => null); if (!b) continue;
      st.progress = "Video gönderiliyor: " + it.name.slice(0, 30); ui();
      R.media.set(fn, await put("media/" + fn, b.blob));
    }
  }
  async function pullAssets(data, R){
    for (const d of data.docs || []){
      if (await DB.get("pdfs", d.fp).catch(() => null)) continue;
      const it = R.pdfs.get(d.fp + ".pdf"); if (!it) continue;
      st.progress = "PDF alınıyor: " + (d.name || "").slice(0, 30); ui();
      await DB.put("pdfs", { fp:d.fp, name:d.name, bytes:new Uint8Array(await (await get(it, "pdfs/" + d.fp + ".pdf")).arrayBuffer()) });
    }
    for (const r of data.recs || []){
      if (await DB.get("blobs", r.id).catch(() => null)) continue;
      const fn = r.id + audioExt(r.mime), it = R.audio.get(fn); if (!it) continue;
      await DB.put("blobs", { id:r.id, blob:await (await get(it, "audio/" + fn)).blob(), mime:r.mime });
    }
    for (const v of data.items || []){
      if (v.type !== "video" || v.local || await DB.get("blobs", v.vid).catch(() => null)) continue;
      const fn = v.vid + videoExt(v.mime), it = R.media.get(fn); if (!it) continue;
      if (await freeSpace() < it.size + 30e6) continue; /* no room on this device: the card says so and the video stays on OneDrive */
      st.progress = "Video alınıyor: " + v.name.slice(0, 30); ui();
      try { await DB.put("blobs", { id:v.vid, blob:await (await get(it, "media/" + fn)).blob(), mime:v.mime }); } catch (e){ console.warn("video", e); }
    }
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

  /* ---------- one full sync ---------- */
  async function sync(manual){
    if (!enabled() || !st.auth) return;
    if (!navigator.onLine){ if (manual) toast("İnternet yok. Bağlantı gelince eşitlenecek."); return; }
    if (st.busy){ st.again = true; return; }
    st.busy = true; st.err = ""; ui();
    let got = 0, sent = 0, copies = 0, removed = 0, reopen = null;
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
      const locals = await DB.all("projects"), seen = new Set();
      for (const rec of locals){
        seen.add(rec.id); if (!rec.data) continue;
        const m = await metaOf(rec.id), it = R.projects.get(rec.id + ".json"), lh = await contentHash(rec.data);
        if (!it){
          if (m && m.hash === lh && !isOpen(rec.id)){ await deleteLocalProject(rec.id); await DB.del("meta", "od:p:" + rec.id); removed++; continue; }
          const n = await upload(rec, R); await setMeta(rec.id, n.eTag, lh); sent++; continue;
        }
        if (m && it.eTag === m.eTag){
          if (m.hash !== lh){ const n = await upload(rec, R, it.eTag); await setMeta(rec.id, n.eTag, lh); sent++; }
          continue;
        }
        const remote = await (await get(it, "projects/" + rec.id + ".json")).json(), rh = await contentHash(remote);
        if (rh === lh){ await setMeta(rec.id, it.eTag, lh); continue; }
        if (m && lh === m.hash){
          if (isOpen(rec.id) && (S.editTick || 0) !== tick){ st.again = true; continue; }
          const clean = await storeLocal(remote, R); await setMeta(rec.id, it.eTag, rh); got++;
          if (isOpen(rec.id)) reopen = clean; continue;
        }
        if (m && rh === m.hash){ const n = await upload(rec, R, it.eTag); await setMeta(rec.id, n.eTag, lh); sent++; continue; }
        /* changed on both devices: keep ours, save theirs next to it */
        const copy = { ...remote, id:"p" + uid(), name:(remote.name || rec.name) + " (diğer cihaz, " + new Date().toLocaleDateString("tr-TR") + ")" };
        const cc = await storeLocal(copy, R); const n2 = await upload({ id:cc.id, name:cc.name, data:(await DB.get("projects", cc.id)).data }, R); await setMeta(cc.id, n2.eTag, await contentHash(cc));
        const n = await upload(rec, R, it.eTag); await setMeta(rec.id, n.eTag, lh); copies++; sent++;
      }
      /* new on OneDrive */
      for (const [name, it] of R.projects){
        const id = name.replace(/\.json$/, ""); if (seen.has(id) || !/\.json$/.test(name)) continue;
        const remote = await (await get(it, "projects/" + name)).json(); if (!remote || remote.id !== id) continue;
        const clean = await storeLocal(remote, R); await setMeta(id, it.eTag, await contentHash(clean)); got++;
      }
      st.last = Date.now(); ls.set("od:last", String(st.last));
      if (reopen){ await openProject(reopen); toast("Diğer cihazdaki değişiklikler alındı."); }
      if (copies) toast(`${copies} proje iki cihazda da değişmişti. Diğer cihazdaki sürüm "(diğer cihaz)" adıyla ayrıca kaydedildi.`, null, 7000);
      else if (manual) toast(got || sent || removed ? `Eşitlendi: ${got} alındı, ${sent} gönderildi.` : "Her şey güncel.");
      if (document.body.dataset.view === "home" && (got || copies || removed)) renderHome();
    } catch (e){
      if (e instanceof NeedLogin){ st.needLogin = true; if (manual) login(); }
      else { console.warn("OneDrive", e); st.err = navigator.onLine ? "Eşitlenemedi" : "İnternet yok"; if (manual) toast("OneDrive ile eşitlenemedi. Biraz sonra tekrar denenecek."); }
    }
    st.busy = false; st.progress = ""; ui();
    if (st.again){ st.again = false; soon(4000); }
  }
  function soon(ms = 15000){ if (!enabled() || !st.auth || st.needLogin) return; clearTimeout(st.timer); st.timer = setTimeout(() => sync(false), ms); }
  async function forget(id){ const m = await metaOf(id); if (m){ await DB.put("meta", { k:"od:del:" + id, eTag:m.eTag }); await DB.del("meta", "od:p:" + id); soon(2000); } }
  async function logout(){
    st.auth = null; await saveAuth();
    for (const m of await DB.all("meta").catch(() => [])) if (/^od:(p|del):/.test(m.k)) await DB.del("meta", m.k).catch(() => {});
    ui(); toast("OneDrive bağlantısı kesildi. Projeler bu cihazda kaldı.");
  }

  /* ---------- status on the home screen and in the editor ---------- */
  const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? "az önce" : s < 3600 ? Math.round(s / 60) + " dk önce" : s < 86400 ? Math.round(s / 3600) + " saat önce" : new Date(t).toLocaleDateString("tr-TR"); };
  function ui(){
    const row = $("#odRow"), on = enabled(); row.hidden = !on; $("#mSync").hidden = !on;
    if (!on) return;
    const txt = $("#odText"), btn = $("#odBtn"), off = $("#odOff");
    if (!st.auth){ txt.textContent = "Projelerini cihazların arasında eşitle"; btn.textContent = "Bağlan"; btn.onclick = login; off.hidden = true; $("#mSync").textContent = "OneDrive'a bağlan"; return; }
    off.hidden = false; $("#mSync").textContent = "OneDrive ile şimdi eşitle";
    if (st.needLogin){ txt.textContent = (st.auth.account ? st.auth.account + " · " : "") + "oturumu yenilemek gerekiyor"; btn.textContent = "Yeniden giriş"; btn.onclick = login; $("#mSync").textContent = "OneDrive'a yeniden giriş yap"; return; }
    txt.textContent = (st.auth.account ? st.auth.account + " · " : "") + (st.busy ? (st.progress || "eşitleniyor…") : st.err ? st.err : st.last ? "eşitlendi, " + ago(st.last) : "bağlı");
    btn.textContent = "Şimdi eşitle"; btn.disabled = st.busy; btn.onclick = () => sync(true);
    if (S.proj && !S.sample && document.body.dataset.view === "editor" && !st.busy && st.last && !st.err && el.saveState.textContent.startsWith("Kaydedildi")) setSaveState("Kaydedildi · OneDrive");
  }
  async function boot(){
    if (!enabled()){ ui(); return null; }
    try { const a = await DB.get("meta", "od:auth"); if (a && a.access) { const { k, ...rest } = a; st.auth = rest; } } catch {}
    st.last = +ls.get("od:last") || 0;
    const back = await handleRedirect();
    ui();
    if (st.auth){ await sync(false); }
    window.addEventListener("online", () => soon(1500));
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") sync(false); else soon(1500); });
    setInterval(() => { if (document.visibilityState === "visible") sync(false); }, 3 * 60 * 1000);
    setInterval(ui, 60 * 1000);
    return back;
  }
  $("#odOff").onclick = () => { if (!$("#odOff").dataset.arm){ $("#odOff").dataset.arm = "1"; toast("Bağlantıyı kesmek için tekrar dokun. Projeler bu cihazda kalır."); setTimeout(() => delete $("#odOff").dataset.arm, 4000); return; } logout(); };
  $("#mSync").onclick = () => { closePop(); st.auth && !st.needLogin ? sync(true) : login(); };
  return { boot, sync, soon, forget, login, ui, enabled, _st:st };
})();

/* ================= splitter ================= */
(function(){
  const main = $("#main"), split = $("#split");
  const saved = parseFloat(ls.get("alinti:split")); if (saved > 20 && saved < 85) main.style.setProperty("--left", saved + "%");
  split.addEventListener("pointerdown", e => {
    split.setPointerCapture(e.pointerId);
    const pct = ev => { const r = main.getBoundingClientRect(); return clamp((ev.clientX - r.left) / r.width * 100, 25, 82); };
    const move = ev => { main.style.setProperty("--left", pct(ev) + "%"); scheduleX(); };
    const up = ev => { split.removeEventListener("pointermove", move); split.removeEventListener("pointerup", up); ls.set("alinti:split", String(pct(ev))); S.viewers.forEach(v => v.fp && !v.root.hidden && fitWidth(v)); drawLinks(); };
    split.addEventListener("pointermove", move); split.addEventListener("pointerup", up);
  });
})();

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
  loadPrefs(); setReadMode(S.readMode); setTool("select");
  if (ls.get("alinti:penOnly") === "1") setPenOnly(true, false);
  S.recMode = ls.get("alinti:recMode") === "keep" ? "keep" : "trace"; renderRecModeIcon();
  await migrateOld();
  setView("home"); $("#appVer").textContent = "ED Note " + APP_VERSION;
  OD.boot().then(async back => { if (back && back.back){ const r = await DB.get("projects", back.back).catch(() => null); if (r && r.data && document.body.dataset.view === "home") openProject(r.data); } }).catch(e => console.warn(e));
  if ("launchQueue" in window) window.launchQueue.setConsumer(async lp => { if (lp.files && lp.files.length){ const f = await lp.files[0].getFile(); if (/\.(ednote|zip)$/i.test(f.name)) importZip(f); else openPdfFile(f, "new"); } });
  if ("serviceWorker" in navigator && /^https?:/.test(location.protocol) && location.hostname !== "localhost" && location.hostname !== "127.0.0.1"){
    navigator.serviceWorker.register("sw.js").then(reg => {
      reg.addEventListener("updatefound", () => { const nw = reg.installing; if (!nw) return; nw.addEventListener("statechange", () => { if (nw.state === "installed" && navigator.serviceWorker.controller) toast("Yeni sürüm hazır", { label:"Yenile", fn:() => location.reload() }, 10000); }); });
    }).catch(() => {});
  }
}
window.EDNote = window.AlintiMasasi = { version:APP_VERSION, _S:S, _OD:OD, _Rec:Rec };
boot();
})();
