import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");

describe("CI workflow", () => {
  test("replays Supabase migrations and pgTAP tests before function tests", () => {
    const supabaseStart = ciWorkflow.indexOf("npm run supabase:start");
    const migrationReset = ciWorkflow.indexOf("npm run supabase:reset");
    const dbTests = ciWorkflow.indexOf("npm run test:db");
    const functionTests = ciWorkflow.indexOf("npm run test:functions");

    expect(supabaseStart).toBeGreaterThan(-1);
    expect(migrationReset).toBeGreaterThan(supabaseStart);
    expect(migrationReset).toBeGreaterThan(-1);
    expect(dbTests).toBeGreaterThan(migrationReset);
    expect(functionTests).toBeGreaterThan(dbTests);
  });
});
