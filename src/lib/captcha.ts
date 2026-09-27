// Серверная проверка токена Yandex SmartCaptcha.
// Если SMARTCAPTCHA_SERVER_KEY не задан — проверка пропускается (удобно для локальной разработки).
import { SMARTCAPTCHA_SERVER_KEY as SERVER_KEY } from 'astro:env/server';

export async function verifyCaptcha(token: string | null, ip: string): Promise<boolean> {
  if (!SERVER_KEY) return true;
  if (!token) return false;

  const params = new URLSearchParams({ secret: SERVER_KEY, token, ip });
  try {
    const res = await fetch(`https://smartcaptcha.yandexcloud.net/validate?${params}`, {
      signal: AbortSignal.timeout(5_000),
    });
    const json = (await res.json()) as { status: string };
    return json.status === 'ok';
  } catch (e) {
    // Капча недоступна — пропускаем, чтобы не терять заявки; от спама остаются honeypot и rate limit.
    console.error('[captcha] ошибка проверки:', e);
    return true;
  }
}
