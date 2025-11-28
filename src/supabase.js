import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://hqedmiahciehjixmigcw.supabase.co";
const supabaseAnonKey = "sb_publishable_lbRRyBda6hix1Q8YNAA1og_gMDAUpFF";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
