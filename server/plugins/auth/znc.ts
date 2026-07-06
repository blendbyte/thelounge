import fs from "fs";

import log from "../../log";
import Config from "../../config";
import type {AuthHandler} from "../auth";
import {validateZncCredentials} from "../znc-sync";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const zncAuth: AuthHandler = (manager, client, user, password, callback, socket?: any) => {
	if (!user || !password) {
		return callback(false);
	}

	// Derive ZNC host from the HTTP Host header of the socket connection.
	// In the original public-mode flow the browser sent data.host (URL subdomain).
	// In private mode we extract it from socket.handshake so the ZNC host always
	// matches the TL URL (e.g. staff.znchost.com), not the IRC username.
	const requestHost: string = socket?.handshake?.headers?.host ?? "";
	const zncHost = requestHost.split(":")[0] || user + "." + Config.values.znchost.suffix;

	log.info(`ZNC auth attempt for ${user} via ${zncHost}`);

	validateZncCredentials({username: user, password, host: zncHost})
		.then((valid) => {
			if (!valid) {
				log.warn(`ZNC auth failed for ${user}`);
				callback(false);
				return;
			}

			if (!client) {
				// First login — auto-provision the user account with credentials included
				fs.mkdirSync(Config.getUsersPath(), {recursive: true});
				manager.addUser(user, null, true);

				const userPath = Config.getUserConfigPath(user);
				const config = JSON.parse(fs.readFileSync(userPath, "utf-8"));
				config.zncCredentials = {username: user, password, host: zncHost};
				fs.writeFileSync(userPath, JSON.stringify(config, null, "\t"), {mode: 0o600});
			} else {
				// Existing user — update stored credentials (handles password changes)
				client.config.zncCredentials = {username: user, password, host: zncHost};
				client.save();
			}

			callback(true);
		})
		.catch((err: Error) => {
			log.error(`ZNC auth error for ${user}: ${err.message}`);
			callback(false);
		});
};

function isEnabled() {
	return !Config.values.public && Config.values.znchost?.enabled === true;
}

export default {
	moduleName: "znc",
	auth: zncAuth,
	isEnabled,
};
