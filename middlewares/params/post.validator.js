import joi from "joi";
import { ApiError } from "../../utils/ApiError.js";

export const postCreateValidator = (req, res, next) => {
	const body = joi.object({
		aspectRatio: joi.string().optional(),
		caption: joi.string().min(1).max(2300).optional(),
		location: joi.string().optional,
		isHideLikes: joi.string().default(false).optional(),
		isDisableComment: joi.string().default(false).optional(),
		postData: joi.string().optional(),
	});

	const { error, value } = body.validate(req.body);

	if (error) {
		return next(new ApiError(400, error.details[0].message.replace(/\"/g, "")));
	}

	return next();
};