import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const cases = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/cases' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    client: z.string(),
    industry: z.string(),
    year: z.number(),
    duration: z.string(),
    team: z.string(),
    stack: z.array(z.string()),
    results: z.array(z.object({ value: z.string(), label: z.string() })),
    // Тип абстрактной обложки, пока нет реальных скриншотов
    cover: z.enum(['dashboard', 'chart', 'profile', 'chat']).default('dashboard'),
    testimonial: z.object({ text: z.string(), author: z.string(), role: z.string() }).optional(),
    order: z.number().default(100),
  }),
});

export const collections = { cases };
