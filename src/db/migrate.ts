import { migrate } from "postgres-migrations";
import "dotenv/config";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL is required");
}

const url = new URL(dbUrl);

async function runMigrations() {
  await migrate(
    {
      host: url.hostname,
      port: parseInt(url.port || "5432"),
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
    },
    "./migrations"
  );
  console.log("Migrations complete");
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
