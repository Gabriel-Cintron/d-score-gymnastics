import type { ThemeColors, ThemeMode } from './theme';

export function applyBrowserShellTheme(
  targetDocument: Document,
  mode: ThemeMode,
  colors: Pick<ThemeColors, 'background' | 'muted'>,
): void {
  const backgroundTargets = [
    targetDocument.documentElement,
    targetDocument.body,
    targetDocument.getElementById('root'),
  ];

  targetDocument.documentElement.setAttribute('data-theme', mode);
  targetDocument.documentElement.style.colorScheme = mode;
  targetDocument.documentElement.style.setProperty('--d-score-background', colors.background);
  targetDocument.documentElement.style.setProperty('--d-score-scrollbar', colors.muted);

  for (const target of backgroundTargets) {
    if (target !== null) target.style.backgroundColor = colors.background;
  }

  const themeColor = findOrCreateMeta(targetDocument, 'theme-color');
  themeColor.setAttribute('content', colors.background);

  const statusBar = findOrCreateMeta(targetDocument, 'apple-mobile-web-app-status-bar-style');
  statusBar.setAttribute('content', mode === 'dark' ? 'black-translucent' : 'default');
}

function findOrCreateMeta(targetDocument: Document, name: string): HTMLMetaElement {
  const existing = targetDocument.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (existing !== null) return existing;

  const meta = targetDocument.createElement('meta');
  meta.setAttribute('name', name);
  targetDocument.head.append(meta);
  return meta;
}
