import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { MODELS } from "../utils/constants.js";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
				ref: MODELS.USER,
			},
		],
		following: [
			{
				type: Schema.Types.ObjectId,
				ref: MODELS.USER,
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
				ref: MODELS.POST,
				default: [],
			},
		],
		isPublic: {
			type: Boolean,
			default: true,
		},
		isVerified: {
			type: Boolean,
			default: false,
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

userSchema.pre("save", async function (next) {
	if (this.isModified("password")) {
		let password = await bcrypt.hash(this.password, 10);
		this.password = password;
	}
	next();
});

userSchema.pre("deleteOne", async function (next) {
	try {
		// console.log(this);
		console.log(this.avatar);
		if (this.avatar) {
			console.log(this.avatar);
			const filename = path.basename(this.avatar);
			const deleteFilePromise = promisify(fs.unlink)(
				path.resolve(__dirname, "../../assets/userAvatars", filename)
			);
			await deleteFilePromise;
		}
		next();
	} catch (error) {
		next(error);
	}
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
