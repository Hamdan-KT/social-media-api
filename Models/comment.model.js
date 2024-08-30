import mongoose from "mongoose";

const { Schema, model } = mongoose;

const commentSchema = new Schema(
	{
		parent_comment: {
			type: Schema.Types.ObjectId,
			ref: "Comment",
		},
		content: {
			type: String,
			required: true,
			trim: true,
		},
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
		},
		post: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: "Post",
		},
		type: {
			type: String,
			enum: ["general", "reply"],
			default: "generel",
		},
		likes: [
			{
				type: Schema.Types.ObjectId,
				ref: "User",
				default: [],
			},
		],
		mentions: [{ type: Schema.Types.ObjectId, ref: "User" }],
	},
	{
		timestamps: true,
	}
);

const Comment = model("Comment", commentSchema);

export default Comment;
