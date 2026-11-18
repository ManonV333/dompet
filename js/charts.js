// Dompet — graphiques SVG faits main (aucune dépendance).
// Chaque marque porte data-tip="..." : une seule infobulle globale les affiche.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

function arcPath(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

// Anneau segmenté. segs = [{value, color, tip}], total = valeur d'un tour complet.
export function ring({ segs, total, size = 240, stroke = 20, r, track = 'var(--ring-track)', gapPx = 3, inner = null, cap = 'round' }) {
  const c = size / 2; r = r || c - stroke / 2 - 2;
  const C = 2 * Math.PI * r;
  const start = -Math.PI / 2;
  let a = start;
  const used = segs.reduce((s, x) => s + x.value, 0);
  const scale = Math.max(total, used) || 1;
  const visible = segs.filter(s => s.value > 0);
  const gap = visible.length > 1 ? gapPx / r : 0;
  let paths = '';
  for (const s of visible) {
    const sweep = (s.value / scale) * 2 * Math.PI;
    const a0 = a + gap / 2, a1 = a + Math.max(sweep - gap / 2, gap / 2 + 0.001);
    if (sweep >= 2 * Math.PI - 1e-6) {
      paths += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}" data-tip="${esc(s.tip)}"/>`;
    } else {
      paths += `<path d="${arcPath(c, c, r, a0, a1)}" fill="none" stroke="${s.color}" stroke-width="${stroke}" stroke-linecap="${cap}" data-tip="${esc(s.tip)}"/>`;
    }
    a += sweep;
  }
  let innerSvg = '';
  if (inner) {
    const ri = inner.r, sw = inner.stroke || 6;
    const frac = Math.max(0, Math.min(1, inner.value));
    innerSvg += `<circle cx="${c}" cy="${c}" r="${ri}" fill="none" stroke="${track}" stroke-width="${sw}"/>`;
    if (frac > 0) innerSvg += `<path d="${arcPath(c, c, ri, start, start + Math.max(frac * 2 * Math.PI - 0.0001, 0.01))}" fill="none" stroke="${inner.color}" stroke-width="${sw}" stroke-linecap="round" data-tip="${esc(inner.tip)}"/>`;
    if (inner.marker != null) {
      const am = start + Math.max(0, Math.min(1, inner.marker)) * 2 * Math.PI;
      const [x0, y0] = polar(c, c, ri - sw, am), [x1, y1] = polar(c, c, ri + sw, am);
      innerSvg += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${inner.markerColor}" stroke-width="3" stroke-linecap="round" data-tip="${esc(inner.markerTip)}"/>`;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" class="ring" role="img" aria-hidden="true">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    ${paths}${innerSvg}</svg>`;
}

// Donut avec trou large (répartition par catégorie)
export function donut({ segs, size = 200, stroke = 26 }) {
  const total = segs.reduce((s, x) => s + x.value, 0);
  return ring({ segs, total, size, stroke, cap: 'butt', gapPx: 2 });
}

// Barres journalières + ligne « budget du jour ». days = [{label, value, limit, tip, highlight, muted}]
export function dayBars({ days, height, W = 640, fmtAxis = v => v, color = 'var(--series-bar)', overColor = 'var(--crit)' }) {
  height = height || (W < 500 ? 220 : 200);
  const H = height, padL = 44, padR = 8, padT = 12, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(1, ...days.map(d => Math.max(d.value, d.limit || 0))) * 1.08;
  const step = iw / days.length, bw = Math.max(3, Math.min(18, step - 3));
  const y = v => padT + ih - (v / max) * ih;
  const ticks = niceTicks(max, 4);
  let g = ticks.map(t => `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${padL - 6}" y="${y(t) + 4}" class="axis" text-anchor="end">${esc(fmtAxis(t))}</text>`).join('');
  let bars = '', lim = '', hits = '';
  days.forEach((d, i) => {
    const x = padL + i * step + (step - bw) / 2;
    const h = Math.max(0, ih - (y(d.value) - padT));
    const over = d.limit != null && d.value > d.limit + 0.005;
    if (d.value > 0) bars += `<path d="${roundTop(x, y(d.value), bw, h, Math.min(4, bw / 2))}" fill="${over ? overColor : color}" class="${d.muted ? 'muted' : ''}${d.highlight ? ' hl' : ''}"/>`;
    hits += `<rect x="${padL + i * step}" y="${padT}" width="${step}" height="${ih}" fill="transparent" data-tip="${esc(d.tip)}"/>`;
    if ((i % Math.ceil(days.length / 8) === 0 && days.length - 1 - i >= Math.ceil(days.length / 8) / 2) || i === days.length - 1) g += `<text x="${padL + i * step + step / 2}" y="${H - 8}" class="axis" text-anchor="middle">${esc(d.label)}</text>`;
  });
  const pts = days.map((d, i) => d.limit != null ? `${(padL + i * step + step / 2).toFixed(1)},${y(Math.max(0, d.limit)).toFixed(1)}` : null).filter(Boolean);
  if (pts.length > 1) lim = `<polyline points="${pts.join(' ')}" class="limit-line"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Dépenses par jour et budget du jour">${g}${bars}${lim}${hits}</svg>`;
}

function roundTop(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, h);
  return `M${x} ${y + h} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h} Z`;
}

export function niceTicks(max, n = 4) {
  const raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const st = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const out = []; for (let v = 0; v <= max; v += st) out.push(v); return out;
}

// Courbe cumulée vs trajectoire idéale. pts=[{label, value|null, ideal, tip}]
export function burnUp({ pts, budget, height, W = 640, fmtAxis = v => v }) {
  height = height || (W < 500 ? 220 : 200);
  const H = height, padL = 44, padR = 12, padT = 14, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(budget, ...pts.map(p => Math.max(p.value || 0, p.proj || 0))) * 1.08 || 1;
  const x = i => padL + (pts.length > 1 ? i / (pts.length - 1) : 0) * iw;
  const y = v => padT + ih - (v / max) * ih;
  let g = niceTicks(max, 4).map(t => `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${padL - 6}" y="${y(t) + 4}" class="axis" text-anchor="end">${esc(fmtAxis(t))}</text>`).join('');
  g += `<line x1="${padL}" x2="${W - padR}" y1="${y(budget)}" y2="${y(budget)}" class="budget-line"/><text x="${W - padR}" y="${y(budget) - 6}" class="axis strong" text-anchor="end">Budget ${esc(fmtAxis(budget))}</text>`;
  const ideal = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.ideal).toFixed(1)}`).join(' ');
  const real = pts.filter(p => p.value != null);
  const realPts = real.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const projPts = pts.map((p, i) => p.proj != null ? `${x(i).toFixed(1)},${y(p.proj).toFixed(1)}` : null).filter(Boolean).join(' ');
  let area = '';
  if (real.length > 1) area = `<path d="M${x(0)} ${y(0)} L${realPts.split(' ').join(' L')} L${x(real.length - 1)} ${y(0)} Z" class="area"/>`;
  let labels = '';
  pts.forEach((p, i) => { if ((i % Math.ceil(pts.length / 8) === 0 && pts.length - 1 - i >= Math.ceil(pts.length / 8) / 2) || i === pts.length - 1) labels += `<text x="${x(i)}" y="${H - 8}" class="axis" text-anchor="middle">${esc(p.label)}</text>`; });
  const step = iw / Math.max(1, pts.length - 1);
  const hits = pts.map((p, i) => `<rect x="${x(i) - step / 2}" y="${padT}" width="${step}" height="${ih}" fill="transparent" data-tip="${esc(p.tip)}"/>`).join('');
  const last = real.length ? `<circle cx="${x(real.length - 1)}" cy="${y(real[real.length - 1].value)}" r="5" class="dot"/>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Dépenses cumulées du mois">${g}${area}
    <polyline points="${ideal}" class="ideal-line"/>
    ${projPts ? `<polyline points="${projPts}" class="proj-line"/>` : ''}
    ${real.length > 1 ? `<polyline points="${realPts}" class="real-line"/>` : ''}${last}${labels}${hits}</svg>`;
}

// Calendrier thermique. cells=[{date, value, tip, empty}], mois commençant lundi
export function heatmap({ cells, max, startWeekday = 0 }) {
  const size = 34, gap = 5, cols = 7;
  const rows = Math.ceil((cells.length + startWeekday) / cols);
  const W = cols * (size + gap), H = rows * (size + gap) + 18;
  const steps = ['var(--seq-0)', 'var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)'];
  let out = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => `<text x="${i * (size + gap) + size / 2}" y="11" class="axis" text-anchor="middle">${d}</text>`).join('');
  cells.forEach((c, i) => {
    const k = i + startWeekday, cx = (k % cols) * (size + gap), cy = 18 + Math.floor(k / cols) * (size + gap);
    const lvl = c.empty ? -1 : c.value <= 0 ? 0 : Math.min(5, 1 + Math.floor((c.value / (max || 1)) * 4.999));
    out += `<rect x="${cx}" y="${cy}" width="${size}" height="${size}" rx="7" fill="${lvl < 0 ? 'transparent' : steps[lvl]}" class="${lvl < 0 ? 'cell-empty' : 'cell'}${c.today ? ' cell-today' : ''}" data-tip="${esc(c.tip)}"/>`;
    out += `<text x="${cx + size / 2}" y="${cy + size / 2 + 4}" text-anchor="middle" class="cell-n${lvl >= 3 ? ' on-dark' : ''}">${Number(c.date.slice(8))}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="heat" role="img" aria-label="Calendrier des dépenses">${out}</svg>`;
}

// Barre empilée horizontale (ex. part fixe / variable / reste)
export function stackBar(parts, { marker = null, markerTip = '' } = {}) {
  const tot = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  let html = parts.filter(p => p.value > 0).map(p => `<span class="sb-part ${p.cls || ''}" style="flex:${p.value / tot};${p.color ? `background:${p.color}` : ''}" data-tip="${esc(p.tip)}"></span>`).join('');
  const m = marker != null ? `<span class="sb-marker" style="left:${Math.max(0, Math.min(100, marker * 100))}%" data-tip="${esc(markerTip)}"></span>` : '';
  return `<div class="stackbar">${html}${m}</div>`;
}
