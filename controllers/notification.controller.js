import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiSuccess } from "../utils/ApiSuccess.js";
import webpush from "web-push";
import NotiSubscription from "../Models/notisubscription.model.js";
import dotenv from "dotenv";
import { messaging } from "../config/firebase.js";
dotenv.config();

export const subscribeNotification = asyncHandler(async (req, res, next) => {
	const { fcmToken } = req.body;
	const userId = req.user?._id;

	console.log({ fcmToken });

	await NotiSubscription.findOneAndUpdate(
		{ userId },
		{
			$addToSet: {
				fcmTokens: fcmToken,
			},
		},
		{ upsert: true, new: true }
	);

	return ApiSuccess(res, "user subscribed for notification.", {});
});

export const sendNotification = asyncHandler(async (req, res, next) => {
	const userId = req.user?._id;
	console.log({ userId });
	const { title, body } = req.body;
	const notificationSub = await NotiSubscription.findOne({ userId });
	console.log({ notificationSub });
	if (!notificationSub) {
		return next(new ApiError(404, "notification subscription not found."));
	}
	if (!notificationSub.fcmTokens?.length) {
		return next(new ApiError(404, "notification tokens not found."));
	}

	const message = {
		notification: {
			title,
			body,
		},
		tokens: notificationSub.fcmTokens,
	};

	try {
		const response = await messaging.sendEachForMulticast(message);
		console.log("Notification sent:", response);
		return ApiSuccess(res, `Notification sent: to user ${userId}`, {});
	} catch (error) {
		console.error("Error sending FCM notification:", error);
	}
});

export const sendFCMToken = asyncHandler(async (req, res, next) => {
	const { fcmToken } = req.body;
	const userId = req.user?._id;
	console.log({ fcmToken, userId });

	await NotiSubscription.findOneAndUpdate(
		{ userId },
		{
			$addToSet: {
				fcmTokens: fcmToken,
			},
		},
		{ upsert: true, new: true }
	);

	return ApiSuccess(
		res,
		"user subscribed for notification, fcm token saved!.",
		{}
	);
});
