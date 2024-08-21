import mongoose from "mongoose";

const { Schema, model } = mongoose;

const preferenceSchema = new Schema(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
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

const Preference = model("Preference", preferenceSchema);

export { Preference };
