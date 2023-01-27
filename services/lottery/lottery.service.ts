import { Context, ServiceSchema } from "moleculer";
import { LotteryDTO } from "./lottery";
import { ERC20_TYPE, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from "./enums";

const LotteryService: ServiceSchema = {
	name: "lottery",
	version: 1,

	actions: {
		create: {
			rest: {
				method: "POST",
				path: "/create"
			},
			params: {
				id:
					{ type: "number", integer: true, positive: true },
				duration:
					{ type: "number", integer: true, positive: true },
				distribution_method:
					{ type: "enum", values: Object.values(TOKEN_DISTRIBUTION_METHOD) },
				number_of_tokens:
					{ type: "number", positive: true },
				wallet:
					{
						type: "string", max: 42, custom: (val: string, errors: Array<any>) => {
							if (!val.startsWith("0x")) errors.push({type: "walletAddress"})
							return val
						}
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
						custom: (val: string, errors: Array<any>, schema: any, name: any, parent: any, context: any) => {
							if (context.data.asset_choice === TOKEN_TYPE.ERC20 && val === undefined) errors.push({type: "erc20Required"})
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
						custom: (val: string, errors: Array<any>, schema: any, name: any, parent: any, context: any) => {
							if (context.data.asset_choice === TOKEN_TYPE.ERC721 && val === undefined) errors.push({type: "erc721Required"})
							return val
						}
					},
				twitter_like: { type: "string", optional: true },
				twitter_content: { type: "string", optional: true },
				twitter_retweet: { type: "string", optional: true },
				twitter_follow: { type: "string", optional: true },
			},
			handler(ctx: Context<LotteryDTO>): any {
				return  ctx.params
			}
		},
		update: {
			rest: {
				method: "POST",
				path: "/update"
			},
			handler(ctx: Context<any>): boolean {
				return true
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
