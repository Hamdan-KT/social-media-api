import mongoose from "mongoose";
import { COMMENT_TYPES, MODELS } from "../utils/constants.js";

const { Schema, model } = mongoose;

const commentSchema = new Schema(
	{
		parent_comment: {
			type: Schema.Types.ObjectId,
			ref: MODELS.COMMENT,
			default: null,
		},
		post: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: MODELS.POST,
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
		type: {
			type: String,
			enum: [COMMENT_TYPES.GENERAL, COMMENT_TYPES.REPLY],
			default: COMMENT_TYPES.GENERAL,
			required: true,
			validate: {
				validator: function (value) {
					if (this.parent_comment !== null && value !== "reply") {
						return false;
					}
					if (this.parent_comment === null && value !== "general") {
						return false;
					}
					return true;
				},
				message: (props) =>
					`Invalid type: ${props.value}. Type should be "reply" if parent_comment is not null, otherwise "general".`,
			},
		},
		likes: [
			{
				type: Schema.Types.ObjectId,
				ref: MODELS.USER,
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
