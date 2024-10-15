import mongoose from "mongoose";
import { MODELS } from "../utils/constants.js";

const { Schema, model } = mongoose;

const contextSchema = new Schema(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		email: {
			type: String,
			required: true,
		},
		ip: {
			type: String,
			required: true,
		},
		country: {
			type: String,
			required: true,
		},
		city: {
			type: String,
			required: true,
		},
		browser: {
			type: String,
			required: true,
		},
		platform: {
			type: String,
			required: true,
		},
		os: {
			type: String,
			required: true,
		},
		device: {
			type: String,
			required: true,
		},
		deviceType: {
			type: String,
			required: true,
		},
		isTrusted: {
			type: Boolean,
			required: true,
			default: true,
		},
	},
	{
		timestamps: true,
	}
);

const Context = model(MODELS.CONTEXT, contextSchema);

export default Context;
