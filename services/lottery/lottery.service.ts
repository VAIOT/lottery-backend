import type { Context, ServiceSchema } from "moleculer";
import DbService from "moleculer-db";
import MongooseAdapter from "moleculer-db-adapter-mongoose";
import { ERC20_TYPE, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from "./enums";
import type { LotteryDTO } from "./lottery";
import { lottery } from "./lottery";

const LotteryService: ServiceSchema = {
	name: "lottery",
	version: 1,

	mixins: [DbService],
	adapter: new MongooseAdapter("mongodb://db-server-hostname/my-db", {
		user: process.env.MONGO_USERNAME,
		pass: process.env.MONGO_PASSWORD,
		keepAlive: true
	}),

	actions: {
		create: {
			rest: {
				method: "POST",
				path: "/create"
			},
			params: {
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
				twitter_like: { type: "startsWith", expected: "https://twitter.com/", optional: true },
				twitter_content: { type: "string", optional: true },
				twitter_retweet: { type: "startsWith", expected: "https://twitter.com/", optional: true },
				twitter_follow: { type: "startsWith", expected: "@", optional: true },
			},
			async handler(ctx: Context<LotteryDTO>): Promise<boolean> {
				const { params } = ctx;
				const lotteryEntity = await lottery.create(params);
				return !!lotteryEntity;
			}
		},
		update: {
			rest: {
				method: "POST",
				path: "/update"
			},
			handler(ctx: Context<any>): boolean {
				return false
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
