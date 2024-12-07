import mongoose from "mongoose";
import {
	MESSAGE_CONTENT_TYPES,
	MESSAGE_MEDIA_TYPES,
	MESSAGE_TYPES,
	MODELS,
} from "../utils/constants.js";

const { Schema, model, Types } = mongoose;

// Media schema
const MediaSchema = new Schema({
	type: {
		type: String,
		enum: [
			MESSAGE_MEDIA_TYPES.IMAGE,
			MESSAGE_MEDIA_TYPES.VIDEO,
			MESSAGE_MEDIA_TYPES.AUDIO,
			MESSAGE_MEDIA_TYPES.FILE,
		],
		default: MESSAGE_MEDIA_TYPES.IMAGE,
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
		messageType: {
			type: String,
			enum: [MESSAGE_TYPES.GENERAL, MESSAGE_TYPES.REPLY],
			default: MESSAGE_TYPES.GENERAL,
		},
		contentType: {
			type: String,
			enum: [MESSAGE_CONTENT_TYPES.TEXT, MESSAGE_CONTENT_TYPES.MEDIA],
			default: MESSAGE_CONTENT_TYPES.TEXT,
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
		media: {
			type: [MediaSchema],
			default: [],
			required: function () {
				this.contentType === MESSAGE_CONTENT_TYPES.MEDIA;
			},
		},
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
