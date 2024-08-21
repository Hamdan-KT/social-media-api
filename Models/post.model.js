import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const { Schema, model } = mongoose;

const postSchema = new Schema(
	{
		content: {
			type: String,
			trim: true,
		},
		fileUrl: {
			type: String,
			trim: true,
		},
		fileType: {
			type: String,
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

const Post = model("Post", postSchema);

export default Post;
