export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
export function sum(arr, f) { let s = 0; for (const x of arr) s += f(x); return s; }
export function smooth(cur, target, k) { return cur + (target - cur) * k; }
