import { execFileSync } from "node:child_process";

async function globalSetup() {
  process.env.E2E_ADMIN_EMAIL ??= "admin@qc.local";
  process.env.E2E_ADMIN_PASSWORD ??= "123456";
  process.env.ADMIN_EMAIL ??= process.env.E2E_ADMIN_EMAIL;
  process.env.ADMIN_PASSWORD ??= process.env.E2E_ADMIN_PASSWORD;
  process.env.ADMIN_NAME ??= "E2E Admin";

  execFileSync("npm", ["run", "db:migrate"], {
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

export default globalSetup;
