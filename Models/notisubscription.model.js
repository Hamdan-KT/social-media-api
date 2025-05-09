import { Schema, model } from "mongoose";
import { MODELS } from "../utils/constants.js";

const NotiSubscriptionSchema = new Schema({
	userId: {
		type: Schema.Types.ObjectId,
		ref: MODELS.USER,
		required: true,
	},
	fcmTokens: [
		{
			type: String,
			unique: true,
		},
	],
});

const NotiSubscription = model(MODELS.NOTISUBSCRIPTION, NotiSubscriptionSchema);

export default NotiSubscription;
