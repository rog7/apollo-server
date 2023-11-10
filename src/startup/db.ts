import mongoose from "mongoose";
import config from "config";

export function initializeDB(winston: any) {
  // const db = config.get("db") as string;
  mongoose.set("strictQuery", true);

  if (process.env.NODE_ENV === "production") {
    mongoose.connect(process.env.PROD_DB as string).then(() => {
      winston.info(`Connected to production database`);
    });
  } else {
    mongoose.connect(process.env.DEV_DB as string).then(() => {
      winston.info(`Connected to development database`);
    });
  }
}
