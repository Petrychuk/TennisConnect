import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export const supabaseAdmin = createClient(
env.SUPABASE_URL,
env.SUPABASE_SERVICE_ROLE_KEY,
{
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
console.log(
  "SUPABASE ADMIN KEY START:",
  env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 15)
);