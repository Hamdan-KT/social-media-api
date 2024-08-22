import mongoose from "mongoose";

const { Schema, model } = mongoose;

const userSchema = new Schema(
	{
		userName: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		name: {
			type: String,
			required: true,
			trim: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		password: {
			type: String,
			required: true,
		},
		avatar: {
			type: String,
		},
		followers: [
			{
				type: Schema.Types.ObjectId,
				ref: "User",
			},
		],
		following: [
			{
				type: Schema.Types.ObjectId,
				ref: "User",
			},
		],
		location: {
			type: String,
			default: "",
		},
		bio: {
			type: String,
			default: "",
		},
		interests: {
			type: String,
			default: "",
		},
		role: {
			type: String,
			enum: ["general", "moderator", "admin"],
			default: "general",
		},
		savedPosts: [
			{
				type: Schema.Types.ObjectId,
				ref: "Post",
				default: [],
			},
		],
		isPublic: {
			type: Boolean,
			default: true,
		},
		isEmailVerified: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: true,
	}
);

userSchema.index({ name: "text" });

const User = model("User", userSchema);

export default User;
