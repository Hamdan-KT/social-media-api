import dayjs from "dayjs";
import { Chat } from "../../Models/chat.model.js";
import { Message } from "../../Models/message.model.js";
import { messageStatusTypes } from "../../utils/constants.js";
import { messageEvents } from "../events.js";
import localizedFormat from "dayjs/plugin/localizedFormat.js";
dayjs.extend(localizedFormat);

export default (io, socket, userSocketMap) => {
	const userId = socket.handshake.query.userId;
	//send message
	async function sendMessage(data, callback) {
		console.log({ messageSend: data });
		try {
			const {
				chatId,
				senderId,
				receiverId,
				messageType,
				contentType,
				replyRef,
				content,
				media,
			} = data;
			let existingChat = null;

			if (!chatId) {
				callback({
					error: true,
					message: { ...data, status: messageStatusTypes.FAILED },
				});
			}

			// Check if chatId is provided
			if (chatId) {
				existingChat = await Chat.findById(chatId).populate("participants");

				if (!existingChat) {
					callback({
						error: true,
						message: { ...data, status: messageStatusTypes.FAILED },
					});
				}

				// if (!existingChat) {
				// 	// If no existing chat, create a new one
				// 	const newChat = await Chat.create({
				// 		participants: [senderId, receiverId],
				// 		isGroupChat: false,
				// 	});
				// 	existingChat = await Chat.findById(newChat._id).populate(
				// 		"participants"
				// 	);
				// }

				// Create and save the message
				const message = await Message.create({
					sender: senderId,
					chat: existingChat._id,
					messageType,
					contentType,
					replyRef,
					content,
					media,
				});

				const newMessage = await Message.findById(message._id)
					.populate("sender", "_id userName name avatar isVerified")
					.populate(
						"replyRef",
						"_id sender chat messageType contentType content media createdAt"
					)
					.lean();

				const formattedMessage = {
					...newMessage,
					createdAt: dayjs(message.createdAt).format("LT"),
				};

				// Update the lastMessage field in the chat
				existingChat.lastMessage = message._id;
				await existingChat.save();

				// Notify all participants of the new message
				existingChat.participants.forEach((participant) => {
					if (participant._id.toString() !== senderId) {
						const recipientSockets = userSocketMap.get(
							participant._id.toString()
						);
						if (recipientSockets) {
							recipientSockets.forEach((socketId) => {
								io.to(socketId).emit(messageEvents.RECEIVE, formattedMessage);
							});
						}
					}
				});
				callback({
					status: messageStatusTypes.SEND,
					messageId: message._id,
					formattedMessage,
				});
			}
		} catch (error) {
			console.error("Error sending message:", error);
			callback({
				error: true,
				message: { ...data, status: messageStatusTypes.FAILED },
			});
		}
	}

	//live typing
	async function typing({ isTyping, chatId }) {
		if (chatId) {
			const existingChat = await Chat.findById(chatId).populate("participants");
			if (!existingChat) {
				return;
			}
			existingChat.participants.forEach((participant) => {
				if (participant._id.toString() !== userId) {
					const recipientSockets = userSocketMap.get(
						participant._id.toString()
					);
					if (recipientSockets) {
						recipientSockets.forEach((socketId) => {
							io.to(socketId).emit(messageEvents.USER_TYPING, {
								isTyping,
								chatId,
							});
							io.to(socketId).emit(messageEvents.USERLIST_TYPING, {
								isTyping,
								chatId,
							});
						});
					}
				}
			});
		}
	}

	//event declarations
	socket.on(messageEvents.SEND_MESSAGE, sendMessage);
	socket.on(messageEvents.TYPING, typing);
};
