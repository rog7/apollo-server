import users from "../routes/users";
import auth from "../routes/auth";
import posts from "../routes/posts";
import socket from "../routes/socket";

export default function initializeRoutes(app: any, express: any) {
  app.use(express.json());
  app.use("/api/users", users);
  app.use("/api/auth", auth);
  app.use("/api/posts", posts);
  app.use("/api/socket", socket);
}
