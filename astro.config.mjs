// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://gfsleme.github.io/stronglog-pro/',
  output: 'static',
  build: {
    format: 'file',
  },
});
