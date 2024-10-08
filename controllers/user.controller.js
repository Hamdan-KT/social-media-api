import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiSuccess } from "../utils/ApiSuccess.js";
import User from "../Models/user.model.js";
import Relationship from "../Models/relationship.model.js";
import dayjs from "dayjs";

export const getUser = asyncHandler(async (req, res, next) => {
	const userId = req.params.id;

	//check if user exist
	const user = await User.findById(userId).select(
		"-password -refreshToken -savedPosts"
	);

	if (!user) {
		return next(new ApiError(404, "user not found."));
	}

	//check already following or relation exist
	const isFollowing = await Relationship.findOne({
		follower: req.user._id,
		following: userId,
	});

	//get current user following list
	const currentUserFollowing = await User.findById(req.user._id).select(
		"-password -refreshToken -savedPosts"
	);

	// get list of mutual followers
	const mutualFollowingUsers = await Relationship.find({
		follower: { $in: currentUserFollowing.following },
		following: userId,
	}).populate("follower", "_id userName name avatar");

	const responseData = {
		userName: user.userName,
		name: user.name,
		email: user.email,
		avatar: user.avatar,
		followersCount: user.followers.length,
		followingCount: user.following.length,
		role: user.role,
		bio: user.bio,
		isPublic: user.isPublic,
		isFollowing: !!isFollowing,
		followingSince: isFollowing
			? dayjs(isFollowing.createdAt).format("MMMM D, YYYY")
			: null,
		joinedOn: dayjs(user.createdAt).format("MMMM D, YYYY"),
		followedBy: mutualFollowingUsers.length
			? mutualFollowingUsers.slice(0, 4)
			: [],
		followedByCount: mutualFollowingUsers.length,
	};

	ApiSuccess(res, "user fetch successfull", responseData);
});

export const getUsers = asyncHandler(async (req, res, next) => {});

export const updateUser = asyncHandler(async (req, res, next) => {
	const { userName, name, bio, email } = req.body;

	//check user exist
	const user = await User.findById(req.user._id);

	if (!user) {
		return next(new ApiError(404, "user not found!"));
	}

	const updatedUser = await User.findByIdAndUpdate(
		req.user._id,
		{
			$set: {
				name,
				userName,
				email,
				bio,
			},
		},
		{ new: true }
	);

	return ApiSuccess(res, "user info updated successfull", updatedUser, 201);
});

export const deleteUser = asyncHandler(async (req, res, next) => {
	const userId = req.params.id;

	// check if user is exist
	const user = await User.findById(userId);

	if (!user) {
		return next(new ApiError(404, "user not found."));
	}

	// validate authorized user
	if (user._id !== req.user._id || req.user.role !== "admin") {
		return next(
			new ApiError(403, "you are not authorized to perform this operation.")
		);
	}

	await User.deleteOne({ _id: req.params.id });

	return ApiSuccess(res, "user deleted successfull");
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

	const relationShips = await Relationship.find({
		follower: req.params.id,
	})
		.sort({ createdAt: -1 })
		.populate("following", "_id userName name avatar")
		.lean();

	const formattedFollowingUsers = relationShips.map((relationShip) => ({
		...relationShip.following,
		followingSince: relationShip.createdAt,
	}));

	return ApiSuccess(
		res,
		"following users fetch successfull.",
		formattedFollowingUsers
	);
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

	const relationShips = await Relationship.find({
		following: req.params.id,
	})
		.sort({ createdAt: -1 })
		.populate("follower", "_id userName name avatar")
		.lean();

	const formattedFollowerUsers = relationShips.map((relationShip) => ({
		...relationShip.follower,
		followerSince: relationShip.createdAt,
	}));

	return ApiSuccess(
		res,
		"follower users fetch successfull.",
		formattedFollowerUsers
	);
});

export const getMuturalUsers = asyncHandler(async (req, res, next) => {
	const user = await User.findById(req.params.id);

	if (!user) {
		return next(new ApiError(404, "user not found."));
	}

	//get current user following list
	const currentUserFollowing = await User.findById(req.user._id).select(
		"-password -refreshToken -savedPosts"
	);

	// get list of mutual followers
	const mutualFollowingUsers = await Relationship.find({
		follower: { $in: currentUserFollowing.following },
		following: req.params.id,
	}).populate("follower", "_id userName name avatar");

	const formattedMutualFollowingUsers = mutualFollowingUsers.map(
		(relationShip) => ({
			...relationShip.follower,
			followerSince: relationShip.createdAt,
		})
	);

	return ApiSuccess(
		res,
		"mutual users fetch successfull.",
		formattedMutualFollowingUsers
	);
});

export const follow = asyncHandler(async (req, res, next) => {
	const followerId = req.user._id;
	const followingId = req.params.id;

	//check if user already following or relation exist
	const relationshipExist = Relationship.exists({
		follower: followerId,
		following: followingId,
	});

	if (relationshipExist) {
		return next(new ApiError(400, "you are already following this user."));
	}

	await Promise.all([
		User.findOneAndUpdate(
			{ _id: followerId },
			{
				$addToSet: {
					following: followingId,
				},
			},
			{ new: true }
		),
		User.findOneAndUpdate(
			{ _id: followingId },
			{
				$addToSet: {
					followers: followerId,
				},
			},
			{ new: true }
		),
	]);

	await Relationship.create({
		follower: followerId,
		following: followingId,
	});

	return ApiSuccess(res, "user followed successfull.");
});

export const unfollow = asyncHandler(async (req, res, next) => {
	const followerId = req.user._id;
	const followingId = req.params.id;

	//check if user already following or relation exist
	const relationshipExist = Relationship.exists({
		follower: followerId,
		following: followingId,
	});

	if (!relationshipExist) {
		return next(new ApiError(400, "you are not already following this user."));
	}

	await Promise.all([
		User.findOneAndUpdate(
			{ _id: followerId },
			{
				$pull: {
					following: followingId,
				},
			},
			{ new: true }
		),
		User.findOneAndUpdate(
			{ _id: followingId },
			{
				$pull: {
					followers: followerId,
				},
			},
			{ new: true }
		),
	]);

	await Relationship.deleteOne({
		follower: followerId,
		following: followingId,
	});

	return ApiSuccess(res, "user unfollowed successfull.");
});
