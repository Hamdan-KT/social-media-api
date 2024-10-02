import dotenv from "dotenv"
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import passport from "passport";
import User from "../Models/user.model";
dotenv.config();

const opts = {
	jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
	secretOrKey: process.env.JWT_SECRET,
};

passport.use(
	new JwtStrategy(opts, async (jwt_payload, done) => {
		try {
			const user = await User.findOne({ _id: jwt_payload._id });
			if (user) {
				return done(null, user);
			}
			return done(null, false);
		} catch (err) {
			return done(err, false);
		}
	})
);
