import mongoose, { model } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiSuccess } from "../utils/ApiSuccess.js";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import {
	MESSAGE_MEDIA_TYPES,
	MODELS,
	RELATION_STATUS_TYPES,
} from "../utils/constants.js";
import cloudinary from "../utils/cloudinary.js";
dayjs.extend(relativeTime);
import fs from "fs";
import { getPublicIdFromCloudinaryURL } from "../utils/common.js";
import Story from "../Models/story.model.js";

export const createStory = asyncHandler(async (req, res, next) => {
	try {
		// get story files
		const storyFiles = req.files;
		
		// parse json data
		// const storyDetailsParsed = JSON.parse(storyDetails);

		// upload files to cloudianry
		const uploadToCloudinary = async (files) => {
			const uploads = files.map((file) => {
				return new Promise((resolve, reject) => {
					const uploadStream = cloudinary.uploader.upload_stream(
						{
							resource_type: "auto",
							folder: "userposts",
						},
						(error, result) => {
							if (error) return reject(error);
							const fileType = result?.resource_type;
							const fileUrl = result?.url;
							resolve({
								user: req.user?._id,
								fileUrl,
								fileType,
							});
						}
					);
					fs.createReadStream(file.path).pipe(uploadStream);
				});
			});

			// Wait for all uploads to finish
			return Promise.all(uploads);
		};

		await uploadToCloudinary(storyFiles)
			.then(async (results) => {
				// Delete temporary files
				const deletePromises = storyFiles.map((file) =>
					fs.promises.unlink(file?.path)
				);
				await Promise.all(deletePromises);

				// Insert media into PostMedia collection
				const insertedStories = await Story.insertMany(results);

				const insertedIds = [...insertedStories?.map((media) => media?._id)];

				return ApiSuccess(res, "story created successfully.", insertedIds);
			})
			.catch((error) => {
				console.error("Error uploading files:", error);
			});
		res.send({ data: "updated" });
	} catch (error) {
		console.log(error);
		return next(new ApiError(500, "error occurred while uploading story."));
	}
});

export const updateStory = asyncHandler(async (req, res, next) => {});
export const getAllStory = asyncHandler(async (req, res, next) => {});
export const deleteStory = asyncHandler(async (req, res, next) => {});
export const getUserStory = asyncHandler(async (req, res, next) => {});
export const likeStory = asyncHandler(async (req, res, next) => {});
export const unlikeStory = asyncHandler(async (req, res, next) => {});
