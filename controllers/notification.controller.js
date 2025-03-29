import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiSuccess } from "../utils/ApiSuccess.js";
import webpush from "web-push";
import NotiSubscription from "../Models/notisubscription.model.js";
import dotenv from "dotenv";
dotenv.config();

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

	// // web-push config
	webpush.setVapidDetails(
		"mailto:hamdankz786@gmail.com",
		process.env.PUBLIC_VAPID_KEY,
		process.env.PRIVATE_VAPID_KEY
	);
	//push notification using web-push
	webpush
		.sendNotification(userSubscription.subscription, payload)
		.then((response) => {
			console.log(response);
			return ApiSuccess(res, "Notification sent successfully.", {});
		})
		.catch((error) => {
			console.error("Push Notification Error:", error);
			return next(new ApiError(500, "Failed to send push notification."));
		});
});
