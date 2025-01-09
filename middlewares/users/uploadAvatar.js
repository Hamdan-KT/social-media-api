import multer from "multer";
import fs from "fs";
import path from "path";
import { ApiError } from "../../utils/ApiError.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function uploadAvatar(req, res, next) {
	const uploadDir = path.resolve(__dirname, "../../assets/userAvatars");

	const storage = multer.diskStorage({
		// destination: function (req, file, cb) {
		// 	if (!fs.existsSync(uploadDir)) {
		// 		return fs.mkdir(uploadDir, { recursive: true }, (err) => {
		// 			if (err) {
		// 				return cb(new ApiError(500, "Error creating upload directory."));
		// 			}
		// 			cb(null, uploadDir);
		// 		});
		// 	}
		// 	cb(null, uploadDir);
		// },
		filename: function (req, file, cb) {
			const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
			const ext = path.extname(file.originalname);
			cb(null, uniqueSuffix + ext);
		},
	});

	const upload = multer({
		storage,
		limits: {
			fileSize: 50 * 1024 * 1024,
		},
		fileFilter: function (req, file, cb) {
			if (file.mimetype.startsWith("image/")) {
				cb(null, true);
			} else {
				cb(new ApiError(400, "Only image files are allowed!"), false);
			}
		},
	});

	upload.single("avatar")(req, res, (err) => {
		if (err?.code === "LIMIT_UNEXPECTED_FILE") {
			return next(new ApiError(500, "only one photo can upload."));
		}
		
		if (err) {
			return next(new ApiError(500, "error occured while uploading posts."));
		}

		//checking files are exist
		if (!req.file) {
			return next(new ApiError(400, "No photo file found to upload."));
		}

		next();
	});
}

export default uploadAvatar;
