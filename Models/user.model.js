import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

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
		refreshToken: {
			type: String,
			unique: true,
		},
	},
	{
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
		timestamps: true,
	}
);

userSchema.index({ name: "text" });

userSchema.virtual("isFollowing", {
	ref: "Relationship",
	localField: "_id",
	foreignField: "following",
	justOne: true,
	options: { match: { follower: null } },
});

userSchema.pre("save", async (next) => {
	if (!this.isModified("password")) return next();
	this.password = await bcrypt.hash(this.password, 10);
	next();
});

userSchema.methods.isPasswordCorrect = async (password) => {
	return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = async () => {
	jwt.sign(
		{ _id: this._id, userName: this.userName, role: this.role },
		process.env.JWT_SECRET,
		{ expiresIn: process.env.JWT_EXPIRY }
	);
};

userSchema.methods.generateRefreshToken = async () => {
	jwt.sign({ _id: this._id }, process.env.JWT_REFRESH_SECRET, {
		expiresIn: process.env.JWT_REFRESH_EXPIRY,
	});
};

const User = model("User", userSchema);

export default User;
