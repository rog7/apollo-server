import express from "express";
import initializeRoutes from "./startup/routes";
import winston from "winston";
import { initializeDB } from "./startup/db";
import cors from "cors";
import compression from "compression";

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
initializeRoutes(app, express);
initializeDB(winston);

const port = process.env.PORT || 3000;
export const server = app.listen(port, () => {
  winston.info(`Listening on port ${port}...`);
});
