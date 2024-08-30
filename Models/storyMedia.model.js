import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const { Schema, model } = mongoose;

const storyMediaSchema = new Schema(
	{
		story: {
			type: Schema.Types.ObjectId,
			ref: "Story",
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
		mentions: [
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

storyMediaSchema.index({ content: "text" });

const StoryMedia = model("StoryMedia", storyMediaSchema);

export default StoryMedia;
