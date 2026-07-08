import { createClient } from "@supabase/supabase-js";
import { loadE2eSupabaseEnv } from "./supabase-env";

const organizationId = "00000000-0000-4000-8000-000000000001";
const permissions = [
  "perm.access_admin_panel",
  "perm.apply_discount",
  "perm.create_order",
  "perm.edit_order_locked",
  "perm.edit_price_book",
  "perm.manage_finance",
  "perm.manage_inventory",
  "perm.manage_users",
  "perm.refund_order",
  "perm.view_shift_report",
];

async function globalSetup() {
  const env = loadE2eSupabaseEnv();
  process.env.SUPABASE_URL = env.SUPABASE_URL;
  process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  }
  process.env.E2E_ADMIN_EMAIL ??= "admin@qc.local";
  process.env.E2E_ADMIN_PASSWORD ??= "123456";

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("Skipping E2E user bootstrap because SUPABASE_SERVICE_ROLE_KEY is not set.");
    return;
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  const userId = await ensureAuthUser(supabase, email, password);

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      organization_id: organizationId,
      display_name: "E2E Admin",
      status: "active",
    },
    { onConflict: "user_id" },
  );
  if (profileError !== null) throw profileError;

  const { error: deleteError } = await supabase.from("user_permissions").delete().eq("user_id", userId);
  if (deleteError !== null) throw deleteError;

  const { error: permissionError } = await supabase.from("user_permissions").insert(
    permissions.map((permission_code) => ({
      user_id: userId,
      permission_code,
      granted_by: userId,
    })),
  );
  if (permissionError !== null) throw permissionError;
}

async function ensureAuthUser(
  supabase: ReturnType<typeof createClient>,
  email: string,
  password: string,
): Promise<string> {
  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
  if (listError !== null) throw listError;

  const existing = existingUsers.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (existing !== undefined) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      email,
      password,
      email_confirm: true,
    });
    if (error !== null) throw error;
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error !== null) throw error;
  return data.user.id;
}

export default globalSetup;
