import User from "../Models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiSuccess } from "../utils/ApiSuccess.js";
import jwt from "jsonwebtoken";

export const register = asyncHandler(async (req, res, next) => {
	try {
		const { userName, name, email, password } = req.body;

		const userExist = await User.findOne({ userName });

		if (userExist) {
			return next(new ApiError(409, "username is already taken."));
		}

		const emailDomain = email.split("@")[1];
		const role = emailDomain === "mod.instogram.com" ? "moderator" : "general";

		const user = await User.create({
			userName,
			name,
			email,
			role,
			password,
		});

		const createdUser = await User.findById(user?._id)
			.select("-password -refreshToken -savedPosts -followers -following")
			.lean();

		if (!createdUser) {
			return next(
				new ApiError(500, "something wrong while registering the user.")
			);
		}

		ApiSuccess(res, "user registeration successfull.", createdUser);
	} catch (error) {
		return next(
			new ApiError(400, "error occured while registering, please try again.")
		);
	}
});

export const login = asyncHandler(async (req, res, next) => {
	try {
		const { userName, password } = req.body;

		const user = await User.findOne({ userName });

		if (!user) {
			return next(new ApiError(404, "invalid credantials."));
		}

		const isPasswordCorrect = await user.isPasswordCorrect(password);

		if (!isPasswordCorrect) {
			return next(new ApiError(404, "invalid credantials."));
		}

		//if enabled auth context will add that feature

		const options = {
			httpOnly: true,
			secure: true,
		};

		const accessToken = await user.generateAccessToken();
		const refreshToken = await user.generateRefreshToken();

		user.refreshToken = refreshToken;
		await user.save();

		const loggedInUser = await User.findById(user._id)
			.select("-password -refreshToken -savedPosts -followers -following")
			.lean();

		//setting current logged user session
		req.user = loggedInUser;

		return res
			.status(200)
			.cookie("accessToken", accessToken, options)
			.cookie("refreshToken", refreshToken, options)
			.json({
				status: 200,
				message: "user login successfull.",
				data: { user: loggedInUser, accessToken, refreshToken },
			});
	} catch (error) {
		return next(
			new ApiError(400, "error occured while login, please try again.")
		);
	}
});

export const logout = asyncHandler(async (req, res, next) => {
	await User.findByIdAndUpdate(
		req.user._id,
		{
			$unset: {
				refreshToken: 1, // this will remove field from document
			},
		},
		{ new: true }
	);

	const options = {
		httpOnly: true,
		secure: true,
	};

	return res
		.status(200)
		.clearCookie("accessToken", options)
		.clearCookie("refreshToken", options)
		.json({
			statu: 200,
			message: "user logged out.",
			data: {},
		});
});

export const refreshToken = asyncHandler(async (req, res, next) => {
	const incomingRefreshToken =
		req.cookies.refreshToken || req.body.refreshToken;

	if (!incomingRefreshToken) {
		return next(new ApiError(401, "unauthorized request."));
	}

	jwt.verify(
		incomingRefreshToken,
		process.env.JWT_REFRESH_SECRET,
		async (err, decodedToken) => {
			if (err) return next(new ApiError(401, "invalid refresh token."));
			// find user

			const user = await User.findById(decodedToken?._id);

			if (!user) {
				return next(new ApiError(401, "invalid refresh token"));
			}

			if (incomingRefreshToken !== user?.refreshToken) {
				return next(new ApiError(401, "refresh token invalid or used."));
			}

			const options = {
				httpOnly: true,
				secure: true,
			};

			const accessToken = await user.generateAccessToken();

			return res.status(200).cookie("accessToken", accessToken, options).json({
				status: 200,
				message: "access token refreshed.",
				data: accessToken,
			});
		}
	);
});

export const currentUser = asyncHandler(async (req, res) => {
	return ApiSuccess(res, "current user.", req?.user);
});
