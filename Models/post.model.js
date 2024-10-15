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
				ref: "PostMedia",
				required: true,
				trim: true,
			},
		],
		aspectRatio: {
			type: Number,
			required: true,
			default: 4 / 5,
			enum: [1 / 1, 4 / 5, 16 / 9],
		},
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		comments: [
			{
				type: Schema.Types.ObjectId,
				ref: "Comment",
			},
		],
		likes: [
			{
				type: Schema.Types.ObjectId,
				ref: "User",
			},
		],
		reportedBy: [
			{
				type: Schema.Types.ObjectId,
				ref: "User",
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

postSchema.pre("remove", async function (next) {
	try {
		if (this.fileUrl) {
			const filename = path.basename(this.fileUrl);
			const deleteFilePromise = promisify(fs.unlink)(
				path.join(__dirname, "../assets/userFiles", filename)
			);
			await deleteFilePromise;
		}

		await this.model("Comment").deleteMany({ _id: this.comments });

		await this.model("Report").deleteOne({
			post: this._id,
		});

		await this.model("User").updateMany(
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
	} catch (err) {
		next(err);
	}
});

const Post = model(MODELS.POST, postSchema);

export default Post;
