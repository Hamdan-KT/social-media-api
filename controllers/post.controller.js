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

	console.log(req.body);

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
		return ApiSuccess(res, "post created successfully.", post[0]);
	} catch (error) {
		console.log(error);
		// Rollback transaction
		await session.abortTransaction();
		session.endSession();

		return next(new ApiError(500, "error occurred while uploading post."));
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
				let: { fileIds: "$files" },
				pipeline: [
					{ $match: { $expr: { $in: ["$_id", "$$fileIds"] } } },
					{ $sort: { createdAt: -1 } },
				],
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
				isLiked: {
					$cond: {
						if: {
							$in: [
								new mongoose.Types.ObjectId(String(req.user._id)),
								"$likes",
							],
						},
						then: true,
						else: false,
					},
				},
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
				isLiked: 1,
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

	post.createdAt = dayjs(post?.createdAt).fromNow(true);

	return ApiSuccess(res, "post info fetch successfull.", post);
});

export const getAllPosts = asyncHandler(async (req, res, next) => {
	const page = parseInt(req.query.page, 10) || 1;
	const limit = parseInt(req.query.limit, 10) || 10;
	const skip = (page - 1) * limit;

	let posts = await Post.aggregate([
		{
			$lookup: {
				from: MODELS.POST_MEDIA,
				let: { fileIds: "$files" },
				pipeline: [
					{ $match: { $expr: { $in: ["$_id", "$$fileIds"] } } },
					{ $sort: { createdAt: -1 } },
				],
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
				isLiked: {
					$cond: {
						if: {
							$in: [
								new mongoose.Types.ObjectId(String(req.user._id)),
								"$likes",
							],
						},
						then: true,
						else: false,
					},
				},
				isFollowing: {
					$cond: {
						if: { $gt: [{ $size: "$relationship" }, 0] },
						then: {
							$eq: [
								{ $arrayElemAt: ["$relationship.status", 0] },
								RELATION_STATUS_TYPES.FOLLOWING,
							],
						},
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
				isLiked: 1,
				likes: {
					$size: "$likes",
				},
				comments: {
					$size: "$comments",
				},
			},
		},
		{
			$sort: { createdAt: -1 }, // Sort by createdAt in descending order
		},
		{ $skip: skip }, // Skip documents for pagination
		{ $limit: limit },
	]);

	posts = posts.map((post) => {
		post.createdAt = dayjs(post?.createdAt).fromNow(true);
		return post;
	});

	return ApiSuccess(
		res,
		"Posts fetched and sorted by date successfully.",
		posts
	);
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
	const page = parseInt(req.query.page, 10) || 1;
	const limit = parseInt(req.query.limit, 10) || 10;
	const skip = (page - 1) * limit;

	const posts = await Post.aggregate([
		{
			$match: { user: new mongoose.Types.ObjectId(String(req.params.id)) },
		},
		{
			$lookup: {
				from: MODELS.POST_MEDIA,
				let: { fileIds: "$files" },
				pipeline: [
					{ $match: { $expr: { $in: ["$_id", "$$fileIds"] } } },
					{ $sort: { createdAt: -1 } },
				],
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
				isLiked: {
					$cond: {
						if: {
							$in: [
								new mongoose.Types.ObjectId(String(req.user._id)),
								"$likes",
							],
						},
						then: true,
						else: false,
					},
				},
				isFollowing: {
					$cond: {
						if: { $gt: [{ $size: "$relationship" }, 0] },
						then: {
							$eq: [
								{ $arrayElemAt: ["$relationship.status", 0] },
								RELATION_STATUS_TYPES.FOLLOWING,
							],
						},
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
				isLiked: 1,
				files: {
					_id: 1,
					fileUrl: 1,
					fileType: 1,
					altText: 1,
				},
				likes: { $size: "$likes" },
				comments: { $size: "$comments" },
			},
		},
		{ $sort: { createdAt: -1 } }, // Sort posts by createdAt in descending order
		{ $skip: skip }, // Skip documents for pagination
		{ $limit: limit },
	]);

	if (!posts.length) {
		return ApiSuccess(res, "user not posted anything yet.", posts);
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
		createdAt: dayjs(post?.createdAt).fromNow(true),
	}));

	return ApiSuccess(res, "posts fetch successfull.", formattedPosts);
});

export const savePost = asyncHandler(async (req, res, next) => {
	const postId = req.params.id;

	const post = await Post.findById(postId)
		.populate("user", "_id userName avatar isPublic")
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
		.populate("user", "_id userName avatar isPublic")
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
	const page = parseInt(req.query.page, 10) || 1;
	const limit = parseInt(req.query.limit, 10) || 10;
	const skip = (page - 1) * limit;

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
				isLiked: {
					$cond: {
						if: {
							$in: [
								new mongoose.Types.ObjectId(String(req.user._id)),
								"$post.likes",
							],
						},
						then: true,
						else: false,
					},
				},
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
				isLiked: 1,
				isFollowing: 1,
				followingStatus: 1,
				likes: { $size: "$post.likes" },
				comments: { $size: "$post.comments" },
			},
		},
		{ $sort: { createdAt: -1 } }, // Sort posts by createdAt in descending order
		{ $skip: skip }, // Skip documents for pagination
		{ $limit: limit },
	]);

	if (!posts.length) {
		return ApiSuccess(res, "user not saved anything yet.", posts);
	}

	const formattedPosts = posts?.map((post) => ({
		...post,
		createdAt: dayjs(post?.createdAt).fromNow(true),
	}));

	return ApiSuccess(res, "saved posts fetch successfull.", formattedPosts);
});

export const getTaggedPosts = asyncHandler(async (req, res, next) => {
	const page = parseInt(req.query.page, 10) || 1;
	const limit = parseInt(req.query.limit, 10) || 10;
	const skip = (page - 1) * limit;

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
				isLiked: {
					$cond: {
						if: {
							$in: [
								new mongoose.Types.ObjectId(String(req.user._id)),
								"$post.likes",
							],
						},
						then: true,
						else: false,
					},
				},
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
				isLiked: { $first: "$isLiked" },
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
				isLiked: 1,
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
		{ $sort: { createdAt: -1 } }, // Sort posts by createdAt in descending order
		{ $skip: skip }, // Skip documents for pagination
		{ $limit: limit },
	]);

	if (!posts.length) {
		return ApiSuccess(res, "user has not any tagged posts yet.", posts);
	}

	const formattedPosts = posts?.map((post) => ({
		...post,
		createdAt: dayjs(post?.createdAt).fromNow(true),
	}));

	return ApiSuccess(
		res,
		"user tagged posts fetch successfull.",
		formattedPosts
	);
});

export const getTaggedUsers = asyncHandler(async (req, res, next) => {
	const page = parseInt(req.query.page, 10) || 1;
	const limit = parseInt(req.query.limit, 10) || 10;
	const skip = (page - 1) * limit;

	const taggedUsers = await PostMedia.aggregate([
		{ $match: { _id: new mongoose.Types.ObjectId(String(req.params.id)) } },
		{ $unwind: "$tags" },
		{
			$lookup: {
				from: MODELS.USER,
				let: { taggedUser: "$tags.user" },
				pipeline: [
					{ $match: { $expr: { $eq: ["$_id", "$$taggedUser"] } } },
					{
						$project: { _id: 1, userName: 1, name: 1, isPublic: 1, avatar: 1 },
					},
				],
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
		// { $sort: { createdAt: -1 } }, // Sort posts by createdAt in descending order
		{ $skip: skip }, // Skip documents for pagination
		{ $limit: limit },
		{
			$project: {
				_id: "$user._id",
				userName: "$user.userName",
				name: "$user.name",
				isPublic: "$user.isPublic",
				avatar: "$user.avatar",
				isFollowing: 1,
				followingStatus: 1,
			},
		},
	]);

	return ApiSuccess(res, "tagged users fetch successfull.", taggedUsers);
});

export const likePost = asyncHandler(async (req, res, next) => {
	const post = await Post.findById(req.params.id)
		.populate("user", "_id userName avatar isPublic")
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
				"this post owner's account is private! you are not able to like this post until you follow this account."
			)
		);
	}

	const updatedPost = await Post.findByIdAndUpdate(
		req.params?.id,
		{
			$addToSet: {
				likes: req.user?._id,
			},
		},
		{ new: true }
	).select("-files -likes -comments -reportedBy");

	return ApiSuccess(res, "post liked successfull.", updatedPost);
});

export const unlikePost = asyncHandler(async (req, res, next) => {
	const post = await Post.findById(req.params.id)
		.populate("user", "_id userName avatar isPublic")
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

	const updatedPost = await Post.findByIdAndUpdate(
		req.params?.id,
		{
			$pull: {
				likes: req.user?._id,
			},
		},
		{ new: true }
	).select("-files -likes -comments -reportedBy");

	return ApiSuccess(res, "post unliked successfull.", updatedPost);
});

export const toggleDisableCommenting = asyncHandler(async (req, res, next) => {
	const isDisableComment = req.body?.isDisableComment;

	if (!req.params?.id) {
		return next(
			new ApiError(
				404,
				"post not found, may be it have been already deleted by owner."
			)
		);
	}
	await Post.findByIdAndUpdate(
		req.params?.id,
		{
			$set: {
				isDisableComment,
			},
		},
		{ new: true }
	).select("-files -likes -comments -reportedBy");
	return ApiSuccess(
		res,
		isDisableComment
			? "commenting disabled successfull."
			: "commenting enabled successfull.",
		{}
	);
});

export const toggleHideLikeCount = asyncHandler(async (req, res, next) => {
	const isHideLikes = req.body?.isHideLikes;
	if (!req.params?.id) {
		return next(
			new ApiError(
				404,
				"post not found, may be it have been already deleted by owner."
			)
		);
	}
	await Post.findByIdAndUpdate(
		req.params?.id,
		{
			$set: {
				isHideLikes,
			},
		},
		{ new: true }
	).select("-files -likes -comments -reportedBy");
	return ApiSuccess(
		res,
		isHideLikes
			? "like count hided successfull."
			: "like count showed successfull.",
		{}
	);
});
