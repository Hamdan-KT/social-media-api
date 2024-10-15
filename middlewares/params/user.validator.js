import joi from "joi";
import { ApiError } from "../../utils/ApiError.js";

export const updateUserValidator = (req, res, next) => {
	const body = joi.object({
		name: joi.string().optional(),
		email: joi.string().optional().email(),
		bio: joi.string().optional(),
		gender: joi.string().optional(),
	});

	const { error, value } = body.validate(req.body);

	if (error) {
		return next(new ApiError(400, error.details[0].message.replace(/\"/g, "")));
	}

	return next();
};
