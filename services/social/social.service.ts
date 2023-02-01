import type { Context, ServiceSchema } from "moleculer";

const SocialService: ServiceSchema = {
	name: "social",
	version: 1,

	settings: {},

	actions: {
		likes: {
			visibility: "protected", // can be called only locally (from local services)
			params: {
				postUrl: "string",
				from: "date",
				to: "date"
			},
			handler(ctx: Context) {

			}
		},
		retweets: {
			visibility: "protected", // can be called only locally (from local services)
			params: {
				postUrl: "string",
				from: "date",
				to: "date"
			},
			handler(ctx: Context) {

			}
		},
		follows: {
			visibility: "protected", // can be called only locally (from local services)
			params: {
				account: "string",
				from: "date",
				to: "date"
			},
			handler(ctx: Context) {

			}
		},
		posts: {
			visibility: "protected", // can be called only locally (from local services)
			params: {
				content: "string",
				from: "date",
				to: "date"
			},
			handler(ctx: Context) {

			}
		}
	},

	/**
	 * Events
	 */
	events: {},

	/**
	 * Methods
	 */
	methods: {
		getWallets() {

		},
		filterBots() {

		}
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() {},

	/**
	 * Service started lifecycle event handler
	 */
	async started() {},

	/**
	 * Service stopped lifecycle event handler
	 */
	async stopped() {}
}

export default SocialService;
