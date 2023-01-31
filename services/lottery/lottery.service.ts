import type { ServiceSchema } from "moleculer";
import DbService from "moleculer-db";
import MongooseAdapter from "moleculer-db-adapter-mongoose";
import { ERC20_TYPE, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from "./enums";
import type { ITwitter } from "./interfaces/twitter";
import { lottery } from "./lottery";
import { hasProperty } from "./utils"

const LotteryService: ServiceSchema = {
	name: "lottery",
	version: 1,

	mixins: [DbService],
	adapter: new MongooseAdapter("mongodb+srv://mongo.mongodb.net", {
		user: "user",
		pass: "pass",
		keepAlive: true
	}),
	model: lottery,

	settings: {
		fields: ["duration", "distribution_method", "number_of_tokens", "num_of_winners", "asset_choice", "twitter"],

		entityValidator: {
			duration:
				{ type: "number", integer: true, positive: true },
			distribution_method:
				{ type: "enum", values: Object.values(TOKEN_DISTRIBUTION_METHOD) },
			number_of_tokens:
				{ type: "number", positive: true },
			wallet:
				{
					type: "startsWith", expected: "0x", length: 42
				},
			num_of_winners:
				{ type: "number", integer: true, positive: true },
			asset_choice:
				{ type: "enum", values: Object.values(TOKEN_TYPE) },
			erc20_choice:
				{
					type: "enum",
					values: Object.values(ERC20_TYPE),
					optional: true,
					custom: (val: string, errors: any[], schema: any, name: any, parent: any, context: any) => {
						if (context.data.asset_choice === TOKEN_TYPE.ERC20 && val === undefined) {
							errors.push({type: "erc20Required"})
						}
						return val
					},
				},
			nfts_choice:
				{
					type: "object",
					values: {
						token_id: { type: "number", integer: true, positive: true },
						contract_address: { type: "string" }
					},
					optional: true,
					custom: (val: string, errors: any[], schema: any, name: any, parent: any, context: any) => {
						if (context.data.asset_choice === TOKEN_TYPE.ERC721 && val === undefined) {
							errors.push({type: "erc721Required"})
						}
						return val
					}
				},
			twitter: {
				type: "object",
				optional: false,
				custom: (value: string, errors: any[], schema: any, name: any, parent: any, context: any) => {
					const twitterReq: (keyof ITwitter)[] = ["content", "follow", "like", "retweet"];
					if (!hasProperty(context.data.twitter, twitterReq)) {
						errors.push({type: "twitterFieldRequired"})
					}
					return value
				},
				like: {type: "string", contains: "twitter.com/", optional: true},
				content: {type: "string", min: 3, max: 280, optional: true},
				retweet: {type: "string", contains: "twitter.com", optional: true},
				follow: {type: "startsWith", expected: "@", optional: true}
			}
		},
	},

	dependencies: [],

	actions: {},

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
