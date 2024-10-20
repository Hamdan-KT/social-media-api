import mongoose from "mongoose";
import { MODELS } from "../utils/constants.js";

const { Schema, model } = mongoose;

const commentSchema = new Schema(
	{
		parent_comment: {
			type: Schema.Types.ObjectId,
			ref: MODELS.COMMENT,
		},
		content: {
			type: String,
			required: true,
			trim: true,
		},
		user: {
			type: Schema.Types.ObjectId,
			ref: MODELS.USER,
		},
		post: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: MODELS.POST,
		},
		type: {
			type: String,
			enum: ["general", "reply"],
			default: "generel",
		},
		likes: [
			{
				type: Schema.Types.ObjectId,
				ref: MODELS.USER,
				default: [],
			},
		],
		mentions: [{ type: Schema.Types.ObjectId, ref: MODELS.USER }],
	},
	{
		timestamps: true,
	}
);

const Comment = model(MODELS.COMMENT, commentSchema);

export default Comment;
