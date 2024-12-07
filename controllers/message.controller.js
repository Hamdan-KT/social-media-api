import mongoose, { model } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiSuccess } from "../utils/ApiSuccess.js";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import localizedFormat from "dayjs/plugin/localizedFormat.js";
import {
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
							$expr: { $in: ["$$userId", "$participants"] },
							$expr: {
								$in: [
									new mongoose.Types.ObjectId(String(req.user._id)),
									"$participants",
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

export const inintializeChat = asyncHandler(async (req, res, next) => {
	const userId = req.user?._id;
	const receiverId = req.params?.receiverId;

	if (!receiverId) {
		return next(new ApiError(404, "receiverId is not provided."));
	}

	// check if already chat exist
	const existChat = await Chat.findOne({
		participants: [userId, receiverId],
		isGroupChat: false,
	});

	if (!existChat) {
		const newChat = await Chat.create({
			participants: [userId, receiverId],
			isGroupChat: false,
		});
		return ApiSuccess(res, "chats initialized successfull.", newChat);
	}

	// return already existing chat data
	return ApiSuccess(res, "chats alreay exist.", existChat);
});

export const fetchUserChats = asyncHandler(async (req, res, next) => {
	const userId = req.user?._id;
	const page = parseInt(req.query.page, 10) || 1;
	const limit = parseInt(req.query.limit, 10) || 10;
	const skip = (page - 1) * limit;

	// Fetch chats for the user with pagination
	const chats = await Chat.aggregate([
		{ $match: { participants: new mongoose.Types.ObjectId(String(userId)) } },
		{ $sort: { "lastMessage.createdAt": -1 } },
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
												"$readBy",
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

	const formattedChats = chats.map((chat) => {
		chat.lastMessage.createdAt = dayjs(chat?.lastMessage?.createdAt).fromNow(
			true
		);
		return chat;
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
												"$readBy",
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

	currentChat[0].lastMessage.createdAt = dayjs(
		currentChat[0]?.lastMessage?.createdAt
	).fromNow(true);

	return ApiSuccess(res, "chats fetch successfull.", currentChat[0]);
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

	return ApiSuccess(res, "chat messages fetch successfull.", formattedMessages);
});
