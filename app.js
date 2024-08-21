const express = require("express");
const app = express();

const cors = require("cors");
const morgan = require("morgan");
const PORT = process.env.PORT || 4000;
// db connection
app.use(cors());
app.use(morgan("dev"));
app.use("/assets/userFiles", express.static(__dirname + "/assets/userFiles"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// server health check
app.get("/server-status", (req, res) => {
	res.status(200).json({ message: "Server is up and running!" });
});
// other routes
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

app.listen(PORT, () => console.log(`Server up and running on port ${PORT}!`));
