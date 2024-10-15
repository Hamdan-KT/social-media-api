import dotenv from "dotenv";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import passport from "passport";
import User from "../Models/user.model.js";
dotenv.config();

var cookieExtractor = function (req) {
	var token = null;
	if (req && req.cookies) {
		token = req.cookies.accessToken;
	}
	return token;
};

const opts = {
	jwtFromRequest: cookieExtractor || ExtractJwt.fromAuthHeaderAsBearerToken(),
	secretOrKey: process.env.JWT_SECRET,
};

passport.use(
	new JwtStrategy(opts, async (jwt_payload, done) => {
		try {
			const user = await User.findOne({ _id: jwt_payload._id })
				.select(
					"-password -refreshToken -savedPosts -followers -following -updatedAt -__v"
				)
				.lean();
			if (user) {
				return done(null, user);
			}
			return done(null, false);
		} catch (err) {
			return done(err, false);
		}
	})
);
