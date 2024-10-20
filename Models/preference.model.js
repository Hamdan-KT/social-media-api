import mongoose from "mongoose";
import { MODELS } from "../utils/constants.js";

const { Schema, model } = mongoose;

const preferenceSchema = new Schema(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: MODELS.USER,
			required: true,
			unique: true,
		},
		enableContextBasedAuth: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
);

const Preference = model(MODELS.PREFERENCE, preferenceSchema);

export default Preference;
