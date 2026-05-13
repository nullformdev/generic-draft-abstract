/**
 * config.ts — reads process.env (populated via --env-file flag).
 *
 * Node.js startup:
 *   node --env-file=.env --experimental-sqlite src/server.ts
 *
 * All values must be set in .env — defaults live there, not here.
 */

export interface Config {
  // HTTP server
  PORT: number;
  HOST: string;
  DOMAIN: string;

  // Database
  DB_PATH: string;

  // Auth
  INVITE_CODE: string;
  SESSION_MAX_AGE: number;

  // i18n
  DEFAULT_LANG: string;
}

export const config: Config = {
  PORT: parseInt(process.env.PORT ?? '', 10),
  HOST: process.env.HOST ?? '',
  DOMAIN: process.env.DOMAIN ?? '',

  DB_PATH: process.env.DB_PATH ?? '',

  INVITE_CODE: process.env.INVITE_CODE ?? '',
  SESSION_MAX_AGE: parseInt(process.env.SESSION_MAX_AGE ?? '', 10),

  DEFAULT_LANG: process.env.DEFAULT_LANG ?? '',
};

const required = [
  'PORT',
  'HOST',
  'DOMAIN',
  'DB_PATH',
  'INVITE_CODE',
  'SESSION_MAX_AGE',
  'DEFAULT_LANG',
] as const;

for (const key of required) {
  if (!config[key]) throw new Error(`${key} is not set in .env`);
}
