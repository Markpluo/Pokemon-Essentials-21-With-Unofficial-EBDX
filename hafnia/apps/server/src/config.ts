// Server settings, all from environment variables (see README.md, "Online server").
export const config = {
  port: Number(process.env.PORT ?? 8787),
  /** Postgres connection string (Supabase: Project settings > Database > Connection string, "Session pooler"). Without it, a JSON file is used. */
  databaseUrl: process.env.DATABASE_URL ?? '',
  /** Where the dev store keeps its JSON file when there is no database. */
  dataFile: process.env.DATA_FILE ?? '.data/online.json',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  jwtSecret: process.env.SUPABASE_JWT_SECRET ?? '',
  devAuth: process.env.DEV_AUTH === '1',
  /** Comma-separated emails that are admins and need no invite code. */
  admins: (process.env.ADMIN_EMAILS ?? '').split(',').map(s => s.trim()).filter(Boolean),
  /** Comma-separated origins allowed to connect (the client's site). Empty allows any (development). */
  origins: (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean),
  maxPlayers: Number(process.env.MAX_PLAYERS ?? 200)
};
