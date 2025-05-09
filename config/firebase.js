import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Absolute path to the service account file
const serviceAccount = path.resolve(
	__dirname,
	"../firebase-service-account.json"
);

let app;

if (!getApps().length) {
	app = initializeApp({
		credential: cert(serviceAccount),
	});
}

const messaging = getMessaging(app);

export { messaging };
