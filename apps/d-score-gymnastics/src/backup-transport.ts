import { Platform, Share } from 'react-native';

import { MAX_BACKUP_CHARACTERS } from './backup';
import { PRODUCT_NAME, PRODUCT_ID } from './product';

export async function exportBackupText(text: string): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = backupFilename(new Date());
    link.href = url;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return;
  }

  await Share.share({
    message: text,
    title: `${PRODUCT_NAME} backup`,
  });
}

export function chooseBackupTextFile(): Promise<string | undefined> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    let settled = false;
    const finish = (value: string | undefined) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    input.accept = 'application/json,.json';
    input.type = 'file';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file === undefined) {
        finish(undefined);
        return;
      }
      if (file.size > MAX_BACKUP_CHARACTERS * 4) {
        settled = true;
        reject(new Error(`That backup file is too large to be a ${PRODUCT_NAME} backup.`));
        return;
      }
      void file.text().then(finish, reject);
    };
    input.addEventListener('cancel', () => finish(undefined));
    globalThis.addEventListener?.(
      'focus',
      () => {
        setTimeout(() => {
          if (input.files?.[0] === undefined) finish(undefined);
        }, 0);
      },
      { once: true },
    );
    input.click();
  });
}

export function backupFilename(date: Date): string {
  const day = date.toISOString().slice(0, 10);
  return `${PRODUCT_ID}-backup-${day}.json`;
}
