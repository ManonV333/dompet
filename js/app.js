// Dompet — interface
import {
  CATS, CAT, DAILY_CATS, DAY_CATS, WEEK_CATS, SUGGESTIONS, DEFAULT_SPLIT, monthSummary, staysCoverage, cashBalance, tripSummary, linesBetween,
  savingsSummary, parseQuick, guessCat,
  localToday, ymOf, addDays, addMonths, diffDays, monthFirst, weekday, parseAmount, toEUR,
  stayNights, stayNightEUR, groupSum, suggestSplit,
} from './engine.js';
import { store, init, onChange, upsert, remove, setSettings, replaceAll, wipe, syncNow, saveSyncConfig, forgetSync, testConnection, syncConfigured, hasData } from './store.js';
import { ring, donut, dayBars, burnUp, heatmap, stackBar } from './charts.js';
import { demoData } from './demo.js';
import { I, icon, catIcon } from './icons.js';

// ---------- petits outils ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { } };

const UI = {
  view: lsGet('dompet:view', 'today'),
  cur: lsGet('dompet:cur', 'IDR'),
  month: null,
  jFilter: 'all', jSearch: '',
};
const D = () => store.data;
const rate = () => D().settings.rate || 18500;
const today = () => localToday();
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MSHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const chartW = () => (window.innerWidth < 600 ? 360 : 640);
const WD = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const WD_SHORT = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const monthName = ym => cap(MONTHS[Number(ym.slice(5)) - 1]) + (ym.slice(0, 4) !== today().slice(0, 4) ? ' ' + ym.slice(0, 4) : '');
const dayLong = d => `${cap(WD[weekday(d)])} ${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const dayShort = d => `${Number(d.slice(8))} ${MSHORT[Number(d.slice(5, 7)) - 1]}`;
const monthYear = d => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

// ---------- montants ----------
// espace insécable normale (l'espace fine U+202F n'existe pas dans toutes les polices)
const fixSp = f => ({ format: v => f.format(v).replace(/\u202f/g, '\u00a0') });
const nf0 = fixSp(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, useGrouping: 'always' }));
const nf2 = fixSp(new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtEUR = (v, { round = false } = {}) => { const a = Math.abs(v); const s = (round || a >= 100) ? nf0.format(Math.round(a)) : nf2.format(a); return `${v < -0.004 ? '−' : ''}${s} €`; };
const fmtIDR = (v, { exact = false } = {}) => { const r = exact ? Math.round(v) : Math.round(v / 1000) * 1000; return `${r < 0 ? '−' : ''}Rp ${nf0.format(Math.abs(r))}`; };
const kIDR = v => { const a = Math.abs(v), sg = v < 0 ? '−' : ''; if (a >= 1e6) return `${sg}${(a / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }).replace(/\u202f/g, '\u00a0')} jt`; if (a >= 1e3) return `${sg}${Math.round(a / 1e3)}k`; return `${sg}${Math.round(a)}`; };
function money(eur, opts = {}) {
  const idr = eur * rate();
  return UI.cur === 'IDR' ? [opts.compact ? `Rp ${kIDR(idr)}` : fmtIDR(idr), fmtEUR(eur, opts)] : [fmtEUR(eur, opts), opts.compact ? `Rp ${kIDR(idr)}` : fmtIDR(idr)];
}
const m1 = (eur, o) => money(eur, o)[0];
const m2 = (eur, o) => money(eur, o)[1];
const axisFmt = v => UI.cur === 'IDR' ? kIDR(v * rate()) : `${Math.round(v)} €`;
const expTotalStr = e => { const tot = (e.amount || 0) + (e.tip || 0); return e.currency === 'IDR' ? fmtIDR(tot, { exact: true }) : fmtEUR(tot); };
const expEUR = e => toEUR((e.amount || 0) + (e.tip || 0), e.currency, e.currency === 'EUR' ? 1 : (e.rate || rate()));
const catColor = id => `var(--c-${id})`;
const badge = (cat, cls = '') => `<span class="badge ${cls}" style="--c:${catColor(cat)}">${catIcon(cat)}</span>`;

// ---------- infobulle + toast ----------
const tip = document.createElement('div'); tip.className = 'tooltip'; tip.setAttribute('role', 'status');
document.body.appendChild(tip);
function showTip(el, x, y) {
  const t = el.getAttribute('data-tip'); if (!t) return hideTip();
  tip.innerHTML = esc(t).replace(/\n/g, '<br>'); tip.classList.add('on');
  const r = tip.getBoundingClientRect();
  const nx = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2));
  const ny = y - r.height - 14 < 8 ? y + 18 : y - r.height - 14;
  tip.style.transform = `translate(${nx}px, ${ny}px)`;
}
function hideTip() { tip.classList.remove('on'); }
document.addEventListener('pointermove', e => { const el = e.target.closest?.('[data-tip]'); if (el && e.pointerType === 'mouse') showTip(el, e.clientX, e.clientY); else if (!el && e.pointerType === 'mouse') hideTip(); });
document.addEventListener('pointerdown', e => { const el = e.target.closest?.('[data-tip]'); if (el && e.pointerType !== 'mouse' && el.closest('svg, .stackbar, .wk, .bar')) showTip(el, e.clientX, e.clientY); else if (!el) hideTip(); });
window.addEventListener('scroll', hideTip, { passive: true });

let toastTimer;
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" class="toast-btn">${esc(action.label)}</button>` : ''}`;
  t.classList.add('on');
  if (action) $('.toast-btn', t).onclick = () => { action.fn(); t.classList.remove('on'); };
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), action ? 5000 : 2600);
}

// ---------- coquille ----------
const NAV = [
  { id: 'today', label: "Aujourd'hui", icon: I.today },
  { id: 'stats', label: 'Analyse', icon: I.stats },
  { id: 'add', label: 'Ajouter', icon: I.plus },
  { id: 'journal', label: 'Journal', icon: I.journal },
  { id: 'stays', label: 'Séjour', icon: I.stays },
];

function shell() {
  $('#app').innerHTML = `
  <header class="top">
    <button class="brand" data-go="today" aria-label="Dompet, aller à aujourd'hui">
      <span class="brand-mark" aria-hidden="true"></span><span class="brand-name">dompet</span>
    </button>
    <div class="top-actions">
      <button class="sync" id="syncBtn" type="button"></button>
      <div class="seg cur-toggle" role="group" aria-label="Devise affichée">
        <button type="button" data-cur="IDR">Rp</button><button type="button" data-cur="EUR">€</button>
      </div>
      <button class="icon-btn" data-go="settings" aria-label="Réglages">${icon(I.settings)}</button>
    </div>
  </header>
  <div class="layout">
    <nav class="nav" aria-label="Sections">
      ${NAV.map(n => `<button type="button" class="nav-btn ${n.id === 'add' ? 'nav-add' : ''}" data-go="${n.id}" aria-label="${n.label}">${icon(n.icon)}<span>${n.label}</span></button>`).join('')}
    </nav>
    <main id="view" tabindex="-1"></main>
  </div>
  <div id="sheet" class="sheet-wrap" hidden></div>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>`;
}

function renderTop() {
  $$('[data-cur]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cur === UI.cur));
  const st = store.status;
  const labels = { local: 'Sur ce téléphone', syncing: 'Synchro…', synced: 'À jour', pending: 'À envoyer', error: 'Erreur synchro', offline: 'Hors ligne', demo: 'Exemple' };
  const b = $('#syncBtn');
  b.className = `sync s-${st}`;
  b.innerHTML = `<span class="dot"></span><span class="sync-l">${labels[st] || st}</span>`;
  b.title = store.error || (store.meta.lastSync ? `Dernière synchro : ${new Date(store.meta.lastSync).toLocaleString('fr-FR')}` : '');
  $$('.nav-btn').forEach(x => x.classList.toggle('on', x.dataset.go === UI.view));
}

function render() {
  renderTop();
  const v = $('#view');
  const views = { today: viewToday, stats: viewStats, journal: viewJournal, stays: viewStays, settings: viewSettings };
  if (!hasData() && !syncConfigured() && !D().demo && UI.view !== 'settings') { v.innerHTML = viewWelcome(); return; }
  const qb = $('#qbar'); const keep = qb && document.activeElement === qb ? qb.value : null;
  v.innerHTML = (views[UI.view] || viewToday)();
  if (keep != null && $('#qbar')) { const q = $('#qbar'); q.value = keep; q.focus(); }
}
function go(view) {
  if (view === 'add') return openExpense();
  UI.view = view; lsSet('dompet:view', view);
  if (view === 'stats' && !UI.month) UI.month = ymOf(today());
  render(); window.scrollTo({ top: 0 });
  const v = $('#view'); v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
}

// ---------- accueil ----------
function viewWelcome() {
  return `<section class="welcome">
    <div class="welcome-art" aria-hidden="true">${ring({ segs: DAILY_CATS.map(c => ({ value: DEFAULT_SPLIT[c], color: catColor(c) })), total: 100, size: 220, stroke: 14 })}</div>
    <h1>Ton budget de voyage, jour par jour.</h1>
    <p class="lead">Note ce que tu dépenses à Bali, ou dis-le à Claude. Chaque matin, Dompet te dit combien tu peux dépenser aujourd'hui, en roupies et en euros.</p>
    <div class="welcome-actions">
      <button class="btn primary big" data-act="setup">Commencer</button>
      <button class="btn" data-act="sync-setup">J'ai déjà un dépôt GitHub</button>
      <button class="btn ghost" data-act="demo">Voir avec un exemple</button>
    </div>
  </section>`;
}

// ---------- AUJOURD'HUI ----------
function insight(ms) {
  const t = ms.today;
  if (ms.varBudget <= 0) return { cls: 'crit', ico: I.alert, text: `Logements et charges fixes (${m1(ms.fixed)}) dépassent déjà le budget de ${monthName(ms.ym).toLowerCase()} (${m1(ms.budget)}).` };
  const yest = ms.days.find(d => d.date === addDays(t, -1));
  const tomorrow = ms.day.tomorrow;
  if (ms.day.remaining < -0.3) {
    const diff = tomorrow != null ? ms.day.base - tomorrow : 0;
    return { cls: 'serious', ico: I.cloud, text: `Tu as dépassé de ${m1(-ms.day.remaining)} aujourd'hui.${tomorrow != null ? ` Demain, ton budget sera de ${m1(tomorrow)}${diff > 0.2 ? ` (${m1(diff)} de moins qu'un jour normal)` : ''} pour rattraper.` : ''}` };
  }
  if (yest && yest.dSpent > yest.dAllowance * 1.05) {
    return { cls: 'warn', ico: I.down, text: `Hier : ${m1(yest.dSpent)} pour ${m1(yest.dAllowance)} prévus. Ton budget du jour a un peu baissé pour rattraper.` };
  }
  const ahead = ms.idealVarToDate - ms.spentBefore;
  if (ahead > ms.baseDaily * 0.5) return { cls: 'good', ico: I.up, text: `Tu as ${m1(ahead)} d'avance sur le mois : ton budget du jour monte un peu.` };
  if (ms.projected > ms.budget) return { cls: 'warn', ico: I.alert, text: `À ce rythme, ${monthName(ms.ym).toLowerCase()} finirait à ${m1(ms.projected)}, soit ${m1(ms.projected - ms.budget)} au-dessus.` };
  return { cls: 'good', ico: I.check, text: `Tu es dans le rythme du mois.` };
}

function favorites() {
  const from = addDays(today(), -60);
  const m = new Map();
  for (const e of D().expenses) {
    if (e.date < from || !e.label) continue;
    const k = `${e.label.toLowerCase()}|${e.cat}`;
    const cur = m.get(k) || { n: 0, e };
    cur.n++; if (e.date >= cur.e.date) cur.e = e; m.set(k, cur);
  }
  return [...m.values()].filter(x => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 8).map(x => x.e);
}

function envRow(c, spent, allow, sub = '') {
  const frac = allow > 0 ? spent / allow : (spent > 0 ? 1.2 : 0);
  const over = spent - Math.max(0, allow);
  return `<li class="env ${frac > 1.001 ? 'over' : ''}">
    ${badge(c)}
    <div class="env-body">
      <div class="env-top"><span class="env-name">${CAT[c].label}</span><span class="env-val"><b>${m1(spent, { compact: true })}</b> / ${m1(Math.max(0, allow), { compact: true })}</span></div>
      <div class="bar" data-tip="${esc(`${CAT[c].label} : ${m1(spent)} sur ${m1(Math.max(0, allow))}`)}"><span style="width:${Math.min(100, frac * 100)}%;background:${catColor(c)}"></span></div>
      ${frac > 1.001 ? `<span class="env-extra neg">${m1(over, { compact: true })} de plus que prévu</span>` : sub ? `<span class="env-extra">${sub}</span>` : ''}
    </div></li>`;
}

function currentStay(t) { return D().stays.find(s => s.checkin <= t && t < s.checkout); }

function viewToday() {
  const t = today();
  const s = D().settings;
  const ms = monthSummary(D(), ymOf(t), t);
  const dy = ms.day;
  const over = dy.remaining < -0.3; // moins de ~5 000 Rp : on considère que c'est pile
  const segs = DAY_CATS.map(c => ({ value: ms.cats[c].today, color: catColor(c), tip: `${CAT[c].label} : ${m1(ms.cats[c].today)}` })).filter(x => x.value > 0);
  const timeFrac = (diffDays(ms.first, t) + 0.5) / ms.dim;
  const ringSvg = ring({
    segs, total: Math.max(dy.allowance, 0.01), size: 260, stroke: 16, gapPx: 4,
    track: 'var(--ring-track)',
    inner: { r: 104, stroke: 3, value: ms.varBudget > 0 ? ms.varSpent / ms.varBudget : 1, color: 'var(--berry)', tip: `${monthName(ms.ym)} : ${m1(ms.varSpent)} dépensés sur ${m1(ms.varBudget)} pour le quotidien`, marker: timeFrac, markerColor: 'var(--gold)', markerTip: 'Où tu devrais en être ce mois-ci' },
  });
  const ins = insight(ms);
  const trip = tripSummary(D(), t);
  const stay = currentStay(t);
  const todays = D().expenses.filter(e => e.date === t).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const cash = cashBalance(D());
  const favs = favorites();
  const B = ms.budget;
  const sv = savingsSummary(D(), t);
  // jour d'hier sans rien ? (seulement si le suivi avait commencé)
  const y = addDays(t, -1);
  const trackStart = s.trackFrom || s.tripStart;
  const yEmpty = trackStart && y >= trackStart && !D().expenses.some(e => e.date === y) && lsGet('dompet:quiet:' + y, '') !== '1';
  const week = ms.cats[WEEK_CATS[0]].weekStart ? { start: ms.cats[WEEK_CATS[0]].weekStart, end: ms.cats[WEEK_CATS[0]].weekEnd } : null;

  const monthBar = stackBar([
    { value: ms.fixedStays, color: catColor('logement'), tip: `Logements : ${m1(ms.fixedStays)}` },
    { value: ms.fixedRecurring, color: catColor('pro'), tip: `Charges fixes : ${m1(ms.fixedRecurring)}` },
    { value: ms.varSpent, cls: 'sb-var', tip: `Quotidien dépensé : ${m1(ms.varSpent)}` },
    { value: Math.max(0, ms.remaining), cls: 'sb-rest', tip: `Reste : ${m1(ms.remaining)}` },
  ], { marker: B > 0 ? Math.min(1, (ms.fixed + ms.idealVarToDate) / Math.max(B, ms.committed)) : null, markerTip: 'Où tu devrais en être aujourd’hui' });

  return `
  <section class="greet">
    <h1 class="date">${dayLong(t)}</h1>
    <p class="greet-sub">${trip && trip.started ? `Jour ${trip.dayIndex} à Bali` : trip ? `Départ dans ${trip.daysTo} jours` : 'Bali'}${stay ? ` · ${esc(stay.name)}` : ''}</p>
  </section>

  <section class="hero ${over ? 'is-over' : ''}">
    <div class="hero-ring">
      ${ringSvg}
      <div class="ring-center">
        <span class="rc-label">${over ? 'Dépassé aujourd’hui' : 'Tu peux encore dépenser'}</span>
        <span class="rc-big">${esc(m1(over ? -dy.remaining : Math.max(0, dy.remaining)))}</span>
        <span class="rc-sub">${esc(m2(over ? -dy.remaining : Math.max(0, dy.remaining)))}</span>
      </div>
    </div>
    <dl class="hero-facts">
      <div><dt>Budget du jour</dt><dd>${m1(dy.allowance, { compact: true })}</dd></div>
      <div><dt>Dépensé</dt><dd>${m1(dy.spent, { compact: true })}</dd></div>
      <div class="tmrw"><dt>Demain</dt><dd>${dy.tomorrow != null ? m1(dy.tomorrow, { compact: true }) : '—'}</dd></div>
    </dl>
  </section>

  <form class="qbar" id="qform" autocomplete="off">
    <label class="sr" for="qbar">Ajouter une dépense en une phrase</label>
    <input id="qbar" name="q" placeholder="Nasi goreng 35k cash…" enterkeyhint="go">
    <button class="qbar-go" aria-label="Ajouter">${icon(I.plus)}</button>
  </form>

  <p class="insight i-${ins.cls}">${icon(ins.ico)}<span>${ins.text}</span></p>

  ${yEmpty ? `<div class="nudge">
    <p>Rien de noté ${dayLong(y).toLowerCase()}. Un oubli ?</p>
    <div class="row-btns"><button class="btn small" data-act="add-yesterday">Ajouter pour hier</button><button class="btn small ghost" data-act="quiet" data-d="${y}">Je n'ai rien dépensé</button></div>
  </div>` : ''}

  ${favs.length ? `<section class="block">
    <h2 class="h2">En un geste</h2>
    <div class="fav-row">${favs.map(e => `<button class="fav" data-act="fav" data-id="${e.id}" style="--c:${catColor(e.cat)}">${catIcon(e.cat)}${esc(e.label)}<b>${e.currency === 'IDR' ? kIDR(e.amount + (e.tip || 0)) : fmtEUR(e.amount + (e.tip || 0))}</b></button>`).join('')}</div>
  </section>` : ''}

  <section class="block card">
    <div class="card-head"><h2 class="h2">Aujourd'hui, poste par poste</h2></div>
    <ul class="env-list">
      ${DAY_CATS.filter(c => ms.cats[c].pct > 0 || ms.cats[c].today > 0).map(c => envRow(c, ms.cats[c].today, ms.cats[c].dailyAllowance,
        c === 'food' ? `≈ ${m1(Math.max(0, ms.mealAllowance), { compact: true })} par repas` : '')).join('')}
    </ul>
  </section>

  ${week ? `<section class="block card">
    <div class="card-head"><h2 class="h2">Cette semaine</h2><span class="muted small">${dayShort(week.start)} → ${dayShort(week.end)}</span></div>
    <ul class="env-list">
      ${WEEK_CATS.filter(c => ms.cats[c].pct > 0 || ms.cats[c].weekSpent > 0).map(c => envRow(c, ms.cats[c].weekSpent, ms.cats[c].weekEnvelope,
        c === 'leisure' ? 'massage, sport, sorties' : '')).join('')}
    </ul>
    <p class="muted small note">Ces dépenses arrivent par à-coups : elles se suivent à la semaine, pas au jour.</p>
  </section>` : ''}

  <section class="block card">
    <div class="card-head"><h2 class="h2">${monthName(ms.ym)}</h2><span class="muted small">jour ${diffDays(ms.first, t) + 1} sur ${ms.dim}</span></div>
    ${monthBar}
    <dl class="kv">
      <div><dt><i style="background:${catColor('logement')}"></i>Logements</dt><dd>${m1(ms.fixedStays)}</dd></div>
      ${ms.fixedRecurring > 0 ? `<div><dt><i style="background:${catColor('pro')}"></i>Charges fixes</dt><dd>${m1(ms.fixedRecurring)}</dd></div>` : ''}
      <div><dt><i class="i-var"></i>Quotidien dépensé</dt><dd>${m1(ms.varSpent)}</dd></div>
      <div class="kv-strong"><dt>Reste sur ${fmtEUR(B, { round: true })}${ms.prorated ? ` <button class="tiny-link" data-act="budget-month" title="Budget de ${fmtEUR(ms.fullBudget, { round: true })} ramené aux ${ms.dim} jours suivis ce mois-ci">au prorata</button>` : ''}</dt><dd class="${ms.remaining < 0 ? 'neg' : ''}">${m1(ms.remaining)}</dd></div>
      <div><dt>À ce rythme, fin du mois</dt><dd class="${ms.projected > B ? 'neg' : ''}">${m1(ms.projected)}</dd></div>
    </dl>
  </section>

  ${sv ? savingsCard(sv) : ''}

  <section class="block">
    <div class="card-head"><h2 class="h2">Noté aujourd'hui</h2>${todays.length ? `<span class="muted small">${m1(todays.reduce((a, e) => a + expEUR(e), 0), { compact: true })}</span>` : ''}</div>
    ${todays.length ? `<ul class="tx-list">${todays.map(txRow).join('')}</ul>` : `<button class="empty" data-act="add">Rien pour l'instant. Écris ta dépense dans la barre plus haut, ou raconte-la à Claude.</button>`}
  </section>

  ${cash != null ? `<section class="block card cash-card">
    <div class="card-head"><h2 class="h2">Tes billets</h2><span class="muted small">estimation</span></div>
    <p class="cash-big ${cash < 0 ? 'neg' : ''}">${fmtIDR(cash)}<span>${fmtEUR(cash / rate())}</span></p>
    <div class="row-btns"><button class="btn small" data-act="withdraw">Retrait au distributeur</button><button class="btn small ghost" data-act="recount">J'ai recompté</button></div>
  </section>` : ''}`;
}

function savingsCard(sv, { full = false } = {}) {
  const end = sv.endDate;
  const pace = sv.realDaily ? 'à ton rythme actuel' : `à ${fmtEUR(D().settings.defaultMonthlyBudget, { round: true })} par mois`;
  const monthsTxt = m => m >= 1 ? `${nf0.format(Math.floor(m))} mois` : `${Math.round(m * 30)} jours`;
  return `<section class="block card savings">
    <div class="card-head"><h2 class="h2">${icon(I.jar)} Ta cagnotte</h2><span class="muted small">depuis le ${dayShort(sv.start)}</span></div>
    <div class="sv-row">
      <div><span class="sv-big">${fmtEUR(sv.remaining, { round: true })}</span><span class="muted small">restent sur ${fmtEUR(sv.amount, { round: true })}</span></div>
      <div class="sv-end">${end ? `<span class="muted small">Elle tient jusqu'en</span><b>${monthYear(end)}</b><span class="muted small">${pace}</span>` : ''}</div>
    </div>
    <div class="bar sv-bar" data-tip="${esc(`Dépensé depuis le ${dayShort(sv.start)} : ${fmtEUR(sv.spent)}`)}"><span style="width:${Math.max(0.6, Math.min(100, sv.pct * 100))}%"></span></div>
    <p class="muted small">${fmtEUR(sv.spent, { round: true })} dépensés en ${sv.days} jour${sv.days > 1 ? 's' : ''}${sv.realDaily ? `, soit ${fmtEUR(sv.realDaily * 30.44, { round: true })} par mois` : ''}.</p>
    ${full ? `<ul class="runway">${[
      ...sv.scenarios.map(x => ({ label: x.key === 'ton budget' ? `Ton budget, ${fmtEUR(x.monthly, { round: true })}/mois` : `${fmtEUR(x.monthly, { round: true })} par mois`, months: x.months, me: x.key === 'ton budget' })),
      ...(sv.realDaily ? [{ label: `Ton rythme réel, ${fmtEUR(sv.realDaily * 30.44, { round: true })}/mois`, months: sv.remaining / (sv.realDaily * 30.44), real: true }] : []),
    ].sort((a, b) => b.months - a.months).map(r => {
      const max = 36;
      return `<li class="${r.me ? 'me' : ''}${r.real ? ' real' : ''}"><span class="rw-l">${r.label}</span>
        <div class="rw-bar" data-tip="${esc(`${r.label} : la cagnotte tient ${monthsTxt(r.months)}`)}"><span style="width:${Math.min(100, r.months / max * 100)}%"></span><i style="left:${12 / max * 100}%"></i></div>
        <b>${monthsTxt(r.months)}</b></li>`;
    }).join('')}</ul><p class="muted small">Le trait doré marque 1 an. Calcul sur ce qui reste aujourd'hui.</p>` : ''}
  </section>`;
}

function txRow(e, { withDate = false } = {}) {
  const flags = [e.pay === 'cash' ? 'Billets' : 'Carte'];
  if (withDate) flags.unshift(dayShort(e.date));
  if (e.tip) flags.push(`pourboire ${e.currency === 'IDR' ? kIDR(e.tip) : fmtEUR(e.tip)}`);
  if (e.spread) flags.push(e.spread === 'week' ? 'étalé sur 7 jours' : 'étalé sur 30 jours');
  if (e.offBudget) flags.push('hors budget du mois');
  if (e.src === 'claude') flags.push('via Claude');
  if (e.note) flags.push(esc(e.note));
  return `<li><button class="tx" data-act="edit" data-id="${e.id}">
    ${badge(e.cat)}
    <span class="tx-main"><span class="tx-label">${esc(e.label || CAT[e.cat]?.label)}</span>
      <span class="tx-meta">${flags.join(' · ')}</span></span>
    <span class="tx-amt">${expTotalStr(e)}<small>${e.currency === 'IDR' ? fmtEUR(expEUR(e)) : fmtIDR(expEUR(e) * rate())}</small></span>
  </button></li>`;
}

// ---------- ANALYSE ----------
function weekCard(t) {
  const ws = addDays(t, -weekday(t));
  const prevS = addDays(ws, -7);
  const lines = linesBetween(D(), prevS, addDays(ws, 6)).filter(l => !l.fixed);
  const per = d => lines.filter(l => l.date === d).reduce((a, l) => a + l.eur, 0);
  const days = Array.from({ length: 7 }, (_, i) => { const d = addDays(ws, i); return { d, v: per(d), prev: per(addDays(prevS, i)), future: d > t }; });
  const elapsed = days.filter(x => !x.future);
  const cur = elapsed.reduce((a, x) => a + x.v, 0) / Math.max(1, elapsed.length);
  const prevTot = days.reduce((a, x) => a + x.prev, 0);
  const prev = prevTot / 7;
  const max = Math.max(0.01, ...days.map(x => Math.max(x.v, x.prev)));
  const diff = prevTot > 0 ? (cur - prev) / prev : null;
  return `<section class="block card">
    <div class="card-head"><h2 class="h2">Bilan de la semaine</h2><span class="muted small">hors logement</span></div>
    <div class="wk-sum">
      <div><span class="kpi-v">${m1(cur, { compact: true })}</span><span class="muted small">par jour cette semaine</span></div>
      ${diff != null ? `<div class="wk-diff ${diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : ''}">${icon(diff > 0.05 ? I.up : diff < -0.05 ? I.down : I.check)}<span>${Math.abs(diff) < 0.05 ? 'comme' : `${Math.round(Math.abs(diff) * 100)} % ${diff > 0 ? 'de plus que' : 'de moins que'}`} la semaine dernière (${m1(prev, { compact: true })}/jour)</span></div>` : ''}
    </div>
    <div class="wk" role="img" aria-label="Dépenses de chaque jour de la semaine, comparées à la semaine dernière">
      ${days.map((x, i) => `<div class="wk-col ${x.d === t ? 'is-today' : ''} ${x.future ? 'is-future' : ''}" data-tip="${esc(`${dayLong(x.d)} : ${x.future ? '—' : m1(x.v)}\nSemaine dernière : ${m1(x.prev)}`)}">
        <div class="wk-bars"><span class="wk-prev" style="height:${x.prev / max * 100}%"></span><span class="wk-cur" style="height:${x.future ? 0 : x.v / max * 100}%"></span></div>
        <span class="wk-l">${WD_SHORT[i]}</span></div>`).join('')}
    </div>
    <p class="legend-inline"><i class="li-cur"></i>cette semaine <i class="li-prev"></i>semaine dernière</p>
  </section>`;
}

function viewStats() {
  const ym = UI.month || ymOf(today());
  const t = today();
  const ms = monthSummary(D(), ym, t);
  const lines = ms.lines;
  const byCat = groupSum(lines);
  const tot = Object.values(byCat).reduce((a, b) => a + b, 0);
  const catRows = CATS.map(c => ({ ...c, v: byCat[c.id] || 0 })).filter(c => c.v > 0).sort((a, b) => b.v - a.v);
  const varDaysElapsed = ms.state === 'current' ? diffDays(ms.first, t) + 1 : ms.state === 'past' ? ms.dim : 0;
  const foodExp = D().expenses.filter(e => ymOf(e.date) === ym && e.cat === 'food');
  const mealAvg = foodExp.length ? foodExp.reduce((a, e) => a + expEUR(e), 0) / foodExp.length : 0;
  const nights = lines.filter(l => l.kind === 'stay');
  const nightAvg = nights.length ? nights.reduce((a, l) => a + l.eur, 0) / nights.length : 0;
  const tipsTot = byCat.tips || 0;
  const pays = { cash: 0, card: 0 };
  lines.filter(l => !l.fixed).forEach(l => pays[l.pay === 'cash' ? 'cash' : 'card'] += l.eur);
  const top = D().expenses.filter(e => ymOf(e.date) === ym).sort((a, b) => expEUR(b) - expEUR(a)).slice(0, 5);
  const wd = Array(7).fill(0), wdn = Array(7).fill(0);
  ms.days.forEach(d => { if (d.date <= t) { wd[weekday(d.date)] += d.spent; wdn[weekday(d.date)]++; } });
  const wdAvg = wd.map((v, i) => wdn[i] ? v / wdn[i] : 0);
  const wdMax = Math.max(...wdAvg, 0.01);
  const perDay = varDaysElapsed ? ms.varSpent / varDaysElapsed : 0;
  const sv = savingsSummary(D(), t);

  const bars = dayBars({
    days: ms.days.map(d => ({
      label: String(Number(d.date.slice(8))), value: d.dSpent, limit: d.date <= t ? d.dAllowance : null, muted: d.date > t, highlight: d.date === t,
      tip: `${dayLong(d.date)}
Quotidien : ${m1(d.dSpent)} pour ${m1(d.dAllowance)} prévus${Object.entries(d.byCat).map(([c, v]) => `
${CAT[c]?.label} : ${m1(v)}`).join('')}`,
    })), fmtAxis: axisFmt, W: chartW(),
  });
  let cum = 0;
  const lastIdx = ms.state === 'current' ? diffDays(ms.first, t) : ms.state === 'past' ? ms.dim - 1 : -1;
  const burn = burnUp({
    budget: ms.budget, fmtAxis: axisFmt, W: chartW(),
    pts: ms.days.map((d, i) => {
      cum += d.spent + d.fixed;
      const ideal = ms.budget * (i + 1) / ms.dim;
      const value = i <= lastIdx ? cum : null;
      return { label: String(Number(d.date.slice(8))), value, ideal, tip: `${dayShort(d.date)}\nCumul : ${value != null ? m1(value) : '—'}\nRythme idéal : ${m1(ideal)}` };
    }),
  });
  const heatMax = Math.max(...ms.days.map(d => d.spent), 0.01);
  const heat = heatmap({
    startWeekday: weekday(ms.first), max: heatMax,
    cells: ms.days.map(d => ({ date: d.date, value: d.spent, empty: d.date > t, today: d.date === t, tip: `${dayLong(d.date)} : ${m1(d.spent)}` })),
  });
  const trip = tripSummary(D(), t);
  const timeF = varDaysElapsed / ms.dim;
  const env = DAILY_CATS.filter(c => ms.cats[c].pct > 0).map(c => {
    const x = ms.cats[c]; const f = x.envelope > 0 ? x.spent / x.envelope : 0;
    return `<li class="env ${f > 1 ? 'over' : ''}">${badge(c)}<div class="env-body">
      <div class="env-top"><span class="env-name">${CAT[c].label} <span class="muted small">${x.pct} %</span></span><span class="env-val"><b>${m1(x.spent, { compact: true })}</b> / ${m1(x.envelope, { compact: true })}</span></div>
      <div class="bar has-marker"><span style="width:${Math.min(100, f * 100)}%;background:${catColor(c)}"></span><i style="left:${Math.min(100, timeF * 100)}%" data-tip="Où tu devrais en être aujourd’hui"></i></div></div></li>`;
  }).join('');

  return `
  <div class="month-nav">
    <button class="icon-btn" data-act="month" data-d="-1" aria-label="Mois précédent">${icon(I.left)}</button>
    <h1 class="h1">${monthName(ym)}</h1>
    <button class="icon-btn" data-act="month" data-d="1" aria-label="Mois suivant">${icon(I.right)}</button>
  </div>

  <div class="kpis">
    <div class="kpi"><span class="kpi-l">Par jour, hors logement</span><span class="kpi-v">${m1(perDay, { compact: true })}</span><span class="kpi-s">prévu ${m1(ms.baseDaily, { compact: true })}</span></div>
    <div class="kpi"><span class="kpi-l">Dépensé, tout compris</span><span class="kpi-v">${m1(ms.committed, { compact: true })}</span><span class="kpi-s">${ms.budget ? Math.round(ms.committed / ms.budget * 100) : 0} % de ${fmtEUR(ms.budget, { round: true })}</span></div>
    <div class="kpi"><span class="kpi-l">Repas moyen</span><span class="kpi-v">${m1(mealAvg, { compact: true })}</span><span class="kpi-s">${foodExp.length} repas notés</span></div>
    <div class="kpi"><span class="kpi-l">Nuit moyenne</span><span class="kpi-v">${m1(nightAvg, { compact: true })}</span><span class="kpi-s">${nights.length} nuits ce mois</span></div>
  </div>

  ${ym === ymOf(t) ? weekCard(t) : ''}

  ${sv ? savingsCard(sv, { full: true }) : ''}

  <section class="block card">
    <div class="card-head"><h2 class="h2">Où part l'argent</h2><span class="muted small">${m1(tot)}</span></div>
    ${tot > 0 ? `<div class="donut-wrap">
      <div class="donut">${donut({ segs: catRows.map(c => ({ value: c.v, color: catColor(c.id), tip: `${c.label} : ${m1(c.v)} (${Math.round(c.v / tot * 100)} %)` })) })}
        <div class="donut-c"><b>${m1(tot, { compact: true })}</b><span>${m2(tot, { compact: true })}</span></div></div>
      <table class="legend"><tbody>${catRows.map(c => `<tr><td><i style="background:${catColor(c.id)}"></i>${c.label}</td><td>${m1(c.v, { compact: true })}</td><td class="muted">${Math.round(c.v / tot * 100)} %</td></tr>`).join('')}</tbody></table>
    </div>` : `<p class="muted">Aucune dépense ce mois-ci.</p>`}
  </section>

  <section class="block card">
    <div class="card-head"><h2 class="h2">Chaque jour</h2><span class="legend-inline"><i class="li-bar"></i>dépensé <i class="li-line"></i>budget du jour</span></div>
    ${bars}
    <p class="muted small">Repas, courses, transport et pourboires. Le budget du jour bouge : si tu dépenses moins, il remonte ; si tu dépenses plus, il baisse pour que le mois tienne.</p>
  </section>

  <section class="block card">
    <div class="card-head"><h2 class="h2">Le mois en cumulé</h2><span class="legend-inline"><i class="li-real"></i>réel <i class="li-ideal"></i>rythme idéal</span></div>
    ${burn}
  </section>

  <section class="block card">
    <div class="card-head"><h2 class="h2">Enveloppes du mois</h2><span class="muted small">trait = où tu devrais en être</span></div>
    <ul class="env-list">${env}</ul>
    <button class="link" data-act="go-settings">Changer la répartition</button>
  </section>

  <div class="grid2">
    <section class="block card">
      <div class="card-head"><h2 class="h2">Calendrier</h2><span class="muted small">hors logement</span></div>
      ${heat}
    </section>
    <section class="block card">
      <div class="card-head"><h2 class="h2">Selon le jour</h2><span class="muted small">moyenne</span></div>
      <ul class="wd">${wdAvg.map((v, i) => `<li data-tip="${cap(WD[i])} : ${esc(m1(v))} en moyenne"><span>${WD_SHORT[i]}</span><div class="bar"><span style="width:${v / wdMax * 100}%"></span></div><b>${m1(v, { compact: true })}</b></li>`).join('')}</ul>
      <h3 class="h3">Billets ou carte</h3>
      ${stackBar([{ value: pays.cash, cls: 'sb-cash', tip: `Billets : ${m1(pays.cash)}` }, { value: pays.card, cls: 'sb-card', tip: `Carte : ${m1(pays.card)}` }])}
      <p class="small muted pay-legend"><span><i class="sb-cash"></i>Billets ${m1(pays.cash, { compact: true })}</span><span><i class="sb-card"></i>Carte ${m1(pays.card, { compact: true })}</span><span>Pourboires ${m1(tipsTot, { compact: true })}</span></p>
    </section>
  </div>

  <section class="block card">
    <div class="card-head"><h2 class="h2">Plus grosses dépenses</h2></div>
    ${top.length ? `<ul class="tx-list">${top.map(e => txRow(e, { withDate: true })).join('')}</ul>` : '<p class="muted">Rien pour l’instant.</p>'}
  </section>

  ${trip && trip.started ? `<section class="block card trip">
    <div class="card-head"><h2 class="h2">Tout le voyage</h2><span class="muted small">depuis le ${dayShort(D().settings.tripStart)}</span></div>
    <div class="kpis small-kpis">
      <div class="kpi"><span class="kpi-l">Total</span><span class="kpi-v">${m1(trip.total, { compact: true })}</span><span class="kpi-s">${m2(trip.total, { compact: true })}</span></div>
      <div class="kpi"><span class="kpi-l">Par jour, tout compris</span><span class="kpi-v">${m1(trip.perDay, { compact: true })}</span><span class="kpi-s">${trip.days} jours</span></div>
    </div>
  </section>` : ''}

  <details class="block card table-view"><summary>Voir le mois en tableau</summary>
    <table class="data-table"><thead><tr><th>Jour</th><th>Dépensé</th><th>Budget du jour</th><th>Logement</th></tr></thead>
    <tbody>${ms.days.filter(d => d.date <= t).map(d => `<tr><td>${dayShort(d.date)}</td><td>${m1(d.spent)}</td><td>${m1(d.dAllowance)}</td><td>${m1(d.fixed)}</td></tr>`).join('')}</tbody></table>
  </details>`;
}

// ---------- JOURNAL ----------
function viewJournal() {
  const q = UI.jSearch.trim().toLowerCase();
  const list = D().expenses
    .filter(e => UI.jFilter === 'all' || e.cat === UI.jFilter || (UI.jFilter === 'cash' && e.pay === 'cash'))
    .filter(e => !q || `${e.label} ${e.note || ''} ${CAT[e.cat]?.label}`.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const groups = new Map();
  list.forEach(e => { if (!groups.has(e.date)) groups.set(e.date, []); groups.get(e.date).push(e); });
  const shown = [...groups.entries()].slice(0, 60);
  const total = list.reduce((a, e) => a + expEUR(e), 0);
  return `
  <h1 class="h1">Journal</h1>
  <div class="search"><input type="search" id="jsearch" placeholder="Chercher : Gojek, warung, massage…" value="${esc(UI.jSearch)}" aria-label="Chercher une dépense"></div>
  <div class="chips" role="group" aria-label="Filtrer">
    <button class="chip ${UI.jFilter === 'all' ? 'on' : ''}" data-act="jf" data-f="all">Tout</button>
    ${CATS.map(c => `<button class="chip ${UI.jFilter === c.id ? 'on' : ''}" data-act="jf" data-f="${c.id}" style="--c:${catColor(c.id)}"><i></i>${c.label}</button>`).join('')}
    <button class="chip ${UI.jFilter === 'cash' ? 'on' : ''}" data-act="jf" data-f="cash">Billets</button>
  </div>
  <p class="muted small">${list.length} dépense${list.length > 1 ? 's' : ''} · ${m1(total)} · ${m2(total)}</p>
  ${shown.length ? shown.map(([d, es]) => `<section class="day-group">
      <h2 class="day-h"><span>${dayLong(d)}</span><span>${m1(es.reduce((a, e) => a + expEUR(e), 0), { compact: true })}</span></h2>
      <ul class="tx-list">${es.map(e => txRow(e)).join('')}</ul></section>`).join('')
    : `<button class="empty" data-act="add">Aucune dépense ${q || UI.jFilter !== 'all' ? 'ne correspond' : 'pour l’instant'}. Ajouter une dépense</button>`}`;
}

// ---------- SÉJOUR ----------
function viewStays() {
  const cov = staysCoverage(D());
  const s = D().settings, t = today();
  const stays = cov.stays;
  let timeline = '';
  if (stays.length) {
    const a = cov.start < stays[0].checkin ? cov.start : stays[0].checkin;
    const b = cov.end;
    const span = Math.max(1, diffDays(a, b));
    const pos = d => (diffDays(a, d) / span) * 100;
    const months = []; for (let ym = ymOf(a); ym <= ymOf(b); ym = addMonths(ym, 1)) months.push(ym);
    timeline = `<div class="tl" aria-hidden="true">
      ${months.map(ym => { const p = pos(monthFirst(ym) < a ? a : monthFirst(ym)); return `<span class="tl-month" style="left:${p}%">${MSHORT[Number(ym.slice(5)) - 1]}</span>`; }).join('')}
      <div class="tl-track">
        ${cov.gaps.map(g => `<span class="tl-gap" style="left:${pos(g.from)}%;width:${(diffDays(g.from, g.to) + 1) / span * 100}%" data-tip="Pas de logement : ${dayShort(g.from)} → ${dayShort(addDays(g.to, 1))}"></span>`).join('')}
        ${stays.map((st, i) => `<span class="tl-stay ${st.paid ? '' : 'unpaid'}" style="left:${pos(st.checkin)}%;width:${stayNights(st) / span * 100}%;--i:${i % 3}" data-tip="${esc(st.name)}\n${dayShort(st.checkin)} → ${dayShort(st.checkout)} · ${stayNights(st)} nuits\n${esc(m1(stayNightEUR(st, rate())))} / nuit"></span>`).join('')}
        ${t >= a && t <= b ? `<span class="tl-today" style="left:${pos(t)}%" data-tip="Aujourd’hui"></span>` : ''}
      </div></div>`;
  }
  const rec = D().recurring;
  const recMonthly = rec.filter(r => r.active !== false).reduce((acc, r) => acc + toEUR(r.amount, r.currency, rate()) * (r.freq === 'weekly' ? 52 / 12 : r.freq === 'yearly' ? 1 / 12 : 1), 0);
  const unpaid = stays.filter(x => !x.paid).reduce((a, x) => a + toEUR(x.total, x.currency, x.rate || rate()), 0);
  const gapNights = cov.gaps.reduce((a, g) => a + diffDays(g.from, g.to) + 1, 0);
  return `
  <h1 class="h1">Séjour</h1>
  <div class="kpis">
    <div class="kpi"><span class="kpi-l">Nuits réservées</span><span class="kpi-v">${cov.nights}</span><span class="kpi-s">jusqu'au ${cov.end ? dayShort(cov.end) : '—'}</span></div>
    <div class="kpi"><span class="kpi-l">Total logements</span><span class="kpi-v">${m1(cov.total, { compact: true })}</span><span class="kpi-s">${unpaid > 0 ? `dont ${m1(unpaid, { compact: true })} à payer` : 'tout est payé'}</span></div>
    <div class="kpi"><span class="kpi-l">Nuit moyenne</span><span class="kpi-v">${m1(cov.avgNight, { compact: true })}</span><span class="kpi-s">${m2(cov.avgNight, { compact: true })}</span></div>
    <div class="kpi"><span class="kpi-l">Charges fixes / mois</span><span class="kpi-v">${m1(recMonthly, { compact: true })}</span><span class="kpi-s">${rec.length ? `${rec.length} au total` : 'aucune'}</span></div>
  </div>
  ${gapNights && s.tripEnd ? cov.gaps.map(g => `<p class="insight i-warn">${icon(I.bed)}<span>Aucun logement du ${dayShort(g.from)} au ${dayShort(addDays(g.to, 1))} (${diffDays(g.from, g.to) + 1} nuit${diffDays(g.from, g.to) ? 's' : ''}). Au prix moyen, compte ≈ ${m1(cov.avgNight * (diffDays(g.from, g.to) + 1))}.</span></p>`).join('') : ''}
  ${cov.overlaps.map(g => `<p class="insight i-serious">${icon(I.alert)}<span>Deux logements se chevauchent du ${dayShort(g.from)} au ${dayShort(addDays(g.to, 1))} : ces nuits sont payées deux fois.</span></p>`).join('')}

  <section class="block card">
    <div class="card-head"><h2 class="h2">Logements</h2><button class="btn small primary" data-act="stay">Ajouter</button></div>
    ${timeline}
    ${stays.length ? `<ul class="stay-list">${stays.map(st => {
      const n = stayNights(st), tot = toEUR(st.total, st.currency, st.rate || rate());
      const now = t >= st.checkin && t < st.checkout;
      const past = st.checkout <= t;
      return `<li><button class="stay ${now ? 'now' : ''} ${past ? 'past' : ''}" data-act="stay" data-id="${st.id}">
        <span class="stay-dates"><b>${Number(st.checkin.slice(8))}</b><small>${MSHORT[Number(st.checkin.slice(5, 7)) - 1]}</small></span>
        <span class="stay-main"><span class="stay-name">${esc(st.name)}${now ? ' <em class="tag">en ce moment</em>' : ''}</span>
          <span class="tx-meta">${esc(st.place || '')}${st.place ? ' · ' : ''}${n} nuit${n > 1 ? 's' : ''} → ${dayShort(st.checkout)}${st.paid ? '' : ' · à payer'}</span></span>
        <span class="tx-amt">${m1(tot, { compact: true })}<small>${m1(tot / Math.max(1, n), { compact: true })} / nuit</small></span>
      </button></li>`;
    }).join('')}</ul>` : `<button class="empty" data-act="stay">Ajoute les logements déjà réservés : leur prix par nuit est retiré automatiquement de ton budget.</button>`}
  </section>

  <section class="block card">
    <div class="card-head"><h2 class="h2">Charges fixes</h2><button class="btn small primary" data-act="rec">Ajouter</button></div>
    <p class="muted small">Ce qui revient tout seul (Google Ads, Claude, forfait…). Compté automatiquement chaque mois : pas besoin de le noter à chaque fois.</p>
    ${rec.length ? `<ul class="tx-list">${rec.map(r => `<li><button class="tx" data-act="rec" data-id="${r.id}">
      ${badge(r.cat || 'pro')}
      <span class="tx-main"><span class="tx-label">${esc(r.label)}${r.active === false ? ' <em class="tag">en pause</em>' : ''}</span>
      <span class="tx-meta">${r.freq === 'weekly' ? 'chaque semaine' : r.freq === 'yearly' ? 'chaque année' : `le ${r.day || 1} de chaque mois`}${r.overrides && r.overrides[ymOf(t)] != null ? ` · ce mois-ci : ${r.currency === 'EUR' ? fmtEUR(r.overrides[ymOf(t)]) : fmtIDR(r.overrides[ymOf(t)])}` : ''}</span></span>
      <span class="tx-amt">${r.currency === 'EUR' ? fmtEUR(r.amount) : fmtIDR(r.amount, { exact: true })}</span></button></li>`).join('')}</ul>` : ''}
  </section>`;
}

// ---------- RÉGLAGES ----------
function viewSettings() {
  const s = D().settings, sy = store.sync;
  const ym = ymOf(today());
  const split = s.split;
  const sumSplit = DAILY_CATS.reduce((a, c) => a + (Number(split[c]) || 0), 0);
  const sug = suggestSplit(D());
  const cash = cashBalance(D());
  return `
  <h1 class="h1">Réglages</h1>
  <form class="block card form" id="f-budget">
    <h2 class="h2">Budget</h2>
    <label>Budget par mois, tout compris<span class="input-suffix"><input name="defaultMonthlyBudget" type="number" inputmode="decimal" min="0" step="10" value="${s.defaultMonthlyBudget}"><em>€</em></span></label>
    <label>Budget spécial pour ${monthName(ym).toLowerCase()} <span class="muted small">(vide = budget normal)</span><span class="input-suffix"><input name="thisMonth" type="number" inputmode="decimal" min="0" step="10" value="${s.monthlyBudgets[ym] ?? ''}"><em>€</em></span></label>
    <div class="two"><label>Arrivée à Bali<input name="tripStart" type="date" value="${s.tripStart || ''}"></label><label>Fin <span class="muted small">(si tu sais)</span><input name="tripEnd" type="date" value="${s.tripEnd || ''}"></label></div>
    <label>Je note tout depuis le<input name="trackFrom" type="date" value="${s.trackFrom || ''}"></label>
    <div class="two"><label>Cagnotte du voyage<span class="input-suffix"><input name="savings" type="number" inputmode="decimal" min="0" step="10" value="${s.savings?.amount ?? ''}"><em>€</em></span></label><label>au<input name="savingsDate" type="date" value="${s.savings?.date || s.tripStart || ''}"></label></div>
    <label>Repas par jour<input name="mealsPerDay" type="number" min="1" max="6" value="${s.mealsPerDay}"></label>
    <button class="btn primary">Enregistrer</button>
  </form>

  <form class="block card form" id="f-split">
    <h2 class="h2">Répartition du quotidien</h2>
    <p class="muted small">Une fois logements et charges fixes retirés, voilà comment le reste est partagé. Total : <b id="splitSum" class="${sumSplit === 100 ? '' : 'neg'}">${sumSplit} %</b></p>
    ${DAILY_CATS.map(c => `<label class="slider"><span>${CAT[c].label}${WEEK_CATS.includes(c) ? ' <em class="muted small">à la semaine</em>' : ''}</span><input type="range" name="${c}" min="0" max="70" step="1" value="${split[c] || 0}" style="--c:${catColor(c)}"><output>${split[c] || 0} %</output></label>`).join('')}
    <div class="row-btns"><button class="btn primary">Enregistrer</button>${sug ? `<button type="button" class="btn ghost" data-act="split-suggest">Caler sur mes habitudes</button>` : ''}</div>
  </form>

  <section class="block card form">
    <h2 class="h2">Tes billets <span class="muted small">(facultatif)</span></h2>
    <p class="muted small">Pour savoir combien de roupies il te reste dans le portefeuille sans les compter : tu indiques une fois ce que tu as, puis chaque retrait. Les dépenses payées en billets sont retirées toutes seules.</p>
    ${cash != null ? `<p><b>${fmtIDR(cash)}</b> <span class="muted small">estimés · suivi depuis le ${dayShort(s.cashStart.date)}</span></p>` : ''}
    <div class="row-btns"><button class="btn" data-act="recount">${cash != null ? 'Recompter' : 'Commencer le suivi'}</button>${cash != null ? `<button class="btn ghost" data-act="withdraw">Ajouter un retrait</button><button class="btn ghost danger" data-act="cash-stop">Arrêter le suivi</button>` : ''}</div>
    ${D().cash.length && cash != null ? `<ul class="tx-list compact">${[...D().cash].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map(c => `<li><div class="tx">${badge('other')}<span class="tx-main"><span class="tx-label">${c.type === 'withdraw' ? 'Retrait' : 'Ajustement'}</span><span class="tx-meta">${dayShort(c.date)}${c.feeIDR ? ` · frais ${kIDR(c.feeIDR)}` : ''}</span></span><span class="tx-amt">${fmtIDR(c.amountIDR, { exact: true })}</span><button class="icon-btn" data-act="cash-del" data-id="${c.id}" aria-label="Supprimer">${icon(I.trash)}</button></div></li>`).join('')}</ul>` : ''}
  </section>

  <form class="block card form" id="f-rate">
    <h2 class="h2">Taux de change</h2>
    <p class="muted small">1 € = <b>${nf0.format(s.rate)} Rp</b>${s.rateDate ? ` · mis à jour le ${dayShort(s.rateDate)}` : ''}. Chaque dépense garde le taux du jour où elle a été notée.</p>
    <label class="check"><input type="checkbox" name="rateAuto" ${s.rateAuto ? 'checked' : ''}> Mettre à jour tout seul chaque jour</label>
    <label>Taux manuel<span class="input-suffix"><input name="rate" type="number" min="1000" step="1" value="${s.rate}"><em>Rp / €</em></span></label>
    <div class="row-btns"><button class="btn primary">Enregistrer</button><button type="button" class="btn ghost" data-act="rate-refresh">Récupérer le taux du jour</button></div>
  </form>

  <section class="block card form">
    <h2 class="h2">Synchronisation GitHub</h2>
    <p class="muted small">Tes données vivent dans un fichier <code>data.json</code> d'un dépôt GitHub privé. Claude y écrit quand tu lui racontes tes dépenses ; ce site y écrit quand tu saisis à la main.</p>
    ${syncConfigured() ? `<p><b>${esc(sy.owner)}/${esc(sy.repo)}</b> · ${esc(sy.path)}<br><span class="muted small">${store.status === 'error' ? `<span class="neg">${esc(store.error)}</span>` : store.meta.lastSync ? `Dernière synchro ${new Date(store.meta.lastSync).toLocaleString('fr-FR')}` : ''}</span></p>
      <div class="row-btns"><button class="btn primary" data-act="sync-now">Synchroniser</button><button class="btn ghost" data-act="sync-setup">Modifier</button><button class="btn ghost danger" data-act="sync-forget">Déconnecter</button></div>`
    : `<button class="btn primary" data-act="sync-setup">Connecter GitHub</button>`}
  </section>

  <section class="block card form">
    <h2 class="h2">Données</h2>
    <div class="row-btns">
      <button class="btn" data-act="export">Télécharger une sauvegarde</button>
      <label class="btn ghost file-btn">Importer une sauvegarde<input type="file" accept="application/json" id="importFile" hidden></label>
    </div>
    <div class="row-btns">
      <button class="btn ghost" data-act="theme">Thème : ${{ auto: 'automatique', light: 'clair', dark: 'sombre' }[lsGet('dompet:theme', 'auto')]}</button>
      ${D().demo ? `<button class="btn ghost danger" data-act="wipe">Quitter l'exemple</button>` : `<button class="btn ghost" data-act="demo">Essayer avec un exemple</button><button class="btn ghost danger" data-act="wipe">Effacer les données de ce téléphone</button>`}
    </div>
  </section>`;
}

// ---------- FEUILLES (formulaires) ----------
function openSheet(html, onMount) {
  const w = $('#sheet');
  w.innerHTML = `<div class="sheet-bg" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  w.hidden = false;
  requestAnimationFrame(() => w.classList.add('open'));
  document.body.classList.add('noscroll');
  onMount && onMount($('.sheet', w));
  const first = $('.sheet [autofocus]', w); if (first && window.matchMedia('(pointer:fine)').matches) first.focus();
}
function closeSheet() {
  const w = $('#sheet'); w.classList.remove('open'); document.body.classList.remove('noscroll');
  setTimeout(() => { w.hidden = true; w.innerHTML = ''; }, 200);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

function sheetHead(title, del) {
  return `<div class="sheet-head"><h2 class="h2">${title}</h2><div>${del ? `<button type="button" class="icon-btn danger" data-act="sheet-del" aria-label="Supprimer">${icon(I.trash)}</button>` : ''}<button type="button" class="icon-btn" data-act="close" aria-label="Fermer">${icon(I.close)}</button></div></div>`;
}

function labelHistory() {
  const m = new Map();
  [...D().expenses].sort((a, b) => a.date.localeCompare(b.date)).forEach(e => e.label && m.set(e.label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(), e.cat));
  return m;
}

// Saisie : un seul champ « Quoi ? » qui remplit montant, catégorie et paiement en direct.
function openExpense(id, preset = {}) {
  const e = id ? D().expenses.find(x => x.id === id) : null;
  const v = e || { date: today(), currency: lsGet('dompet:lastCur', 'IDR'), pay: lsGet('dompet:lastPay', 'cash'), cat: '', label: '', amount: '', tip: 0, ...preset };
  const hist = labelHistory();
  const fmtA = (a, c) => a === '' || a == null ? '' : c === 'IDR' ? nf0.format(a) : String(a).replace('.', ',');
  const moreOpen = !!(v.spread || v.offBudget || v.note);
  openSheet(`${sheetHead(e ? 'Modifier la dépense' : 'Nouvelle dépense', !!e)}
  <form id="f-exp" class="form" autocomplete="off">
    <label class="what">Quoi ?<input name="label" placeholder="nasi goreng 35k cash" value="${esc(preset.text || v.label)}" autofocus enterkeyhint="done"></label>
    <div class="amount-box">
      <input name="amount" class="amount-in" inputmode="decimal" placeholder="0" value="${fmtA(v.amount, v.currency)}" aria-label="Montant">
      <div class="seg" role="group" aria-label="Devise"><button type="button" data-c="IDR">Rp</button><button type="button" data-c="EUR">€</button></div>
    </div>
    <p class="conv" id="conv"></p>
    <div class="cat-grid" role="radiogroup" aria-label="Catégorie">
      ${CATS.map(c => `<button type="button" class="cat" data-cat="${c.id}" role="radio" aria-checked="false" style="--c:${catColor(c.id)}">${catIcon(c.id)}<span>${c.label}</span></button>`).join('')}
    </div>
    <div class="sugs" id="sugs"></div>
    <div class="two">
      <div class="seg pay" role="group" aria-label="Moyen de paiement"><button type="button" data-p="cash">${icon(I.cash)}Billets</button><button type="button" data-p="card">${icon(I.card)}Carte</button></div>
      <label class="tip-l">Pourboire<input name="tip" inputmode="decimal" placeholder="0" value="${v.tip ? fmtA(v.tip, v.currency) : ''}"></label>
    </div>
    <div class="date-row">
      <div class="seg" role="group" aria-label="Jour"><button type="button" data-day="0">Aujourd'hui</button><button type="button" data-day="-1">Hier</button></div>
      <input type="date" name="date" value="${v.date}" aria-label="Date">
    </div>
    <details class="more" ${moreOpen ? 'open' : ''}><summary>Plus d'options</summary>
      <div class="more-body">
        <label>Note<input name="note" placeholder="facultatif" value="${esc(v.note || '')}"></label>
        <div><span class="lbl">Grosse dépense ? La répartir</span>
          <div class="seg spread" role="group" aria-label="Répartir"><button type="button" data-spread="">Non</button><button type="button" data-spread="week">Sur 7 jours</button><button type="button" data-spread="month">Sur 30 jours</button></div></div>
        <label class="check"><input type="checkbox" name="offBudget" ${v.offBudget ? 'checked' : ''}> Payé d'avance, hors budget du mois <span class="muted small">(vol, assurance… compte seulement dans la cagnotte)</span></label>
      </div>
    </details>
    <p class="form-err" id="err" role="alert"></p>
    <button class="btn primary big">${e ? 'Enregistrer' : 'Ajouter'}</button>
  </form>`, root => {
    const f = $('#f-exp', root);
    let cur = v.currency, pay = v.pay, cat = v.cat, spread = v.spread || '';
    let touched = { amount: !!e, cat: !!e, pay: !!e, cur: !!e, tip: !!e };
    const sync = () => {
      $$('[data-c]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.c === cur));
      $$('[data-p]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.p === pay));
      $$('[data-spread]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.spread === spread));
      $$('[data-day]', root).forEach(b => b.setAttribute('aria-pressed', f.date.value === addDays(today(), Number(b.dataset.day))));
      $$('[data-cat]', root).forEach(b => { b.classList.toggle('on', b.dataset.cat === cat); b.setAttribute('aria-checked', b.dataset.cat === cat); });
      $('#sugs', root).innerHTML = !f.label.value.trim() && cat ? SUGGESTIONS[cat].map(x => `<button type="button" class="chip small" data-sug="${esc(x)}">${esc(x)}</button>`).join('') : '';
      conv();
    };
    const conv = () => {
      const a = parseAmount(f.amount.value, cur), tp = parseAmount(f.tip.value, cur) || 0;
      if (!Number.isFinite(a)) { $('#conv', root).textContent = cur === 'IDR' ? '« 50k » = 50 000 Rp · « 1,2jt » = 1 200 000 Rp' : 'Montant en euros'; return; }
      const tot = a + tp;
      $('#conv', root).textContent = cur === 'IDR' ? `${fmtIDR(tot, { exact: true })} = ${fmtEUR(tot / rate())}` : `${fmtEUR(tot)} = ${fmtIDR(tot * rate())}`;
    };
    const flash = el => { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); };
    // le champ « Quoi ? » remplit le reste
    const readWhat = () => {
      const p = parseQuick(f.label.value, { history: hist, defaultCurrency: cur });
      if (p.currency && !touched.cur && p.currency !== cur) { cur = p.currency; }
      if (p.amount !== undefined && !touched.amount) { const s = fmtA(p.amount, cur); if (f.amount.value !== s) { f.amount.value = s; flash($('.amount-box', root)); } }
      if (p.tip !== undefined && !touched.tip) f.tip.value = fmtA(p.tip, cur);
      if (p.pay && !touched.pay && p.pay !== pay) { pay = p.pay; }
      if (p.cat && !touched.cat && p.cat !== cat) { cat = p.cat; const b = $(`[data-cat="${cat}"]`, root); b && flash(b); }
      sync();
      return p;
    };
    sync();
    if (preset.text) readWhat();
    f.label.addEventListener('input', readWhat);
    f.label.addEventListener('blur', () => { const p = parseQuick(f.label.value, { history: hist, defaultCurrency: cur }); if (p.amount !== undefined && p.label) f.label.value = p.label; });
    f.label.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); f.label.blur(); if (Number.isFinite(parseAmount(f.amount.value, cur)) && cat) f.requestSubmit(); else (cat ? f.amount : $('[data-cat]', root)).focus(); } });
    root.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.c) { cur = b.dataset.c; touched.cur = true; sync(); }
      if (b.dataset.p) { pay = b.dataset.p; touched.pay = true; sync(); }
      if (b.dataset.cat) { cat = b.dataset.cat; touched.cat = true; sync(); }
      if (b.dataset.spread != null) { spread = b.dataset.spread; sync(); }
      if (b.dataset.day != null) { f.date.value = addDays(today(), Number(b.dataset.day)); sync(); }
      if (b.dataset.sug) { f.label.value = b.dataset.sug; sync(); }
      if (b.dataset.act === 'sheet-del' && e) { remove('expenses', e.id); closeSheet(); toast('Dépense supprimée', { label: 'Annuler', fn: () => upsert('expenses', e) }); }
    });
    f.amount.addEventListener('input', () => { touched.amount = true; conv(); });
    f.tip.addEventListener('input', () => { touched.tip = true; conv(); });
    f.date.addEventListener('change', sync);
    f.addEventListener('submit', ev => {
      ev.preventDefault();
      const amount = parseAmount(f.amount.value, cur), tipV = parseAmount(f.tip.value, cur) || 0;
      if (!Number.isFinite(amount) || amount <= 0) return showErr(root, 'Indique un montant.');
      if (!cat) return showErr(root, 'Choisis une catégorie.');
      const p = parseQuick(f.label.value, { history: hist, defaultCurrency: cur });
      const label = (p.amount !== undefined ? p.label : f.label.value.trim()) || CAT[cat].label;
      const item = {
        ...(e || {}), date: f.date.value || today(), amount, currency: cur, tip: tipV, cat, pay, label,
        note: f.note.value.trim(), spread: spread || undefined, offBudget: f.offBudget.checked || undefined,
        rate: cur === 'IDR' ? (e && e.currency === 'IDR' && e.rate ? e.rate : rate()) : undefined,
        src: e?.src || 'manual',
      };
      item.eur = Math.round(toEUR(amount + tipV, cur, item.rate || 1) * 100) / 100;
      lsSet('dompet:lastCur', cur); lsSet('dompet:lastPay', pay);
      const saved = upsert('expenses', item);
      closeSheet();
      toast(e ? 'Dépense modifiée' : `Ajouté : ${saved.label}, ${expTotalStr(saved)}`, e ? null : { label: 'Annuler', fn: () => remove('expenses', saved.id) });
    });
  });
}
function showErr(root, msg) { const el = $('#err', root); el.textContent = msg; el.classList.add('on'); }

function openStay(id) {
  const st = id ? D().stays.find(x => x.id === id) : null;
  const last = [...D().stays].sort((a, b) => b.checkout.localeCompare(a.checkout))[0];
  const v = st || { name: '', place: '', checkin: last ? last.checkout : today(), checkout: addDays(last ? last.checkout : today(), 7), total: '', currency: 'EUR', paid: true, link: '', note: '' };
  openSheet(`${sheetHead(st ? 'Modifier le logement' : 'Nouveau logement', !!st)}
  <form id="f-stay" class="form" autocomplete="off">
    <label>Nom<input name="name" required placeholder="Guesthouse, bungalow, Airbnb…" value="${esc(v.name)}" autofocus></label>
    <label>Lieu<input name="place" placeholder="Canggu, Ubud, Gili…" value="${esc(v.place || '')}"></label>
    <div class="two"><label>Arrivée<input type="date" name="checkin" required value="${v.checkin}"></label><label>Départ<input type="date" name="checkout" required value="${v.checkout}"></label></div>
    <div class="seg" role="group" aria-label="Type de prix"><button type="button" data-mode="total" aria-pressed="true">Prix total</button><button type="button" data-mode="night" aria-pressed="false">Prix par nuit</button></div>
    <div class="amount-box small"><input name="total" class="amount-in" inputmode="decimal" placeholder="0" value="${v.total !== '' ? (v.currency === 'IDR' ? nf0.format(v.total) : String(v.total).replace('.', ',')) : ''}" aria-label="Prix"><div class="seg" role="group" aria-label="Devise"><button type="button" data-c="IDR">Rp</button><button type="button" data-c="EUR">€</button></div></div>
    <p class="conv" id="conv"></p>
    <label class="check"><input type="checkbox" name="paid" ${v.paid ? 'checked' : ''}> Déjà payé</label>
    <label>Lien de réservation<input name="link" type="url" placeholder="https://" value="${esc(v.link || '')}"></label>
    <label>Note<input name="note" value="${esc(v.note || '')}"></label>
    ${v.link ? `<a class="link" href="${esc(v.link)}" target="_blank" rel="noopener">Ouvrir la réservation</a>` : ''}
    <p class="form-err" id="err" role="alert"></p>
    <button class="btn primary big">${st ? 'Enregistrer' : 'Ajouter le logement'}</button>
  </form>`, root => {
    const f = $('#f-stay', root); let cur = v.currency, mode = 'total';
    const nights = () => Math.max(0, diffDays(f.checkin.value, f.checkout.value));
    const conv = () => {
      $$('[data-c]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.c === cur));
      $$('[data-mode]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode));
      const a = parseAmount(f.total.value, cur), n = nights();
      if (!Number.isFinite(a) || !n) { $('#conv', root).textContent = n ? `${n} nuit${n > 1 ? 's' : ''}` : 'Le départ doit être après l’arrivée'; return; }
      const tot = mode === 'night' ? a * n : a, eur = toEUR(tot, cur, rate());
      $('#conv', root).textContent = `${n} nuits · total ${fmtEUR(eur)} / ${fmtIDR(eur * rate())} · ${fmtEUR(eur / n)} par nuit`;
    };
    conv();
    root.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.c) { cur = b.dataset.c; conv(); }
      if (b.dataset.mode) { mode = b.dataset.mode; conv(); }
      if (b.dataset.act === 'sheet-del' && st) { remove('stays', st.id); closeSheet(); toast('Logement supprimé', { label: 'Annuler', fn: () => upsert('stays', st) }); }
    });
    ['input', 'change'].forEach(evn => f.addEventListener(evn, conv));
    f.addEventListener('submit', ev => {
      ev.preventDefault();
      const a = parseAmount(f.total.value, cur), n = nights();
      if (!n) return showErr(root, 'La date de départ doit être après l’arrivée.');
      if (!Number.isFinite(a) || a <= 0) return showErr(root, 'Indique un prix.');
      upsert('stays', { ...(st || {}), name: f.name.value.trim(), place: f.place.value.trim(), checkin: f.checkin.value, checkout: f.checkout.value, total: mode === 'night' ? a * n : a, currency: cur, rate: cur === 'IDR' ? (st?.rate || rate()) : undefined, paid: f.paid.checked, link: f.link.value.trim(), note: f.note.value.trim() });
      closeSheet(); toast(st ? 'Logement modifié' : 'Logement ajouté');
    });
  });
}

function openRecurring(id) {
  const r = id ? D().recurring.find(x => x.id === id) : null;
  const ym = ymOf(today());
  const v = r || { label: '', cat: 'pro', amount: '', currency: 'EUR', freq: 'monthly', day: Number(today().slice(8)), start: today(), end: '', active: true, overrides: {} };
  openSheet(`${sheetHead(r ? 'Modifier la charge fixe' : 'Nouvelle charge fixe', !!r)}
  <form id="f-rec" class="form" autocomplete="off">
    <label>Nom<input name="label" required placeholder="Google Ads, Claude, forfait…" value="${esc(v.label)}" autofocus></label>
    <div class="amount-box small"><input name="amount" class="amount-in" inputmode="decimal" placeholder="0" value="${v.amount}" aria-label="Montant"><div class="seg" role="group" aria-label="Devise"><button type="button" data-c="EUR">€</button><button type="button" data-c="IDR">Rp</button></div></div>
    <div class="two">
      <label>Fréquence<select name="freq"><option value="monthly" ${v.freq === 'monthly' ? 'selected' : ''}>Chaque mois</option><option value="weekly" ${v.freq === 'weekly' ? 'selected' : ''}>Chaque semaine</option><option value="yearly" ${v.freq === 'yearly' ? 'selected' : ''}>Chaque année</option></select></label>
      <label>Jour du mois<input name="day" type="number" min="1" max="31" value="${v.day || 1}"></label>
    </div>
    <label>Catégorie<select name="cat">${CATS.map(c => `<option value="${c.id}" ${v.cat === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label>
    <div class="two"><label>Depuis<input type="date" name="start" value="${v.start || ''}"></label><label>Jusqu'au <span class="muted small">(facultatif)</span><input type="date" name="end" value="${v.end || ''}"></label></div>
    <label>Montant réel pour ${monthName(ym).toLowerCase()} <span class="muted small">(si différent, ex. Google Ads)</span><input name="override" inputmode="decimal" value="${v.overrides?.[ym] ?? ''}"></label>
    <label class="check"><input type="checkbox" name="active" ${v.active !== false ? 'checked' : ''}> Active</label>
    <p class="form-err" id="err" role="alert"></p>
    <button class="btn primary big">${r ? 'Enregistrer' : 'Ajouter'}</button>
  </form>`, root => {
    const f = $('#f-rec', root); let cur = v.currency;
    const seg = () => $$('[data-c]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.c === cur)); seg();
    root.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.c) { cur = b.dataset.c; seg(); }
      if (b.dataset.act === 'sheet-del' && r) { remove('recurring', r.id); closeSheet(); toast('Charge supprimée', { label: 'Annuler', fn: () => upsert('recurring', r) }); }
    });
    f.addEventListener('submit', ev => {
      ev.preventDefault();
      const a = parseAmount(f.amount.value, cur);
      if (!Number.isFinite(a) || a <= 0) return showErr(root, 'Indique un montant.');
      const ov = parseAmount(f.override.value, cur);
      const overrides = { ...(v.overrides || {}) };
      if (Number.isFinite(ov)) overrides[ym] = ov; else delete overrides[ym];
      upsert('recurring', { ...(r || {}), label: f.label.value.trim(), amount: a, currency: cur, freq: f.freq.value, day: Number(f.day.value) || 1, cat: f.cat.value, start: f.start.value || today(), end: f.end.value || null, active: f.active.checked, overrides });
      closeSheet(); toast(r ? 'Charge modifiée' : 'Charge ajoutée');
    });
  });
}

function openWithdraw() {
  openSheet(`${sheetHead('Retrait au distributeur')}
  <form id="f-wd" class="form" autocomplete="off">
    <label>Montant retiré<span class="input-suffix"><input name="amount" inputmode="decimal" placeholder="2 500 000" autofocus><em>Rp</em></span></label>
    <div class="quick">${[1000000, 2000000, 2500000, 3000000].map(x => `<button type="button" class="chip" data-v="${x}">${kIDR(x)}</button>`).join('')}</div>
    <div class="two"><label>Frais du distributeur<span class="input-suffix"><input name="fee" inputmode="decimal" placeholder="50k"><em>Rp</em></span></label><label>Frais de ta banque<span class="input-suffix"><input name="feeEUR" inputmode="decimal" placeholder="0"><em>€</em></span></label></div>
    <label>Date<input type="date" name="date" value="${today()}"></label>
    <p class="muted small">Un retrait n'est pas une dépense : il remplit ton portefeuille. Les frais, eux, comptent dans « Divers ».</p>
    <p class="form-err" id="err" role="alert"></p>
    <button class="btn primary big">Ajouter le retrait</button>
  </form>`, root => {
    const f = $('#f-wd', root);
    root.addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (b) f.amount.value = nf0.format(Number(b.dataset.v)); });
    f.addEventListener('submit', ev => {
      ev.preventDefault();
      const a = parseAmount(f.amount.value, 'IDR');
      if (!Number.isFinite(a) || a <= 0) return showErr(root, 'Indique le montant retiré.');
      if (!D().settings.cashStart?.date) setSettings({ cashStart: { date: f.date.value, amountIDR: 0 } });
      upsert('cash', { type: 'withdraw', date: f.date.value, amountIDR: a, feeIDR: parseAmount(f.fee.value, 'IDR') || 0, feeEUR: parseAmount(f.feeEUR.value, 'EUR') || 0 });
      closeSheet(); toast('Retrait ajouté');
    });
  });
}

function openRecount() {
  const exp = cashBalance(D());
  openSheet(`${sheetHead('Combien de billets as-tu ?')}
  <form id="f-rc" class="form" autocomplete="off">
    ${exp != null ? `<p class="muted">D'après tes dépenses, tu devrais avoir <b>${fmtIDR(exp)}</b>.</p>` : `<p class="muted">Compte les roupies de ton portefeuille. Ensuite, Dompet retire tout seul chaque dépense payée en billets et ajoute tes retraits.</p>`}
    <label>Ce que tu as vraiment<span class="input-suffix"><input name="amount" inputmode="decimal" placeholder="850k" autofocus><em>Rp</em></span></label>
    <p class="muted small" id="diff"></p>
    <p class="form-err" id="err" role="alert"></p>
    <button class="btn primary big">Valider</button>
  </form>`, root => {
    const f = $('#f-rc', root);
    f.amount.addEventListener('input', () => {
      const a = parseAmount(f.amount.value, 'IDR'); if (!Number.isFinite(a) || exp == null) return;
      const d = exp - a;
      $('#diff', root).textContent = Math.abs(d) < 5000 ? 'Parfait, tout est noté.' : d > 0 ? `Il manque ${fmtIDR(d)} : Dompet l'ajoutera comme « Billets non notés » dans Divers.` : `Tu as ${fmtIDR(-d)} de plus que prévu : Dompet corrigera.`;
    });
    f.addEventListener('submit', ev => {
      ev.preventDefault();
      const a = parseAmount(f.amount.value, 'IDR');
      if (!Number.isFinite(a) || a < 0) return showErr(root, 'Indique un montant.');
      const t = today();
      if (exp == null) { setSettings({ cashStart: { date: t, amountIDR: a } }); }
      else {
        const d = exp - a;
        if (d >= 5000) upsert('expenses', { date: t, amount: Math.round(d), currency: 'IDR', rate: rate(), tip: 0, cat: 'other', pay: 'cash', label: 'Billets non notés', note: 'écart au recomptage', src: 'manual', eur: Math.round(d / rate() * 100) / 100 });
        else if (d <= -5000) upsert('cash', { type: 'adjust', date: t, amountIDR: Math.round(-d) });
      }
      closeSheet(); toast('Portefeuille à jour');
    });
  });
}

function openSyncSetup() {
  const sy = store.sync;
  openSheet(`${sheetHead('Connecter GitHub')}
  <form id="f-sync" class="form" autocomplete="off">
    <ol class="steps">
      <li>Sur GitHub, crée un dépôt <b>privé</b> (par ex. <code>dompet-data</code>).</li>
      <li>Crée une clé : <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → Settings → Developer settings → Fine-grained tokens</a>. Choisis <i>Only select repositories</i> → ce dépôt, puis <i>Permissions → Contents : Read and write</i>.</li>
      <li>Colle la clé ci-dessous. Elle reste uniquement sur ce téléphone.</li>
    </ol>
    <div class="two"><label>Ton nom GitHub<input name="owner" required value="${esc(sy.owner)}" autocapitalize="off" spellcheck="false"></label><label>Nom du dépôt<input name="repo" required value="${esc(sy.repo || 'dompet-data')}" autocapitalize="off" spellcheck="false"></label></div>
    <label>Clé (token)<input name="token" type="password" required value="${esc(sy.token)}" autocapitalize="off" spellcheck="false" placeholder="github_pat_…"></label>
    <details><summary class="small muted">Options avancées</summary><div class="two"><label>Branche<input name="branch" value="${esc(sy.branch || 'main')}"></label><label>Fichier<input name="path" value="${esc(sy.path || 'data.json')}"></label></div></details>
    <p class="form-err" id="err" role="alert"></p>
    <p class="muted small" id="okmsg"></p>
    <button class="btn primary big">Tester et connecter</button>
  </form>`, root => {
    const f = $('#f-sync', root);
    f.addEventListener('submit', async ev => {
      ev.preventDefault();
      const cfg = { owner: f.owner.value.trim(), repo: f.repo.value.trim(), token: f.token.value.trim(), branch: f.branch.value.trim() || 'main', path: f.path.value.trim() || 'data.json' };
      $('#okmsg', root).textContent = 'Connexion…'; $('#err', root).textContent = '';
      const r = await testConnection(cfg);
      if (!r.ok) { $('#okmsg', root).textContent = ''; return showErr(root, r.error); }
      saveSyncConfig(cfg);
      if (D().demo) replaceAll({}, { demo: false });
      closeSheet();
      toast(r.exists ? `Connecté · ${r.count} dépenses trouvées` : 'Connecté · le fichier sera créé');
      await syncNow();
      UI.view = 'today';
      render();
    });
  });
}

function openSetup() {
  const s = D().settings;
  openSheet(`${sheetHead('On règle ton budget')}
  <form id="f-setup" class="form">
    <label>Combien veux-tu dépenser par mois, tout compris ?<span class="input-suffix"><input name="budget" type="number" inputmode="decimal" min="0" step="10" value="${s.defaultMonthlyBudget}" autofocus><em>€</em></span></label>
    <div class="two"><label>Arrivée<input name="tripStart" type="date" value="${s.tripStart || today()}"></label><label>Fin <span class="muted small">(si tu sais)</span><input name="tripEnd" type="date" value="${s.tripEnd || ''}"></label></div>
    <label>Cagnotte totale du voyage <span class="muted small">(facultatif)</span><span class="input-suffix"><input name="savings" type="number" inputmode="decimal" min="0" step="10"><em>€</em></span></label>
    <button class="btn primary big">C'est parti</button>
    <p class="muted small">Ensuite : ajoute tes logements réservés dans l'onglet Séjour.</p>
  </form>`, root => {
    const f = $('#f-setup', root);
    f.addEventListener('submit', ev => {
      ev.preventDefault();
      if (D().demo) replaceAll({}, { demo: false });
      const sv = Number(f.savings.value);
      setSettings({ trackFrom: today(), defaultMonthlyBudget: Number(f.budget.value) || 1000, tripStart: f.tripStart.value || null, tripEnd: f.tripEnd.value || null, ...(sv > 0 ? { savings: { amount: sv, date: f.tripStart.value || today() } } : {}) });
      closeSheet(); go('stays'); toast('Budget enregistré. Ajoute maintenant tes logements.');
    });
  });
}

function openBudgetMonth() {
  const ym = ymOf(today()), s = D().settings;
  openSheet(`${sheetHead(`Budget de ${monthName(ym).toLowerCase()}`)}
  <form id="f-bm" class="form">
    <p class="muted small">Tu as commencé à noter en cours de mois : ton budget de ${fmtEUR(s.monthlyBudgets[ym] ?? s.defaultMonthlyBudget, { round: true })} est ramené aux jours suivis.</p>
    <label>Budget du mois entier, tout compris<span class="input-suffix"><input name="b" type="number" inputmode="decimal" min="0" step="10" value="${s.monthlyBudgets[ym] ?? s.defaultMonthlyBudget}" autofocus><em>€</em></span></label>
    <label class="check"><input type="checkbox" name="all"> Utiliser aussi pour les mois suivants</label>
    <button class="btn primary big">Enregistrer</button>
  </form>`, root => {
    $('#f-bm', root).addEventListener('submit', ev => {
      ev.preventDefault(); const f = ev.target; const b = Number(f.b.value) || 0;
      if (f.all.checked) setSettings({ defaultMonthlyBudget: b, monthlyBudgets: { ...s.monthlyBudgets, [ym]: b } });
      else setSettings({ monthlyBudgets: { ...s.monthlyBudgets, [ym]: b } });
      closeSheet(); toast('Budget mis à jour');
    });
  });
}

// ---------- taux de change ----------
async function refreshRate(force = false) {
  const s = D().settings;
  if (!force && (!s.rateAuto || s.rateDate === today())) return;
  const srcs = [
    ['https://api.frankfurter.dev/v1/latest?base=EUR&symbols=IDR', j => j.rates?.IDR],
    ['https://api.frankfurter.app/latest?from=EUR&to=IDR', j => j.rates?.IDR],
    ['https://open.er-api.com/v6/latest/EUR', j => j.rates?.IDR],
  ];
  for (const [url, get] of srcs) {
    try {
      const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) continue;
      const v = Math.round(get(await r.json())); if (!v) continue;
      if (D().demo || (!hasData() && !syncConfigured())) { D().settings.rate = v; D().settings.rateDate = today(); render(); return v; }
      if (Math.abs(v - s.rate) / s.rate > 0.003 || force || !s.rateDate) setSettings({ rate: v, rateDate: today() });
      return v;
    } catch { /* source suivante */ }
  }
  if (force) toast('Impossible de récupérer le taux. Saisis-le à la main.');
}

// ---------- actions ----------
function exportData() {
  const blob = new Blob([JSON.stringify(D(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dompet-${today()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function cycleTheme() {
  const order = ['auto', 'light', 'dark'];
  const next = order[(order.indexOf(lsGet('dompet:theme', 'auto')) + 1) % 3];
  lsSet('dompet:theme', next); applyTheme(); render();
}
function applyTheme() {
  const t = lsGet('dompet:theme', 'auto');
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}

document.addEventListener('click', ev => {
  const g = ev.target.closest('[data-go]'); if (g) return go(g.dataset.go);
  const c = ev.target.closest('[data-cur]'); if (c) { UI.cur = c.dataset.cur; lsSet('dompet:cur', UI.cur); return render(); }
  if (ev.target.closest('#syncBtn')) { if (syncConfigured()) syncNow(); else go('settings'); return; }
  const a = ev.target.closest('[data-act]'); if (!a) return;
  const id = a.dataset.id;
  switch (a.dataset.act) {
    case 'close': return closeSheet();
    case 'add': return openExpense();
    case 'add-yesterday': return openExpense(null, { date: addDays(today(), -1) });
    case 'quiet': lsSet('dompet:quiet:' + a.dataset.d, '1'); return render();
    case 'edit': return openExpense(id);
    case 'fav': {
      const e = D().expenses.find(x => x.id === id); if (!e) return;
      const { id: _i, createdAt, updatedAt, spread, offBudget, ...rest } = e;
      const saved = upsert('expenses', { ...rest, date: today(), rate: e.currency === 'IDR' ? rate() : undefined, src: 'manual', note: '' });
      return toast(`Ajouté : ${e.label}`, { label: 'Annuler', fn: () => remove('expenses', saved.id) });
    }
    case 'stay': return openStay(id);
    case 'rec': return openRecurring(id);
    case 'withdraw': return openWithdraw();
    case 'recount': return openRecount();
    case 'cash-stop': if (confirm('Arrêter le suivi des billets ? Tes dépenses ne changent pas.')) setSettings({ cashStart: { date: null, amountIDR: 0 } }); return;
    case 'budget-month': return openBudgetMonth();
    case 'setup': return openSetup();
    case 'sync-setup': return openSyncSetup();
    case 'sync-now': return syncNow();
    case 'sync-forget': if (confirm('Déconnecter GitHub sur ce téléphone ? Tes données restent sur GitHub.')) forgetSync(); return render();
    case 'demo': replaceAll(demoData(), { demo: true }); UI.view = 'today'; toast('Exemple chargé, rien n’est envoyé sur GitHub.'); return render();
    case 'wipe': if (confirm(D().demo ? 'Quitter l’exemple ?' : 'Effacer les données de ce téléphone ? Si GitHub est connecté, elles seront rechargées depuis GitHub.')) { wipe(); if (syncConfigured()) syncNow(); } return render();
    case 'export': return exportData();
    case 'theme': return cycleTheme();
    case 'rate-refresh': return refreshRate(true).then(v => v && toast(`1 € = ${nf0.format(v)} Rp`));
    case 'month': UI.month = addMonths(UI.month || ymOf(today()), Number(a.dataset.d)); return render();
    case 'jf': UI.jFilter = a.dataset.f; return render();
    case 'go-settings': return go('settings');
    case 'cash-del': { const c = D().cash.find(x => x.id === id); remove('cash', id); return toast('Supprimé', { label: 'Annuler', fn: () => upsert('cash', c) }); }
    case 'split-suggest': {
      const sug = suggestSplit(D()); if (!sug) return;
      DAILY_CATS.forEach(k => { const el = document.querySelector(`#f-split [name="${k}"]`); if (el) { el.value = sug[k]; el.nextElementSibling.textContent = sug[k] + ' %'; } });
      updateSplitSum(); return toast('Répartition calée sur tes vraies dépenses. Enregistre pour valider.');
    }
  }
});

function updateSplitSum() {
  const f = $('#f-split'); if (!f) return;
  const t = DAILY_CATS.reduce((a, c) => a + Number(f[c].value), 0);
  const el = $('#splitSum'); el.textContent = t + ' %'; el.classList.toggle('neg', t !== 100);
}

document.addEventListener('input', ev => {
  if (ev.target.id === 'jsearch') {
    UI.jSearch = ev.target.value;
    const pos = ev.target.selectionStart; render(); const el = $('#jsearch'); el.focus(); el.setSelectionRange(pos, pos);
  }
  if (ev.target.closest('#f-split') && ev.target.type === 'range') { ev.target.nextElementSibling.textContent = ev.target.value + ' %'; updateSplitSum(); }
});
document.addEventListener('change', async ev => {
  if (ev.target.id === 'importFile') {
    const file = ev.target.files[0]; if (!file) return;
    try { const j = JSON.parse(await file.text()); if (!j.expenses) throw 0; if (confirm(`Importer ${j.expenses.length} dépenses ? Elles remplacent les données de ce téléphone.`)) { replaceAll(j); toast('Sauvegarde importée'); } }
    catch { toast('Ce fichier n’est pas une sauvegarde Dompet.'); }
  }
});
document.addEventListener('submit', ev => {
  const f = ev.target;
  if (f.id === 'qform') {
    ev.preventDefault();
    const text = f.q.value.trim();
    f.q.value = ''; f.q.blur();
    return openExpense(null, text ? { text } : {});
  }
  if (f.id === 'f-budget') {
    ev.preventDefault();
    const ym = ymOf(today()); const mb = { ...D().settings.monthlyBudgets };
    if (f.thisMonth.value !== '') mb[ym] = Number(f.thisMonth.value); else delete mb[ym];
    const sv = Number(f.savings.value);
    setSettings({ defaultMonthlyBudget: Number(f.defaultMonthlyBudget.value) || 0, monthlyBudgets: mb, tripStart: f.tripStart.value || null, tripEnd: f.tripEnd.value || null, trackFrom: f.trackFrom.value || null, mealsPerDay: Number(f.mealsPerDay.value) || 3, savings: { amount: sv > 0 ? sv : null, date: f.savingsDate.value || f.tripStart.value || null } });
    toast('Budget enregistré');
  }
  if (f.id === 'f-split') {
    ev.preventDefault();
    const split = {}; DAILY_CATS.forEach(c => split[c] = Number(f[c].value));
    const t = Object.values(split).reduce((a, b) => a + b, 0);
    if (t !== 100) { let acc = 0; DAILY_CATS.forEach(c => { split[c] = Math.round(split[c] / t * 100); acc += split[c]; }); split.food += 100 - acc; }
    setSettings({ split }); toast(t === 100 ? 'Répartition enregistrée' : 'Répartition ajustée à 100 % et enregistrée');
  }
  if (f.id === 'f-rate') {
    ev.preventDefault();
    setSettings({ rateAuto: f.rateAuto.checked, rate: Number(f.rate.value) || D().settings.rate, rateDate: today() });
    toast('Taux enregistré');
  }
});

// ---------- démarrage ----------
applyTheme();
init();
shell();
render();
onChange(() => render());
syncNow({ quiet: true }).then(() => render());
refreshRate();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => { });
