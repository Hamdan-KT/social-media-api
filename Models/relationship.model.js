import mongoose from "mongoose";
import { MODELS, RELATION_STATUS_TYPES } from "../utils/constants.js";

const { Schema, model } = mongoose;

const relationshipSchema = new Schema(
	{
		follower: {
			type: Schema.Types.ObjectId,
			ref: "User",
		},
		following: {
			type: Schema.Types.ObjectId,
			ref: "User",
		},
		status: {
			type: String,
			enum: [
				RELATION_STATUS_TYPES.FOLLOWING,
				RELATION_STATUS_TYPES.REQUESTED,
				RELATION_STATUS_TYPES.NOT_FOLLOWING,
			],
			default: RELATION_STATUS_TYPES.NOT_FOLLOWING,
		},
	},
	{ timestamps: true }
);

const Relationship = model(MODELS.RELATIONSHIP, relationshipSchema);

export default Relationship;
