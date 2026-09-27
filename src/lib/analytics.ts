// Яндекс Метрика: загружается только после согласия на cookie.
import { PUBLIC_YM_ID } from 'astro:env/client';

declare global {
  interface Window {
    ym?: (id: number, method: string, ...args: unknown[]) => void;
  }
}

const CONSENT_KEY = 'cookie-consent';

export function getConsent(): 'accepted' | 'declined' | null {
  try {
    return localStorage.getItem(CONSENT_KEY) as 'accepted' | 'declined' | null;
  } catch {
    return null;
  }
}

export function setConsent(value: 'accepted' | 'declined') {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {}
}

export function loadMetrika() {
  if (!PUBLIC_YM_ID || window.ym) return;
  const id = Number(PUBLIC_YM_ID);
  const queue: unknown[][] = [];
  window.ym = (...args: unknown[]) => void queue.push(args);
  (window.ym as unknown as { a: unknown[][]; l: number }).a = queue;
  (window.ym as unknown as { a: unknown[][]; l: number }).l = Date.now();

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://mc.yandex.ru/metrika/tag.js';
  document.head.appendChild(script);

  window.ym(id, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
}

export function reachGoal(goal: string) {
  if (PUBLIC_YM_ID && window.ym) window.ym(Number(PUBLIC_YM_ID), 'reachGoal', goal);
}

// UTM-метки сохраняем при первом заходе, чтобы приложить к заявке.
const UTM_KEY = 'utm';

export function captureUtm() {
  const params = new URLSearchParams(location.search);
  const utm = [...params].filter(([k]) => k.startsWith('utm_'));
  if (!utm.length) return;
  try {
    sessionStorage.setItem(UTM_KEY, new URLSearchParams(utm).toString());
  } catch {}
}

export function getUtm(): string {
  try {
    return sessionStorage.getItem(UTM_KEY) ?? '';
  } catch {
    return '';
  }
}
