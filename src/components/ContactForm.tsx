import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { PUBLIC_SMARTCAPTCHA_SITEKEY } from 'astro:env/client';
import { leadSchema, validateFile, ALLOWED_FILE_EXT } from '../lib/lead-schema';
import { getUtm, reachGoal } from '../lib/analytics';

type Status = 'idle' | 'sending' | 'success' | 'error';
type FieldErrors = Partial<Record<'name' | 'contact' | 'message' | 'consent' | 'file', string>>;

interface SmartCaptcha {
  render(el: HTMLElement, opts: { sitekey: string; invisible: boolean; callback: (token: string) => void }): number;
  execute(id: number): void;
  reset(id: number): void;
}
declare global {
  interface Window {
    smartCaptcha?: SmartCaptcha;
    __onSmartCaptchaLoad?: () => void;
  }
}

// Невидимая Yandex SmartCaptcha. Без PUBLIC_SMARTCAPTCHA_SITEKEY форма работает без капчи.
function useSmartCaptcha() {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const resolver = useRef<((token: string) => void) | null>(null);

  useEffect(() => {
    if (!PUBLIC_SMARTCAPTCHA_SITEKEY || !container.current) return;
    window.__onSmartCaptchaLoad = () => {
      widgetId.current = window.smartCaptcha!.render(container.current!, {
        sitekey: PUBLIC_SMARTCAPTCHA_SITEKEY!,
        invisible: true,
        callback: (token) => resolver.current?.(token),
      });
    };
    const script = document.createElement('script');
    script.src = 'https://smartcaptcha.yandexcloud.net/captcha.js?render=onload&onload=__onSmartCaptchaLoad';
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  const getToken = (): Promise<string> => {
    const id = widgetId.current;
    if (!PUBLIC_SMARTCAPTCHA_SITEKEY || id === null || !window.smartCaptcha) return Promise.resolve('');
    return new Promise((resolve) => {
      resolver.current = resolve;
      window.smartCaptcha!.execute(id);
    });
  };

  const reset = () => {
    if (widgetId.current !== null) window.smartCaptcha?.reset(widgetId.current);
  };

  return { container, getToken, reset };
}

export default function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [fileName, setFileName] = useState('');
  const captcha = useSmartCaptcha();

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    const parsed = leadSchema.safeParse({
      name: data.get('name'),
      contact: data.get('contact'),
      message: data.get('message'),
      consent: data.get('consent') === 'on',
    });
    const fieldErrors: FieldErrors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as keyof FieldErrors] ??= issue.message;
    }
    const fileError = validateFile(data.get('file') as File | null);
    if (fileError) fieldErrors.file = fileError;

    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;

    setStatus('sending');
    setServerError('');
    try {
      data.set('captchaToken', await captcha.getToken());
      data.set('page', location.href);
      data.set('utm', getUtm());

      const res = await fetch('/api/lead', { method: 'POST', body: data });
      const body = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: FieldErrors };
      if (!res.ok) {
        setErrors(body.fieldErrors ?? {});
        throw new Error(body.error ?? 'Не удалось отправить заявку');
      }

      reachGoal('lead_submit');
      form.reset();
      setFileName('');
      setFileName('');
      setStatus('success');
    } catch (err) {
      // Данные формы не сбрасываются — пользователь может отправить повторно.
      setServerError(err instanceof Error ? err.message : 'Не удалось отправить заявку');
      setStatus('error');
    } finally {
      captcha.reset();
    }
  }

  if (status === 'success') {
    return (
      <div className="flex h-full min-h-96 flex-col items-start justify-center rounded-3xl border border-line bg-bg p-8 md:p-10" role="status">
        <span className="grid size-14 place-items-center rounded-full bg-accent text-2xl text-bg" aria-hidden="true">✓</span>
        <p className="mt-6 font-display text-2xl font-semibold">Заявка отправлена</p>
        <p className="mt-2 text-muted">Мы свяжемся с вами в течение рабочего дня.</p>
        <button className="btn-ghost mt-8 !py-2 !text-sm" onClick={() => setStatus('idle')}>
          Отправить ещё одну
        </button>
      </div>
    );
  }

  const err = (name: keyof FieldErrors) =>
    errors[name] ? (
      <p id={`${name}-error`} className="mt-1.5 text-sm text-red-400">
        {errors[name]}
      </p>
    ) : null;
  const a11y = (name: keyof FieldErrors) => ({
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });
  const label = 'mb-2 block text-sm text-muted';

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-3xl border border-line bg-bg p-6 md:p-10">
      {/* Honeypot: скрыт от людей, боты заполняют */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
        <label>
          Сайт <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={label}>Имя *</label>
          <input id="name" name="name" autoComplete="name" placeholder="Как к вам обращаться" className="field" {...a11y('name')} />
          {err('name')}
        </div>
        <div>
          <label htmlFor="contact" className={label}>Телефон, email или Telegram *</label>
          <input id="contact" name="contact" placeholder="+7…, mail@…, @username" className="field" {...a11y('contact')} />
          {err('contact')}
        </div>
      </div>

      <div>
        <label htmlFor="message" className={label}>О проекте</label>
        <textarea
          id="message"
          name="message"
          rows={4}
          placeholder="Что хотите сделать, какие сроки, что уже есть"
          className="field resize-y"
          {...a11y('message')}
        />
        {err('message')}
      </div>

      <div>
        <label
          htmlFor="file"
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm text-muted transition-colors hover:border-accent hover:text-fg"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7" />
          </svg>
          <span className="min-w-0 truncate">{fileName || 'Прикрепить ТЗ или презентацию (pdf, doc, png, jpg — до 10 МБ)'}</span>
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept={ALLOWED_FILE_EXT.map((e) => `.${e}`).join(',')}
          className="sr-only"
          onChange={(e) => setFileName(e.currentTarget.files?.[0]?.name ?? '')}
          {...a11y('file')}
        />
        {err('file')}
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-muted">
          <input type="checkbox" name="consent" className="mt-0.5 size-4 shrink-0 accent-accent" {...a11y('consent')} />
          <span>
            Даю{' '}
            <a href="/privacy" target="_blank" className="text-fg underline underline-offset-2">
              согласие на обработку персональных данных
            </a>
            , включая их трансграничную передачу
          </span>
        </label>
        {err('consent')}
      </div>

      <div ref={captcha.container} />

      {status === 'error' && serverError && (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300" role="alert">
          {serverError}
        </p>
      )}

      <button type="submit" className="btn-primary w-full !py-4" disabled={status === 'sending'}>
        {status === 'sending' ? 'Отправляем…' : 'Отправить заявку →'}
      </button>
    </form>
  );
}
