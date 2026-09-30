import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.production");

if (!existsSync(envPath)) {
  console.error("Missing .env.production. Copy env.production.example and fill Supabase production values first.");
  process.exit(1);
}

const raw = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return index === -1 ? [line, ""] : [line.slice(0, index), line.slice(index + 1)];
    }),
);

const url = env.VITE_SUPABASE_URL || "";
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

if (!url || !key) {
  console.error("VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required in .env.production.");
  process.exit(1);
}

if (/127\.0\.0\.1|localhost|54321/i.test(url)) {
  console.error("Production build blocked: VITE_SUPABASE_URL still points to local Supabase.");
  process.exit(1);
}

if (!/^https:\/\/.+\.supabase\.co$/i.test(url)) {
  console.warn("Warning: VITE_SUPABASE_URL does not look like a Supabase Cloud URL. Continuing anyway.");
}

console.log("Production env looks ready.");
