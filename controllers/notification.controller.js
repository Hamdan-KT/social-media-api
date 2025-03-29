import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiSuccess } from "../utils/ApiSuccess.js";
import webpush from "web-push";
import NotiSubscription from "../Models/notisubscription.model.js";

export const subscribeNotification = asyncHandler(async (req, res, next) => {
	const { subscription } = req.body;
	const userId = req.user?._id;

	await NotiSubscription.findOneAndUpdate(
		{ userId },
		{ subscription },
		{ upsert: true, new: true }
	);

	return ApiSuccess(res, "user subscribed for notification.", {});
});

export const sendNotification = asyncHandler(async (req, res, next) => {
	const { userId, message } = req.body;
	const userSubscription = await NotiSubscription.findOne({ userId });
	if (!userSubscription) {
		return next(new ApiError(404, "User subscription not found."));
	}

	const payload = JSON.stringify({ title: "instogram", body: message });

	//push notification using web-push
	webpush
		.sendNotification(userSubscription.subscription, payload)
		.catch((err) => {
			console.log(err);
		});

	return ApiSuccess(res, "notification send successfully.", {});
});
