import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const { Schema, model } = mongoose;

const postMediaSchema = new Schema(
	{
		post: {
			type: Schema.Types.ObjectId,
			ref: "Post",
		},
		fileUrl: {
			type: String,
			required: true,
			trim: true,
		},
		fileType: {
			type: String,
			required: true,
			enum: ["image", "video"],
		},
		tags: [
			{
				user: {
					type: Schema.Types.ObjectId,
					ref: "User",
				},
				x: { type: Number },
				y: { type: Number },
			},
		],
		altText: {
			type: String,
			trim: true,
		},
	},
	{
		timestamps: true,
	}
);

postMediaSchema.index({ content: "text" });

const PostMedia = model("PostMedia", postMediaSchema);

export default PostMedia;
