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

			// Get hostname from URL
			const hostname = window.location.hostname;
			const matches = hostname.match(
				new RegExp("^(.*)." + this.$store.state.serverConfiguration.znchost.suffix + "$")
			);

			if (matches !== null) {
				parsedParams.host = matches[1];
			}

			// Username via param
			if (typeof params.username !== "undefined") {
				parsedParams.username = String(params.username);
			}

			return parsedParams;
		},
	},
};
</script>
