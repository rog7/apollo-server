// import mongoose from "mongoose";
// import config from "config";

// export function initializeDB(winston: any) {
//   // const db = config.get("db") as string;
//   mongoose.set("strictQuery", true);

//   if (process.env.NODE_ENV === "production") {
//     mongoose.connect(process.env.APOLLO_PROD_DB as string).then(() => {
//       winston.info(`Connected to production database`);
//     });
//   } else {
//     mongoose.connect(process.env.APOLLO_DEV_DB as string).then(() => {
//       winston.info(`Connected to development database`);
//     });
//   }
// }

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../utils/globalVars";

// Create a single supabase client for interacting with your database
export const supabase = createClient(
  SUPABASE_URL as string,
  SUPABASE_KEY as string
);
