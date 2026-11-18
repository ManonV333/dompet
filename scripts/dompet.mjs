#!/usr/bin/env node
// QQ — outil en ligne de commande utilisé par Claude pour alimenter data.json.
//
//   node scripts/dompet.mjs status                         → résumé du jour (heure de Bali)
//   node scripts/dompet.mjs add '[{"label":"Warung","amount":"45k","cat":"food","pay":"cash"}]'
//   node scripts/dompet.mjs upsert stays '{"name":"Villa","checkin":"2026-12-01","checkout":"2026-12-08","total":"3,5jt"}'
//   node scripts/dompet.mjs upsert recurring '{"label":"Google Ads","amount":300,"currency":"EUR","day":1}'
//   node scripts/dompet.mjs withdraw 2500000 50000         → retrait (montant, frais en IDR)
//   node scripts/dompet.mjs settings '{"defaultMonthlyBudget":1200}'
//   node scripts/dompet.mjs list [jours=3]                 → dernières dépenses avec leur id
//   node scripts/dompet.mjs delete <collection> <id>
//   node scripts/dompet.mjs rate                           → met à jour le taux EUR→IDR
//
// Option : --data <chemin vers data.json>  (défaut : ../dompet-data/data.json puis ./data.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize, emptyData, uid, parseAmount, toEUR, todayIn, ymOf, monthSummary, cashBalance, savingsSummary, CAT, DAY_CATS, WEEK_CATS, addDays } from '../js/engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let dataPath = null;
const di = args.indexOf('--data');
if (di >= 0) { dataPath = args[di + 1]; args.splice(di, 2); }
if (!dataPath) {
  const cands = [path.resolve(here, '../../dompet-data/data.json'), path.resolve(process.cwd(), 'data.json')];
  dataPath = cands.find(p => fs.existsSync(p)) || cands[0];
}
const load = () => normalize(fs.existsSync(dataPath) ? JSON.parse(fs.readFileSync(dataPath, 'utf8')) : emptyData());
const save = d => { d.updatedAt = new Date().toISOString(); fs.writeFileSync(dataPath, JSON.stringify(d, null, 1) + '\n'); };
const now = () => new Date().toISOString();
const D = load();
const tz = D.settings.timezone || 'Asia/Makassar';
const today = todayIn(tz);
const R = D.settings.rate;
const idr = v => 'Rp ' + Math.round(v).toLocaleString('fr-FR');
const eur = v => v.toFixed(2).replace('.', ',') + ' €';
const both = v => `${idr(v * R)} (${eur(v)})`;

function parseJSON(s) { try { return JSON.parse(s); } catch (e) { console.error('JSON invalide :', e.message); process.exit(1); } }
function money(v, cur) { return typeof v === 'number' ? v : parseAmount(v, cur); }

function upsert(col, item) {
  const it = { ...item, id: item.id || uid(), updatedAt: now() };
  if (!it.createdAt) it.createdAt = it.updatedAt;
  const i = D[col].findIndex(x => x.id === it.id);
  if (i >= 0) D[col][i] = { ...D[col][i], ...it }; else D[col].push(it);
  return it;
}

const cmd = args[0];
if (cmd === 'add') {
  let items = parseJSON(args[1]); if (!Array.isArray(items)) items = [items];
  const added = [];
  for (const x of items) {
    const currency = (x.currency || 'IDR').toUpperCase();
    const amount = money(x.amount, currency), tip = money(x.tip || 0, currency) || 0;
    if (!Number.isFinite(amount) || amount <= 0) { console.error('Montant invalide :', JSON.stringify(x)); process.exit(1); }
    if (!CAT[x.cat]) { console.error(`Catégorie inconnue « ${x.cat} ». Choix : ${Object.keys(CAT).join(', ')}`); process.exit(1); }
    const rate = currency === 'IDR' ? R : undefined;
    const e = upsert('expenses', { date: x.date || today, label: x.label || CAT[x.cat].label, amount, currency, tip, cat: x.cat, pay: x.pay || 'cash', note: x.note || '', rate, ...(x.spread ? { spread: x.spread } : {}), ...(x.offBudget ? { offBudget: true } : {}), eur: Math.round(toEUR(amount + tip, currency, rate || 1) * 100) / 100, src: 'claude' });
    added.push(e);
  }
  save(D);
  added.forEach(e => console.log(`+ ${e.date}  ${CAT[e.cat].label} · ${e.label}  ${e.currency === 'IDR' ? idr(e.amount + e.tip) : eur(e.amount + e.tip)}  [${e.pay}]  id=${e.id}`));
} else if (cmd === 'upsert') {
  const col = args[1]; if (!['expenses', 'stays', 'recurring', 'cash', 'income'].includes(col)) { console.error('Collection : expenses | stays | recurring | cash | income'); process.exit(1); }
  const x = parseJSON(args[2]);
  const cur = (x.currency || (col === 'recurring' || col === 'income' ? 'EUR' : 'IDR')).toUpperCase();
  if (col === 'stays') { x.total = money(x.total, cur); x.currency = cur; if (cur === 'IDR') x.rate = x.rate || R; if (x.paid == null) x.paid = true; }
  if (col === 'recurring') { x.amount = money(x.amount, cur); x.currency = cur; x.freq = x.freq || 'monthly'; x.cat = x.cat || 'pro'; x.start = x.start || today; x.day = x.day || Number(x.start.slice(8)); }
  if (col === 'expenses' && x.amount != null) x.amount = money(x.amount, x.currency || 'IDR');
  if (col === 'income') { x.amount = money(x.amount, cur); x.currency = cur; x.date = x.date || today; if (cur === 'IDR') x.rate = x.rate || R; }
  const it = upsert(col, x); save(D); console.log(`ok ${col} id=${it.id}`);
} else if (cmd === 'withdraw') {
  const a = parseAmount(args[1], 'IDR'), fee = parseAmount(args[2] || '0', 'IDR') || 0;
  if (!D.settings.cashStart?.date) D.settings = { ...D.settings, cashStart: { date: today, amountIDR: 0 }, updatedAt: now() };
  const it = upsert('cash', { type: 'withdraw', date: args[3] || today, amountIDR: a, feeIDR: fee }); save(D); console.log(`ok retrait ${idr(a)} id=${it.id}`);
} else if (cmd === 'exchange') {
  // change d'euros en roupies : exchange <euros> <roupies reçues>
  const e = parseAmount(args[1], 'EUR'), r = parseAmount(args[2], 'IDR');
  const it = upsert('cash', { type: 'exchange', date: args[3] || today, amountEUR: e, amountIDR: r }); save(D); console.log(`ok change ${eur(e)} → ${idr(r)} id=${it.id}`);
} else if (cmd === 'settings') {
  D.settings = { ...D.settings, ...parseJSON(args[1]), updatedAt: now() }; save(D); console.log('ok réglages');
} else if (cmd === 'delete') {
  const [_, col, id] = args; D[col] = D[col].filter(x => x.id !== id); D.deleted[id] = now(); save(D); console.log(`supprimé ${col} ${id}`);
} else if (cmd === 'list') {
  const n = Number(args[1] || 3); const from = addDays(today, -n + 1);
  D.expenses.filter(e => e.date >= from).sort((a, b) => a.date.localeCompare(b.date)).forEach(e => console.log(`${e.date}  ${CAT[e.cat]?.emoji} ${e.label}  ${e.currency === 'IDR' ? idr(e.amount + (e.tip || 0)) : eur(e.amount + (e.tip || 0))}  [${e.pay}]  id=${e.id}`));
} else if (cmd === 'rate') {
  const r = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=IDR').then(r => r.json()).catch(() => null);
  const v = r?.rates?.IDR; if (!v) { console.error('Taux indisponible'); process.exit(1); }
  D.settings = { ...D.settings, rate: Math.round(v), rateDate: today, updatedAt: now() }; save(D); console.log(`1 € = ${Math.round(v)} Rp`);
} else {
  // status
  const ms = monthSummary(D, ymOf(today), today);
  const dy = ms.day;
  const cash = cashBalance(D);
  const sv = savingsSummary(D, today);
  const mois = (m) => m >= 1 ? `${Math.floor(m)} mois` : `${Math.round(m * 30)} jours`;
  console.log(`QQ — ${today} (${tz})  ·  fichier : ${dataPath}`);
  console.log(`Budget ${ymOf(today)} : ${eur(ms.budget)}${ms.prorated ? ' (prorata)' : ''}  ·  logements+fixes ${eur(ms.fixed)}  ·  quotidien dépensé ${eur(ms.varSpent)}  ·  reste ${eur(ms.remaining)}`);
  console.log(`Aujourd'hui (repas, courses, transport, pourboires) : budget ${both(dy.allowance)}, dépensé ${both(dy.spent)}, reste ${both(dy.remaining)}`);
  if (dy.tomorrow != null) console.log(`Demain : ${both(dy.tomorrow)}  (jour normal : ${both(dy.base)})`);
  console.log(`Repas : ≈ ${both(ms.mealAllowance)} par repas  ·  à ce rythme, fin de mois ${eur(ms.projected)}`);
  for (const c of DAY_CATS) { const x = ms.cats[c]; if (x.pct) console.log(`  ${CAT[c].label.padEnd(22)} aujourd'hui ${idr(x.today * R).padStart(12)} / ${idr(Math.max(0, x.dailyAllowance) * R)}`); }
  console.log('Cette semaine :');
  for (const c of WEEK_CATS) { const x = ms.cats[c]; if (x.pct) console.log(`  ${CAT[c].label.padEnd(22)} ${idr(x.weekSpent * R).padStart(12)} / ${idr(Math.max(0, x.weekEnvelope) * R)}`); }
  if (sv) console.log(`Cagnotte : ${eur(sv.remaining)} restent sur ${eur(sv.amount + sv.income)}${sv.income ? ` (dont ${eur(sv.income)} de rentrées)` : ''} · ${eur(sv.spent)} dépensés en ${sv.days} j${sv.realDaily ? ` (${eur(sv.realDaily * 30.44)}/mois)` : ''} · tient ≈ ${mois(sv.monthsLeft)}${sv.endDate ? ` (→ ${sv.endDate.slice(0, 7)})` : ''}`);
  if (cash != null) console.log(`Billets estimés : ${idr(cash.idr)}${cash.eur ? ` + ${eur(cash.eur)} en billets euros` : ''}`);
}
