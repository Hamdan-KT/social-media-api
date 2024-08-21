import express from "express";
import cors from "cors";
import morgan from "morgan";

const app = express();
const PORT = process.env.PORT || 4000;

// db connection

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
		console.log("Disconnected from database.");
		process.exit(0);
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
});

// Start the server
app.listen(PORT, () => console.log(`Server up and running on port ${PORT}!`));
