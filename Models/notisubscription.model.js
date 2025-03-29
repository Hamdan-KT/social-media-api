import { Schema, model } from "mongoose";
import { MODELS } from "../utils/constants.js";

const NotiSubscriptionSchema = new Schema({
	userId: {
		type: Schema.Types.ObjectId,
		ref: MODELS.USER,
		required: true,
	},
	subscription: {
		type: Object,
		required: true,
	},
});

const NotiSubscription = model(MODELS.NOTISUBSCRIPTION, NotiSubscriptionSchema);

export default NotiSubscription;
