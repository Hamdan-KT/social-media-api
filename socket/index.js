import express from "express"
import http from "http"
import { Server } from "socket.io"

export const app = express();
export const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: process.env.CLIENT_URL,
        credentials: true
	},
});

io.on("connection", (socket) => {
    console.log("user connect - ", socket.id);

    //

    io.on("disconnect", () => {
        console.log("disconnect user - ", socket.id)
    })
})