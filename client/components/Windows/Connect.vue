<template>
	<NetworkForm
		:handle-submit="handleSubmit"
		:error-message="errorMessage"
		:defaults="defaults"
		:disabled="disabled"
	/>
</template>

<script lang="ts">
import {defineComponent, ref} from "vue";

import socket from "../../js/socket";
import {useStore} from "../../js/store";
import NetworkForm, {NetworkFormDefaults} from "../NetworkForm.vue";

export default defineComponent({
	name: "Connect",
	components: {
		NetworkForm,
	},
	props: {
		queryParams: Object,
	},
	setup(props) {
		const store = useStore();

		const disabled = ref(false);

		const handleSubmit = (data: Record<string, any>) => {
			disabled.value = true;

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
		};

		const parseOverrideParams = (params?: Record<string, string>) => {
			if (!params) {
				return {};
			}

			const parsedParams: Record<string, any> = {};

			// Get hostname from URL
			const hostname = window.location.hostname;
			const matches = hostname.match(
				new RegExp("^(.*)." + this.$store.state.serverConfiguration.znchost.suffix + "$")
			);

			if (matches !== null) {
				parsedParams.host = matches[1];
			}

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
						store.state.serverConfiguration?.defaults,
						key
					)
				) {
					continue;
				}

				// When the network is locked, URL overrides should not affect disabled fields
				if (
					store.state.serverConfiguration?.lockNetwork &&
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
				switch (typeof store.state.serverConfiguration?.defaults[key]) {
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
		};

		const defaults = ref<Partial<NetworkFormDefaults>>(
			Object.assign(
				{},
				store.state.serverConfiguration?.defaults,
				parseOverrideParams(props.queryParams)
			)
		);

		return {
			defaults,
			disabled,
			handleSubmit,
		};
	},
});
</script>
