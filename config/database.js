import mongoose from "mongoose";
mongoose.set("strictQuery", false);
import chalk from "chalk";

export class Database {
	constructor(uri, options) {
		this.uri = uri;
		this.options = options;
	}

	async connect() {
		try {
			await mongoose.connect(this.uri, this.options).then(() => {
				console.log(
					chalk.white.bgGreenBright.bold(
						` Connected to Database: ${mongoose.connection.db.databaseName} `
					)
				);
			});
		} catch (error) {
			console.error(
				chalk.white.bgRed(` Error connecting to database: ${error} `)
			);
			throw error;
		}
	}

	async disconnect() {
		try {
			if (mongoose.connection.readyState === 1) {
				await mongoose.disconnect().then(() => {
					console.error(chalk.white.bgRed.bold("Disconnected from Database"));
				});
			} else {
				console.error(chalk.bgYellow("No Active Connections to Database"));
			}
		} catch (error) {
			console.error(chalk.white.bgRed(`Error closing connection: ${error}`));
			throw error;
		}
	}
}
