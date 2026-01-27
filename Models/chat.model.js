import mongoose from "mongoose";
import { MODELS } from "../utils/constants.js";

const { Schema, model } = mongoose;

const ChatSchema = new Schema(
	{
		participants: [
			{
				type: Schema.Types.ObjectId,
				ref: MODELS.USER,
				required: true,
			},
		],
		lastMessage: {
			type: Schema.Types.ObjectId,
			ref: MODELS.MESSAGE,
		},
		isGroupChat: {
			type: Boolean,
			default: false,
		},
		groupName: {
			type: String,
			default: null,
		},
		groupAvatar: {
			type: String,
			default: null,
		},
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	},
);

// ChatSchema.virtual("meta", {
// 	ref: MODELS.CHATMETA,
// 	localField: "_id",
// 	foreignField: "chat",
// });

export const Chat = model(MODELS.CHAT, ChatSchema);
