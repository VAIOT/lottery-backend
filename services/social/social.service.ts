import type { ServiceSchema } from "moleculer";

const SocialService: ServiceSchema = {
	name: "social",
	version: 1,

	settings: {},

	actions: {

	},

	/**
	 * Events
	 */
	events: {},

	/**
	 * Methods
	 */
	methods: {
		getLikes(postUrl: string, from: Date, to: Date) {

		},
		findPosts(content: string, from: Date, to: Date) {

		},
		getRetweets(postUrl: string, from: Date, to: Date) {

		},
		getFollows(accountName: string, from: Date, to: Date) {

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
