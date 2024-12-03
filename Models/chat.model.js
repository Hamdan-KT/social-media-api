import mongoose from "mongoose";
import { MODELS } from "../utils/constants";

const { Schema, model, Types } = mongoose;

const ChatSchema = new Schema(
	{
		participants: [
			{
				type: Types.ObjectId,
				ref: MODELS.USER,
				required: true,
			},
		],
		lastMessage: {
			type: Types.ObjectId,
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
	{ timestamps: true }
);

export const Chat = model(MODELS.CHAT, ChatSchema);
