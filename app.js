import express from "express";
import cors from "cors";
import morgan from "morgan";
import { Database } from "./config/database.js";
import dotenv from "dotenv";
import chalk from "chalk";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// db connection
const db = new Database(process.env.MONGO_URI);
db.connect();

// Middleware
app.use(cors());
app.use(morgan("dev"));
app.use(
	"/assets",
	express.static(new URL("./assets", import.meta.url).pathname)
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Server health check
app.get("/server-status", (req, res) => {
	res.status(200).json({ message: "Server is up and running!" });
});

// other routes

// Handle graceful shutdown
process.on("SIGINT", async () => {
	try {
		await db.disconnect();
		process.exit(0);
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
});

// Start the server
app.listen(PORT, () =>
	console.log(
		chalk.bgYellowBright.bold(` Server up and running on port ${PORT}! `)
	)
);
