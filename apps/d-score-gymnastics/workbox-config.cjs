// eslint-disable-next-line no-undef
module.exports = {
  cleanupOutdatedCaches: true,
  clientsClaim: false,
  globDirectory: 'dist',
  globPatterns: ['**/*.{css,html,ico,js,json,png,svg,ttf,woff,woff2}'],
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
  navigateFallback: '/app/index.html',
  skipWaiting: false,
  swDest: 'dist/sw.js',
};
