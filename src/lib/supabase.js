import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://vnhupxlvexlkgxhntdrs.supabase.co";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuaHVweGx2ZXhsa2d4aG50ZHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTYwNTUsImV4cCI6MjEwMjM3MjA1NX0.p3_VLWqlS2gO-1OE4D8wD8lvhtepUf5cfnr_LRzeXoU";

export const supabase = createClient(url, anon);
