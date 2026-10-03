import { defineConfig } from 'vite';

const sha = process.env.GITHUB_SHA ?? 'local';
const branch = process.env.GITHUB_REF_NAME ?? 'local';

export default defineConfig({
  base: './',
  define: {
    __BUILD_SHA__: JSON.stringify(sha),
    __BUILD_BRANCH__: JSON.stringify(branch),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  test: { include: ['tests/**/*.test.ts'] },
});
