import express from "express";
import initializeRoutes from "./startup/routes";
import winston from "winston";
import cors from "cors";
import compression from "compression";
import { attachSupabase } from "./middleware/supabase";
import bodyParser from "body-parser";

const app = express();
app.use(
  cors({
    exposedHeaders: [
      "Authorization",
      "Refresh-Token-Id",
      "RateLimit-Remaining",
      "RateLimit-Reset",
    ],
  })
);
app.use(compression());

// Attach the supabase instance to all routes
app.use(attachSupabase);
app.use(bodyParser.json({ limit: "50mb" }));

initializeRoutes(app, express);

const port = process.env.PORT || 3000;
export const server = app.listen(port, () => {
  winston.info(`Listening on port ${port}...`);
});
