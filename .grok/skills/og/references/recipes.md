# Recipes

Stage each asset outside the shipped public dir, then hand over atomically:

- card: `node scripts/write-atomic.mjs /workspace/.staging/og.jpg /workspace/public/og.jpg`
- banner: `node scripts/write-atomic.mjs /workspace/.staging/x-banner.jpg /workspace/public/x-banner.jpg`
- contract: `node scripts/write-atomic.mjs /workspace/.staging/site.json /workspace/src/lib/og/site.json`
