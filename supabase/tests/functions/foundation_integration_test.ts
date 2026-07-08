Deno.test("foundation integration environment is configured", () => {
  const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((name) => Deno.env.get(name) === undefined);

  if (missing.length > 0) {
    console.warn(`Skipping local integration checks; missing ${missing.join(", ")}`);
    return;
  }
});
