/** Native intentionally remains a no-op until its separate release work resumes. */
export { createSearchTracker } from './telemetry-search';
export const telemetry = {
  available: false,
  async invitation() {
    return false;
  },
  async dismissInvitation() {
    return undefined;
  },
  subscribe(_listener: () => void) {
    void _listener;
    return () => undefined;
  },
  async consent() {
    return { usage: false, search: false, owner: false };
  },
  async setConsent(_consent: { usage: boolean; search: boolean; owner: boolean }) {
    void _consent;
  },
  async erase() {
    return undefined;
  },
  async search(_event: unknown) {
    void _event;
  },
  async selected(_event: unknown) {
    void _event;
  },
  start() {
    return () => undefined;
  },
};
