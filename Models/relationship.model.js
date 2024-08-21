import mongoose from "mongoose";

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
	},
	{ timestamps: true }
);

const Relationship = model("Relationship", relationshipSchema);

export default Relationship;
