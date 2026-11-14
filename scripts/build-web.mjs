/* Copies the web app into dist/ for the Android app. app.js is minified there, so it is hard to read. */
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { minify } from "terser";
const root = new URL("..", import.meta.url).pathname, out = root + "dist/";
rmSync(out, { recursive:true, force:true }); mkdirSync(out, { recursive:true });
for (const f of ["index.html", "style.css", "config.js", "manifest.webmanifest"]) cpSync(root + f, out + f);
for (const d of ["icons", "vendor"]) cpSync(root + d, out + d, { recursive:true });
const src = readFileSync(root + "app.js", "utf8");
const r = await minify(src, { compress:{ passes:2 }, mangle:{ toplevel:true }, format:{ comments:false } });
writeFileSync(out + "app.js", r.code);
console.log("dist hazır:", (r.code.length / 1024).toFixed(0), "KB app.js");
