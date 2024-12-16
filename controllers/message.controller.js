import mongoose, { model } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiSuccess } from "../utils/ApiSuccess.js";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import localizedFormat from "dayjs/plugin/localizedFormat.js";
import {
	MESSAGE_MEDIA_TYPES,
	MESSAGE_TYPES,
	MODELS,
	RELATION_STATUS_TYPES,
} from "../utils/constants.js";
import User from "../Models/user.model.js";
import { Chat } from "../Models/chat.model.js";
import { Message } from "../Models/message.model.js";
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

export const getChatSearchUsers = asyncHandler(async (req, res, next) => {
	const page = parseInt(req.query.page, 10) || 1;
	const limit = parseInt(req.query.limit, 10) || 10;
	const skip = (page - 1) * limit;
	const searchTerm = req.query.search || "";

	const users = await User.aggregate([
		{
			$match: {
				_id: { $ne: new mongoose.Types.ObjectId(String(req.user._id)) },
				...(searchTerm && {
					$or: [
						{ userName: { $regex: searchTerm, $options: "i" } }, // Case-insensitive match for userName
						{ name: { $regex: searchTerm, $options: "i" } }, // Case-insensitive match for name
					],
				}),
			},
		},
		{
			$lookup: {
				from: MODELS.RELATIONSHIP,
				let: { userId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$following", "$$userId"] },
									{
										$eq: [
											"$follower",
											new mongoose.Types.ObjectId(String(req.user._id)),
										],
									},
								],
							},
						},
					},
				],
				as: "myrelationship",
			},
		},
		{
			$addFields: {
				isFollowing: {
					$cond: {
						if: { $gt: [{ $size: "$myrelationship" }, 0] }, // Check if a relationship exists
						then: {
							$eq: [
								{ $arrayElemAt: ["$myrelationship.status", 0] },
								RELATION_STATUS_TYPES.FOLLOWING,
							],
						}, // Only mark as "following" if the status is FOLLOWING
						else: false,
					},
				},
				followingStatus: { $arrayElemAt: ["$myrelationship.status", 0] },
			},
		},
		{ $sort: { createdAt: 1 } },
		{
			$lookup: {
				from: MODELS.CHAT,
				let: { userId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $in: ["$$userId", "$participants"] },
									{
										$in: [
											new mongoose.Types.ObjectId(String(req.user._id)),
											"$participants",
										],
									},
								],
							},
						},
					},
					{
						$lookup: {
							from: MODELS.USER,
							let: { participantIds: "$participants" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $in: ["$_id", "$$participantIds"] },
												{
													$ne: [
														"$_id",
														new mongoose.Types.ObjectId(String(req.user._id)),
													],
												},
											],
										},
									},
								},
								{
									$project: {
										name: 1,
										userName: 1,
										_id: 1,
										avatar: 1,
										isVerified: 1,
									},
								},
							],
							as: "participants",
						},
					},
					{
						$addFields: {
							receiver: {
								$cond: {
									if: { $eq: ["$isGroupChat", false] },
									then: { $arrayElemAt: ["$participants", 0] },
									else: null,
								},
							},
						},
					},
					{
						$project: {
							participants: 0,
						},
					},
				],
				as: "chat",
			},
		},
		{ $unwind: { path: "$chat", preserveNullAndEmptyArrays: true } },
		{
			$project: {
				_id: 1,
				userName: 1,
				name: 1,
				avatar: 1,
				isPublic: 1,
				isFollowing: 1,
				followingStatus: 1,
				isVerified: 1,
				chat: 1,
			},
		},
		{ $skip: skip }, // Skip documents for pagination
		{ $limit: limit },
	]);

	return ApiSuccess(res, "message search users fetch successfull.", users);
});

export const initializeChat = asyncHandler(async (req, res, next) => {
	const userId = req.user?._id;
	const receiverId = req.params?.receiverId;

	if (!receiverId) {
		return next(new ApiError(404, "receiverId is not provided."));
	}

	let chat;

	// check if already chat exist
	chat = await Chat.findOne({
		participants: [userId, receiverId],
		isGroupChat: false,
	});

	if (!chat) {
		chat = await Chat.create({
			participants: [userId, receiverId],
			isGroupChat: false,
		});
	}

	const formattedChat = await Chat.aggregate([
		{ $match: { _id: new mongoose.Types.ObjectId(String(chat._id)) } },
		{
			$lookup: {
				from: MODELS.MESSAGE,
				localField: "lastMessage",
				foreignField: "_id",
				as: "lastMessage",
			},
		},
		{ $unwind: { path: "$lastMessage", preserveNullAndEmptyArrays: true } },
		{
			$lookup: {
				from: MODELS.USER,
				let: { participantIds: "$participants" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $in: ["$_id", "$$participantIds"] },
									{
										$ne: [
											"$_id",
											new mongoose.Types.ObjectId(String(req.user._id)),
										],
									},
								],
							},
						},
					},
					{
						$project: {
							name: 1,
							userName: 1,
							_id: 1,
							avatar: 1,
							isVerified: 1,
						},
					},
				],
				as: "participants",
			},
		},
		{
			$lookup: {
				from: MODELS.MESSAGE,
				let: { participantIds: "$participants._id", chatId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$chat", "$$chatId"],
									},
									{ $in: ["$sender", "$$participantIds"] },
									{
										$not: {
											$in: [
												new mongoose.Types.ObjectId(String(req.user._id)),
												{
													$map: {
														input: "$readBy",
														as: "reader",
														in: "$$reader.user",
													},
												},
											],
										},
									},
								],
							},
						},
					},
				],
				as: "unreadMessages",
			},
		},
		{
			$addFields: {
				unreadMessagesCount: {
					$size: "$unreadMessages",
				},
				receiver: {
					$cond: {
						if: { $eq: ["$isGroupChat", false] },
						then: { $arrayElemAt: ["$participants", 0] },
						else: null,
					},
				},
			},
		},
		{
			$project: {
				"lastMessage.replyRef": 0,
				"lastMessage.media": 0,
				"lastMessage.readBy": 0,
				"lastMessage.reactions": 0,
				"lastMessage.updatedAt": 0,
				"lastMessage.__v": 0,
				unreadMessages: 0,
				participants: 0,
			},
		},
	]);

	if (formattedChat[0]?.lastMessage) {
		formattedChat[0].lastMessage.createdAt = dayjs(
			formattedChat[0].lastMessage.createdAt
		).fromNow(true);
	}

	//send chat data
	return ApiSuccess(res, "chats initialized successfull.", formattedChat[0]);
});

export const fetchUserChats = asyncHandler(async (req, res, next) => {
	const userId = req.user?._id;
	const page = parseInt(req.query.page, 10) || 1;
	const limit = parseInt(req.query.limit, 10) || 10;
	const skip = (page - 1) * limit;

	// Fetch chats for the user with pagination
	const chats = await Chat.aggregate([
		{
			$match: {
				participants: new mongoose.Types.ObjectId(String(userId)),
				lastMessage: { $ne: null, $exists: true },
			},
		},
		{ $skip: skip },
		{ $limit: limit },
		{
			$lookup: {
				from: MODELS.MESSAGE,
				localField: "lastMessage",
				foreignField: "_id",
				as: "lastMessage",
			},
		},
		{ $unwind: { path: "$lastMessage", preserveNullAndEmptyArrays: true } },
		{
			$lookup: {
				from: MODELS.USER,
				let: { participantIds: "$participants" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $in: ["$_id", "$$participantIds"] },
									{
										$ne: [
											"$_id",
											new mongoose.Types.ObjectId(String(req.user._id)),
										],
									},
								],
							},
						},
					},
					{
						$project: {
							name: 1,
							userName: 1,
							_id: 1,
							avatar: 1,
							isVerified: 1,
						},
					},
				],
				as: "participants",
			},
		},
		{
			$lookup: {
				from: MODELS.MESSAGE,
				let: { participantIds: "$participants._id", chatId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$chat", "$$chatId"],
									},
									{ $in: ["$sender", "$$participantIds"] },
									{
										$not: {
											$in: [
												new mongoose.Types.ObjectId(String(req.user._id)),
												{
													$map: {
														input: "$readBy",
														as: "reader",
														in: "$$reader.user",
													},
												},
											],
										},
									},
								],
							},
						},
					},
				],
				as: "unreadMessages",
			},
		},
		{
			$addFields: {
				unreadMessagesCount: {
					$size: "$unreadMessages",
				},
				receiver: {
					$cond: {
						if: { $eq: ["$isGroupChat", false] },
						then: { $arrayElemAt: ["$participants", 0] },
						else: null,
					},
				},
			},
		},
		{ $sort: { "lastMessage.createdAt": -1 } },
		{
			$project: {
				"lastMessage.replyRef": 0,
				"lastMessage.media": 0,
				"lastMessage.readBy": 0,
				"lastMessage.reactions": 0,
				"lastMessage.updatedAt": 0,
				"lastMessage.__v": 0,
				unreadMessages: 0,
				participants: 0,
			},
		},
	]);

	const formattedChats = chats.map((chat) => {
		return {
			...chat,
			lastMessage: {
				...chat?.lastMessage,
				formattedCreatedAt: dayjs(chat?.lastMessage?.createdAt).fromNow(true),
			},
		};
	});

	return ApiSuccess(res, "chats fetch successfull.", formattedChats);
});

export const getCurrentChat = asyncHandler(async (req, res, next) => {
	const chatId = req.params?.chatId;

	if (!chatId) {
		return next(new ApiError(404, "chat Id is not provide or invalid."));
	}

	const currentChat = await Chat.aggregate([
		{ $match: { _id: new mongoose.Types.ObjectId(String(chatId)) } },
		{ $sort: { "lastMessage.createdAt": -1 } },
		{
			$lookup: {
				from: MODELS.MESSAGE,
				localField: "lastMessage",
				foreignField: "_id",
				as: "lastMessage",
			},
		},
		{ $unwind: { path: "$lastMessage", preserveNullAndEmptyArrays: true } },
		{
			$lookup: {
				from: MODELS.USER,
				let: { participantIds: "$participants" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $in: ["$_id", "$$participantIds"] },
									{
										$ne: [
											"$_id",
											new mongoose.Types.ObjectId(String(req.user._id)),
										],
									},
								],
							},
						},
					},
					{
						$project: {
							name: 1,
							userName: 1,
							_id: 1,
							avatar: 1,
							isVerified: 1,
						},
					},
				],
				as: "participants",
			},
		},
		{
			$lookup: {
				from: MODELS.MESSAGE,
				let: { participantIds: "$participants._id", chatId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$chat", "$$chatId"],
									},
									{ $in: ["$sender", "$$participantIds"] },
									{
										$not: {
											$in: [
												new mongoose.Types.ObjectId(String(req.user._id)),
												{
													$map: {
														input: "$readBy",
														as: "reader",
														in: "$$reader.user",
													},
												},
											],
										},
									},
								],
							},
						},
					},
				],
				as: "unreadMessages",
			},
		},
		{
			$addFields: {
				unreadMessagesCount: {
					$size: "$unreadMessages",
				},
				receiver: {
					$cond: {
						if: { $eq: ["$isGroupChat", false] },
						then: { $arrayElemAt: ["$participants", 0] },
						else: null,
					},
				},
			},
		},
		{
			$project: {
				"lastMessage.replyRef": 0,
				"lastMessage.media": 0,
				"lastMessage.readBy": 0,
				"lastMessage.reactions": 0,
				"lastMessage.updatedAt": 0,
				"lastMessage.__v": 0,
				unreadMessages: 0,
				participants: 0,
			},
		},
	]);

	if (currentChat[0]?.lastMessage) {
		currentChat[0].lastMessage.createdAt = dayjs(
			currentChat[0].lastMessage.createdAt
		).fromNow(true);
	}

	return ApiSuccess(res, "Chats fetched successfully.", currentChat[0]);
});

export const fetchChatMessages = asyncHandler(async (req, res, next) => {
	const chatId = req.params?.chatId;

	const page = parseInt(req.query.page, 10) || 1;
	const limit = parseInt(req.query.limit, 10) || 10;
	const skip = (page - 1) * limit;

	if (!chatId) {
		return next(new ApiError(404, "chat Id is not provide or invalid."));
	}

	const messages = await Message.aggregate([
		{
			$match: {
				chat: new mongoose.Types.ObjectId(String(chatId)),
				deletedFor: { $ne: new mongoose.Types.ObjectId(String(req.user?._id)) },
			},
		},
		{ $sort: { createdAt: -1 } },
		{ $limit: limit },
		{ $skip: skip },
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
					{ $unwind: { path: "$sender", preserveNullAndEmptyArrays: true } },
					{
						$addFields: {
							media: {
								$filter: {
									input: "$media",
									as: "mediaItem",
									cond: {
										$eq: ["$$mediaItem._id", { $toObjectId: "$$mediaId" }],
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
		{ $unwind: { path: "$replyRef", preserveNullAndEmptyArrays: true } },
		{
			$project: {
				readBy: 0,
				reactions: 0,
			},
		},
	]);

	const formattedMessages = messages?.map((msg) => ({
		...msg,
		createdAt: dayjs(msg?.createdAt).format("LT"),
	}));

	return ApiSuccess(
		res,
		"chat messages fetch successfull.",
		formattedMessages.reverse()
	);
});

export const uploadMessageMedias = asyncHandler(async (req, res, next) => {
	const files = req.files;
	const { chatId } = req.body;

	const formattedMessageFiles = files?.map((file) => {
		let fileType;
		// Check file type
		if (file.mimetype.startsWith("image/")) {
			fileType = MESSAGE_MEDIA_TYPES.IMAGE;
		} else if (file.mimetype.startsWith("video/")) {
			fileType = MESSAGE_MEDIA_TYPES.VIDEO;
		} else if (file.mimetype.startsWith("audio/")) {
			fileType = MESSAGE_MEDIA_TYPES.AUDIO;
		}

		// Get file URL
		const fileUrl = `${req.protocol}://${req.get("host")}/assets/chat-${
			req.user?._id
		}/${file?.filename}`;

		return {
			type: fileType,
			url: fileUrl,
		};
	});

	return ApiSuccess(
		res,
		"messages file uploaded successfull.",
		formattedMessageFiles
	);
});
