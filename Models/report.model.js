import mongoose from "mongoose";

const { Schema, model } = mongoose;

const reportSchema = new Schema({
	post: {
		type: Schema.Types.ObjectId,
		ref: "Post",
		required: true,
	},
	reportedBy: [
		{
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
	],
	reportReason: {
		type: String,
		required: true,
	},
	reportDate: {
		type: Date,
		default: Date.now,
	},
});

const Report = model("Report", reportSchema);

export default Report;
