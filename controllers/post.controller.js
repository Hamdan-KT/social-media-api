import mongoose, { model } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiSuccess } from "../utils/ApiSuccess.js";
import Post from "../Models/post.model.js";
import User from "../Models/user.model.js";
import PostMedia from "../Models/postMedia.model.js";
import Relationship from "../Models/relationship.model.js";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import { MODELS, RELATION_STATUS_TYPES } from "../utils/constants.js";
dayjs.extend(relativeTime);

export const createPost = asyncHandler(async (req, res, next) => {
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		const {
			aspectRatio,
			caption,
			location,
			isHideLikes,
			isDisableComment,
			postData,
		} = req.body;

		// get post files
		const postFiles = req.files;

		// Create the post
		const post = await Post.create(
			[
				{
					aspectRatio,
					caption,
					location,
					isHideLikes,
					isDisableComment,
					user: req?.user?._id,
				},
			],
			{ session }
		);

		//parse json data
		const postDataParsed = JSON.parse(postData);

		//format to db structrue
		const formattedPostFilesData = postFiles?.map((file) => {
			let fileType;

			// Check file type
			if (file?.mimetype.startsWith("image/")) {
				fileType = "image";
			} else if (file?.mimetype.startsWith("video/")) {
				fileType = "video";
			}

			// Get file URL
			const fileUrl = `${req.protocol}://${req.get("host")}/assets/userPosts/${
				file?.filename
			}`;

			return {
				post: post[0]?._id,
				fileUrl,
				fileType,
				tags: postDataParsed[file?.fieldname]?.tags || [],
				altText: postDataParsed[file?.fieldname]?.altText || "",
			};
		});

		// Insert media into PostMedia collection
		const insertedMedias = await PostMedia.insertMany(formattedPostFilesData, {
			session,
		});

		post[0].files = [...insertedMedias?.map((media) => media?._id)];
		await post[0].save();

		// Commit the transaction
		await session.commitTransaction();
		session.endSession();

		post[0].createdAt = dayjs(post[0].createdAt).fromNow();
		return ApiSuccess(res, "Post created successfully.", post[0]);
	} catch (error) {
		console.log(error);
		// Rollback transaction
		await session.abortTransaction();
		session.endSession();

		return next(new ApiError(500, "Error occurred while uploading post."));
	}
});

export const updatePost = asyncHandler(async (req, res, next) => {});

export const getPost = asyncHandler(async (req, res, next) => {
	let post = await Post.aggregate([
		{
			$match: { _id: new mongoose.Types.ObjectId(String(req.params.id)) },
		},
		{
			$lookup: {
				from: MODELS.POST_MEDIA,
				localField: "files",
				foreignField: "_id",
				as: "files",
			},
		},
		{
			$lookup: {
				from: MODELS.USER,
				localField: "user",
				foreignField: "_id",
				as: "user",
			},
		},
		{ $unwind: "$user" },
		{
			$lookup: {
				from: MODELS.RELATIONSHIP,
				let: { userId: "$user._id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$following", "$$userId"],
									},
									{
										$eq: [
											"$follower",
											new mongoose.Types.ObjectId(String(req.user._id)),
										],
									},
									{ $eq: ["$status", RELATION_STATUS_TYPES.FOLLOWING] },
								],
							},
						},
					},
				],
				as: "relationship",
			},
		},
		{
			$addFields: {
				isFollowing: {
					$cond: {
						if: { $gt: [{ $size: "$relationship" }, 0] },
						then: {
							$eq: [
								{ $arrayElemAt: ["$relationship.status", 0] },
								RELATION_STATUS_TYPES.FOLLOWING,
							],
						}, // Only mark as "following" if the status is FOLLOWING
						else: false,
					},
				},
				followingStatus: { $arrayElemAt: ["$relationship.status", 0] },
			},
		},
		{
			$project: {
				_id: 1,
				files: 1,
				aspectRatio: 1,
				caption: 1,
				location: 1,
				isHideLikes: 1,
				isDisableComment: 1,
				createdAt: 1,
				isFollowing: 1,
				followingStatus: 1,
				user: {
					_id: 1,
					userName: 1,
					isPublic: 1,
					avatar: 1,
				},
				files: {
					_id: 1,
					fileUrl: 1,
					fileType: 1,
					altText: 1,
				},
				likes: {
					$size: "$likes",
				},
				comments: {
					$size: "$comments",
				},
			},
		},
	]);

	post = post.length ? post[0] : null;

	if (!post) {
		return next(
			new ApiError(
				404,
				"post not found, may be it have been already deleted by owner."
			)
		);
	}

	if (
		!post?.user?.isPublic &&
		post?.user?._id.toString() !== req.user._id.toString() &&
		!post?.isFollowing
	) {
		return next(
			new ApiError(
				400,
				"this account is private! you are not able to see this post info until you follow this account."
			)
		);
	}

	post.createdAt = dayjs(post?.createdAt).fromNow();

	return ApiSuccess(res, "post info fetch successfull.", post);
});

export const deletePost = asyncHandler(async (req, res, next) => {
	const post = await Post.findById(req.params.id)
		.populate("user", "_id userName name avatar isPublic")
		.lean();

	if (!post) {
		return next(
			new ApiError(
				404,
				"post not found, may be it have been already deleted by owner."
			)
		);
	}

	if (post.user?._id?.toString() !== req.user._id?.toString()) {
		return next(
			new ApiError(401, "you are not authorized to perform this operation.")
		);
	}

	await Post.findByIdAndDelete(post._id);

	return ApiSuccess(res, "post deleted successfull.");
});

export const getUserPosts = asyncHandler(async (req, res, next) => {
	const posts = await Post.aggregate([
		{
			$match: { user: new mongoose.Types.ObjectId(String(req.params.id)) },
		},
		{
			$lookup: {
				from: MODELS.POST_MEDIA,
				localField: "files",
				foreignField: "_id",
				as: "files",
			},
		},
		{
			$lookup: {
				from: MODELS.USER,
				localField: "user",
				foreignField: "_id",
				as: "user",
			},
		},
		{ $unwind: "$user" },
		{
			$lookup: {
				from: MODELS.RELATIONSHIP,
				let: { userId: "$user._id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$following", "$$userId"],
									},
									{
										$eq: [
											"$follower",
											new mongoose.Types.ObjectId(String(req.user._id)),
										],
									},
									{ $eq: ["$status", RELATION_STATUS_TYPES.FOLLOWING] },
								],
							},
						},
					},
				],
				as: "relationship",
			},
		},
		{
			$addFields: {
				isFollowing: {
					$cond: {
						if: { $gt: [{ $size: "$relationship" }, 0] },
						then: {
							$eq: [
								{ $arrayElemAt: ["$relationship.status", 0] },
								RELATION_STATUS_TYPES.FOLLOWING,
							],
						}, // Only mark as "following" if the status is FOLLOWING
						else: false,
					},
				},
				followingStatus: { $arrayElemAt: ["$relationship.status", 0] },
			},
		},
		{
			$project: {
				_id: 1,
				files: 1,
				aspectRatio: 1,
				caption: 1,
				location: 1,
				isHideLikes: 1,
				isDisableComment: 1,
				createdAt: 1,
				isFollowing: 1,
				followingStatus: 1,
				user: {
					_id: 1,
					userName: 1,
					isPublic: 1,
					avatar: 1,
				},
				files: {
					_id: 1,
					fileUrl: 1,
					fileType: 1,
					altText: 1,
				},
				likes: {
					$size: "$likes",
				},
				comments: {
					$size: "$comments",
				},
			},
		},
	]);

	if (!posts.length) {
		return next(new ApiError(404, "user not posted anything yet."));
	}

	if (
		!posts[0]?.user?.isPublic &&
		posts[0]?.user?._id.toString() !== req.user._id.toString() &&
		!posts[0]?.isFollowing
	) {
		return next(
			new ApiError(
				400,
				"this account is private! you are not able to see their posts until you follow this account."
			)
		);
	}

	const formattedPosts = posts?.map((post) => ({
		...post,
		createdAt: dayjs(post?.createdAt).fromNow(),
	}));

	return ApiSuccess(res, "posts fetch successfull.", formattedPosts);
});

export const savePost = asyncHandler(async (req, res, next) => {
	const postId = req.params.id;

	const post = await Post.findById(postId)
		.populate("user", "userName avatar isPublic")
		.select("-comments -likes -reportedBy")
		.lean();

	if (!post) {
		return next(
			new ApiError(
				404,
				"post not found, may be it have been already deleted by owner."
			)
		);
	}

	const isFollowing = await Relationship.exists({
		follower: req.user?._id,
		following: post?.user?._id,
		status: RELATION_STATUS_TYPES.FOLLOWING,
	});

	if (
		!post?.user?.isPublic &&
		post?.user?._id.toString() !== req.user._id.toString() &&
		!isFollowing
	) {
		return next(
			new ApiError(
				400,
				"this account is private! you are not able to save their posts until you follow this account."
			)
		);
	}

	await User.findByIdAndUpdate(
		req.user?._id,
		{
			$addToSet: {
				savedPosts: post?._id,
			},
		},
		{ new: true }
	);

	return ApiSuccess(res, "posts saved successfull.", post);
});

export const unsavePost = asyncHandler(async (req, res, next) => {
	const postId = req.params.id;

	const post = await Post.findById(postId)
		.populate("user", "userName avatar isPublic")
		.select("-comments -likes -reportedBy")
		.lean();

	if (!post) {
		return next(
			new ApiError(
				404,
				"post not found, may be it have been already deleted by owner."
			)
		);
	}

	await User.findByIdAndUpdate(
		req.user?._id,
		{
			$pull: {
				savedPosts: post?._id,
			},
		},
		{ new: true }
	);

	return ApiSuccess(res, "posts unsaved successfull.", post);
});

export const getSavedPosts = asyncHandler(async (req, res, next) => {
	const posts = await User.aggregate([
		{
			$match: {
				_id: new mongoose.Types.ObjectId(String(req.user?._id)),
			},
		},
		{
			$lookup: {
				from: MODELS.POST,
				localField: "savedPosts",
				foreignField: "_id",
				as: "post",
			},
		},
		{ $unwind: "$post" },
		{
			$lookup: {
				from: MODELS.POST_MEDIA,
				let: { postId: "$post._id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$eq: ["$post", "$$postId"],
							},
						},
					},
					{
						$project: {
							_id: 1,
							fileUrl: 1,
							fileType: 1,
							altText: 1,
						},
					},
				],
				as: "post.files",
			},
		},
		{
			$lookup: {
				from: MODELS.USER,
				localField: "post.user",
				foreignField: "_id",
				as: "postUser",
			},
		},
		{
			$unwind: "$postUser",
		},
		{
			$lookup: {
				from: MODELS.RELATIONSHIP,
				let: { userId: "$postUser._id" },
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
									{ $eq: ["$status", RELATION_STATUS_TYPES.FOLLOWING] },
								],
							},
						},
					},
				],
				as: "relationship",
			},
		},
		{
			$addFields: {
				isFollowing: {
					$cond: {
						if: { $gt: [{ $size: "$relationship" }, 0] },
						then: {
							$eq: [
								{ $arrayElemAt: ["$relationship.status", 0] },
								RELATION_STATUS_TYPES.FOLLOWING,
							],
						}, // Only mark as "following" if the status is FOLLOWING
						else: false,
					},
				},
				followingStatus: { $arrayElemAt: ["$relationship.status", 0] },
			},
		},
		{
			$project: {
				_id: "$post._id",
				files: "$post.files",
				aspectRatio: "$post.aspectRatio",
				caption: "$post.caption",
				location: "$post.location",
				isHideLikes: "$post.isHideLikes",
				isDisableComment: "$post.isDisableComment",
				createdAt: "$post.createdAt",
				user: {
					_id: "$postUser._id",
					userName: "$postUser.userName",
					isPublic: "$postUser.isPublic",
					avatar: "$postUser.avatar",
				},
				isFollowing: 1,
				followingStatus: 1,
				likes: { $size: "$post.likes" },
				comments: { $size: "$post.comments" },
			},
		},
	]);

	if (!posts.length) {
		return next(new ApiError(404, "user not saved anything yet."));
	}

	const formattedPosts = posts?.map((post) => ({
		...post,
		createdAt: dayjs(post?.createdAt).fromNow(),
	}));

	return ApiSuccess(res, "saved posts fetch successfull.", formattedPosts);
});

export const getTaggedPosts = asyncHandler(async (req, res, next) => {
	const posts = await PostMedia.aggregate([
		{
			$match: {
				"tags.user": new mongoose.Types.ObjectId(String(req.params?.id)),
			},
		},
		{
			$lookup: {
				from: MODELS.POST,
				localField: "post",
				foreignField: "_id",
				as: "post",
			},
		},
		{ $unwind: "$post" },
		{
			$lookup: {
				from: MODELS.USER,
				localField: "post.user",
				foreignField: "_id",
				as: "user",
			},
		},
		{ $unwind: "$user" },
		{
			$lookup: {
				from: MODELS.RELATIONSHIP, // Lookup to check following status
				let: { userId: "$user._id" },
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
									{ $eq: ["$status", RELATION_STATUS_TYPES.FOLLOWING] },
								],
							},
						},
					},
				],
				as: "relationship",
			},
		},
		{
			$addFields: {
				isFollowing: {
					$cond: {
						if: { $gt: [{ $size: "$relationship" }, 0] },
						then: true,
						else: false,
					},
				},
				followingStatus: { $arrayElemAt: ["$relationship.status", 0] },
			},
		},
		{ $sort: { "relationship.createdAt": -1 } },
		{
			$group: {
				_id: "$post._id",
				files: {
					$push: {
						_id: "$_id",
						fileUrl: "$fileUrl",
						fileType: "$fileType",
						altText: "$altText",
					},
				},
				aspectRatio: { $first: "$post.aspectRatio" },
				caption: { $first: "$post.caption" },
				location: { $first: "$post.location" },
				isHideLikes: { $first: "$post.isHideLikes" },
				isDisableComment: { $first: "$post.isDisableComment" },
				createdAt: { $first: "$post.createdAt" },
				user: {
					$first: {
						_id: "$user._id",
						userName: "$user.userName",
						isPublic: "$user.isPublic",
						avatar: "$user.avatar",
					},
				},
				isFollowing: { $first: "$isFollowing" },
				followingStatus: { $first: "$followingStatus" },
				likes: { $first: { $size: "$post.likes" } },
				comments: { $first: { $size: "$post.comments" } },
			},
		},
		{
			$project: {
				_id: 1,
				files: 1,
				aspectRatio: 1,
				caption: 1,
				location: 1,
				isHideLikes: 1,
				isDisableComment: 1,
				createdAt: 1,
				user: 1,
				isFollowing: 1,
				followingStatus: {
					$cond: {
						if: { $ne: ["$followingStatus", null] },
						then: "$followingStatus",
						else: "$$REMOVE",
					},
				},
				likes: 1,
				comments: 1,
			},
		},
	]);

	if (!posts.length) {
		return next(new ApiError(404, "user has not any tagged posts yet."));
	}

	const formattedPosts = posts?.map((post) => ({
		...post,
		createdAt: dayjs(post?.createdAt).fromNow(),
	}));

	return ApiSuccess(res, "saved posts fetch successfull.", formattedPosts);
});

export const getTaggedUsers = asyncHandler(async (req, res, next) => {
	
});

export const likePost = asyncHandler(async (req, res, next) => {});

export const unlikePost = asyncHandler(async (req, res, next) => {});
