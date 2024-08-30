import express from "express";
import { webSocketUrl } from "../utils/globalVars";

const router = express.Router();

router.get("/", async (req: any, res) => {
  return res.send({ webSocketUrl });
});
export default router;
