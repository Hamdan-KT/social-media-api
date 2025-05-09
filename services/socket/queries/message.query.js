import mongoose from "mongoose";
import { Chat } from "../../../Models/chat.model.js";
import { MODELS } from "../../../utils/constants.js";
import { Message } from "../../../Models/message.model.js";

export const getRoleBasedCurrentChat = async (chatId) => {
	let chat = await Chat.aggregate([
		{ $match: { _id: new mongoose.Types.ObjectId(String(chatId)) } },
		{ $sort: { "lastMessage.createdAt": -1 } },
		{
			$lookup: {
				from: MODELS.MESSAGE,
				localField: "lastMessage",
				foreignField: "_id",
				let: { readBy: "$readBy" },
				pipeline: [
					{
						$lookup: {
							from: MODELS.USER,
							localField: "readBy.user",
							foreignField: "_id",
							pipeline: [
								{
									$project: {
										_id: 1,
										userName: 1,
										avatar: 1,
									},
								},
							],
							as: "readedUsers",
						},
					},
					{
						$addFields: {
							readBy: {
								$map: {
									input: "$readBy",
									as: "read",
									in: {
										user: {
											$arrayElemAt: [
												{
													$filter: {
														input: "$readedUsers",
														as: "readUser",
														cond: { $eq: ["$$readUser._id", "$$read.user"] },
													},
												},
												0,
											],
										},
										readAt: "$$read.readAt",
									},
								},
							},
						},
					},
				],
				as: "lastMessage",
			},
		},
		{
			$unwind: {
				path: "$lastMessage",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$project: {
				// "lastMessage.readedUsers": 0,
				"lastMessage.replyRef": 0,
				"lastMessage.media": 0,
				"lastMessage.reactions": 0,
				"lastMessage.updatedAt": 0,
				"lastMessage.__v": 0,
				// unreadMessages: 0,
				// participants: 0,
			},
		},
	]);
	return chat[0] ?? null;
};

export const formattedNewMessage = async (messageId) => {
	try {
		const newMessage = await Message.aggregate([
			{
				$match: {
					_id: new mongoose.Types.ObjectId(String(messageId)),
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
		return newMessage[0] || {};
	} catch (error) {
		console.log("Error in formatting new message:", error);
		return {};
	}
};
