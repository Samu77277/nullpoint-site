// Общая схема заявки: используется и в форме (клиент), и в API (сервер).
import { z } from 'zod';

const phoneRe = /^\+?[\d\s()-]{10,20}$/;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const telegramRe = /^@[a-zA-Z0-9_]{5,32}$/;

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const ALLOWED_FILE_EXT = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'];

export const leadSchema = z.object({
  name: z.string().trim().min(2, 'Укажите имя').max(100),
  contact: z
    .string()
    .trim()
    .refine((v) => phoneRe.test(v) || emailRe.test(v) || telegramRe.test(v), {
      message: 'Телефон, email или @username в Telegram',
    }),
  message: z.string().trim().max(3000, 'Не больше 3000 символов').optional().default(''),
  consent: z.literal(true, { message: 'Нужно согласие на обработку данных' }),
});

export type Lead = z.infer<typeof leadSchema>;

export function validateFile(file: File | null | undefined): string | null {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_FILE_SIZE) return 'Файл больше 10 МБ';
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_FILE_EXT.includes(ext)) return 'Допустимые форматы: pdf, doc, docx, png, jpg';
  return null;
}
