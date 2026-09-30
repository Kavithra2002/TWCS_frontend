/**
 * Demo mode is the default so the UI can be reviewed without Postgres or the API.
 * Set NEXT_PUBLIC_DATA_SOURCE=api to call the real backend again.
 */
export const USE_DEMO_DATA = process.env.NEXT_PUBLIC_DATA_SOURCE !== 'api';
