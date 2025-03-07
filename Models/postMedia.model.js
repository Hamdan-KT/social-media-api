import mongoose from "mongoose";
import { COMMON_MEDIA_TYPES, MODELS } from "../utils/constants.js";

const { Schema, model } = mongoose;

const postMediaSchema = new Schema(
	{
		post: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: MODELS.POST,
		},
		fileUrl: {
			type: String,
			required: true,
			trim: true,
		},
		fileType: {
			type: String,
			required: true,
			enum: [COMMON_MEDIA_TYPES.IMAGE, COMMON_MEDIA_TYPES.VIDEO],
		},
		tags: [
			{
				user: {
					type: Schema.Types.ObjectId,
					ref: MODELS.USER,
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

const PostMedia = model(MODELS.POST_MEDIA, postMediaSchema);

export default PostMedia;
