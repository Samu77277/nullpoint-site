// @ts-check
import { defineConfig, envField } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // TODO: заменить на боевой домен (нужен для sitemap, canonical и OG)
  site: 'https://example.ru',

  integrations: [react(), mdx(), sitemap()],

  adapter: node({
    mode: 'standalone'
  }),

  env: {
    schema: {
      TELEGRAM_BOT_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      TELEGRAM_CHAT_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      SMARTCAPTCHA_SERVER_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      DB_PATH: envField.string({ context: 'server', access: 'secret', default: './data/leads.db' }),
      PUBLIC_SMARTCAPTCHA_SITEKEY: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_YM_ID: envField.string({ context: 'client', access: 'public', optional: true }),
    }
  },

  vite: {
    plugins: [tailwindcss()]
  }
});
