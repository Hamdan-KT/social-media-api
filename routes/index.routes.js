import express from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import postRoutes from "./post.routes.js";
import adminRoutes from "./admin.routes.js";
import commentRoutes from "./comment.routes.js";
import messageRoutes from "./message.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/post", postRoutes);
router.use("/admin", adminRoutes);
router.use("/comment", commentRoutes);
router.use("/message", messageRoutes);

export default router;
