import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const screenshotDirectory = resolve(repositoryRoot, 'release/app-store/screenshots');
const rawDirectory = resolve(screenshotDirectory, 'raw');

const screens = [
  {
    accent: '#2563eb',
    file: '01-home.png',
    subtitle: ['Six-event all-arounds and individual routines', 'stay one tap away.'],
    title: 'Start with any event',
  },
  {
    accent: '#0f766e',
    file: '02-build-floor.png',
    subtitle: ['Search 738 elements and add only the skills', 'you plan to count.'],
    title: 'Build routines faster',
  },
  {
    accent: '#7c3aed',
    file: '03-score-breakdown.png',
    subtitle: ['Live explanations show difficulty, groups,', 'connections, and exclusions.'],
    title: 'Understand every tenth',
  },
  {
    accent: '#c2410c',
    file: '04-pommel-flops.png',
    subtitle: ['Build valid Flop and Combined sequences', 'one component at a time.'],
    title: 'Pommel sequences, made clear',
  },
  {
    accent: '#2563eb',
    file: '05-save-and-settings.png',
    subtitle: ['Save locally, switch themes, and export', 'a backup whenever you choose.'],
    title: 'Private by design',
  },
];

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

await mkdir(screenshotDirectory, { recursive: true });
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'd-score-store-'));

try {
  for (const screen of screens) {
    const rawPath = resolve(rawDirectory, screen.file);
    await readFile(rawPath);
    const framePath = resolve(temporaryDirectory, `${screen.file}.svg`);
    const outputPath = resolve(screenshotDirectory, screen.file);
    const [firstSubtitle, secondSubtitle] = screen.subtitle.map(escapeXml);
    const frame = `<svg xmlns="http://www.w3.org/2000/svg" width="1320" height="2868" viewBox="0 0 1320 2868">
  <rect width="1320" height="2868" fill="#f5f7fb"/>
  <circle cx="1210" cy="110" r="320" fill="${screen.accent}" opacity="0.09"/>
  <rect x="70" y="66" width="54" height="54" rx="16" fill="${screen.accent}"/>
  <text x="97" y="105" fill="#ffffff" font-family="DejaVu Sans, sans-serif" font-size="31" font-weight="700" text-anchor="middle">D</text>
  <text x="144" y="101" fill="#15223b" font-family="DejaVu Sans, sans-serif" font-size="27" font-weight="700">D-Score Gymnastics</text>
  <text x="70" y="226" fill="#15223b" font-family="DejaVu Sans, sans-serif" font-size="62" font-weight="700">${escapeXml(screen.title)}</text>
  <text x="72" y="304" fill="#5d6b82" font-family="DejaVu Sans, sans-serif" font-size="28">${firstSubtitle}</text>
  <text x="72" y="346" fill="#5d6b82" font-family="DejaVu Sans, sans-serif" font-size="28">${secondSubtitle}</text>
  <rect x="139" y="460" width="1042" height="2292" rx="58" fill="#0c1629" opacity="0.13"/>
  <rect x="151" y="472" width="1018" height="2268" rx="50" fill="#ffffff" stroke="#d7deea" stroke-width="3"/>
</svg>`;
    await writeFile(framePath, frame, 'utf8');

    const result = spawnSync(
      'magick',
      [
        '-background',
        '#f5f7fb',
        framePath,
        '(',
        rawPath,
        '-resize',
        '966x2100!',
        ')',
        '-geometry',
        '+177+520',
        '-composite',
        '-alpha',
        'remove',
        '-alpha',
        'off',
        '-colorspace',
        'sRGB',
        '-depth',
        '8',
        '-strip',
        `PNG24:${outputPath}`,
      ],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) {
      throw new Error(`Unable to compose ${screen.file}: ${result.stderr || result.stdout}`);
    }
    await rm(rawPath, { force: true });
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}

globalThis.process.stdout.write(`Generated ${screens.length} polished App Store screenshots.\n`);
