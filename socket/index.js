import express from "express";
import http from "http";
import { Server } from "socket.io";
import messageController from "./controllers/message.controller.js";
import chalk from "chalk";

export const app = express();
export const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: process.env.CLIENT_URL,
		credentials: true,
	},
});

const userSocketMap = new Map();

// all controllers handler
const onConnection = (socket) => {
	messageController(io, socket, userSocketMap);
};

//disconnection
const onDisconnect = (socket) => {
	console.error(chalk.white.bgRed.bold(`client disconnected: ${socket.id}`));
	for (const [userId, socketIds] of userSocketMap.entries()) {
		if (socketIds.has(socket.id)) {
			socketIds.delete(socket.id);
			if (socketIds.size === 0) {
				userSocketMap.delete(userId); // Remove user if no sockets are left
			}
			break;
		}
	}
};
// const onDisconnect = (socket) => {
// 	console.log(`client disconnected: ${socket.id}`);
// 	for (const [userId, socketId] of userSocketMap.entries()) {
// 		if (socketId === socket.id) {
// 			userSocketMap.delete(userId);
// 			break;
// 		}
// 	}
// };

io.on("connection", (socket) => {
	const userId = socket.handshake.query.userId;

	// if (userId) {
	// 	userSocketMap.set(userId, socket.id);
	// 	console.log(`user connected: ${userId} with socketID: ${socket.id}`);
	// } else {
	// 	console.log(`userId is not provided during connection`);
	// }

	if (userId) {
		if (!userSocketMap.has(userId)) {
			userSocketMap.set(userId, new Set());
		}
		userSocketMap.get(userId).add(socket.id);
		console.log(
			chalk.white.bgBlueBright.bold(
				`user connected: ${userId} with socketID: ${socket.id}`
			)
		);
	}

	onConnection(socket);

	// handling disconnection
	socket.on("disconnect", () => onDisconnect(socket));
});
