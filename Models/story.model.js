import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { MODELS } from "../utils/constants.js";

const { Schema, model } = mongoose;

const storySchema = new Schema(
	{
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
		aspectRatio: {
			type: Number,
			required: true,
			default: 9 / 16,
		},
		user: {
			type: Schema.Types.ObjectId,
			ref: MODELS.USER,
			required: true,
		},
		views: [
			{
				type: Schema.Types.ObjectId,
				ref: MODELS.USER,
			},
		],
		likes: [
			{
				type: Schema.Types.ObjectId,
				ref: MODELS.USER,
			},
		],
		mentions: [
			{
				type: Schema.Types.ObjectId,
				ref: MODELS.USER,
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
