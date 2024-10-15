import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { MODELS } from "../utils/constants.js";

const { Schema, model, } = mongoose;

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
		gender: {
			type: String,
			enum: ["male", "female", "others"],
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
		refreshToken: {
			type: String,
			default: null,
		},
	},
	{
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
		timestamps: true,
	}
);

// userSchema.virtual("isFollowing", {
// 	ref: "Relationship",
// 	localField: "_id",
// 	foreignField: "following",
// 	justOne: true,
// 	options: { match: { follower: null } },
// });

userSchema.pre("save", async function (next) {
	if (this.isModified("password")) {
		let password = await bcrypt.hash(this.password, 10);
		this.password = password;
	}
	next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
	return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = async function () {
	return jwt.sign(
		{ _id: this._id, userName: this.userName, role: this.role },
		process.env.JWT_SECRET,
		{ expiresIn: process.env.JWT_EXPIRY }
	);
};

userSchema.methods.generateRefreshToken = async function () {
	return jwt.sign({ _id: this._id }, process.env.JWT_REFRESH_SECRET, {
		expiresIn: process.env.JWT_REFRESH_EXPIRY,
	});
};

const User = model(MODELS.USER, userSchema);

export default User;
