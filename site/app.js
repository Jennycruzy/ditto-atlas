// Ditto site: every number is read from the published atlas and proofs JSON; the decoder runs Ditto's own
// recognition code in the browser against PUBLIC RPCs only. Nothing on this site can move money.
const chains = { base: "Base", arbitrum: "Arbitrum", optimism: "Optimism", ethereum: "Ethereum" };
const explorers = { base: "https://basescan.org", arbitrum: "https://arbiscan.io", optimism: "https://optimistic.etherscan.io", ethereum: "https://etherscan.io" };
const publicRpc = { base: "https://mainnet.base.org", arbitrum: "https://arb1.arbitrum.io/rpc", optimism: "https://mainnet.optimism.io", ethereum: "https://ethereum-rpc.publicnode.com" };
const $ = (s, root = document) => root.querySelector(s);
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) k === "class" ? e.className = v : e.setAttribute(k, v); for (const k of kids) e.append(k?.nodeType ? k : document.createTextNode(String(k ?? ""))); return e; };
const short = h => `${h.slice(0, 6)}…${h.slice(-4)}`;
// Card text: short addresses, at most 6 decimals, so lines never overflow a phone screen.
const tidy = t => t.replace(/0x[0-9a-fA-F]{40}/g, a => short(a)).replace(/(\d+\.\d{6})\d+/g, "$1");
const unquote = t => String(t ?? "").replace(/^"|"$/g, "");
const ago = iso => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 90 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };
async function getJson(url) { const r = await fetch(url, { cache: "no-store" }); if (!r.ok) throw new Error(`${r.status}`); return r.json(); }
async function atlas(chain) { try { return await getJson(`atlas/${chain}.json`); } catch { return null; } }
const proofNames = ["r2-steakhouse-prime", "r3-clearstar", "r4-compound", "r6-fluid"];
async function proofs() { return (await Promise.all(proofNames.map(n => getJson(`proofs/${n}.json`).catch(() => null)))).filter(Boolean); }
const names = { "r2-steakhouse-prime": "Steakhouse Prime USDC vault", "r3-clearstar": "Clearstar USDC vault", "r4-compound": "Compound v3 USDC", "r6-fluid": "Fluid USDC savings" };

function proofCard(p) {
  const card = el("article", { class: "card receipt reveal" });
  if (p.enter.proof?.landed && p.exit.proof?.landed) card.append(el("span", { class: "stamp" }, "LANDED"));
  card.append(el("h3", {}, names[p.label] ?? p.label), el("p", { class: "small muted" }, `${chains[p.chain]} · ${new Date(p.generatedAt).toUTCString().slice(5, 22)} UTC · wallet ${short(p.wallet)}`));
  for (const [label, part] of [["Put 1 USDC in", p.enter], ["Took it all out", p.exit]]) {
    const box = el("div", { class: "part" }); card.append(box);
    box.append(el("p", { class: "small", style: "margin:0 0 6px" }, el("strong", {}, label), " ", el("span", { class: `pill ${part.proof?.landed ? "ok" : "bad"}` }, part.proof?.landed ? "landed" : "not complete")));
    const lines = part.text.split("\n").filter(l => /^[✓✗]/.test(l));
    for (const l of lines) box.append(el("div", { class: `check small ${l.startsWith("✓") ? "ok" : "bad"}` }, tidy(l.slice(2))));
    const links = el("p", { class: "small mono", style: "margin:8px 0 0" });
    for (const h of part.hashes) links.append(el("a", { href: `${explorers[p.chain]}/tx/${h}`, rel: "noopener" }, short(h)), " ");
    box.append(links);
  }
  const result = el("div", { class: "small", "aria-live": "polite" });
  const button = el("button", { class: "ghost", type: "button" }, "Re-check now on the chain");
  button.addEventListener("click", () => recheck(p, result, button));
  card.append(button, result);
  return card;
}
// Re-read every receipt from the chain's public RPC and re-run the core assertions in the browser.
async function recheck(p, out, button) {
  button.disabled = true; out.textContent = "Reading receipts from the public RPC…";
  const usdc = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", wallet = p.wallet.toLowerCase(), topic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  try {
    const all = [...p.enter.hashes, ...p.exit.hashes];
    const body = all.map((h, n) => ({ jsonrpc: "2.0", id: n, method: "eth_getTransactionReceipt", params: [h] }));
    const res = await (await fetch(publicRpc[p.chain], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
    const receipts = all.map((_, n) => res.find(r => r.id === n)?.result);
    const flows = (hashes) => { let out = 0n, back = 0n; for (const h of hashes) { const r = receipts[all.indexOf(h)]; for (const l of r.logs) if (l.address.toLowerCase() === usdc && l.topics[0] === topic) { const from = `0x${l.topics[1].slice(26)}`, to = `0x${l.topics[2].slice(26)}`, v = BigInt(l.data); if (from === wallet) out += v; if (to === wallet) back += v; } } return { out, back }; };
    const checks = [
      ["Every transaction succeeded", receipts.every(r => r?.status === "0x1")],
      ["Every transaction was sent by the plan's wallet", receipts.every(r => r?.from.toLowerCase() === wallet)],
      ["Exactly 1.000000 USDC left the wallet on entry", flows(p.enter.hashes).out === 1000000n],
      ["At least 0.999 USDC came back on exit", flows(p.exit.hashes).back >= 999000n],
    ];
    out.replaceChildren(...checks.map(([t, ok]) => el("div", { class: `check ${ok ? "ok" : "bad"}` }, t)), el("p", { class: "muted" }, `Re-checked ${new Date().toUTCString().slice(17, 25)} UTC from ${new URL(publicRpc[p.chain]).host}.`));
  } catch { out.textContent = "The public RPC did not answer. Try again in a minute, or open the explorer links."; }
  button.disabled = false;
}
function placeRow(r) {
  const tr = el("tr");
  const name = el("td", {}, el("strong", {}, unquote(r.protocol?.text)), el("div", { class: "small muted" }, `${r.family} · `, el("a", { href: `${explorers[r.chain]}/address/${r.contract}`, rel: "noopener" }, short(r.contract))));
  const status = el("td", {}, el("span", { class: `pill ${r.verdict === "ok" ? "ok" : "bad"}` }, r.verdict === "ok" ? "passed every check" : "refused"));
  if (r.verdict !== "ok") status.append(el("div", { class: "small muted" }, r.refusals.map(x => x.reason).join(" ")));
  const exit = r.exitPreview ? `${r.exitPreview.returns.map(x => x.amount.display).join(" + ")} back for 1 (${r.exitClass})` : "n/a";
  const txs = el("td", { class: "small" }); for (const h of r.evidence.sampleTxs ?? []) txs.append(el("a", { href: `tx.html?c=${r.chain}&h=${h}` }, short(h)), " ");
  tr.append(name, el("td", {}, `${r.evidence.deposits24h}`, el("div", { class: "small muted" }, `${r.evidence.uniqueWallets24h} wallets`)), el("td", {}, Number(r.totalAssets.display).toLocaleString("en-US", { maximumFractionDigits: 0 })), el("td", {}, r.apy7dPct === null ? "—" : `${r.apy7dPct}%`), el("td", { class: "small" }, exit), status, txs);
  return tr;
}
const pages = {
  async home() {
    const a = await atlas("base");
    if (a) {
      const ok = a.rows.filter(r => r.verdict === "ok");
      countUp($("#live-count"), a.rows.reduce((s, r) => s + r.evidence.deposits24h, 0));
      countUp($("#pass-count"), ok.length);
      $("#live-detail").append(` · updated ${ago(a.generatedAt)}`);
    }
    const all = await proofs(); countUp($("#proof-count"), all.length);
    const list = $("#latest-proofs"); for (const p of all.slice(0, 3)) list.append(proofCard(p));
    observe();
  },
  async today() {
    const select = $("#chain"), body = $("#board"), note = $("#updated");
    const show = async () => {
      body.replaceChildren(); const a = await atlas(select.value);
      if (!a) { note.textContent = "No evidence published for this chain yet."; return; }
      const stale = Date.now() - Date.parse(a.generatedAt) > 7_200_000;
      note.replaceChildren(`Updated ${ago(a.generatedAt)}. `, stale ? el("span", { class: "pill warn" }, "older than 2 h: plans re-check live") : "");
      a.rows.forEach((r, n) => { const row = placeRow(r); row.style.animation = `rise .4s ${n * 40}ms both`; body.append(row); });
    };
    select.addEventListener("change", show); await show();
  },
  async tx() {
    const form = $("#decode"), out = $("#result"), params = new URLSearchParams(location.search);
    const run = async (chain, tx) => {
      out.replaceChildren(el("p", { class: "muted" }, "Reading the receipt from the public RPC and decoding it in your browser…"));
      try {
        const core = await import("./app/core.js");
        const rpc = new core.JsonRpc(chain, { endpoint: publicRpc[chain], maxRequests: 32 });
        const r = await core.explainTransaction({ chain, tx }, rpc);
        const say = r.copyable === "yes" ? `Ditto: copy ${explorers[chain]}/tx/${r.hash} with 1 USDC` : null;
        out.replaceChildren(el("pre", {}, r.text), say ? el("h3", { style: "margin-top:16px" }, "Say this to your agent in PayBox") : "", say ? el("div", { class: "say" }, say) : "", el("p", { class: "small" }, el("a", { href: `${explorers[chain]}/tx/${r.hash}`, rel: "noopener" }, "Open in the explorer")));
        history.replaceState(null, "", `?c=${chain}&h=${r.hash}`);
      } catch (e) { out.replaceChildren(el("p", {}, "The public RPC did not answer or this is not a transaction on that chain. Try again in a minute."), el("p", { class: "small muted" }, String(e.message ?? e).slice(0, 200))); }
    };
    form.addEventListener("submit", e => { e.preventDefault(); run($("#txchain").value, $("#txhash").value.trim()); });
    if (params.get("h")) { $("#txchain").value = params.get("c") ?? "base"; $("#txhash").value = params.get("h"); run($("#txchain").value, params.get("h")); }
  },
  async proofs() { const list = $("#proof-list"); for (const p of await proofs()) list.append(proofCard(p)); observe(); },
};

// Motion, only when the visitor has not asked for less.
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
function countUp(node, to) {
  if (!node) return; if (calm) { node.textContent = to; return; }
  const start = performance.now(), d = 1100;
  const frame = t => { const k = Math.min(1, (t - start) / d); node.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}
let io;
function observe() {
  const items = document.querySelectorAll(".reveal:not(.in)");
  if (calm || !("IntersectionObserver" in window)) { items.forEach(i => i.classList.add("in")); return; }
  io ??= new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  items.forEach(i => io.observe(i));
}
// Hero: the stranger's move is copied into your slip, then each check ticks in and the stamp lands. Loops.
async function heroLoop() {
  const demo = $(".copy-demo"); if (!demo) return;
  const typed = [...demo.querySelectorAll(".typed")], ticks = [...demo.querySelectorAll(".tick")], stamp = $(".stamp", demo), mark = $(".ditto-mark", demo);
  if (calm) { ticks.forEach(t => t.classList.add("on")); stamp.classList.add("on"); return; }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for (;;) {
    typed.forEach(t => t.textContent = ""); ticks.forEach(t => t.classList.remove("on")); stamp.classList.remove("on");
    mark.classList.add("go"); await wait(900);
    for (const t of typed) { const text = t.dataset.type; for (let i = 1; i <= text.length; i++) { t.textContent = text.slice(0, i); await wait(28); } await wait(150); }
    mark.classList.remove("go");
    for (const t of ticks) { await wait(420); t.classList.add("on"); }
    await wait(380); stamp.classList.add("on"); await wait(3600);
  }
}
const style = document.createElement("style"); style.textContent = "@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }"; document.head.append(style);
heroLoop(); observe();
const page = document.body.dataset.page; if (pages[page]) pages[page]();
