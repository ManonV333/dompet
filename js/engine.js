// Dompet — moteur de calcul (pur, sans DOM). Utilisé par le site ET par le script de Claude.
// Toutes les dates sont des chaînes "YYYY-MM-DD" (heure locale de Bali).

export const CATS = [
  { id: 'logement',  label: 'Logement',            emoji: '🏡', hint: 'Nuit en plus, caution, ménage' },
  { id: 'food',      label: 'Repas',               emoji: '🍜', hint: 'Warung, resto, café, GoFood' },
  { id: 'groceries', label: 'Courses',             emoji: '🛒', hint: 'Supermarché, eau, fruits' },
  { id: 'transport', label: 'Transport',           emoji: '🛵', hint: 'Grab, Gojek, scooter, essence' },
  { id: 'leisure',   label: 'Bien-être & sorties', emoji: '🌸', hint: 'Massage, sport, surf, bar' },
  { id: 'shopping',  label: 'Shopping',            emoji: '🛍️', hint: 'Vêtements, souvenirs' },
  { id: 'tips',      label: 'Pourboires',          emoji: '🙏', hint: 'Tips, offrandes' },
  { id: 'pro',       label: 'Pro & abonnements',   emoji: '💼', hint: 'Google Ads, logiciels, coworking' },
  { id: 'other',     label: 'Divers',              emoji: '✨', hint: 'Laundry, SIM, santé, visa, frais' },
];
export const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));

// Catégories du quotidien variable. Les « jour » se suivent jour par jour,
// les « semaine » (dépenses irrégulières : massage, shopping…) se suivent à la semaine.
export const DAILY_CATS = ['food', 'groceries', 'transport', 'tips', 'leisure', 'shopping', 'other'];
export const DAY_CATS = ['food', 'groceries', 'transport', 'tips'];
export const WEEK_CATS = ['leisure', 'shopping', 'other'];

export const SUGGESTIONS = {
  food: ['Warung', 'Restaurant', 'Café', 'Smoothie bowl', 'GoFood', 'Street food', 'Petit-déj'],
  groceries: ['Supermarché', 'Eau', 'Fruits', 'Snacks', 'Pepito'],
  transport: ['Grab', 'Gojek', 'Location scooter', 'Essence', 'Bateau / ferry', 'Vol', 'Parking'],
  leisure: ['Massage', 'Salle de sport', 'Yoga', 'Surf', 'Beach club', 'Excursion', 'Bar'],
  shopping: ['Vêtements', 'Souvenirs', 'Cosmétiques', 'Accessoires'],
  tips: ['Pourboire', 'Offrande'],
  pro: ['Google Ads', 'Abonnement', 'Logiciel', 'Coworking'],
  other: ['Laundry', 'SIM / data', 'Pharmacie', 'Visa', 'Frais bancaires', 'Cadeau'],
  logement: ['Nuit supplémentaire', 'Caution', 'Ménage'],
};

// Calé sur son plan : ~290 €/mois de quotidien, eau 15, massage 26 + sport 100, pourboires 15.
export const DEFAULT_SPLIT = { food: 42, groceries: 5, transport: 10, tips: 3, leisure: 26, shopping: 6, other: 8 };

export function emptyData() {
  const now = new Date().toISOString();
  return {
    schema: 1,
    updatedAt: now,
    settings: {
      updatedAt: '1970-01-01T00:00:00.000Z', // réglages par défaut : jamais prioritaires sur une vraie version
      defaultMonthlyBudget: 1000,
      monthlyBudgets: {},
      tripStart: null,
      tripEnd: null,
      trackFrom: null,
      tripBudget: null,
      rate: 20000,
      rateDate: null,
      rateAuto: true,
      split: { ...DEFAULT_SPLIT },
      mealsPerDay: 3,
      savings: { amount: null, date: null }, // cagnotte totale du voyage
      cashStart: { date: null, amountIDR: 0 },
      timezone: 'Asia/Makassar',
    },
    expenses: [],
    stays: [],
    recurring: [],
    cash: [],
    deleted: {},
  };
}

// ---------- dates ----------
const DAY = 86400000;
export const parseD = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const fmtD = t => new Date(t).toISOString().slice(0, 10);
export const addDays = (s, n) => fmtD(parseD(s) + n * DAY);
export const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / DAY);
export const ymOf = s => s.slice(0, 7);
export const daysInMonth = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export const monthFirst = ym => `${ym}-01`;
export const monthLast = ym => `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`;
export const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
export const weekday = s => (new Date(parseD(s)).getUTCDay() + 6) % 7; // 0 = lundi
export function todayIn(tz) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  catch { return fmtD(Date.now()); }
}
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function rangeDays(a, b) { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; }

// ---------- argent ----------
export const toEUR = (amount, currency, rate) => currency === 'EUR' ? amount : amount / rate;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Lit un montant tapé façon Bali : "50k", "50rb", "1,5jt", "45.000", "12,50".
export function parseAmount(raw, currency = 'IDR') {
  if (raw == null) return NaN;
  let s = String(raw).trim().toLowerCase().replace(/\s|rp|€|eur|idr/g, '');
  if (!s) return NaN;
  let mult = 1;
  const m = s.match(/(k|rb|ribu|jt|juta|m)$/);
  if (m) { mult = /^(k|rb|ribu)$/.test(m[1]) ? 1e3 : 1e6; s = s.slice(0, -m[1].length); }
  if (currency === 'IDR' && mult === 1) {
    s = s.replace(/\./g, '').replace(',', '.'); // 45.000 → 45000
  } else {
    s = s.replace(',', '.');
  }
  const v = parseFloat(s);
  return Number.isFinite(v) ? v * mult : NaN;
}

// ---------- éclatement en lignes ----------
// Chaque ligne = { date, eur, cat, kind, fixed, pay, label, ref }
export function stayNights(st) { return Math.max(0, diffDays(st.checkin, st.checkout)); }
export function stayNightEUR(st, rate) {
  const n = stayNights(st); if (!n) return 0;
  return toEUR(st.total, st.currency, st.rate || rate) / n;
}

function recurringDates(r, from, to) {
  const out = [];
  const start = r.start || from;
  const end = r.end || '9999-12-31';
  if (r.freq === 'weekly') {
    let d = start;
    if (d < from) d = addDays(d, Math.ceil(diffDays(d, from) / 7) * 7);
    for (; d <= to && d <= end; d = addDays(d, 7)) out.push(d);
    return out;
  }
  for (let ym = ymOf(from); ym <= ymOf(to); ym = addMonths(ym, 1)) {
    if (r.freq === 'yearly' && ym.slice(5) !== start.slice(5, 7)) continue;
    const day = Math.min(r.day || Number(start.slice(8)) || 1, daysInMonth(ym));
    const d = `${ym}-${String(day).padStart(2, '0')}`;
    if (d >= from && d <= to && d >= start && d <= end) out.push(d);
  }
  return out;
}

export function linesBetween(data, from, to) {
  const s = data.settings, rate = s.rate;
  const L = [];
  for (const e of data.expenses) {
    const n = e.spread === 'month' ? 30 : e.spread === 'week' ? 7 : 1;
    const last = n > 1 ? addDays(e.date, n - 1) : e.date;
    if (last < from || e.date > to) continue;
    const r = e.currency === 'EUR' ? 1 : (e.rate || rate);
    const base = toEUR(e.amount, e.currency, r) / n, tip = e.tip ? toEUR(e.tip, e.currency, r) / n : 0;
    for (let i = 0; i < n; i++) {
      const d = n > 1 ? addDays(e.date, i) : e.date;
      if (d < from || d > to) continue;
      // offBudget : payé d'avance (vol, VPN…) → sort de la cagnotte mais pas du budget du mois
      L.push({ date: d, eur: base, cat: e.cat, kind: e.offBudget ? 'offbudget' : 'expense', fixed: !!e.offBudget, off: !!e.offBudget, pay: e.pay, label: e.label, ref: e.id, spread: n > 1 });
      if (tip) L.push({ date: d, eur: tip, cat: 'tips', kind: 'tip', fixed: false, pay: e.pay, label: `Pourboire · ${e.label || ''}`, ref: e.id });
    }
  }
  for (const st of data.stays) {
    const n = stayNights(st); if (!n) continue;
    const per = stayNightEUR(st, rate);
    for (let i = 0; i < n; i++) {
      const d = addDays(st.checkin, i);
      if (d < from || d > to) continue;
      L.push({ date: d, eur: per, cat: 'logement', kind: 'stay', fixed: true, pay: 'card', label: st.name, ref: st.id });
    }
  }
  for (const r of data.recurring) {
    if (r.active === false) continue;
    for (const d of recurringDates(r, from, to)) {
      const ov = r.overrides && r.overrides[ymOf(d)];
      const amt = ov != null ? ov : r.amount;
      L.push({ date: d, eur: toEUR(amt, r.currency, rate), cat: r.cat || 'pro', kind: 'recurring', fixed: true, pay: 'card', label: r.label, ref: r.id });
    }
  }
  for (const c of data.cash) {
    if (c.type !== 'withdraw' || c.date < from || c.date > to) continue;
    const fee = (c.feeIDR || 0) / rate + (c.feeEUR || 0);
    if (fee > 0) L.push({ date: c.date, eur: fee, cat: 'other', kind: 'fee', fixed: false, pay: 'card', label: 'Frais de retrait', ref: c.id });
  }
  return L;
}

const sum = (arr, f = x => x.eur) => arr.reduce((a, x) => a + f(x), 0);

export function budgetFor(data, ym) {
  const b = data.settings.monthlyBudgets && data.settings.monthlyBudgets[ym];
  return b != null ? b : data.settings.defaultMonthlyBudget;
}

// ---------- le cœur : où j'en suis ce mois-ci ----------
export function monthSummary(data, ym, today) {
  const s = data.settings;
  // Si le voyage commence ou finit en cours de mois, le budget est proratisé sur les jours réellement couverts.
  const realFirst = monthFirst(ym), realLast = monthLast(ym), fullDim = daysInMonth(ym);
  // Le calcul démarre au plus tard entre le début du voyage et le jour où tu as commencé à tout noter (trackFrom).
  const startAt = [s.tripStart, s.trackFrom].filter(Boolean).sort().pop();
  const first = startAt && startAt > realFirst && startAt <= realLast ? startAt : realFirst;
  const last = s.tripEnd && s.tripEnd >= first && s.tripEnd < realLast ? s.tripEnd : realLast;
  const dim = diffDays(first, last) + 1;
  const explicit = s.monthlyBudgets && s.monthlyBudgets[ym] != null;
  const prorated = !explicit && dim < fullDim;
  const B = prorated ? budgetFor(data, ym) * dim / fullDim : budgetFor(data, ym);
  const lines = linesBetween(data, first, last).filter(l => !l.off);
  const fixedLines = lines.filter(l => l.fixed), varLines = lines.filter(l => !l.fixed);
  const fixed = sum(fixedLines);
  const fixedStays = sum(fixedLines.filter(l => l.kind === 'stay'));
  const fixedRecurring = fixed - fixedStays;
  const varBudget = B - fixed;

  const state = today < first ? 'future' : today > last ? 'past' : 'current';
  const ref = state === 'current' ? today : state === 'future' ? first : addDays(last, 1);
  const spentBefore = sum(varLines.filter(l => l.date < ref));
  const spentToday = state === 'current' ? sum(varLines.filter(l => l.date === today)) : 0;
  const varSpent = sum(varLines);
  const daysLeft = state === 'current' ? diffDays(today, last) + 1 : state === 'future' ? dim : 0;
  const baseDaily = varBudget / dim;
  const todayAllowance = daysLeft ? (varBudget - spentBefore) / daysLeft : 0;
  const remainingToday = todayAllowance - spentToday;
  const tomorrowAllowance = daysLeft > 1 ? (varBudget - spentBefore - spentToday) / (daysLeft - 1) : null;

  // Rythme : moyenne des 7 derniers jours terminés (variable)
  const elapsedFull = state === 'current' ? diffDays(first, today) : state === 'past' ? dim : 0;
  const win = Math.min(7, elapsedFull);
  let avgRecent = 0;
  if (win > 0) {
    const from = addDays(ref, -win);
    avgRecent = sum(varLines.filter(l => l.date >= from && l.date < ref)) / win;
  }
  const avgMonth = elapsedFull > 0 ? spentBefore / elapsedFull : 0;
  const projVar = state === 'past' ? varSpent
    : state === 'future' ? varBudget
    : spentBefore + Math.max(spentToday, avgRecent || baseDaily) + (avgRecent || baseDaily) * (daysLeft - 1);
  const projected = fixed + projVar;
  const idealVarToDate = baseDaily * (state === 'current' ? elapsedFull : state === 'past' ? dim : 0);

  // Enveloppes par catégorie
  const split = s.split || DEFAULT_SPLIT;
  const cats = {};
  for (const c of CATS) {
    const cl = varLines.filter(l => l.cat === c.id);
    const pct = split[c.id] || 0;
    const env = varBudget * pct / 100;
    const before = sum(cl.filter(l => l.date < ref));
    const todayC = state === 'current' ? sum(cl.filter(l => l.date === today)) : 0;
    const fixedC = sum(fixedLines.filter(l => l.cat === c.id));
    // semaine en cours (lundi → dimanche), bornée au mois
    const ws = state === 'current' ? (addDays(today, -weekday(today)) < first ? first : addDays(today, -weekday(today))) : null;
    const we = ws ? (addDays(ws, 6 - (ws === first ? weekday(first) : 0)) > last ? last : addDays(ws, 6 - (ws === first ? weekday(first) : 0))) : null;
    const weekDays = ws ? diffDays(ws, we) + 1 : 0;
    const weekSpent = ws ? sum(cl.filter(l => l.date >= ws && l.date <= today)) : 0;
    const weekBefore = ws ? sum(cl.filter(l => l.date < ws)) : before;
    const weekEnvelope = ws && daysLeft ? Math.max(0, env - weekBefore) * Math.min(weekDays, diffDays(ws, last) + 1) / (diffDays(ws, last) + 1) : 0;
    cats[c.id] = {
      pct, envelope: env, spent: sum(cl), spentBefore: before, today: todayC, fixed: fixedC,
      weekSpent, weekEnvelope, weekRemaining: weekEnvelope - weekSpent, weekStart: ws, weekEnd: we,
      dailyAllowance: daysLeft && pct ? (env - before) / daysLeft : 0,
      count: cl.filter(l => l.kind === 'expense').length,
    };
  }
  const meals = Math.max(1, s.mealsPerDay || 2);
  const mealAllowance = cats.food.dailyAllowance / meals;

  // Le « jour » : seulement le quotidien régulier (repas, courses, transport, pourboires).
  // Massage, shopping, divers se suivent à la semaine et ne font pas exploser la journée.
  const inDay = l => DAY_CATS.includes(l.cat);
  const dayPct = DAY_CATS.reduce((a, c) => a + (split[c] || 0), 0);
  const dayBudget = varBudget * dayPct / 100;
  const dLines = varLines.filter(inDay);
  const dBefore = sum(dLines.filter(l => l.date < ref));
  const dToday = state === 'current' ? sum(dLines.filter(l => l.date === today)) : 0;
  const dAllow = daysLeft ? (dayBudget - dBefore) / daysLeft : 0;
  const day = {
    budget: dayBudget, base: dayBudget / dim, allowance: dAllow, spent: dToday, remaining: dAllow - dToday, spentBefore: dBefore,
    tomorrow: daysLeft > 1 ? (dayBudget - dBefore - dToday) / (daysLeft - 1) : null,
    idealToDate: dayBudget / dim * (state === 'current' ? elapsedFull : state === 'past' ? dim : 0),
  };

  // Série jour par jour (pour les graphes)
  const days = [];
  let cum = 0, cumD = 0;
  for (let i = 0; i < dim; i++) {
    const d = addDays(first, i);
    const dl = varLines.filter(l => l.date === d);
    const allowance = (varBudget - cum) / (dim - i);
    const dAllowance = (dayBudget - cumD) / (dim - i);
    const spent = sum(dl), dSpent = sum(dl.filter(inDay));
    days.push({ date: d, spent, allowance, dSpent, dAllowance, fixed: sum(fixedLines.filter(l => l.date === d)), cumVar: cum + spent, byCat: groupSum(dl) });
    cum += spent; cumD += dSpent;
  }

  return {
    ym, first, last, dim, fullDim, prorated, fullBudget: budgetFor(data, ym), state, today, budget: B, fixed, fixedStays, fixedRecurring, varBudget,
    spentBefore, spentToday, varSpent, committed: fixed + varSpent, remaining: B - fixed - varSpent,
    daysLeft, baseDaily, todayAllowance, remainingToday, tomorrowAllowance,
    avgRecent, avgMonth, projected, idealVarToDate, cats, mealAllowance, meals, days, lines, day,
  };
}

export function groupSum(lines, key = 'cat') {
  const o = {};
  for (const l of lines) o[l[key]] = (o[l[key]] || 0) + l.eur;
  return o;
}

// ---------- logements : couverture du voyage ----------
export function staysCoverage(data) {
  const s = data.settings;
  const stays = [...data.stays].sort((a, b) => a.checkin.localeCompare(b.checkin));
  if (!stays.length && !s.tripStart) return { stays, gaps: [], overlaps: [], nights: 0, total: 0, avgNight: 0 };
  const start = s.tripStart || stays[0].checkin;
  const end = s.tripEnd || (stays.length ? stays.reduce((m, x) => x.checkout > m ? x.checkout : m, stays[0].checkout) : start);
  const cover = {};
  for (const st of stays) for (let i = 0; i < stayNights(st); i++) { const d = addDays(st.checkin, i); cover[d] = (cover[d] || 0) + 1; }
  const gaps = [], overlaps = [];
  let g = null, o = null;
  for (let d = start; d < end; d = addDays(d, 1)) {
    const c = cover[d] || 0;
    if (c === 0) { g ? g.to = d : (g = { from: d, to: d }); } else if (g) { gaps.push(g); g = null; }
    if (c > 1) { o ? o.to = d : (o = { from: d, to: d }); } else if (o) { overlaps.push(o); o = null; }
  }
  if (g) gaps.push(g); if (o) overlaps.push(o);
  const nights = stays.reduce((a, x) => a + stayNights(x), 0);
  const total = stays.reduce((a, x) => a + toEUR(x.total, x.currency, x.rate || s.rate), 0);
  return { stays, gaps, overlaps, nights, total, avgNight: nights ? total / nights : 0, start, end, tripNights: diffDays(start, end) };
}

// ---------- cash en poche ----------
export function cashBalance(data) {
  const s = data.settings, rate = s.rate;
  const start = s.cashStart && s.cashStart.date;
  if (!start) return null;
  let bal = s.cashStart.amountIDR || 0;
  for (const c of data.cash) {
    if (c.date < start) continue;
    if (c.type === 'withdraw') bal += c.amountIDR || 0;
    if (c.type === 'adjust') bal += c.amountIDR || 0;
  }
  for (const e of data.expenses) {
    if (e.pay !== 'cash' || e.date < start) continue;
    const tot = (e.amount || 0) + (e.tip || 0);
    bal -= e.currency === 'IDR' ? tot : tot * rate;
  }
  return bal;
}

// ---------- voyage complet ----------
export function tripSummary(data, today) {
  const s = data.settings;
  if (!s.tripStart) return null;
  const end = s.tripEnd && s.tripEnd < today ? s.tripEnd : today;
  if (end < s.tripStart) return { started: false, daysTo: diffDays(today, s.tripStart) };
  const lines = linesBetween(data, s.tripStart, end);
  const days = diffDays(s.tripStart, end) + 1;
  const total = sum(lines);
  const totalDays = s.tripEnd ? diffDays(s.tripStart, s.tripEnd) + 1 : null;
  return { started: true, days, total, perDay: total / days, totalDays, dayIndex: days, byCat: groupSum(lines) };
}

// ---------- fusion (sync) ----------
const COLS = ['expenses', 'stays', 'recurring', 'cash'];
export function mergeData(a, b) {
  if (!a) return b; if (!b) return a;
  const out = { ...a, schema: 1 };
  const deleted = { ...(a.deleted || {}) };
  for (const [k, v] of Object.entries(b.deleted || {})) if (!deleted[k] || deleted[k] < v) deleted[k] = v;
  for (const col of COLS) {
    const m = new Map();
    for (const it of [...(a[col] || []), ...(b[col] || [])]) {
      const cur = m.get(it.id);
      if (!cur || (it.updatedAt || '') > (cur.updatedAt || '')) m.set(it.id, it);
    }
    out[col] = [...m.values()].filter(it => !(deleted[it.id] && deleted[it.id] >= (it.updatedAt || '')));
  }
  out.deleted = deleted;
  out.settings = ((b.settings?.updatedAt || '') > (a.settings?.updatedAt || '')) ? b.settings : a.settings;
  out.settings = { ...emptyData().settings, ...out.settings };
  out.updatedAt = [a.updatedAt, b.updatedAt].sort().pop();
  return out;
}

export function normalize(d) {
  const base = emptyData();
  const out = { ...base, ...d, settings: { ...base.settings, ...(d && d.settings) } };
  for (const col of COLS) out[col] = Array.isArray(out[col]) ? out[col] : [];
  out.deleted = out.deleted || {};
  out.settings.split = { ...DEFAULT_SPLIT, ...(out.settings.split || {}) };
  return out;
}

// Habitudes réelles → répartition proposée (sur les dépenses variables passées)
export function suggestSplit(data) {
  if (data.expenses.length < 10) return null;
  const dates = data.expenses.map(e => e.date).sort();
  const lines = linesBetween(data, dates[0], dates[dates.length - 1]).filter(l => !l.fixed && DAILY_CATS.includes(l.cat));
  const tot = sum(lines);
  if (tot <= 0) return null;
  const g = groupSum(lines);
  const out = {}; let acc = 0;
  DAILY_CATS.forEach(c => { out[c] = Math.round((g[c] || 0) / tot * 100); acc += out[c]; });
  out.food += 100 - acc;
  return out;
}

// ---------- la cagnotte : combien de temps ça tient ----------
export function savingsSummary(data, today) {
  const s = data.settings;
  const sv = s.savings || {};
  const start = sv.date || s.tripStart;
  if (!sv.amount || !start) return null;
  const end = today < start ? start : today;
  const lines = linesBetween(data, start, end);
  const spent = sum(lines);
  const days = Math.max(1, diffDays(start, end) + 1);
  const remaining = sv.amount - spent;
  // rythme réel (≥ 7 jours de données), sinon le budget mensuel
  const budgetDaily = s.defaultMonthlyBudget * 12 / 365;
  const realDaily = days >= 7 ? spent / days : null;
  const pace = realDaily || budgetDaily;
  const daysLeft = pace > 0 ? remaining / pace : Infinity;
  const endDate = Number.isFinite(daysLeft) ? addDays(end, Math.floor(daysLeft)) : null;
  // engagements futurs déjà réservés (logements après aujourd'hui)
  const booked = sum(linesBetween(data, addDays(end, 1), '2099-12-31').filter(l => l.kind === 'stay'));
  const scen = [['faible', 690], ['ton budget', s.defaultMonthlyBudget], ['élevé', 990]].map(([k, m]) => ({ key: k, monthly: m, months: remaining / m }));
  return { amount: sv.amount, start, spent, remaining, days, realDaily, budgetDaily, pace, monthsLeft: daysLeft / 30.44, endDate, booked, scenarios: scen, pct: spent / sv.amount };
}

// ---------- bilan d'une semaine ----------
export function weekSummary(data, today) {
  const ws = addDays(today, -weekday(today));
  const prev = addDays(ws, -7);
  const cur = linesBetween(data, ws, today).filter(l => !l.fixed);
  const last = linesBetween(data, prev, addDays(ws, -1)).filter(l => !l.fixed);
  const days = diffDays(ws, today) + 1;
  return { start: ws, days, spent: sum(cur), lastWeek: sum(last), byCat: groupSum(cur), perDay: sum(cur) / days, lastPerDay: sum(last) / 7 };
}

// ---------- saisie en une phrase : « nasi goreng 35k cash » ----------
const KEYWORDS = {
  food: 'nasi mie mee goreng warung warteg resto restaurant cafe coffee kopi latte cappuccino smoothie bowl acai dej dejeuner diner brunch repas pizza burger gofood grabfood shopeefood babi guling sate satay ayam gado poke jus juice glace gelato croissant boulangerie bakery coco coconut sushi pad thai curry soupe salade sandwich wrap tacos breakfast lunch dinner bakso martabak pisang',
  groceries: 'eau water aqua supermarche supermarket pepito indomaret alfamart minimart courses fruits fruit snack snacks biscuits yaourt lait pain cereales gourde',
  transport: 'gojek grab taxi bluebird scooter essence bensin pertamina bateau ferry fastboat bus navette shuttle parking moto bemo uber',
  leisure: 'massage spa sport gym salle yoga surf pilates cours temple entree beach club bar biere bintang cocktail excursion tour sortie cinema plongee snorkeling manucure manucure nails ongles coiffeur reflexologie sauna hammam boxe muay',
  shopping: 'robe maillot vetement vetements short top sandales tongs souvenir souvenirs sac bijou bijoux creme solaire cosmetique cosmetiques maquillage lunettes chapeau paréo pareo',
  tips: 'pourboire tip tips offrande',
  pro: 'ads google canva domaine hebergement shopify claude chatgpt abonnement logiciel coworking',
  other: 'laundry lessive pressing sim data forfait pharmacie medecin docteur visa frais cadeau poste impression',
};
const KW = new Map();
for (const [cat, words] of Object.entries(KEYWORDS)) for (const w of words.split(' ')) if (!KW.has(w)) KW.set(w, cat);
const PHRASES = [['beach club', 'leisure'], ['google ads', 'pro'], ['fast boat', 'transport'], ['petit dej', 'food'], ['salle de sport', 'leisure']];
const deacc = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const FILLER = new Set(['de', 'du', 'des', 'd', 'le', 'la', 'les', 'l', 'un', 'une', 'en', 'a', 'au', 'aux', 'pour', 'et', 'avec', 'par', 'paye', 'payee', 'payé']);
const PAY = { cash: 'cash', especes: 'cash', espece: 'cash', liquide: 'cash', carte: 'card', cb: 'card', card: 'card', visa: 'card', wise: 'card', revolut: 'card' };

export function guessCat(label, history) {
  const n = deacc(label || '').trim();
  if (!n) return null;
  if (history && history.has(n)) return history.get(n);
  for (const [p, c] of PHRASES) if (n.includes(p)) return c;
  for (const w of n.split(/[^a-z0-9]+/)) if (KW.has(w)) return KW.get(w);
  return null;
}

// Renvoie ce qu'on a compris, champ par champ (les champs absents restent undefined).
export function parseQuick(text, { history = null, defaultCurrency = 'IDR' } = {}) {
  const out = { label: '', amount: undefined, currency: undefined, pay: undefined, tip: undefined, cat: null };
  if (!text || !text.trim()) return out;
  const toks = text.trim().split(/\s+/);
  const words = [];
  let tipNext = false;
  if (toks.some(x => /^(eur|euro|euros|€)$/.test(deacc(x)))) out.currency = 'EUR';
  for (let i = 0; i < toks.length; i++) {
    const raw = toks[i], t = deacc(raw).replace(/[,;!?]$/, '');
    if (PAY[t]) { out.pay = PAY[t]; continue; }
    if (/^(tip|tips|pourboire|\+tip)$/.test(t)) { tipNext = true; continue; }
    if (/^(eur|euro|euros|€)$/.test(t)) { out.currency = 'EUR'; continue; }
    if (/^(rp|idr|roupies?)$/.test(t)) { out.currency = 'IDR'; continue; }
    const m = t.replace(/^\+/, '').match(/^(rp)?(\d+(?:[.,]\d+)*)(k|rb|ribu|jt|juta|m)?(€|e|eur|rp)?$/);
    if (m) {
      const cur = m[4] && /€|e|eur/.test(m[4]) ? 'EUR' : (m[1] || m[4] === 'rp') ? 'IDR' : null;
      if (cur) out.currency = cur;
      const c = cur || out.currency || defaultCurrency;
      let v = parseAmount(m[2] + (m[3] || ''), c);
      if (c === 'IDR' && !m[3] && v < 1000) v *= 1000; // « 35 » à Bali = 35 000 Rp
      if (tipNext || (out.amount !== undefined && /^\+/.test(raw))) { out.tip = v; tipNext = false; }
      else if (out.amount === undefined) out.amount = v;
      else out.tip = v;
      continue;
    }
    words.push(raw);
  }
  while (words.length && FILLER.has(deacc(words[words.length - 1]))) words.pop();
  while (words.length && FILLER.has(deacc(words[0]))) words.shift();
  const label = words.join(' ');
  out.label = label ? label.charAt(0).toUpperCase() + label.slice(1) : '';
  out.cat = guessCat(label, history);
  if (out.currency === undefined && out.amount !== undefined) out.currency = defaultCurrency;
  return out;
}
