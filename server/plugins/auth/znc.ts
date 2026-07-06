import fs from "fs";

import log from "../../log";
import Config from "../../config";
import type {AuthHandler} from "../auth";
import {validateZncCredentials} from "../znc-sync";

const zncAuth: AuthHandler = (manager, client, user, password, callback) => {
	if (!user || !password) {
		return callback(false);
	}

	log.info(`ZNC auth attempt for ${user}`);

	validateZncCredentials({username: user, password})
		.then((valid) => {
			if (!valid) {
				log.warn(`ZNC auth failed for ${user}`);
				callback(false);
				return;
			}

			if (!client) {
				// First login — auto-provision the user account with credentials included
				manager.addUser(user, null, true);

				const userPath = Config.getUserConfigPath(user);
				const config = JSON.parse(fs.readFileSync(userPath, "utf-8"));
				config.zncCredentials = {username: user, password};
				fs.writeFileSync(userPath, JSON.stringify(config, null, "\t"), {mode: 0o600});
			} else {
				// Existing user — update stored credentials (handles password changes)
				client.config.zncCredentials = {username: user, password};
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
