import { supabase } from "../startup/db";

export function attachSupabase(req: any, res: any, next: any) {
  req.supabase = supabase; // Attach the supabase instance to the request object
  next(); // Call the next middleware or route handler
}
