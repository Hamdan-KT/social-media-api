import mongoose from "mongoose";
import { MODELS } from "../../../utils/constants.js";
import { Message } from "../../../Models/message.model.js";

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
