import type { ServiceSchema } from "moleculer";
import DbService from "moleculer-db";
import MongooseAdapter from "moleculer-db-adapter-mongoose";
import { ERC20_TYPE, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from "./enums";
import type { ITwitter } from "./interfaces/twitter";
import { lottery } from "./lottery";
import { hasProperty } from "./utils"

const regex = {
	twitter: {
		post: "^(http(s)?:\\/\\/)?twitter\\.com\\/(?:#!\\/)?(\\w+)\\/status(es)?\\/(\\d+)$",
		username: "^@(\\w{1,15})$",
	}
}

const LotteryService: ServiceSchema = {
	name: "lottery",
	version: 1,

	mixins: [DbService],
	adapter: new MongooseAdapter(`mongodb+srv://${process.env.MONGO_URI}`, {
		user: process.env.MONGO_USER,
		pass: process.env.MONGO_PASS,
		keepAlive: true
	}),
	model: lottery,

	settings: {
		fields: ["duration", "distribution_method", "number_of_tokens", "distribution_options", "fees_amount", "num_of_winners", "asset_choice", "twitter", "lottery_end"],

		entityValidator: {
			duration:
				{ type: "number", integer: true, positive: true },
			distribution_method:
				{ 
					type: "enum",
					values: Object.values(TOKEN_DISTRIBUTION_METHOD),
					optional: true,
					custom: (value: TOKEN_DISTRIBUTION_METHOD, errors: any[], schema: any, name: any, parent: any, context: any): (TOKEN_DISTRIBUTION_METHOD | undefined) => {
						if (context.data.asset_choice !== TOKEN_TYPE.ERC721) {
							if (value) {
								return value;
							}
							errors.push({type: "required"});
						}
						return undefined;
					}
				},
			distribution_options:
				{
					type: "array",
					items: {
						type: "number",
						positive: true
					},
					optional: true,
					custom: (value: number[], errors: any[], schema: any, name: any, parent: any, context: any): (number[] | undefined) => {
						if (context.data.asset_choice !== TOKEN_TYPE.ERC721 && context.data.distribution_method === TOKEN_DISTRIBUTION_METHOD.PERCENTAGE) {
							if (value) {
								if (value.reduce((sum, val) => sum + val, 0) === 100) {
									return value
								}
								errors.push({type: "numberEqual", expected: 100 });
							} else {
								errors.push({type: "required"});
							}
						}
						return undefined;
					}
				},
			fees_amount: 
				{ type: "number" },
			number_of_tokens:
				{
					type: "number",
					positive: true,
					optional: true,
					custom: (value: number, errors: any[], schema: any, name: any, parent: any, context: any): (number | undefined) => {
						if (context.data.asset_choice !== TOKEN_TYPE.ERC721) {
							if (value) {
								return value;
							}
							errors.push({type: "required"});
						}
						return undefined;
					}
				},
			wallet:
				{ type: "startsWith", expected: "0x", length: 42 },
			num_of_winners:
				{ type: "number", integer: true, positive: true },
			asset_choice:
				{ type: "enum", values: Object.values(TOKEN_TYPE) },
			erc20_choice:
				{
					type: "enum",
					values: Object.values(ERC20_TYPE),
					optional: true,
					custom: (value: string, errors: any[], schema: any, name: any, parent: any, context: any): (string | undefined)  => {
						if (context.data.asset_choice === TOKEN_TYPE.ERC20) {
							if (value) {
								return value;
							}
							errors.push({type: "required"});
						}
						return undefined;
					}
				},
			nfts_choice:
				{
					type: "array",
					items: {
						type: "object",
						props: {
							name: { type: "string" },
							token_id: { type: "number", integer: true, positive: true },
							contract_address: { type: "string", required: true }
						}
					},
					optional: true,
					custom: (value: object[], errors: any[], schema: any, name: any, parent: any, context: any): (object[] | undefined) => {
						if (context.data.asset_choice === TOKEN_TYPE.ERC721) {
							if (value) {
								return value;
							}
							errors.push({type: "required"});
						}
						return undefined;
					}
				},
			twitter: {
				type: "object",
				optional: false,
				custom: (value: object, errors: any[], schema: any, name: any, parent: any, context: any): object => {
					const twitterReq: (keyof ITwitter)[] = ["content", "follow", "like", "retweet"];
					if (!hasProperty(context.data.twitter, twitterReq)) {
						errors.push({type: "twitterFieldRequired"});
					}
					return value;
				},
				props: {
					like: {
						type: "string",
						pattern: regex.twitter.post,
						optional: true
					},
					content: { type: "string", min: 3, max: 280, optional: true },
					retweet: {
						type: "string",
						pattern: regex.twitter.post,
						optional: true
					},
					follow: { type: "string", pattern: regex.twitter.username, optional: true }
				}
			},
			$$strict: "remove"
		}
	},

	dependencies: [
		{ name: "twitter", version: 1 }
	],

	actions: {},

	/**
	 * Events
	 */
	events: {},

	/**
	 * Methods
	 */
	methods: {
		async checkEndedLotteries() {
			// TODO
		}
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() {},

	/**
	 * Service started lifecycle event handler
	 */
	started() {
		this.checkEndedLotteries()
		// todo iterate through lotteries in db and retrieve end time.
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	async stopped() {}
}

export default LotteryService;
