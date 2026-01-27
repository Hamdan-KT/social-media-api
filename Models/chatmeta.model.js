import mongoose from "mongoose";
import { MODELS } from "../utils/constants.js";

const { Schema, model } = mongoose;

const chatMetaSchema = new Schema(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: MODELS.USER,
		},
		chat: {
			type: Schema.Types.ObjectId,
			ref: MODELS.CHAT,
		},
		lastReadAt: {
			type: Date,
			default: Date.now,
		},
		unreadMessagesCount: {
			type: Number,
			default: 0,
		},
	},
	{ timestamps: true },
);

export const ChatMeta = model(MODELS.CHATMETA, chatMetaSchema);
