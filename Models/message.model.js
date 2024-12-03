import mongoose from "mongoose";
import { MESSAGE_TYPES, MODELS } from "../utils/constants";

const { Schema, model, Types } = mongoose;

// Media schema
const MediaSchema = new Schema({
	type: {
		type: String,
		enum: ["image", "video", "audio", "file", "post"],
		required: true,
	},
	url: { type: String, required: true },
	thumbnail: { type: String },
	duration: { type: Number },
});

// Message schema
const MessageSchema = new Schema(
	{
		sender: {
			type: Types.ObjectId,
			ref: MODELS.USER,
			required: true,
		},
		chat: {
			type: Types.ObjectId,
			ref: MODELS.CHAT,
			required: true,
		},
		type: {
			type: String,
			enum: [MESSAGE_TYPES.GENERAL, MESSAGE_TYPES.REPLY],
			default: MESSAGE_TYPES.GENERAL,
		},
		replyRef: {
			type: Types.ObjectId,
			ref: MODELS.MESSAGE,
			required: function () {
				return this.type === MESSAGE_TYPES.REPLY;
			},
		},
		content: {
			type: String,
			default: null,
		},
		media: [MediaSchema],
		reactions: [
			{
				user: { type: Types.ObjectId, ref: MODELS.USER },
				emoji: { type: String }, // Store the emoji as a string (e.g., "❤️")
			},
		],
		readBy: [{ type: Types.ObjectId, ref: MODELS.USER }],
	},
	{ timestamps: true }
);

export const Message = model(MODELS.MESSAGE, MessageSchema);
