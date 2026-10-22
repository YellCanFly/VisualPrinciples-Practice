import { defineConfig } from 'vite';
import { loadWeeks } from './scripts/lib.mjs';

export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1', port: Number(process.env.COURSE_PORT || 5173), strictPort: true,
    proxy: Object.fromEntries(loadWeeks().map(week => [
      `^/${week.id}(?:/|$)`, { target: `http://127.0.0.1:${week.port}`, ws: true },
    ])),
  },
});
