// Données d'exemple : un mois réaliste à Bali, pour découvrir l'outil sans rien saisir.
import { emptyData, addDays, localToday, uid } from './engine.js';

export function demoData() {
  const d = emptyData();
  const today = localToday();
  const start = addDays(today, -20);
  const now = new Date().toISOString();
  const s = d.settings;
  s.defaultMonthlyBudget = 880;
  s.savings = { amount: 21730, date: start };
  s.tripStart = start; s.tripEnd = addDays(today, 40);
  s.rate = 20000;
  s.cashStart = { date: start, amountIDR: 300000, amountEUR: 50 };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const R = 20000;
  d.stays = [
    { id: uid(), name: 'Guesthouse Pererenan', place: 'Canggu', checkin: start, checkout: addDays(start, 14), total: 2800000, currency: 'IDR', rate: R, paid: true, updatedAt: now },
    { id: uid(), name: 'Villa rizières', place: 'Ubud', checkin: addDays(start, 14), checkout: addDays(start, 30), total: 180, currency: 'EUR', paid: true, updatedAt: now },
    { id: uid(), name: 'Bungalow plage', place: 'Amed', checkin: addDays(start, 33), checkout: addDays(start, 45), total: 3600000, currency: 'IDR', rate: R, paid: false, updatedAt: now },
  ];
  d.recurring = [
    { id: uid(), label: 'Claude', cat: 'pro', amount: 20, currency: 'EUR', freq: 'monthly', day: 12, start: addDays(start, -40), updatedAt: now },
    { id: uid(), label: 'iCloud 200 Go', cat: 'other', amount: 2.99, currency: 'EUR', freq: 'monthly', day: 18, start: addDays(start, -40), updatedAt: now },
  ];
  const meals = [['Warung nasi campur', 25000], ['Smoothie bowl', 50000], ['Café latte', 30000], ['Restaurant', 80000], ['Mie goreng', 20000], ['Poke bowl', 60000], ['GoFood', 45000], ['Nasi goreng', 20000]];
  for (let i = 0; i <= 20; i++) {
    const day = addDays(start, i);
    const add = (label, cat, amount, pay = 'cash', tip = 0) => d.expenses.push({ id: uid(), date: day, label, cat, amount, currency: 'IDR', rate: R, pay, tip, src: 'demo', createdAt: now, updatedAt: now });
    const n = 2 + (rnd() > .7 ? 1 : 0);
    for (let k = 0; k < n; k++) { const [l, a] = pick(meals); add(l, 'food', a + Math.round(rnd() * 2) * 5000, rnd() > .6 ? 'card' : 'cash', rnd() > .85 ? 5000 : 0); }
    if (rnd() > .3) add(pick(['Gojek', 'Grab']), 'transport', 15000 + Math.round(rnd() * 6) * 5000, 'card');
    if (rnd() > .5) add(pick(['Pepito', 'Supermarché', 'Eau']), 'groceries', 20000 + Math.round(rnd() * 10) * 10000);
    if (rnd() > .75) add(pick(['Massage', 'Salle de sport', 'Yoga', 'Beach club']), 'leisure', 100000 + Math.round(rnd() * 3) * 25000, 'cash', rnd() > .5 ? 20000 : 0);
    if (rnd() > .85) add(pick(['Vêtements', 'Souvenirs']), 'shopping', 100000 + Math.round(rnd() * 6) * 50000);
    if (rnd() > .8) add('Laundry', 'other', 40000);
    if (i === 1 || i === 7 || i === 13 || i === 18) d.cash.push({ id: uid(), date: day, type: 'withdraw', amountIDR: 3000000, feeIDR: 50000, updatedAt: now });
  }
  return d;
}
