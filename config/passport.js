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
	console.log({ m_token: token });
	return token;
};

const opts = {
	jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
	// jwtFromRequest: cookieExtractor || ExtractJwt.fromAuthHeaderAsBearerToken(),
	secretOrKey: process.env.JWT_SECRET,
};

passport.use(
	new JwtStrategy(
		{
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			// jwtFromRequest: cookieExtractor || ExtractJwt.fromAuthHeaderAsBearerToken(),
			secretOrKey: process.env.JWT_SECRET,
		},
		async (jwt_payload, done) => {
			console.log({ jwt_payload });
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
		}
	)
);
