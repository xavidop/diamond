// @ts-check
import { defineConfig } from 'astro/config';

// Served from a custom domain (public/CNAME), so base stays at '/'.
export default defineConfig({
  site: 'https://diamond.xavidop.me',
});
