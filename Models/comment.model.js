import mongoose from "mongoose";

const { Schema, model } = mongoose;

const commentSchema = new Schema(
	{
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
			ref: "Post",
		},
		likes: [
			{
				type: Schema.Types.ObjectId,
				ref: "User",
				default: [],
			},
		],
	},
	{
		timestamps: true,
	}
);

const Comment = model("Comment", commentSchema);

export default Comment;
