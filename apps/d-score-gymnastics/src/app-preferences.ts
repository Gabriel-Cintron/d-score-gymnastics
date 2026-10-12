export const APP_PREFERENCES_SCHEMA_VERSION = 1;

export interface AppPreferences {
  readonly onboardingComplete: boolean;
}

export interface StoredAppPreferences extends AppPreferences {
  readonly schemaVersion: typeof APP_PREFERENCES_SCHEMA_VERSION;
}

export const defaultAppPreferences: AppPreferences = {
  onboardingComplete: false,
};

export function createStoredAppPreferences(preferences: AppPreferences): StoredAppPreferences {
  return {
    ...preferences,
    schemaVersion: APP_PREFERENCES_SCHEMA_VERSION,
  };
}

export function parseStoredAppPreferences(value: unknown): AppPreferences | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion !== APP_PREFERENCES_SCHEMA_VERSION ||
    typeof record.onboardingComplete !== 'boolean'
  ) {
    return undefined;
  }
  return { onboardingComplete: record.onboardingComplete };
}
