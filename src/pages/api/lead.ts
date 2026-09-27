import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { leadSchema, validateFile } from '../../lib/lead-schema';
import { insertLead, UPLOADS_DIR } from '../../lib/db';
import { deliverLead, ensureRetryLoop } from '../../lib/telegram';
import { verifyCaptcha } from '../../lib/captcha';
import { isRateLimited } from '../../lib/rate-limit';

export const prerender = false;

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  ensureRetryLoop();
  const ip = request.headers.get('x-real-ip') ?? clientAddress;

  if (isRateLimited(ip)) return json(429, { error: 'Слишком много заявок. Попробуйте позже.' });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: 'Некорректный запрос' });
  }

  // Honeypot: людям поле не видно, боты его заполняют. Отвечаем «успехом», чтобы не подсказывать.
  if (form.get('website')) return json(200, { ok: true });

  if (!(await verifyCaptcha(form.get('captchaToken') as string | null, ip))) {
    return json(400, { error: 'Проверка на робота не пройдена. Обновите страницу и попробуйте снова.' });
  }

  const parsed = leadSchema.safeParse({
    name: form.get('name'),
    contact: form.get('contact'),
    message: form.get('message') ?? undefined,
    budget: form.get('budget') ?? undefined,
    consent: form.get('consent') === 'on',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return json(422, { error: 'Проверьте поля формы', fieldErrors });
  }

  const file = form.get('file');
  const upload = file instanceof File && file.size > 0 ? file : null;
  const fileError = validateFile(upload);
  if (fileError) return json(422, { error: fileError, fieldErrors: { file: fileError } });

  let filePath: string | null = null;
  if (upload) {
    filePath = join(UPLOADS_DIR, `${randomUUID()}${extname(upload.name).toLowerCase()}`);
    await writeFile(filePath, Buffer.from(await upload.arrayBuffer()));
  }

  const id = insertLead({
    ...parsed.data,
    file_path: filePath,
    file_name: upload?.name ?? null,
    source_page: (form.get('page') as string | null)?.slice(0, 500) ?? null,
    utm: (form.get('utm') as string | null)?.slice(0, 1000) || null,
    ip,
  });

  // Заявка уже сохранена — даже если Telegram недоступен, её доставит фоновый ретрай.
  await deliverLead(id);

  return json(200, { ok: true });
};
