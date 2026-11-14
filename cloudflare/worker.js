/* ED Note lisans sunucusu (Cloudflare Worker).
   Her lisans kodu ilk kullanıldığında bir Microsoft hesabına bağlanır. Sonra o hesapla istenen sayıda cihazda çalışır;
   başka bir hesap aynı kodu kullanamaz. Hangi kodların geçerli olduğu yine GitHub'daki liste.json'dan okunur.

   Cloudflare'da gerekenler (Worker > Settings):
     - KV bağlantısı:   değişken adı LIC  (bir KV deposuna bağlı)
     - Değişken:        LIST_URL   = https://raw.githubusercontent.com/MrED-01/ednote-lisans/main/liste.json
     - Gizli değişken:  ADMIN_KEY  = uzun bir şifre (lisans aracı kullanır; cihaz biletlerini imzalamak için de kullanılır)
     - İsteğe bağlı:    CLIENT_ID  = Entra uygulama kimliği (boşsa ED Note'unki)

   Uygulama:      POST /precheck {code}              -> {ok} | {ok:false, reason:"bad"}
                  POST /bind     {code, idt, m}      -> {ok, ticket, name} | {ok:false, reason:"bad"|"taken"|"token"}
                  POST /check    {ticket, m}         -> {ok, name} | {ok:false, reason:"bad"|"unbound"}
   Lisans aracı:  GET  /admin/list                   (Authorization: Bearer ADMIN_KEY)
                  POST /admin/set {h, name?, unbind?:true} */
const DEFAULT_CLIENT_ID = "12f84819-caa4-4a71-b453-f0d35c0bdff7";
const ALPH = /^[0-9A-HJKMNP-TV-Z]{12}$/;
const DAY = 864e5;
const enc = new TextEncoder();

const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET, POST, OPTIONS", "Access-Control-Allow-Headers":"Content-Type, Authorization", "Access-Control-Max-Age":"86400" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers:{ ...cors, "Content-Type":"application/json", "Cache-Control":"no-store" } });
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
const sha = async s => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const b64uToBytes = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function validCodes(env){
  const r = await fetch(env.LIST_URL + "?t=" + Math.floor(Date.now() / 120000), { cf:{ cacheTtl:120 } });
  if (!r.ok) throw new Error("list " + r.status);
  const j = await r.json(); return new Set(j.codes || []);
}
const getRec = async (env, h) => (await env.LIC.get("c:" + h, "json")) || {};
const putRec = (env, h, rec) => env.LIC.put("c:" + h, JSON.stringify(rec));
const seen = (rec, m) => { rec.t = Date.now(); if (m){ rec.devs = rec.devs || {}; rec.devs[m] = rec.t; const k = Object.keys(rec.devs); if (k.length > 12) delete rec.devs[k.sort((a, b) => rec.devs[a] - rec.devs[b])[0]]; } };

/* ---------- Microsoft sign-in token (id_token, RS256) ---------- */
async function msKeys(url){ const r = await fetch(url, { cf:{ cacheTtl:3600 } }); if (!r.ok) throw new Error("keys " + r.status); return (await r.json()).keys || []; }
async function verifyIdToken(idt, env){
  const [h64, p64, s64] = String(idt || "").split("."); if (!s64) throw new Error("format");
  const head = JSON.parse(new TextDecoder().decode(b64uToBytes(h64))), p = JSON.parse(new TextDecoder().decode(b64uToBytes(p64)));
  if (head.alg !== "RS256") throw new Error("alg");
  let key = (await msKeys("https://login.microsoftonline.com/common/discovery/v2.0/keys")).find(k => k.kid === head.kid);
  if (!key && /^[0-9a-f-]{36}$/.test(p.tid || "")) key = (await msKeys(`https://login.microsoftonline.com/${p.tid}/discovery/v2.0/keys`)).find(k => k.kid === head.kid);
  if (!key) throw new Error("kid");
  const ck = await crypto.subtle.importKey("jwk", { kty:"RSA", n:key.n, e:key.e, alg:"RS256", ext:true }, { name:"RSASSA-PKCS1-v1_5", hash:"SHA-256" }, false, ["verify"]);
  if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", ck, b64uToBytes(s64), enc.encode(h64 + "." + p64)))) throw new Error("signature");
  const now = Date.now() / 1000;
  if (p.aud !== (env.CLIENT_ID || DEFAULT_CLIENT_ID)) throw new Error("aud");
  if (!(p.exp > now - 120) || !(p.iat > now - 3 * 3600)) throw new Error("expired");
  if (p.iss !== `https://login.microsoftonline.com/${p.tid}/v2.0`) throw new Error("iss");
  const who = p.oid || p.sub; if (!who) throw new Error("subject");
  return { uid:p.tid + ":" + who, name:String(p.name || "").slice(0, 60), email:String(p.preferred_username || p.email || "").slice(0, 80) };
}

/* ---------- device tickets: a signed note "code h belongs to account uid" ---------- */
async function hmacKey(env){ return crypto.subtle.importKey("raw", enc.encode("ednote-ticket:" + env.ADMIN_KEY), { name:"HMAC", hash:"SHA-256" }, false, ["sign", "verify"]); }
async function makeTicket(env, h, uid){ const body = b64u(enc.encode(JSON.stringify({ h, uid, iat:Date.now() }))); return body + "." + b64u(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(body))); }
async function readTicket(env, t){
  const [body, sig] = String(t || "").split("."); if (!sig) return null;
  if (!(await crypto.subtle.verify("HMAC", await hmacKey(env), b64uToBytes(sig), enc.encode(body)))) return null;
  try { return JSON.parse(new TextDecoder().decode(b64uToBytes(body))); } catch { return null; }
}

export default {
  async fetch(req, env){
    if (req.method === "OPTIONS") return new Response(null, { headers:cors });
    const path = new URL(req.url).pathname.replace(/\/+$/, "");
    try {
      if (req.method === "POST" && (path === "/precheck" || path === "/bind" || path === "/check")){
        const b = await req.json().catch(() => ({})), m = String(b.m || "").slice(0, 60);
        if (path === "/check"){
          const t = await readTicket(env, b.ticket); if (!t) return json({ ok:false, reason:"unbound" });
          if (!(await validCodes(env)).has(t.h)) return json({ ok:false, reason:"bad" });
          const rec = await getRec(env, t.h); if (rec.uid !== t.uid) return json({ ok:false, reason:"unbound" });
          if (Date.now() - (rec.t || 0) > DAY / 2 || (m && !(rec.devs || {})[m])){ seen(rec, m); await putRec(env, t.h, rec); }   /* KV'ye günde en fazla birkaç yazma */
          return json({ ok:true, name:rec.name || "" });
        }
        const code = String(b.code || ""); if (!ALPH.test(code)) return json({ ok:false, reason:"bad" });
        const h = await sha("ednote-v1:" + code);
        if (!(await validCodes(env)).has(h)) return json({ ok:false, reason:"bad" });
        if (path === "/precheck") return json({ ok:true });
        let u; try { u = await verifyIdToken(b.idt, env); } catch (e){ return json({ ok:false, reason:"token", detail:String(e.message || e) }); }
        const rec = await getRec(env, h);
        if (rec.uid && rec.uid !== u.uid) return json({ ok:false, reason:"taken" });
        if (!rec.uid){ rec.uid = u.uid; rec.at = Date.now(); }
        if (!rec.fixedName) rec.name = u.name || rec.name || ""; rec.email = u.email || rec.email || ""; seen(rec, m);
        await putRec(env, h, rec);
        return json({ ok:true, ticket:await makeTicket(env, h, u.uid), name:rec.name || "" });
      }
      if (path.startsWith("/admin/")){
        if (!env.ADMIN_KEY || req.headers.get("Authorization") !== "Bearer " + env.ADMIN_KEY) return json({ error:"yetki yok" }, 401);
        if (path === "/admin/list"){
          const out = []; let cursor;
          do { const l = await env.LIC.list({ prefix:"c:", cursor }); for (const k of l.keys){ const r = await env.LIC.get(k.name, "json"); if (r) out.push({ h:k.name.slice(2), name:r.name || "", email:r.email || "", bound:!!r.uid, at:r.at || 0, t:r.t || 0, devs:r.devs || {} }); } cursor = l.list_complete ? null : l.cursor; } while (cursor);
          return json({ ok:true, items:out });
        }
        if (path === "/admin/set" && req.method === "POST"){
          const b = await req.json().catch(() => ({})); const h = String(b.h || "");
          if (!/^[0-9a-f]{64}$/.test(h)) return json({ error:"h" }, 400);
          const rec = await getRec(env, h);
          if (typeof b.name === "string"){ rec.name = b.name.slice(0, 60); rec.fixedName = !!b.name; }
          if (b.unbind){ delete rec.uid; delete rec.email; delete rec.at; rec.devs = {}; }
          await putRec(env, h, rec);
          return json({ ok:true, rec });
        }
      }
      if (path === "") return json({ ok:true, service:"ED Note lisans" });
      return json({ error:"bulunamadı" }, 404);
    } catch (e){ return json({ error:String(e && e.message || e) }, 500); }
  }
};
