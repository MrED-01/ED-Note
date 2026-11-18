/* ED Note compatibility test.
   Every release must open, show, edit, re-save and export files from every earlier release.
   Run:  python3 -m http.server 8765   (in the app folder)
         node tests/compat.test.js http://localhost:8765/
   Needs Node with Playwright and Chromium. Add a new fixture (exported from the old version) for every release. */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const BASE = process.argv[2] || "http://localhost:8765/";
const DIR = path.join(__dirname, "fixtures");
const expected = JSON.parse(fs.readFileSync(path.join(DIR, "expected.json"), "utf8"));
const KEYS = ["docs","items","links","groups","ink","texts","comments","bookmarks","pins","recs","spaces"];
let failed = 0;
const check = (name, cond, msg) => { if (!cond){ failed++; console.log(`  FAIL ${name}: ${msg}`); } };
(async () => {
  const b = await chromium.launch();
  for (const [file, exp] of Object.entries(expected)){
    const ctx = await b.newContext({ viewport:{ width:1440, height:900 }, acceptDownloads:true });
    /* the test runs without the licence gate and without OneDrive */
    await ctx.route("**/config.js", r => r.fulfill({ status:200, headers:{ "Content-Type":"application/javascript" }, body:"window.ED_CONFIG = {};" }));
    const p = await ctx.newPage(); const errs = [];
    p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
    await p.goto(BASE); await p.waitForTimeout(600);
    let [fc] = await Promise.all([p.waitForEvent("filechooser"), p.click("#hImport")]); await fc.setFiles(path.join(DIR, file)); await p.waitForTimeout(2200);
    const st = await p.evaluate(async KEYS => {
      const q = EDNote._S.proj; if (!q) return null; const c = {}; for (const k of KEYS) c[k] = (q[k] || []).length;
      const db = await new Promise(r => { const o = indexedDB.open("alinti-masasi"); o.onsuccess = () => r(o.result); });
      c.audio = 0; for (const r of q.recs) c.audio += await new Promise(res => { const g = db.transaction("blobs").objectStore("blobs").get(r.id); g.onsuccess = () => res(g.result ? 1 : 0); });
      const outside = q.items.filter(i => { if (i.group) return false; const sh = q.spaces.find(s => s.id === i.space).sheet; return i.x < sh.x || i.y < sh.y || i.x + i.w > sh.x + sh.w; }).length;
      return { c, outside, sheets:q.spaces.every(s => s.sheet && s.sheet.w > 0), version:EDNote.version };
    }, KEYS);
    console.log(`${file} -> app ${st && st.version}`);
    check(file, !!st, "project did not open"); if (!st){ await ctx.close(); continue; }
    for (const k of [...KEYS, "audio"]) check(file, st.c[k] === exp[k], `${k}: expected ${exp[k]}, got ${st.c[k]}`);
    check(file, st.outside === 0, `${st.outside} cards outside their sheet`);
    /* v6.9.9: recognised shapes keep sharp corners */
    if (exp.shape){
      const r = await p.evaluate(() => { const st = EDNote._S.proj.ink.find(s => s.id === "shp1"), h = document.querySelector('path[data-id="shp1"]'); return { sh:st ? st.sh : 0, d:h ? h.getAttribute("d") : "" }; });
      check(file, JSON.stringify(r) === JSON.stringify(exp.shape), `shape fields: ${JSON.stringify(r)}`);
    }
    /* v6.9.7: free ink colours, pencil and calligraphy tips, coloured text box */
    if (exp.pens){
      const r = await p.evaluate(() => { const P = EDNote._S.proj, h = document.querySelector('path[data-id="i1"]');
        return { inkColors:P.ink.map(s => s.color).join(","), tips:P.ink.map(s => s.tip || "").join(","), text:(P.texts[0] || {}).color, pencilDom:document.querySelectorAll("path.ipencil").length, hexStyle:h ? getComputedStyle(h).stroke : "" }; });
      check(file, JSON.stringify(r) === JSON.stringify(exp.pens), `pen fields: ${JSON.stringify(r)}`);
    }
    /* v6.9.6: desk surface, paper grain, group look, stickers, link shape */
    if (exp.desk){
      const r = await p.evaluate(() => { const P = EDNote._S.proj, sp = P.spaces[0], g = P.groups[0] || {};
        return { desk:sp.desk || "", grain:!!sp.grain, group:[g.c, g.bg], stickers:(P.stickers || []).length, onCard:(P.stickers || []).filter(k => k.card).length, shapes:P.links.map(l => l.shape || "").join(","), domStk:document.querySelectorAll("#plane .stk").length }; });
      check(file, JSON.stringify(r) === JSON.stringify(exp.desk), `desk fields: ${JSON.stringify(r)}`);
    }
    /* v6.9.5: star, pin, label colour, cover page and reading progress survive the import */
    if (exp.lib){
      const r = await p.evaluate(() => { const P = EDNote._S.proj, fp = P.docs[0].fp; return { star:!!P.star, pin:!!P.pin, label:P.label || "", coverPage:P.cover && P.cover.page, read:P.read && P.read[fp] }; });
      check(file, JSON.stringify(r) === JSON.stringify(exp.lib), `library fields: ${JSON.stringify(r)}`);
    }
    /* v6.9.4: formatted notes, free card colours and paper colours */
    if (exp.rich){
      const r = await p.evaluate(() => { const P = EDNote._S.proj; return { rich:P.items.filter(i => i.rich).length, cc:P.items.filter(i => i.cc).length, paper:P.spaces[0].paper || "", spans:document.querySelectorAll("#plane .note span[data-rt]").length }; });
      check(file, r.rich === exp.rich && r.cc === exp.cc && r.paper === exp.paper && r.spans > 0, `formatting: ${JSON.stringify(r)}`);
    }
    check(file, st.sheets, "a space has no sheet");
    /* every space renders all its cards */
    const spaces = await p.evaluate(() => EDNote._S.proj.spaces.map(s => s.id));
    for (let i = 0; i < spaces.length; i++){
      await p.click(`.sp[data-sid="${spaces[i]}"]`).catch(() => {}); await p.waitForTimeout(250);
      const r = await p.evaluate(() => { const S = EDNote._S, items = S.proj.items.filter(x => x.space === S.space); return { want:items.length, got:document.querySelectorAll("#plane .card").length }; });
      check(file, r.want === r.got, `space ${i + 1}: ${r.want} cards in data, ${r.got} on screen`);
    }
    /* edit, save, export, re-import */
    await p.click("#bNote"); await p.waitForTimeout(150); await p.keyboard.type("uyumluluk testi"); await p.mouse.click(1380, 840); await p.waitForTimeout(700);
    await p.click("#bMore"); const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#mExport")]);
    const re = path.join(require("os").tmpdir(), "ednote-compat-" + file.replace(/\W/g, "_") + ".ednote"); await dl.saveAs(re);
    await p.click("#bHome"); await p.waitForTimeout(300);
    [fc] = await Promise.all([p.waitForEvent("filechooser"), p.click("#hImport")]); await fc.setFiles(re); await p.waitForTimeout(2000);
    const after = await p.evaluate(() => ({ items:EDNote._S.proj.items.length, notes:EDNote._S.proj.items.filter(i => i.note === "uyumluluk testi").length }));
    check(file, after.items === exp.items + 1 && after.notes === 1, `after edit and re-import: ${JSON.stringify(after)}`);
    /* annotated PDF */
    const pdf = await p.evaluate(async () => { const r = await EDNoteBuildPdf(); return { size:r.bytes.length, ws:r.wsCount, skipped:r.skipped.length }; }).catch(e => ({ error:String(e) }));
    check(file, !pdf.error && pdf.size > 1000 && pdf.skipped === 0, `pdf export: ${JSON.stringify(pdf)}`);
    /* library: the project shows up on the home screen, in its folder (v6.9+) */
    await p.click("#bHome"); await p.waitForTimeout(500);
    const lib = await p.evaluate(() => ({ tiles:[...document.querySelectorAll("#recent .rc")].map(li => (li.classList.contains("fold") ? "D:" : "") + li.querySelector(".rc-name").textContent) }));
    const top = exp.folder ? "D:" + exp.folder.split("/")[0] : null;
    check(file, top ? lib.tiles.includes(top) : lib.tiles.some(t => !t.startsWith("D:")), `home tiles: ${JSON.stringify(lib.tiles)}`);
    check(file, errs.length === 0, "page errors: " + errs.join(" | "));
    await ctx.close();
  }
  await b.close();
  console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll compatibility checks passed");
  process.exit(failed ? 1 : 0);
})();
