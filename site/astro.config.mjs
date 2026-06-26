// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Served from a custom domain (public/CNAME), so base stays at '/'.
// `site` is required for the sitemap to emit absolute URLs.
export default defineConfig({
  site: 'https://diamond.xavidop.me',
  integrations: [sitemap()],
});
