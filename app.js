import express from "express";
import cors from "cors";
import morgan from "morgan";
import "./config/passport.js";
import dotenv from "dotenv";
import chalk from "chalk";
dotenv.config();
// routes imoport
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import postRoutes from "./routes/post.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import commentRoutes from "./routes/comment.routes.js";
import passport from "passport";
import cookieParser from "cookie-parser";
import { Database } from "./config/database.js";
import { ApiError } from "./utils/ApiError.js";


const app = express();
const PORT = process.env.PORT || 4000;

// db connection
const db = new Database(process.env.MONGO_URI);
db.connect();

// middlewares
app.use(
	cors({
		origin: process.env.CORS_ORIGIN,
		credentials: true,
	})
);
app.use(morgan("dev"));
app.use("/assets", express.static("assets"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Server health check
app.get("/server-status", (req, res) => {
	res.status(200).json({ message: "Server is up and running!" });
});
// main routes config
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/post", postRoutes);
app.use("/admin", adminRoutes);
app.use("/comment", commentRoutes);

// error-handling middleware
app.use((err, req, res, next) => {
	console.log(err);
	if (err instanceof ApiError) {
		res.status(err?.statusCode).json({
			status: err?.statusCode,
			message: err?.message,
			errors: err?.errors,
		});
	} else {
		res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
	}
});

// handling graceful shutdown
process.on("SIGINT", async () => {
	try {
		await db.disconnect();
		process.exit(0);
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
});

// start the server
app.listen(PORT, () =>
	console.log(
		chalk.bgYellowBright.bold(` Server up and running on port ${PORT}! `)
	)
);
