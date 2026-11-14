
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://jzettznrqgblnroiscic.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_yqZSRV1umjBcBxdyzbvxMQ_Ot_ZzSxl";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);