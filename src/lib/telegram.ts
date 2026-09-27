// Доставка заявок в Telegram + ретраи недоставленных.
import { readFile } from 'node:fs/promises';
import { TELEGRAM_BOT_TOKEN as TOKEN, TELEGRAM_CHAT_ID as CHAT_ID } from 'astro:env/server';
import { getLead, getUndelivered, markDelivered, markFailed, type LeadRow } from './db';

const API = `https://api.telegram.org/bot${TOKEN}`;

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function formatLead(lead: LeadRow): string {
  const lines = [
    `<b>Новая заявка #${lead.id}</b>`,
    '',
    `<b>Имя:</b> ${escape(lead.name)}`,
    `<b>Контакт:</b> ${escape(lead.contact)}`,
  ];
  if (lead.message) lines.push('', escape(lead.message));
  lines.push('');
  if (lead.source_page) lines.push(`Страница: ${escape(lead.source_page)}`);
  if (lead.utm) lines.push(`UTM: ${escape(lead.utm)}`);
  lines.push(`Время: ${lead.created_at} UTC`);
  return lines.join('\n');
}

async function call(method: string, body: FormData | object) {
  const isForm = body instanceof FormData;
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json()) as { ok: boolean; description?: string };
  if (!json.ok) throw new Error(json.description ?? `Telegram ${method} failed`);
}

async function send(lead: LeadRow) {
  if (!TOKEN || !CHAT_ID) throw new Error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID не заданы');

  await call('sendMessage', { chat_id: CHAT_ID, text: formatLead(lead), parse_mode: 'HTML' });

  if (lead.file_path) {
    const form = new FormData();
    form.set('chat_id', CHAT_ID);
    form.set('caption', `Вложение к заявке #${lead.id}`);
    form.set('document', new Blob([await readFile(lead.file_path)]), lead.file_name ?? 'file');
    await call('sendDocument', form);
  }
}

export async function deliverLead(id: number): Promise<boolean> {
  const lead = getLead(id);
  if (!lead) return false;
  try {
    await send(lead);
    markDelivered(id);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    markFailed(id, msg);
    console.error(`[lead #${id}] доставка в Telegram не удалась: ${msg}`);
    return false;
  }
}

async function retryUndelivered() {
  for (const lead of getUndelivered()) await deliverLead(lead.id);
}

// Фоновый ретрай раз в 5 минут. Запускается при первом обращении к модулю.
let retryTimer: NodeJS.Timeout | undefined;
export function ensureRetryLoop() {
  if (retryTimer) return;
  retryTimer = setInterval(() => void retryUndelivered(), 5 * 60 * 1000);
  retryTimer.unref();
}
