/* ED Note OneDrive sync test (v6.9.3): two devices against a fake OneDrive.
   Run:  python3 -m http.server 8765   (in the app folder)
         node tests/onedrive.test.js http://localhost:8765/
   Needs Node with Playwright, Chromium and pdf-lib.
   Checks: 3 folders of PDFs reach the other device (incl. a large PDF sent in pieces), a file that keeps failing
   does not hold up the others and is retried, a hung download does not leave the sync stuck,
   and disconnecting + reconnecting the same account keeps what the device knows. */
const { chromium } = require("playwright");
const { PDFDocument } = require("pdf-lib");
const BASE = process.argv[2] || "http://localhost:8765/";
let failed = 0;
const check = (name, cond, msg) => { if (cond) console.log("  ok   " + name); else { failed++; console.log("  FAIL " + name + ": " + msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- fake OneDrive (Microsoft Graph, app folder only) ---------- */
const files = new Map(); /* path -> { bytes, eTag } */
let etagN = 0;
const rules = { failUpload:null, failUploadTimes:0, hangDownload:null, delay:0 };
const sessions = new Map();
const itemOf = path => { const f = files.get(path); const name = path.split("/").pop(); return { name, eTag:f.eTag, size:f.bytes.length, file:{}, "@microsoft.graph.downloadUrl":"https://fake.dl/" + encodeURIComponent(path) }; };
async function graph(route){
  const req = route.request(), url = new URL(req.url()), m = req.method();
  if (rules.delay && m === "PUT") await sleep(rules.delay);
  const json = (o, status = 200) => route.fulfill({ status, contentType:"application/json", body:JSON.stringify(o) });
  if (url.host === "fake.dl"){
    const path = decodeURIComponent(url.pathname.slice(1));
    if (rules.hangDownload && path.includes(rules.hangDownload)) return; /* never answers */
    const f = files.get(path); return f ? route.fulfill({ status:200, body:Buffer.from(f.bytes) }) : route.fulfill({ status:404, body:"" });
  }
  if (url.host === "fake.up"){
    const s = sessions.get(url.pathname.slice(1)); const body = req.postDataBuffer() || Buffer.alloc(0);
    const [, a, b, total] = /bytes (\d+)-(\d+)\/(\d+)/.exec(req.headers()["content-range"]);
    s.parts.push([+a, body]); s.total = +total;
    if (+b + 1 < +total) return json({ nextExpectedRanges:[(+b + 1) + "-"] }, 202);
    const out = Buffer.alloc(+total); for (const [o, p] of s.parts) p.copy(out, o);
    files.set(s.path, { bytes:out, eTag:"e" + (++etagN) }); sessions.delete(url.pathname.slice(1));
    return json(itemOf(s.path), 201);
  }
  if (url.host === "login.microsoftonline.com") return json({ access_token:"tok", expires_in:3600, refresh_token:"ref" });
  const p = url.pathname.replace(/^\/v1\.0/, "");
  if (p === "/me") return json({ userPrincipalName:"ekrem@example.com" });
  if (p === "/me/drive/special/approot/children"){
    const tops = new Set([...files.keys()].map(k => k.split("/")[0]));
    return json({ value:[...tops].map(n => files.has(n) ? itemOf(n) : { name:n, folder:{} }) });
  }
  let mm = /^\/me\/drive\/special\/approot:\/(.+):\/(children|content|createUploadSession)$/.exec(decodeURIComponent(p));
  if (mm){
    const [, path, op] = mm;
    if (op === "children"){
      const kids = [...files.keys()].filter(k => k.startsWith(path + "/"));
      if (!kids.length) return route.fulfill({ status:404, body:"" });
      return json({ value:kids.map(itemOf) });
    }
    if (op === "content" && m === "GET"){ const f = files.get(path); return f ? route.fulfill({ status:200, body:Buffer.from(f.bytes) }) : route.fulfill({ status:404, body:"" }); }
    const im = req.headers()["if-match"]; if (im && files.has(path) && files.get(path).eTag !== im) return json({}, 412);
    if (rules.failUpload && path.includes(rules.failUpload) && rules.failUploadTimes > 0){ rules.failUploadTimes--; return json({ error:"boom" }, 500); }
    if (op === "content" && m === "PUT"){ files.set(path, { bytes:req.postDataBuffer() || Buffer.alloc(0), eTag:"e" + (++etagN) }); return json(itemOf(path), 201); }
    if (op === "createUploadSession"){ const id = "s" + Math.random().toString(36).slice(2); sessions.set(id, { path, parts:[] }); return json({ uploadUrl:"https://fake.up/" + id }); }
  }
  mm = /^\/me\/drive\/special\/approot:\/(.+)$/.exec(decodeURIComponent(p));
  if (mm && m === "DELETE"){ files.delete(mm[1]); return route.fulfill({ status:204, body:"" }); }
  return json({ error:"unhandled " + m + " " + p }, 400);
}

async function makePdf(label, padBytes = 0){
  const d = await PDFDocument.create(); d.setTitle(label + " " + Math.random()); const pg = d.addPage([300, 400]); pg.drawText(label, { x:30, y:350, size:14 });
  if (padBytes){ const junk = new Uint8Array(require("crypto").randomBytes(padBytes)); d.attach(junk, "pad.bin", { mimeType:"application/octet-stream" }); }
  return Array.from(await d.save({ useObjectStreams:false }));
}

async function device(b, name){
  const ctx = await b.newContext({ viewport:{ width:1280, height:800 } });
  await ctx.route("**/config.js", r => r.fulfill({ status:200, headers:{ "Content-Type":"application/javascript" }, body:'window.ED_CONFIG = { onedriveClientId:"test-client" };' }));
  await ctx.route(/graph\.microsoft\.com|login\.microsoftonline\.com|fake\.dl|fake\.up/, graph);
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(600);
  /* signed in already */
  await p.evaluate(() => EDNote._DB.put("meta", { k:"od:auth", access:"tok", exp:Date.now() + 3600e3, refresh:"ref", account:"ekrem@example.com" }));
  await p.reload(); await p.waitForTimeout(800);
  return { p, ctx, errs, name };
}
const idle = async (d, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms){ if (!(await d.p.evaluate(() => EDNote._OD._st.busy))) return true; await sleep(200); } return false; };
const projects = d => d.p.evaluate(async () => (await EDNote._DB.all("projects")).map(r => ({ id:r.id, name:r.name, folder:r.data.folder || "", fps:r.data.docs.map(x => x.fp) })));
const havePdf = (d, fp) => d.p.evaluate(fp => EDNote._DB.get("pdfs", fp).then(x => !!x), fp);

module.exports = { graph, files, rules, makePdf, device, idle };
if (require.main === module) (async () => {
  const b = await chromium.launch();
  const A = await device(b, "PC"), B = await device(b, "telefon");
  await idle(A); await idle(B);

  console.log("1) PC: 3 klasör, içlerinde PDF'ler (biri 6 MB, parça parça gider)");
  const plan = [["Dönem 3/Kompozit", 3], ["Dönem 3/FEM", 2], ["Makaleler", 3]];
  const pdfs = []; let k = 0;
  for (const [folder, n] of plan) for (let i = 0; i < n; i++) pdfs.push({ folder, name:`${folder.split("/").pop()} ${i + 1}.pdf`, bytes:await makePdf(`${folder} ${i}`, k++ === 4 ? 6 * 1024 * 1024 : 0) });
  rules.failUpload = "Makaleler-boom"; /* placeholder, set below */
  await A.p.evaluate(async list => {
    for (const x of list){
      const { fp } = await EDNote._ingest(new Uint8Array(x.bytes), x.name);
      const p = EDNote._empty(x.name.replace(/\.pdf$/, "")); p.docs = [{ fp, name:x.name }]; p.ui = { space:p.spaces[0].id, viewers:[fp], split:false }; p.folder = x.folder;
      await EDNote._DB.put("projects", { id:p.id, name:p.name, updated:Date.now(), data:p });
    }
  }, pdfs);
  const aProj = await projects(A);
  check("her PDF ayrı", new Set(aProj.map(x => x.fps[0])).size === aProj.length, "PDF fingerprints collide (test setup)");
  /* one PDF fails 3 times in a row on the server */
  const bad = aProj.find(x => x.name === "FEM 1");
  rules.failUpload = "pdfs/" + bad.fps[0]; rules.failUploadTimes = 3;
  await A.p.evaluate(() => EDNote._OD.sync(false)); await idle(A, 60000);
  const st1 = await A.p.evaluate(() => ({ err:EDNote._OD._st.err, fails:EDNote._OD._st.fails }));
  const sentNow = [...files.keys()].filter(k => k.startsWith("projects/")).length;
  check("hata veren dosya diğerlerini durdurmuyor", sentNow === aProj.length - 1, `${sentNow} of ${aProj.length} projects on OneDrive`);
  check("hata görünür ve tekrar planlandı", st1.fails === 1 && /eşitlenemedi/.test(st1.err), JSON.stringify(st1));
  const big = [...files.entries()].find(([k, v]) => k.startsWith("pdfs/") && v.bytes.length > 5e6);
  check("6 MB PDF parça parça yüklendi", !!big, "no large pdf on OneDrive");
  /* the retry runs by itself after 30 s; wait for it (the server fails twice more, then the 2nd retry works after 60 s more) */
  rules.failUploadTimes = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 45000 && [...files.keys()].filter(k => k.startsWith("projects/")).length < aProj.length) await sleep(500);
  await idle(A);
  check("başarısız proje kendiliğinden yeniden denendi", [...files.keys()].filter(k => k.startsWith("projects/")).length === aProj.length, "still missing after retry");

  console.log("2) Telefon: bir PDF indirmesi takılıyor");
  rules.hangDownload = bad.fps[0];
  B.p.evaluate(() => EDNote._OD.sync(false));
  await sleep(4000);
  const busy = await B.p.evaluate(() => EDNote._OD._st.busy);
  check("takılan indirme sırasında eşitleme meşgul", busy, "not busy");
  const midway = await projects(B);
  check("takılan dosya varken diğer projeler geldi", midway.length >= aProj.length - 1, `${midway.length} projects on phone`);
  /* the app comes back from the background after a long pause */
  rules.hangDownload = null;
  await B.p.evaluate(() => { EDNote._OD._st.beat = Date.now() - 10 * 60000; EDNote._OD.sync(false); });
  check("takılan eşitleme durduruldu ve yeniden başlıyor", await idle(B, 20000), "still busy");
  await sleep(5000); await idle(B, 20000);
  const bProj = await projects(B);
  check("telefonda tüm projeler var", bProj.length === aProj.length, `${bProj.length} of ${aProj.length}`);
  const folders = [...new Set(bProj.map(x => x.folder))].sort();
  check("3 klasör de telefonda", JSON.stringify(folders) === JSON.stringify(plan.map(x => x[0]).sort()), JSON.stringify(folders));
  let missing = 0; for (const x of bProj) for (const fp of x.fps) if (!(await havePdf(B, fp))) missing++;
  check("bütün PDF'ler telefona indi", missing === 0, `${missing} missing`);

  console.log("3) Bağlantıyı kesip aynı hesapla tekrar bağlanmak");
  const metaBefore = await B.p.evaluate(async () => (await EDNote._DB.all("meta")).filter(m => m.k.startsWith("od:p:")).length);
  await B.p.evaluate(async () => { EDNote._OD._st.auth && null; });
  await B.p.click("#odOff").catch(() => {}); await B.p.click("#odOff").catch(() => {});
  await B.p.evaluate(() => EDNote._DB.put("meta", { k:"od:auth", access:"tok", exp:Date.now() + 3600e3, refresh:"ref", account:"ekrem@example.com" }));
  const metaAfter = await B.p.evaluate(async () => (await EDNote._DB.all("meta")).filter(m => m.k.startsWith("od:p:")).length);
  check("eşitleme kayıtları korunuyor", metaBefore === aProj.length && metaAfter === metaBefore, `${metaBefore} -> ${metaAfter}`);
  let gets = 0; const count = r => { if (/fake\.dl\/projects|approot:\/projects\/.+:\/content/.test(r.url()) && r.method() === "GET") gets++; };
  B.ctx.on("request", count);
  await B.p.reload(); await B.p.waitForTimeout(800); await idle(B);
  const copies = (await projects(B)).filter(x => /diğer cihaz/.test(x.name)).length;
  check("yeniden bağlanınca projeler tekrar indirilmiyor", gets === 0, `${gets} project files fetched again`);
  check("kopya proje oluşmadı", copies === 0, `${copies} copies`);

  console.log("4) Telefonda yeni proje PC'ye gidiyor");
  await B.p.evaluate(async bytes => {
    const { fp } = await EDNote._ingest(new Uint8Array(bytes), "telefon.pdf");
    const p = EDNote._empty("telefon"); p.docs = [{ fp, name:"telefon.pdf" }]; p.ui = { space:p.spaces[0].id, viewers:[fp], split:false }; p.folder = "Makaleler";
    await EDNote._DB.put("projects", { id:p.id, name:p.name, updated:Date.now(), data:p });
    await EDNote._OD.sync(false);
  }, await makePdf("telefon"));
  await idle(B); await A.p.evaluate(() => EDNote._OD.sync(false)); await idle(A);
  check("PC telefondaki yeni projeyi aldı", (await projects(A)).some(x => x.name === "telefon"), "not on PC");

  console.log("5) Klasörler ve görünüm (library.json)");
  await A.p.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("ednote:lib")); const now = Date.now();
    st.styles = st.styles || {}; st.styles["s-test"] = { name:"Deney", look:{ color:"g", bg:"mint" }, t:now };
    st.pens = st.pens || {}; st.pens["p-test"] = { name:"Turkuaz", kind:"pen", color:"#1f8a8a", w:1.4, t:now };
    st.folders["Boş klasör"] = { t:now }; st.looks["Makaleler"] = { c:"#e6a25a", st:"🔬", pos:"center", t:now }; st.app = { accent:"#6a4bb5", t:now };
    localStorage.setItem("ednote:lib", JSON.stringify(st));
  });
  await A.p.evaluate(() => EDNote._OD.sync(false)); await idle(A);
  check("library.json OneDrive'da", files.has("library.json"), "missing");
  await B.p.evaluate(() => EDNote._OD.sync(false)); await idle(B);
  const lb = await B.p.evaluate(() => { const st = JSON.parse(localStorage.getItem("ednote:lib")); return { empty:!!(st.folders["Boş klasör"] && !st.folders["Boş klasör"].del), look:st.looks["Makaleler"] && st.looks["Makaleler"].st, style:st.styles && st.styles["s-test"] && st.styles["s-test"].name, pen:st.pens && st.pens["p-test"] && st.pens["p-test"].name, acc:getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() }; });
  check("boş klasör, klasör görünümü, kart stili, kalem ve vurgu rengi telefona geldi", lb.empty && lb.look === "🔬" && lb.style === "Deney" && lb.pen === "Turkuaz" && lb.acc === "#6a4bb5", JSON.stringify(lb));
  /* the phone removes the empty folder; the PC follows */
  await B.p.evaluate(() => { const st = JSON.parse(localStorage.getItem("ednote:lib")); st.folders["Boş klasör"] = { del:true, t:Date.now() }; localStorage.setItem("ednote:lib", JSON.stringify(st)); return EDNote._OD.sync(false); }); await idle(B);
  await A.p.evaluate(() => EDNote._OD.sync(false)); await idle(A);
  const gone = await A.p.evaluate(() => { const v = JSON.parse(localStorage.getItem("ednote:lib")).folders["Boş klasör"]; return !!(v && v.del); });
  check("silinen klasör diğer cihazda da silindi", gone, "still there");

  check("sayfa hatası yok", !A.errs.length && !B.errs.length, [...A.errs, ...B.errs].join(" | "));
  await b.close();
  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
