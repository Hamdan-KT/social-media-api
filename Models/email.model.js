import mongoose from "mongoose";
import { MODELS } from "../utils/constants.js";

const { Schema, model } = mongoose;

const emailSchema = new Schema({
	email: {
		type: String,
		required: true,
	},
	verificationCode: {
		type: String,
		required: true,
		unique: true,
	},
	messageId: {
		type: String,
		required: true,
	},
	for: {
		type: String,
		required: true,
	},
	createdAt: {
		type: Date,
		default: Date.now,
		expires: 1800, // 30 minutes
	},
});

const Email = model(MODELS.EMAIL, emailSchema);

export default Email;
