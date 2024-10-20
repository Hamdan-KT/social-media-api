import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { MODELS } from "../utils/constants.js";

const { Schema, model } = mongoose;

const postSchema = new Schema(
	{
		files: [
			{
				type: Schema.Types.ObjectId,
				required: true,
				ref: MODELS.POST_MEDIA,
			},
		],
		aspectRatio: {
			type: String,
			required: true,
			default: "4/5",
			enum: ["1/1", "4/5", "16/9"],
		},
		user: {
			type: Schema.Types.ObjectId,
			ref: MODELS.USER,
			required: true,
		},
		comments: [
			{
				type: Schema.Types.ObjectId,
				ref: MODELS.COMMENT,
			},
		],
		likes: [
			{
				type: Schema.Types.ObjectId,
				ref: MODELS.USER,
			},
		],
		reportedBy: [
			{
				type: Schema.Types.ObjectId,
				ref: MODELS.USER,
			},
		],
		caption: {
			type: String,
			trim: true,
		},
		location: {
			type: String,
		},
		music: {
			type: String,
		},
		isHideLikes: {
			type: Boolean,
			default: false,
		},
		isDisableComment: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: true,
	}
);

postSchema.index({ content: "text" });

postSchema.pre("deleteOne", async function (next) {
	try {
		// console.log(this.avatar);
		// if (this.avatar) {
		// 	console.log(this.avatar);
		// 	const filename = path.basename(this.avatar);
		// 	const deleteFilePromise = promisify(fs.unlink)(
		// 		path.resolve(__dirname, "../../assets/userPosts", filename)
		// 	);
		// 	await deleteFilePromise;
		// }

		await this.model(MODELS.COMMENT).deleteMany({ _id: this.comments });

		await this.model(MODELS.USER).updateMany(
			{
				savedPosts: this._id,
			},
			{
				$pull: {
					savedPosts: this._id,
				},
			}
		);

		next();
	} catch (error) {
		next(error);
	}
});

const Post = model(MODELS.POST, postSchema);

export default Post;
