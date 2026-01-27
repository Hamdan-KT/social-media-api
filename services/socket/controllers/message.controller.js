import dayjs from "dayjs";
import { Chat } from "../../../Models/chat.model.js";
import { Message } from "../../../Models/message.model.js";
import {
	MESSAGE_MEDIA_TYPES,
	messageStatusTypes,
	MODELS,
} from "../../../utils/constants.js";
import { messageEvents } from "../events.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
import localizedFormat from "dayjs/plugin/localizedFormat.js";
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);
import { formattedNewMessage } from "../queries/message.query.js";
import { getPublicIdFromCloudinaryURL } from "../../../utils/common.js";
import cloudinary from "../../../utils/cloudinary.js";
import { setOnlineUsers } from "../../redis/services.js";
import { ChatMeta } from "../../../Models/chatmeta.model.js";
import mongoose from "mongoose";

export default (io, socket) => {
	const userId = socket.handshake.query.userId;

	//join user to socket
	async function onJoin(data) {
		// Add socket ID to the user's set of sockets
		socket.join(data.userId);
		// user online
		await setOnlineUsers(userId);
		console.log(`User ${userId} online with socket ${socket.id}`);
	}

	// join chat to socket
	async function onJoinChat(data) {
		const chat = await Chat.findById(data?.chatId).select("participants");
		if (!chat) return;
		if (!chat.participants.includes(userId)) return;

		socket.join(data?.chatId);
		console.log(`User ${userId} joined chat ${data?.chatId}`);
	}

	//leaving chat
	async function onLeaveChat(data) {
		socket.leave(data?.chatId);
		console.log(`User ${userId} left chat ${data?.chatId}`);
	}

	//send message
	async function sendMessage(data, callback) {
		try {
			const {
				chatId,
				messageType,
				contentType,
				replyRef,
				content,
				media,
				details,
			} = data;
			let existingChat = null;

			// check chatId is not provided
			if (!chatId) {
				return callback({
					error: true,
					message: { ...data, status: messageStatusTypes.FAILED },
				});
			}

			// Check if chatId is provided
			if (chatId) {
				existingChat = await Chat.findById(chatId).populate("participants");

				if (!existingChat) {
					return callback({
						error: true,
						message: { ...data, status: messageStatusTypes.FAILED },
					});
				}

				// Create and save the message
				const message = await Message.create({
					sender: userId,
					chat: existingChat._id,
					messageType,
					contentType,
					replyRef,
					content,
					media,
					details,
				});

				await ChatMeta.updateMany(
					{
						chat: chatId,
						user: {
							$in: existingChat.participants
								.filter((p) => p._id.toString() !== userId)
								.map((p) => p._id.toString()),
						},
					},
					{ $inc: { unreadMessagesCount: 1 } },
				);

				// Update the lastMessage field in the chat
				existingChat.lastMessage = message._id;
				await existingChat.save();

				//get fromatted new message using aggregate
				const newMessage = await formattedNewMessage(message._id);

				//format new message's createdAt
				const formattedMessage = {
					...newMessage,
					createdAt: dayjs(message.createdAt).format("LT"),
					formattedCreatedAt: dayjs(message.createdAt).fromNow(true),
				};

				const allRecipientSockets = existingChat.participants.map(
					(participant) => participant._id.toString(),
				);

				io.to(chatId)
					.except(socket.id)
					.emit(messageEvents.RECEIVE, formattedMessage);
				io.to(allRecipientSockets).emit(messageEvents.CHATLIST_UPDATED, {
					chatId: existingChat._id,
					lastMessage: {
						...formattedMessage,
						sender: formattedMessage.sender._id,
					},
					inc: 1,
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
			const allRecipientWithoutUser = existingChat.participants
				.filter((p) => p._id.toString() !== userId)
				.map((p) => p._id.toString());

			if (allRecipientWithoutUser.length > 0) {
				io.to(chatId).except(socket.id).emit(messageEvents.USER_TYPING, {
					isTyping,
					chatId,
				});
				io.to(allRecipientWithoutUser).emit(messageEvents.USERLIST_TYPING, {
					isTyping,
					chatId,
				});
			}
		}
	}

	// unsend message
	async function unsendChat(data, callback) {
		const session = await mongoose.startSession();
		session.startTransaction();

		try {
			const { messageId, unsend = true } = data;

			if (!messageId) {
				await session.abortTransaction();
				session.endSession();
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
						session,
					},
				);
				await session.commitTransaction();
				session.endSession();
				return callback({ status: true, messageId });
			}

			// 1. Perform Database Operations inside the Transaction
			const deletedMessage = await Message.findByIdAndDelete(messageId, {
				session,
			});

			if (!deletedMessage) {
				await session.abortTransaction();
				session.endSession();
				return callback({ status: false, error: "Message not found" });
			}

			// Update the chat's last message if needed
			const chat = await Chat.findById(
				deletedMessage.chat,
				{},
				{ session },
			).populate("participants");

			// Update the unreadMessagesCount field in the chat
			await ChatMeta.updateMany(
				{
					chat: chat._id,
					user: {
						$in: chat.participants
							.filter((p) => p._id.toString() !== userId)
							.map((p) => p._id.toString()),
					},
				},
				{ $inc: { unreadMessagesCount: -1 } },
			);

			let formattedMessage = null;
			if (
				chat &&
				chat.lastMessage &&
				chat.lastMessage.toString() === messageId
			) {
				const latestMessage = await Message.findOne(
					{ chat: chat._id },
					{},
					{ session },
				)
					.sort({ createdAt: -1 })
					.lean()
					.exec();

				if (latestMessage) {
					formattedMessage = {
						...latestMessage,
						createdAt: dayjs(latestMessage.createdAt).format("LT"),
						formattedCreatedAt: dayjs(latestMessage.createdAt).fromNow(true),
					};
				}

				chat.lastMessage = latestMessage ? latestMessage._id : null;
				await chat.save({ session });
			}

			await session.commitTransaction();
			session.endSession();

			// 2. Perform External I/O (Cloudinary) OUTSIDE the transaction
			if (deletedMessage?.media?.length > 0) {
				const mediaToDelete = deletedMessage.media.map((file) => ({
					public_id: getPublicIdFromCloudinaryURL(file.url),
					resource_type: [
						MESSAGE_MEDIA_TYPES.AUDIO,
						MESSAGE_MEDIA_TYPES.VIDEO,
					].includes(file?.type)
						? "video"
						: "image",
				}));

				const groupedMedia = mediaToDelete.reduce(
					(acc, media) => {
						acc[media.resource_type].push(media.public_id);
						return acc;
					},
					{ image: [], video: [] },
				);

				const deleteFns = Object.entries(groupedMedia)
					.filter(([_, publicIds]) => publicIds.length > 0)
					.map(
						([resourceType, publicIds]) =>
							new Promise((resolve, reject) => {
								cloudinary.api.delete_resources(
									publicIds,
									{ resource_type: resourceType },
									(err, result) => (err ? reject(err) : resolve(result)),
								);
							}),
					);

				// the DB transaction is already closed waiting to delete media.
				Promise.all(deleteFns)
					.then((result) => console.log("Cloudinary Media Deleted:", result))
					.catch((err) =>
						console.error("Cloudinary Deletion Error (Post-Commit):", err),
					);
			}

			const allRecipientSockets = chat.participants.map((participant) =>
				participant._id.toString(),
			);

			io.to(chat._id?.toString())
				.except(socket.id)
				.emit(messageEvents.MESSAGE_DELETED, messageId);
			io.to(allRecipientSockets).emit(messageEvents.CHATLIST_UPDATED, {
				chatId: chat._id?.toString(),
				lastMessage: formattedMessage,
				inc: -1,
			});

			callback({ status: true, messageId });
		} catch (error) {
			if (session.inTransaction()) {
				await session.abortTransaction();
			}
			session.endSession();
			console.log(error);
			callback({ status: false, error: "failed to delete message." });
		}
	}

	async function readMessage({ chatId }) {
		if (chatId) {
			const existingChat = await Chat.findById(chatId).populate("participants");
			if (!existingChat) {
				return;
			}

			await Message.updateMany(
				{
					chat: existingChat?._id,
					"readBy.user": { $ne: userId },
					sender: { $ne: userId },
				},
				{
					$addToSet: {
						readBy: { user: userId },
					},
				},
				{ new: true },
			);

			await ChatMeta.findOneAndUpdate(
				{ chat: chatId, user: userId },
				{ unreadMessagesCount: 0, lastReadAt: Date.now() },
				{ new: true, upsert: true },
			);

			const allRecipientSockets = existingChat.participants.map((participant) =>
				participant._id.toString(),
			);
			io.to(allRecipientSockets).emit(messageEvents.CHATLIST_UPDATED, {
				chatId: existingChat._id,
				readBy: [{ user: userId }],
				inc: 0,
			});
		}
	}

	//event declarations
	socket.on(messageEvents.JOIN, onJoin);
	socket.on(messageEvents.JOIN_CHAT, onJoinChat);
	socket.on(messageEvents.LEAVE_CHAT, onLeaveChat);
	socket.on(messageEvents.SEND_MESSAGE, sendMessage);
	socket.on(messageEvents.TYPING, typing);
	socket.on(messageEvents.DELETE_MESSAGE, unsendChat);
	socket.on(messageEvents.CHAT_READ, readMessage);
};
