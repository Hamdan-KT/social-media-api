import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { MODELS } from "../utils/constants.js";

const { Schema, model } = mongoose;

const storySchema = new Schema(
	{
		file: {
			type: Schema.Types.ObjectId,
			ref: "StoryMedia",
			required: true,
			trim: true,
		},
		aspectRatio: {
			type: Number,
			required: true,
			default: 9 / 16,
		},
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		views: [
			{
				type: Schema.Types.ObjectId,
				ref: "User",
			},
		],
		likes: [
			{
				type: Schema.Types.ObjectId,
				ref: "User",
			},
		],
		music: {
			type: String,
		},
	},
	{
		timestamps: true,
	}
);

storySchema.index({ content: "text" });

const Story = model(MODELS.STORY, storySchema);

export default Story;
