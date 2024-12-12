import dayjs from "dayjs";
import { Chat } from "../../Models/chat.model.js";
import { Message } from "../../Models/message.model.js";
import { messageStatusTypes } from "../../utils/constants.js";
import { messageEvents } from "../events.js";
import localizedFormat from "dayjs/plugin/localizedFormat.js";
dayjs.extend(localizedFormat);
import fs from "fs";

export default (io, socket, userSocketMap) => {
	const userId = socket.handshake.query.userId;
	//send message
	async function sendMessage(data, callback) {
		try {
			const {
				chatId,
				senderId,
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
					.populate({
						path: "sender",
						select: "_id userName name avatar isVerified",
					})
					.populate({
						path: "replyRef",
						select:
							"_id sender chat messageType contentType content media createdAt",
						populate: {
							path: "sender",
							select: "_id userName name avatar isVerified",
						},
					})
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

	async function unsendChat(data, callback) {
		try {
			const { messageId, unsend = true } = data;

			if (!messageId) {
				return callback({ status: false, error: "Message ID is required" });
			}

			if (!unsend) {
				await Message.findOneAndUpdate(
					{
						_id: messageId,
					},
					{
						$addToSet: {
							deletedFor: userId,
						},
					},
					{
						new: true,
					}
				);
				return callback({ status: true, messageId });
			}

			// Delete the message
			const deletedMessage = await Message.findByIdAndDelete(messageId);

			if (deletedMessage?.media?.length > 0) {
				const deletePromises = deletedMessage?.media?.map(async (file) => {
					if (fs.promises.access(file?.url)) {
						fs.promises.unlink(file?.url);
					}
				});
				await Promise.all(deletePromises);
			}

			if (!deletedMessage) {
				return callback({ status: false, error: "Message not found" });
			}

			// Update the chat's last message if needed
			const chat = await Chat.findById(deletedMessage.chat);

			if (chat && chat.lastMessage.toString() === messageId) {
				const latestMessage = await Message.findOne({ chat: chat._id })
					.sort({ createdAt: -1 })
					.exec();

				chat.lastMessage = latestMessage ? latestMessage._id : null;
				await chat.save();
			}

			chat.participants.forEach((participant) => {
				if (participant._id.toString() !== userId) {
					const recipientSockets = userSocketMap.get(
						participant._id.toString()
					);
					if (recipientSockets) {
						recipientSockets.forEach((socketId) => {
							io.to(socketId).emit(messageEvents.MESSAGE_DELETED, messageId);
						});
					}
				}
			});

			callback({ status: true, messageId });
		} catch (error) {
			callback({ status: false, error: "Failed to delete message" });
		}
	}

	//event declarations
	socket.on(messageEvents.SEND_MESSAGE, sendMessage);
	socket.on(messageEvents.TYPING, typing);
	socket.on(messageEvents.DELETE_MESSAGE, unsendChat);
};
