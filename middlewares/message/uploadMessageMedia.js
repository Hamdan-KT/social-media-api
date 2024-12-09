import multer from "multer";
import fs from "fs";
import path from "path";
import { ApiError } from "../../utils/ApiError.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function uploadMessageMedia(req, res, next) {
	const uploadDir = path.resolve(
		__dirname,
		`../../assets/chat-${req?.user?._id}`
	);

	const storage = multer.diskStorage({
		destination: function (req, file, cb) {
			if (!fs.existsSync(uploadDir)) {
				return fs.mkdir(uploadDir, { recursive: true }, (err) => {
					if (err) {
						return cb(new ApiError(500, "Error creating upload directory."));
					}
					cb(null, uploadDir);
				});
			}
			cb(null, uploadDir);
		},
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
			if (
				file.mimetype.startsWith("image/") ||
				file.mimetype.startsWith("video/") ||
				file.mimetype.startsWith("audio/")
			) {
				cb(null, true);
			} else {
				cb(new ApiError(400, "Only image or video files are allowed!"), false);
			}
		},
	});

	upload.any()(req, res, (err) => {
		if (err) {
			return next(new ApiError(500, "error occured while uploading posts."));
		}
		next();
	});
}

export default uploadMessageMedia;
