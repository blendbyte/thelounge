import IrcFramework from "irc-framework";
import _ from "lodash";

import log from "../log";
import Config from "../config";
import type Client from "../client";
import ClientCertificate from "./clientCertificate";

export type ZncCredentials = {
	username: string;
	password: string;
};

export function validateZncCredentials(credentials: ZncCredentials): Promise<boolean> {
	return new Promise((resolve) => {
		let resolved = false;

		const done = (success: boolean) => {
			if (!resolved) {
				resolved = true;
				resolve(success);
			}
		};

		const timeout = setTimeout(() => done(false), 15000);

		const irc = new IrcFramework.Client({});
		irc.connect({
			host: credentials.username + "." + Config.values.znchost.suffix,
			port: Config.values.znchost.port,
			tls: Config.values.znchost.tls,
			nick: credentials.username,
			username: credentials.username,
			password: credentials.password,
			version: false,
			outgoing_addr: Config.values.bind,
			auto_reconnect: false,
			rejectUnauthorized: true,
		});

		irc.on("registered", function () {
			clearTimeout(timeout);
			done(true);
			setTimeout(() => irc.quit(), 100);
		});

		irc.on("close", function () {
			clearTimeout(timeout);
			done(false);
		});
	});
}

export function fetchZncNetworks(credentials: ZncCredentials): Promise<string[]> {
	return new Promise((resolve, reject) => {
		const networks: string[] = [];

		const irc = new IrcFramework.Client({});
		irc.connect({
			host: credentials.username + "." + Config.values.znchost.suffix,
			port: Config.values.znchost.port,
			tls: Config.values.znchost.tls,
			nick: credentials.username,
			username: credentials.username,
			password: credentials.password,
			version: false,
			outgoing_addr: Config.values.bind,
			auto_reconnect: false,
			rejectUnauthorized: true,
		});

		irc.on("message", function (event) {
			if (event.type !== "privmsg" || event.nick !== "*status") {
				return;
			}

			const rawMatch = event.message.match(/^\| (.*) \| (.*) \| (.*) \| (.*) \| (.*)\|$/);
			log.debug(
				"znchost:message",
				event.type ?? "",
				event.nick,
				event.message,
				rawMatch === null ? "nope" : JSON.stringify(rawMatch)
			);

			if (rawMatch === null) {
				return;
			}

			const match = rawMatch.map((n) => n.trim());

			if (match.length !== 6 || match[1] === "Network") {
				return;
			}

			networks.push(match[1]);
		});

		irc.on("registered", function () {
			log.debug("znchost:registered", "listnetworks sent");
			irc.say("*status", "listnetworks");
			setTimeout(() => irc.quit(), 1000);
		});

		irc.on("close", function (event) {
			log.debug("znchost:closed", String(networks.length), JSON.stringify(networks));

			if (event === true || networks.length > 0) {
				resolve(networks);
			} else {
				reject(new Error("Unable to connect to ZNC. Check your credentials."));
			}
		});
	});
}

export async function syncNetworks(client: Client, credentials: ZncCredentials): Promise<void> {
	let zncNetworks: string[];

	try {
		zncNetworks = await fetchZncNetworks(credentials);
	} catch (e: any) {
		// Don't remove any networks if ZNC is temporarily unreachable
		log.warn(`ZNC network sync failed for ${client.name}: ${String(e.message)}`);
		return;
	}

	const zncSet = new Set(zncNetworks);
	const managed = client.networks.filter((n) => n.znc === true);
	const currentNames = new Set(managed.map((n) => n.name));

	const toAdd = zncNetworks.filter((name) => !currentNames.has(name));
	const toRemove = managed.filter((n) => !zncSet.has(n.name));

	if (toAdd.length === 0 && toRemove.length === 0) {
		return;
	}

	log.info(
		`ZNC sync for ${client.name}: adding [${toAdd.join(", ")}]${
			toRemove.length > 0 ? `, removing [${toRemove.map((n) => n.name).join(", ")}]` : ""
		}`
	);

	for (const name of toAdd) {
		client.connectToNetwork({
			name,
			host: credentials.username + "." + Config.values.znchost.suffix,
			port: Config.values.znchost.port,
			tls: Config.values.znchost.tls,
			rejectUnauthorized: true,
			nick: credentials.username,
			username: credentials.username + "/" + name,
			password: credentials.password,
			znc: true,
		});
	}

	for (const network of toRemove) {
		client.networks = _.without(client.networks, network);
		network.destroy();
		client.emit("quit", {network: network.uuid});
		network.quit();
		ClientCertificate.remove(network.uuid);
	}

	client.save();
}
