import { describe, expect, it } from 'vitest';

import { createStoredAppPreferences, parseStoredAppPreferences } from './app-preferences';

describe('app preferences', () => {
  it('round-trips onboarding completion', () => {
    expect(
      parseStoredAppPreferences(createStoredAppPreferences({ onboardingComplete: true })),
    ).toEqual({ onboardingComplete: true });
  });

  it('rejects malformed preferences', () => {
    expect(
      parseStoredAppPreferences({ onboardingComplete: 'yes', schemaVersion: 1 }),
    ).toBeUndefined();
    expect(
      parseStoredAppPreferences({ onboardingComplete: true, schemaVersion: 2 }),
    ).toBeUndefined();
  });
});
