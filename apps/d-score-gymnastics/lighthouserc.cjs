// eslint-disable-next-line no-undef
module.exports = {
  ci: {
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    collect: {
      numberOfRuns: 1,
      settings: { preset: 'desktop' },
      startServerCommand:
        globalThis.process.env.DSCORE_USE_EXISTING_BUILD === '1'
          ? 'pnpm serve:web'
          : 'pnpm export:web && pnpm serve:web',
      startServerReadyPattern: 'http://localhost:4173',
      url: ['http://localhost:4173/', 'http://localhost:4173/app/'],
    },
    upload: {
      outputDir: './.lighthouseci',
      target: 'filesystem',
    },
  },
};
