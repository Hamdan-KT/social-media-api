import dayjs from "dayjs";
import { Chat } from "../../Models/chat.model.js";
import { Message } from "../../Models/message.model.js";
import {
	MESSAGE_MEDIA_TYPES,
	messageStatusTypes,
	MODELS,
} from "../../utils/constants.js";
import { messageEvents } from "../events.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
import localizedFormat from "dayjs/plugin/localizedFormat.js";
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import mongoose from "mongoose";
import { getRoleBasedCurrentChat } from "../queries/message.query.js";
import { getPublicIdFromCloudinaryURL } from "../../utils/common.js";
import cloudinary from "../../utils/cloudinary.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default (io, socket, userSocketMap) => {
	const userId = socket.handshake.query.userId;
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
				receiverId,
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

				//get fromatted new message using aggregate
				const newMessage = await Message.aggregate([
					{
						$match: {
							_id: new mongoose.Types.ObjectId(String(message._id)),
						},
					},
					{
						$lookup: {
							from: MODELS.USER,
							localField: "sender",
							foreignField: "_id",
							pipeline: [
								{
									$project: {
										_id: 1,
										userName: 1,
										name: 1,
										isVerified: 1,
										avatar: 1,
									},
								},
							],
							as: "sender",
						},
					},
					{ $unwind: "$sender" },
					{
						$lookup: {
							from: MODELS.MESSAGE,
							localField: "replyRef",
							foreignField: "_id",
							let: { mediaId: "$details.mediaId" },
							pipeline: [
								{
									$lookup: {
										from: MODELS.USER,
										localField: "sender",
										foreignField: "_id",
										pipeline: [
											{
												$project: {
													_id: 1,
													userName: 1,
													name: 1,
													isVerified: 1,
													avatar: 1,
												},
											},
										],
										as: "sender",
									},
								},
								{
									$unwind: {
										path: "$sender",
										preserveNullAndEmptyArrays: true,
									},
								},
								{
									$addFields: {
										media: {
											$filter: {
												input: "$media",
												as: "mediaItem",
												cond: {
													$eq: [
														"$$mediaItem._id",
														{ $toObjectId: "$$mediaId" },
													],
												},
											},
										},
									},
								},
								{
									$project: {
										readBy: 0,
										reactions: 0,
									},
								},
							],
							as: "replyRef",
						},
					},
					{
						$unwind: { path: "$replyRef", preserveNullAndEmptyArrays: true },
					},
					{
						$project: {
							readBy: 0,
							reactions: 0,
						},
					},
				]);

				//format new message's createdAt
				const formattedMessage = {
					...newMessage[0],
					createdAt: dayjs(message.createdAt).format("LT"),
				};

				// Update the lastMessage field in the chat
				existingChat.lastMessage = message._id;
				await existingChat.save();

				//get sender's and receiver's current formatted chat to updated latest chat list
				let senderCurrentChat = await getRoleBasedCurrentChat(
					existingChat?._id,
					userId
				);
				let receiverCurrentChat = await getRoleBasedCurrentChat(
					existingChat?._id,
					receiverId
				);

				//formatting last message time of sender's and receiver's chat
				if (
					receiverCurrentChat?.lastMessage &&
					senderCurrentChat?.lastMessage
				) {
					senderCurrentChat.lastMessage.formattedCreatedAt = dayjs(
						senderCurrentChat.lastMessage.createdAt
					).fromNow(true);
					receiverCurrentChat.lastMessage.formattedCreatedAt = dayjs(
						receiverCurrentChat.lastMessage.createdAt
					).fromNow(true);
				}

				// Notify all participants of the new message
				existingChat.participants.forEach((participant) => {
					const recipientSockets = userSocketMap.get(
						participant._id.toString()
					);
					if (recipientSockets) {
						if (participant._id.toString() !== userId) {
							recipientSockets.forEach((socketId) => {
								if (socketId !== socket?.id) {
									io.to(socketId).emit(messageEvents.RECEIVE, formattedMessage);
								}
								io.to(socketId).emit(
									messageEvents.CHATLIST_UPDATED,
									receiverCurrentChat
								);
							});
						} else {
							recipientSockets.forEach((socketId) => {
								if (socketId !== socket?.id) {
									io.to(socketId).emit(messageEvents.RECEIVE, formattedMessage);
								}
								io.to(socketId).emit(
									messageEvents.CHATLIST_UPDATED,
									senderCurrentChat
								);
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

	// unsend message
	async function unsendChat(data, callback) {
		try {
			const { messageId, receiverId, unsend = true } = data;

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
				const mediaToDelete = deletedMessage.media.map((file) => ({
					public_id: getPublicIdFromCloudinaryURL(file.url),
					resource_type: [
						MESSAGE_MEDIA_TYPES.AUDIO,
						MESSAGE_MEDIA_TYPES.VIDEO,
					].includes(file?.type)
						? "video"
						: "image",
				}));

				// Separate files by resource type
				const groupedMedia = mediaToDelete.reduce(
					(acc, media) => {
						acc[media.resource_type].push(media.public_id);
						return acc;
					},
					{ image: [], video: [] }
				);

				for (const [resourceType, publicIds] of Object.entries(groupedMedia)) {
					if (publicIds.length > 0) {
						await cloudinary.api.delete_resources(
							publicIds,
							{ resource_type: resourceType },
							(err, result) => {
								if (err) {
									return callback({
										status: false,
										error: "Message not deleted, try again.",
									});
								}
							}
						);
					}
				}
			}

			if (!deletedMessage) {
				return callback({ status: false, error: "Message not found" });
			}

			// Update the chat's last message if needed
			const chat = await Chat.findById(deletedMessage.chat).populate(
				"participants"
			);

			if (chat && chat.lastMessage.toString() === messageId) {
				const latestMessage = await Message.findOne({ chat: chat._id })
					.sort({ createdAt: -1 })
					.exec();

				chat.lastMessage = latestMessage ? latestMessage._id : null;
				await chat.save();
			}

			//get sender's and receiver's current formatted chat to updated latest chat list
			let senderCurrentChat = await getRoleBasedCurrentChat(chat?._id, userId);
			let receiverCurrentChat = await getRoleBasedCurrentChat(
				chat?._id,
				receiverId
			);

			//formatting last message time of sender's and receiver's chat
			if (receiverCurrentChat?.lastMessage && senderCurrentChat?.lastMessage) {
				senderCurrentChat.lastMessage.formattedCreatedAt = dayjs(
					senderCurrentChat.lastMessage.createdAt
				).fromNow(true);
				receiverCurrentChat.lastMessage.formattedCreatedAt = dayjs(
					receiverCurrentChat.lastMessage.createdAt
				).fromNow(true);
			}

			chat.participants.forEach((participant) => {
				const recipientSockets = userSocketMap.get(participant._id.toString());
				if (recipientSockets) {
					if (participant._id.toString() !== userId) {
						recipientSockets.forEach((socketId) => {
							if (socketId !== socket?.id) {
								io.to(socketId).emit(messageEvents.MESSAGE_DELETED, messageId);
							}
							io.to(socketId).emit(
								messageEvents.CHATLIST_UPDATED,
								receiverCurrentChat
							);
						});
					} else {
						recipientSockets.forEach((socketId) => {
							if (socketId !== socket?.id) {
								io.to(socketId).emit(messageEvents.MESSAGE_DELETED, messageId);
							}
							io.to(socketId).emit(
								messageEvents.CHATLIST_UPDATED,
								senderCurrentChat
							);
						});
					}
				}
			});

			callback({ status: true, messageId });
		} catch (error) {
			callback({ status: false, error: "failed to delete message." });
		}
	}

	async function readMessage({ chatId, receiverId }) {
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
				{ new: true }
			);

			//get sender's and receiver's current formatted chat to updated latest chat list
			let senderCurrentChat = await getRoleBasedCurrentChat(
				existingChat?._id,
				userId
			);
			let receiverCurrentChat = await getRoleBasedCurrentChat(
				existingChat?._id,
				receiverId
			);

			//formatting last message time of sender's and receiver's chat
			if (receiverCurrentChat?.lastMessage && senderCurrentChat?.lastMessage) {
				senderCurrentChat.lastMessage.formattedCreatedAt = dayjs(
					senderCurrentChat.lastMessage.createdAt
				).fromNow(true);
				receiverCurrentChat.lastMessage.formattedCreatedAt = dayjs(
					receiverCurrentChat.lastMessage.createdAt
				).fromNow(true);
			}

			existingChat.participants.forEach((participant) => {
				const recipientSockets = userSocketMap.get(participant._id.toString());
				if (recipientSockets) {
					if (participant._id.toString() !== userId) {
						recipientSockets.forEach((socketId) => {
							io.to(socketId).emit(
								messageEvents.CHATLIST_UPDATED,
								receiverCurrentChat
							);
						});
					} else {
						recipientSockets.forEach((socketId) => {
							io.to(socketId).emit(
								messageEvents.CHATLIST_UPDATED,
								senderCurrentChat
							);
						});
					}
				}
			});
		}
	}

	//event declarations
	socket.on(messageEvents.SEND_MESSAGE, sendMessage);
	socket.on(messageEvents.TYPING, typing);
	socket.on(messageEvents.DELETE_MESSAGE, unsendChat);
	socket.on(messageEvents.CHAT_READ, readMessage);
};
