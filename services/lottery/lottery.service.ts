import { ServiceSchema } from "moleculer";


const LotteryService: ServiceSchema = {
	name: "lottery",
	version: 1,

	actions: {
		create: {
			rest: {
				method: "POST",
				path: "/create",
			},
			handler(): string {
				return 'abc'
			}
		},
	},

	/**
	 * Events
	 */
	events: {},

	/**
	 * Methods
	 */
	methods: {},

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
	async stopped() {},
}

export default LotteryService;
