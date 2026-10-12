import { describe, expect, it } from 'vitest';

import { applyBrowserShellTheme } from './browser-shell';

interface FakeElement {
  readonly attributes: Map<string, string>;
  readonly style: {
    backgroundColor: string;
    colorScheme: string;
    readonly properties: Map<string, string>;
    setProperty(name: string, value: string): void;
  };
  setAttribute(name: string, value: string): void;
}

function element(): FakeElement {
  return {
    attributes: new Map(),
    setAttribute(name, value) {
      this.attributes.set(name, value);
    },
    style: {
      backgroundColor: '',
      colorScheme: '',
      properties: new Map(),
      setProperty(name, value) {
        this.properties.set(name, value);
      },
    },
  };
}

function fakeDocument() {
  const documentElement = element();
  const body = element();
  const root = element();
  const metas: FakeElement[] = [];
  const document = {
    body,
    createElement: () => element(),
    documentElement,
    getElementById: (id: string) => (id === 'root' ? root : null),
    head: {
      append(meta: FakeElement) {
        metas.push(meta);
      },
    },
    querySelector(selector: string) {
      const name = /meta\[name="([^"]+)"\]/.exec(selector)?.[1];
      return metas.find((meta) => meta.attributes.get('name') === name) ?? null;
    },
  };

  return { body, document: document as unknown as Document, documentElement, metas, root };
}

describe('browser shell theme', () => {
  it('applies the active theme to the document, root, and browser chrome metadata', () => {
    const target = fakeDocument();

    applyBrowserShellTheme(target.document, 'dark', {
      background: '#0b1120',
      muted: '#94a3b8',
    });

    expect(target.documentElement.attributes.get('data-theme')).toBe('dark');
    expect(target.documentElement.style.colorScheme).toBe('dark');
    expect(target.documentElement.style.properties.get('--d-score-background')).toBe('#0b1120');
    expect(target.documentElement.style.properties.get('--d-score-scrollbar')).toBe('#94a3b8');
    expect(target.documentElement.style.backgroundColor).toBe('#0b1120');
    expect(target.body.style.backgroundColor).toBe('#0b1120');
    expect(target.root.style.backgroundColor).toBe('#0b1120');
    expect(target.metas).toHaveLength(2);
    expect(target.metas[0]?.attributes.get('content')).toBe('#0b1120');
    expect(target.metas[1]?.attributes.get('content')).toBe('black-translucent');
  });

  it('reuses metadata when the user changes themes', () => {
    const target = fakeDocument();

    applyBrowserShellTheme(target.document, 'dark', {
      background: '#0b1120',
      muted: '#94a3b8',
    });
    applyBrowserShellTheme(target.document, 'light', {
      background: '#f4f6f8',
      muted: '#667085',
    });

    expect(target.metas).toHaveLength(2);
    expect(target.metas[0]?.attributes.get('content')).toBe('#f4f6f8');
    expect(target.metas[1]?.attributes.get('content')).toBe('default');
  });
});
