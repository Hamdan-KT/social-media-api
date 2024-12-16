import mongoose from "mongoose";
import { Chat } from "../../Models/chat.model.js";
import { MODELS } from "../../utils/constants.js";

export const getRoleBasedCurrentChat = async (chatId, userId, options = {}) => {
	const chat = await Chat.aggregate([
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
		{
			$unwind: {
				path: "$lastMessage",
				preserveNullAndEmptyArrays: true,
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
									options?.sender
										? {
												$ne: [
													"$_id",
													new mongoose.Types.ObjectId(String(userId)),
												],
										  }
										: {
												$eq: [
													"$_id",
													new mongoose.Types.ObjectId(String(userId)),
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
												new mongoose.Types.ObjectId(String(userId)),
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
	return chat[0] ?? null;
};
