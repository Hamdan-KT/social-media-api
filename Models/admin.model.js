import mongoose from "mongoose";
import bcrypt from "bcrypt";

const { Schema, model } = mongoose;

const adminSchema = new Schema(
	{
		username: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		password: {
			type: String,
			required: true,
			trim: true,
		},
	},
	{
		timestamps: true,
	}
);

adminSchema.pre("save", async function (next) {
	const admin = this;
	if (!admin.isModified("password")) {
		return next();
	}
	try {
		const salt = await bcrypt.genSalt(10);
		admin.password = await bcrypt.hash(admin.password, salt);
		return next();
	} catch (error) {
		return next(error);
	}
});

const Admin = model("Admin", adminSchema);

export default Admin;
