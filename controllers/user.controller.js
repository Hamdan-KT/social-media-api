import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiSuccess } from "../utils/ApiSuccess.js";
import User from "../Models/user.model.js";
import Relationship from "../Models/relationship.model.js";
import dayjs from "dayjs";
import { MODELS, RELATION_STATUS_TYPES } from "../utils/constants.js";
import mongoose from "mongoose";

export const getUser = asyncHandler(async (req, res, next) => {
	const userId = req.params.id;

	const result = await User.aggregate([
		{
			$match: { _id: new mongoose.Types.ObjectId(String(userId)) },
		},
		{
			$project: {
				password: 0,
				refreshToken: 0,
				savedPosts: 0,
			},
		},
		{
			$lookup: {
				from: MODELS.RELATIONSHIP,
				let: { userId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: [
											"$follower",
											new mongoose.Types.ObjectId(String(req.user._id)),
										],
									},
									{ $eq: ["$following", "$$userId"] },
									{ $eq: ["$status", RELATION_STATUS_TYPES.FOLLOWING] },
								],
							},
						},
					},
				],
				as: "myrelationship",
			},
		},
		{
			$addFields: {
				isFollowing: { $gt: [{ $size: "$myrelationship" }, 0] },
				followingSince: {
					$cond: {
						if: { $gt: [{ $size: "$myrelationship" }, 0] },
						then: { $arrayElemAt: ["$myrelationship.createdAt", 0] },
						else: null,
					},
				},
				followingStatus: { $arrayElemAt: ["$myrelationship.status", 0] },
			},
		},
		{
			$lookup: {
				from: MODELS.USER,
				localField: "_id",
				foreignField: "following",
				as: "currentUserFollowing",
			},
		},
		{
			$lookup: {
				from: MODELS.RELATIONSHIP,
				let: { followingIds: "$currentUserFollowing._id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $in: ["$follower", "$$followingIds"] },
									{
										$eq: [
											"$following",
											new mongoose.Types.ObjectId(String(userId)),
										],
									},
									{ $eq: ["$status", RELATION_STATUS_TYPES.FOLLOWING] },
								],
							},
						},
					},
					// { $limit: 3 },
				],
				as: "mutualFollowingUsers",
			},
		},
		{
			$lookup: {
				from: MODELS.USER,
				localField: "mutualFollowingUsers.follower",
				foreignField: "_id",
				as: "mutualFollowingUserDetails",
			},
		},
		{
			$addFields: {
				mutualUsers: {
					$map: {
						input: "$mutualFollowingUserDetails",
						as: "user",
						in: {
							_id: "$$user._id",
							userName: "$$user.userName",
							avatar: "$$user.avatar",
						},
					},
				},
				followedByCount: { $size: "$mutualFollowingUsers" },
				followingCount: { $size: "$following" },
				followersCount: { $size: "$followers" },
			},
		},
		{
			$project: {
				currentUserFollowing: 0,
				mutualFollowingUserDetails: 0,
				mutualFollowingUsers: 0,
				followers: 0,
				following: 0,
				myrelationship: 0,
			},
		},
	]);

	if (!result.length) {
		return next(new ApiError(404, "User not found."));
	}

	const user = result[0];

	const responseData = {
		...user,
		joinedOn: user.createdAt
			? dayjs(user.createdAt).format("MMMM D, YYYY")
			: null,
		followingSince: user.followingSince
			? dayjs(user.followingSince).format("MMMM D, YYYY")
			: null,
	};

	ApiSuccess(res, "User fetch successful", responseData);
});

export const getUsers = asyncHandler(async (req, res, next) => {
	const relationShips = await User.aggregate([
		{
			$match: {
				_id: { $ne: new mongoose.Types.ObjectId(String(req.user._id)) },
			},
		},
		{
			$lookup: {
				from: MODELS.RELATIONSHIP,
				let: { userId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$following", "$$userId"] },
									{
										$eq: [
											"$follower",
											new mongoose.Types.ObjectId(String(req.user._id)),
										],
									},
								],
							},
						},
					},
				],
				as: "myrelationship",
			},
		},
		{
			$addFields: {
				isFollowing: {
					$cond: {
						if: { $gt: [{ $size: "$myrelationship" }, 0] }, // Check if a relationship exists
						then: {
							$eq: [
								{ $arrayElemAt: ["$myrelationship.status", 0] },
								RELATION_STATUS_TYPES.FOLLOWING,
							],
						}, // Only mark as "following" if the status is FOLLOWING
						else: false,
					},
				},
				followingStatus: { $arrayElemAt: ["$myrelationship.status", 0] },
			},
		},
		{ $sort: { createdAt: -1 } },
		{
			$project: {
				_id: 1,
				userName: 1,
				name: 1,
				avatar: 1,
				isPublic: 1,
				isFollowing: 1,
				followingStatus: 1,
			},
		},
	]);

	return ApiSuccess(res, "following users fetch successfull.", relationShips);
});

export const updateUser = asyncHandler(async (req, res, next) => {
	try {
		const { name, bio, email, gender } = req.body;

		//check user exist
		const user = await User.findById(req.user?._id);

		if (!user) {
			return next(new ApiError(404, "user not found!"));
		}

		const updatedUser = await User.findByIdAndUpdate(
			req.user._id,
			{
				$set: {
					name,
					email,
					bio,
					gender,
				},
			},
			{ new: true }
		).select("-password -refreshToken -savedPosts -followers -following");

		return ApiSuccess(res, "user info updated successfull", updatedUser, 201);
	} catch (error) {
		return next(
			new ApiError(
				400,
				"error occured while updating profile info, please try again."
			)
		);
	}
});

export const updateUserAvatar = asyncHandler(async (req, res, next) => {
	try {
		const avatar = `${req.protocol}://${req.get("host")}/assets/userAvatars/${
			req?.file?.filename
		}`;

		const updatedUser = await User.findByIdAndUpdate(
			req.user._id,
			{
				$set: {
					avatar,
				},
			},
			{ new: true }
		).select("-password -refreshToken -savedPosts -followers -following");

		return ApiSuccess(res, "user avatar updated successfull", updatedUser, 201);
	} catch (error) {
		return next(
			new ApiError(
				400,
				"error occured while updating user avtar, please try again."
			)
		);
	}
});

export const deleteUser = asyncHandler(async (req, res, next) => {
	try {
		const userId = req.params.id;

		// check if user is exist
		const user = await User.findById(userId);

		if (!user) {
			return next(new ApiError(404, "user not found."));
		}

		// validate authorized user
		if (
			user._id.toString() !== req.user?._id.toString() &&
			req.user.role !== "admin"
		) {
			return next(
				new ApiError(403, "you are not authorized to perform this operation.")
			);
		}

		await User.deleteOne({ _id: req.params.id });

		return ApiSuccess(res, "user deleted successfull");
	} catch (error) {
		return next(
			new ApiError(
				400,
				"error occured while deleting user account, please try again."
			)
		);
	}
});

export const getFollowingUsers = asyncHandler(async (req, res, next) => {
	const user = await User.findById(req.params.id);

	if (!user) {
		return next(new ApiError(404, "user not found."));
	}

	if (!user.isPublic && req.params.id !== req.user._id) {
		return next(
			new ApiError(
				"this is a private account. you need this account owner's permission to access this specific data."
			)
		);
	}

	const relationShips = await Relationship.aggregate([
		{
			$match: {
				follower: new mongoose.Types.ObjectId(String(req.params.id)),
				status: RELATION_STATUS_TYPES.FOLLOWING,
			},
		},
		{
			$lookup: {
				from: MODELS.USER,
				localField: "following",
				foreignField: "_id",
				as: "followingUserDetails",
			},
		},
		{
			$unwind: "$followingUserDetails",
		},
		{
			$lookup: {
				from: MODELS.RELATIONSHIP,
				let: { followingUserId: "$followingUserDetails._id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$following", "$$followingUserId"] },
									{
										$eq: [
											"$follower",
											new mongoose.Types.ObjectId(String(req.user._id)),
										],
									},
									{
										$ne: ["$status", RELATION_STATUS_TYPES.NOT_FOLLOWING],
									},
								],
							},
						},
					},
				],
				as: "myrelationship",
			},
		},
		{
			$addFields: {
				isFollowing: {
					$cond: {
						if: { $gt: [{ $size: "$myrelationship" }, 0] }, // Check if a relationship exists
						then: {
							$eq: [
								{ $arrayElemAt: ["$myrelationship.status", 0] },
								RELATION_STATUS_TYPES.FOLLOWING,
							],
						}, // Only mark as "following" if the status is FOLLOWING
						else: false,
					},
				},
				followingStatus: { $arrayElemAt: ["$myrelationship.status", 0] },
			},
		},
		{ $sort: { createdAt: -1 } },
		{
			$project: {
				_id: "$followingUserDetails._id",
				userName: "$followingUserDetails.userName",
				name: "$followingUserDetails.name",
				avatar: "$followingUserDetails.avatar",
				isPublic: "$followingUserDetails.isPublic",
				isFollowing: 1,
				followingStatus: 1,
			},
		},
	]);

	return ApiSuccess(res, "following users fetch successfull.", relationShips);
});

export const getFollowerUsers = asyncHandler(async (req, res, next) => {
	const user = await User.findById(req.params.id);

	if (!user) {
		return next(new ApiError(404, "user not found."));
	}

	if (!user.isPublic && req.params.id !== req.user._id) {
		return next(
			new ApiError(
				"this is a private account. you need this account owner's permission to access this specific data."
			)
		);
	}

	const relationShips = await Relationship.aggregate([
		{
			$match: {
				following: new mongoose.Types.ObjectId(String(req.params.id)),
				status: RELATION_STATUS_TYPES.FOLLOWING,
			},
		},
		{
			$lookup: {
				from: MODELS.USER,
				localField: "follower",
				foreignField: "_id",
				as: "followerUserDetails",
			},
		},
		{
			$unwind: "$followerUserDetails",
		},
		{
			$lookup: {
				from: MODELS.RELATIONSHIP,
				let: { followingUserId: "$followerUserDetails._id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$following", "$$followingUserId"] },
									{
										$eq: [
											"$follower",
											new mongoose.Types.ObjectId(String(req.user._id)),
										],
									},
									{
										$ne: ["$status", RELATION_STATUS_TYPES.NOT_FOLLOWING],
									},
								],
							},
						},
					},
				],
				as: "myrelationship",
			},
		},
		{
			$addFields: {
				isFollowing: {
					$cond: {
						if: { $gt: [{ $size: "$myrelationship" }, 0] }, // Check if a relationship exists
						then: {
							$eq: [
								{ $arrayElemAt: ["$myrelationship.status", 0] },
								RELATION_STATUS_TYPES.FOLLOWING,
							],
						}, // Only mark as "following" if the status is FOLLOWING
						else: false,
					},
				},
				followingStatus: { $arrayElemAt: ["$myrelationship.status", 0] },
			},
		},
		{ $sort: { createdAt: -1 } },
		{
			$project: {
				_id: "$followerUserDetails._id",
				userName: "$followerUserDetails.userName",
				name: "$followerUserDetails.name",
				avatar: "$followerUserDetails.avatar",
				isPublic: "$followerUserDetails.isPublic",
				isFollowing: 1,
				followingStatus: 1,
			},
		},
	]);

	return ApiSuccess(res, "follower users fetch successfull.", relationShips);
});

export const getMuturalUsers = asyncHandler(async (req, res, next) => {
	const user = await User.findById(req.params.id);

	if (!user) {
		return next(new ApiError(404, "user not found."));
	}

	// get list of mutual followers
	const mutualFollowingUsers = await Relationship.aggregate([
		{
			$match: {
				follower: new mongoose.Types.ObjectId(String(req.user._id)),
				status: RELATION_STATUS_TYPES.FOLLOWING,
			},
		},
		{
			$lookup: {
				from: MODELS.RELATIONSHIP,
				let: { followingUser: "$following" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: [
											"$follower",
											new mongoose.Types.ObjectId(String(req.params.id)),
										],
									},
									{
										$eq: ["$following", "$$followingUser"],
									},
									{
										$eq: ["$status", RELATION_STATUS_TYPES.FOLLOWING],
									},
								],
							},
						},
					},
				],
				as: "mutual",
			},
		},
		{
			$match: {
				mutual: { $ne: [] },
			},
		},
		{
			$lookup: {
				from: MODELS.USER,
				localField: "following",
				foreignField: "_id",
				as: "mutualUserDetails",
			},
		},
		{
			$unwind: "$mutualUserDetails",
		},
		{
			$addFields: {
				isFollowing: {
					$cond: {
						if: { $eq: ["$status", RELATION_STATUS_TYPES.FOLLOWING] },
						then: true,
						else: false,
					},
				},
			},
		},
		{
			$project: {
				_id: "$mutualUserDetails._id",
				userName: "$mutualUserDetails.userName",
				name: "$mutualUserDetails.name",
				avatar: "$mutualUserDetails.avatar",
				isPublic: "$mutualUserDetails.isPublic",
				followingStatus: "$status",
				isFollowing: 1,
			},
		},
	]);

	return ApiSuccess(
		res,
		"mutual users fetch successfull.",
		mutualFollowingUsers
	);
});

export const follow = asyncHandler(async (req, res, next) => {
	const followerId = req.user._id;
	const followingId = req.params.id;

	// prevent users from following themselves
	if (followerId.toString() === followingId.toString()) {
		return next(new ApiError(400, "You cannot follow yourself."));
	}

	// check if the user to be followed exists
	const followingUser = await User.findById(followingId);
	if (!followingUser) {
		return next(new ApiError(404, "User not found."));
	}

	// check if a relationship already exists between the follower and following user
	const relationshipExist = await Relationship.findOne({
		follower: followerId,
		following: followingId,
	});

	// if a relationship exists, handle the status accordingly
	if (relationshipExist) {
		if (relationshipExist.status === RELATION_STATUS_TYPES.FOLLOWING) {
			return next(new ApiError(400, "You are already following this user."));
		}
		if (relationshipExist.status === RELATION_STATUS_TYPES.REQUESTED) {
			return next(
				new ApiError(
					400,
					"You have already sent a follow request to this user."
				)
			);
		}
	}

	// determine the relationship status (following or requested) based on the user's privacy settings
	let status = RELATION_STATUS_TYPES.FOLLOWING;

	if (!followingUser.isPublic) {
		// If the user has a private account, set the status to 'requested'
		status = RELATION_STATUS_TYPES.REQUESTED;
	}

	// create the relationship in the Relationship collection
	await Relationship.create({
		follower: followerId,
		following: followingId,
		status,
	});

	// ff the user is public, update both users' followers and following arrays
	if (followingUser.isPublic) {
		await Promise.all([
			User.findByIdAndUpdate(
				followerId,
				{ $addToSet: { following: followingId } },
				{ new: true }
			),
			User.findByIdAndUpdate(
				followingId,
				{ $addToSet: { followers: followerId } },
				{ new: true }
			),
		]);
	}

	return ApiSuccess(
		res,
		status === RELATION_STATUS_TYPES.FOLLOWING
			? "user followed successfully."
			: "follow request sent to the user successfully."
	);
});

export const unfollow = asyncHandler(async (req, res, next) => {
	const followerId = req.user._id;
	const followingId = req.params.id;

	// check if the user to be followed exists
	const followingUser = await User.findById(followingId);
	if (!followingUser) {
		return next(new ApiError(404, "User not found."));
	}

	// prevent users from unfollowing themselves
	if (followerId.toString() === followingId.toString()) {
		return next(new ApiError(400, "You cannot unfollow yourself."));
	}

	// check if a relationship exists between the follower and the following user
	const relationshipExist = await Relationship.findOne({
		follower: followerId,
		following: followingId,
	});

	// if no relationship exists, return an error
	if (!relationshipExist) {
		return next(
			new ApiError(
				400,
				"You are not following or have not requested to follow this user."
			)
		);
	}

	// handling if the relationship is in the 'requested' or 'following' state
	if (relationshipExist.status === RELATION_STATUS_TYPES.FOLLOWING) {
		// if the user is following, update the followers and following arrays and delete the relationship
		await Promise.all([
			User.findByIdAndUpdate(
				followerId,
				{
					$pull: { following: followingId },
				},
				{ new: true }
			),
			User.findByIdAndUpdate(
				followingId,
				{
					$pull: { followers: followerId },
				},
				{ new: true }
			),
		]);
	} else if (relationshipExist.status === RELATION_STATUS_TYPES.REQUESTED) {
		// if the relationship is in the 'requested' state, we just remove the follow request
		await Relationship.deleteOne({
			_id: relationshipExist._id,
		});
		return ApiSuccess(res, "Follow request canceled successfully.");
	}

	// Remove the relationship from the Relationship collection
	await Relationship.deleteOne({
		follower: followerId,
		following: followingId,
	});

	return ApiSuccess(res, "User unfollowed successfully.");
});

export const acceptFollowRequest = asyncHandler(async (req, res, next) => {
	const currentUserId = req.user._id;
	const followerId = req.params.id;

	// check if the user to be followed exists
	const followerUser = await User.findById(followerId);
	if (!followerUser) {
		return next(new ApiError(404, "User not found."));
	}

	// prevent users from unfollowing themselves
	if (followerId.toString() === currentUserId.toString()) {
		return next(new ApiError(400, "You cannot accept yourself."));
	}

	// check if a relationship exists between the follower and the following user
	const relationshipExist = await Relationship.findOne({
		follower: followerId,
		following: currentUserId,
		status: RELATION_STATUS_TYPES.REQUESTED,
	});

	// if no relationship exists, return an error
	if (!relationshipExist) {
		return next(
			new ApiError(400, "You are not able to accept invalid request.")
		);
	}

	//update status to following
	relationshipExist.status = RELATION_STATUS_TYPES.FOLLOWING;
	await relationshipExist.save();

	await Promise.all([
		User.findByIdAndUpdate(
			followerId,
			{ $addToSet: { following: currentUserId } },
			{ new: true }
		),
		User.findByIdAndUpdate(
			currentUserId,
			{ $addToSet: { followers: followerId } },
			{ new: true }
		),
	]);

	return ApiSuccess(res, "User follow request accepted successfully.");
});

export const rejectFollowRequest = asyncHandler(async (req, res, next) => {
	const currentUserId = req.user._id;
	const followerId = req.params.id;

	// check if the user to be followed exists
	const followerUser = await User.findById(followerId);
	if (!followerUser) {
		return next(new ApiError(404, "User not found."));
	}

	// prevent users from unfollowing themselves
	if (followerId.toString() === currentUserId.toString()) {
		return next(new ApiError(400, "You cannot reject yourself."));
	}

	// check if a relationship exists between the follower and the following user
	const relationshipExist = await Relationship.findOne({
		follower: followerId,
		following: currentUserId,
		status: RELATION_STATUS_TYPES.REQUESTED,
	});

	// if no relationship exists, return an error
	if (!relationshipExist) {
		return next(
			new ApiError(400, "You are not able to reject invalid request.")
		);
	}

	// create the relationship in the Relationship collection
	await Relationship.deleteOne({
		follower: followerId,
		following: currentUserId,
		status: RELATION_STATUS_TYPES.REQUESTED,
	});

	return ApiSuccess(res, "User follow request rejected successfully.");
});
