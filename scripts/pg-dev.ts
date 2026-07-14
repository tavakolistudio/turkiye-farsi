/**
 * Local development PostgreSQL, powered by embedded-postgres.
 *
 * Provisions a real PostgreSQL server (no Docker / no admin rights) whose
 * connection string is a standard `postgresql://` URL — identical in shape to
 * Supabase, so migrating to Supabase later is only an env change.
 *
 *   npm run db:start   # initialise (first run) + start, then exit (server stays up)
 *   npm run db:stop    # stop the server
 *
 * Data lives in ./.pgdata (git-ignored). Credentials/port come from env with
 * dev-only fallbacks; production uses Supabase and never runs this script.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), ".pgdata");
const PORT = Number(process.env.PG_DEV_PORT ?? 54329);
const USER = process.env.PG_DEV_USER ?? "postgres";
const PASSWORD = process.env.PG_DEV_PASSWORD ?? "postgres";
const DB_NAME = process.env.PG_DEV_DB ?? "turkiye_farsi";

function makeServer() {
  return new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    // Force UTF8 so Persian/Arabic text is storable regardless of OS locale.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });
}

async function start() {
  const pg = makeServer();
  const firstRun = !existsSync(path.join(DATA_DIR, "PG_VERSION"));

  if (firstRun) {
    console.log("• Initialising a fresh PostgreSQL cluster in .pgdata ...");
    await pg.initialise();
  }

  console.log(`• Starting PostgreSQL on port ${PORT} ...`);
  await pg.start();

  // createDatabase throws if it already exists — ignore that case.
  try {
    await pg.createDatabase(DB_NAME);
    console.log(`• Created database "${DB_NAME}".`);
  } catch {
    console.log(`• Database "${DB_NAME}" already exists.`);
  }

  console.log(
    `\n✓ PostgreSQL is running.\n  DATABASE_URL=postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB_NAME}\n`,
  );

  // embedded-postgres runs the server as a child of this process, so we must
  // stay alive to keep it up. Keep the script running until interrupted.
  const shutdown = async () => {
    console.log("\n• Stopping PostgreSQL ...");
    try {
      await pg.stop();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  console.log("(server stays up while this process runs — Ctrl+C to stop)");
  // Block forever.
  await new Promise(() => {});
}

async function stop() {
  const pg = makeServer();
  try {
    await pg.stop();
    console.log("✓ PostgreSQL stopped.");
  } catch (err) {
    console.error("Could not stop PostgreSQL (is it running?):", err);
  }
  process.exit(0);
}

const cmd = process.argv[2];
if (cmd === "start") void start();
else if (cmd === "stop") void stop();
else {
  console.error("Usage: tsx scripts/pg-dev.ts <start|stop>");
  process.exit(1);
}
