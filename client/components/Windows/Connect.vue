<template>
	<NetworkForm
		:handle-submit="handleSubmit"
		:error-message="errorMessage"
		:defaults="defaults"
		:disabled="disabled"
	/>
</template>

<script>
import socket from "../../js/socket";
import NetworkForm from "../NetworkForm.vue";

export default {
	name: "Connect",
	components: {
		NetworkForm,
	},
	props: {
		queryParams: Object,
	},
	data() {
		// Merge settings from url params into default settings
		const defaults = Object.assign(
			{},
			this.$store.state.serverConfiguration.defaults,
			this.parseOverrideParams(this.queryParams)
		);
		return {
			config: this.$store.state.serverConfiguration,
			disabled: false,
			errorMessage: "",
			defaults,
		};
	},
	methods: {
		handleSubmit(data) {
			if (this.config.znchost.enabled) {
				const that = this;
				this.disabled = true;
				this.errorMessage = "";

				// Get all networks
				socket.emit("znc:getnetworks", data, function (ret) {
					if (ret.okay === false) {
						that.disabled = false;
						that.errorMessage = ret.error;
						return;
					}

					if (ret.networks.length === 0) {
						that.errorMessage =
							"Login successful, but you do not have any IRC networks configured yet. Please ask your administrator.";
						return;
					}

					ret.networks.forEach((net) => {
						socket.emit("network:new", {
							name: net,
							host: data.host + "." + that.config.znchost.suffix,
							port: that.config.znchost.port,
							tls: that.config.znchost.tls,
							rejectUnauthorized: true,
							username: data.username + "/" + net,
							password: data.password,
							nickname: data.username,
						});
					});
				});

				return;
			}

			socket.emit("network:new", data);
		},
		parseOverrideParams(params) {
			const parsedParams = {};

			for (let key of Object.keys(params)) {
				let value = params[key];

				// Param can contain multiple values in an array if its supplied more than once
				if (Array.isArray(value)) {
					value = value[0];
				}

				// Support `channels` as a compatibility alias with other clients
				if (key === "channels") {
					key = "join";
				}

				if (
					!Object.prototype.hasOwnProperty.call(
						this.$store.state.serverConfiguration.defaults,
						key
					)
				) {
					continue;
				}

				// When the network is locked, URL overrides should not affect disabled fields
				if (
					this.$store.state.serverConfiguration.lockNetwork &&
					["name", "host", "port", "tls", "rejectUnauthorized"].includes(key)
				) {
					continue;
				}

				if (key === "join") {
					value = value
						.split(",")
						.map((chan) => {
							if (!chan.match(/^[#&!+]/)) {
								return `#${chan}`;
							}

							return chan;
						})
						.join(", ");
				}

				// Override server provided defaults with parameters passed in the URL if they match the data type
				switch (typeof this.$store.state.serverConfiguration.defaults[key]) {
					case "boolean":
						if (value === "0" || value === "false") {
							parsedParams[key] = false;
						} else {
							parsedParams[key] = !!value;
						}

						break;
					case "number":
						parsedParams[key] = Number(value);
						break;
					case "string":
						parsedParams[key] = String(value);
						break;
				}
			}

			return parsedParams;
		},
	},
};
</script>
