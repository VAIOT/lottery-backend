/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-implied-eval */
import type { ActionSchema, Context, ServiceSchema } from "moleculer";
import DbService from "moleculer-db";
import MongooseAdapter from "moleculer-db-adapter-mongoose";
import { ERC20_TYPE, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from "./enums";
import type { ITwitter } from "./interfaces/twitter";
import type { LotteryEntity } from "./lottery";
import { lottery } from "./lottery";
import { hasProperty } from "./utils";

const regex = {
	twitter: {
		post: "^(http(s)?:\\/\\/)?twitter\\.com\\/(?:#!\\/)?(\\w+)\\/status(es)?\\/(\\d+)$",
		username: "^@(\\w{1,15})$"
	},
	wallet: /0x[a-fA-Z0-9]{40}/
};

const LotteryService: ServiceSchema = {
	name: "lottery",
	version: 1,

	mixins: [DbService],
	adapter: new MongooseAdapter(`mongodb+srv://${process.env.MONGO_URI}`, {
		user: process.env.MONGO_USER,
		pass: process.env.MONGO_PASS,
		keepAlive: true,
	}),
	model: lottery,

	settings: {
		fields: [
			"_id",
			"lottery_id",
			"duration",
			"distribution_method",
			"number_of_tokens",
			"distribution_options",
			"fees_amount",
			"num_of_winners",
			"asset_choice",
			"twitter",
			"lottery_end",
			"createdAt"
		],

		entityValidator: {
			duration: { type: "number", integer: true, positive: true },
			distribution_method: {
				type: "enum",
				values: Object.values(TOKEN_DISTRIBUTION_METHOD),
				optional: true,
				custom: (
					value: TOKEN_DISTRIBUTION_METHOD,
					errors: any[],
					schema: any,
					name: any,
					parent: any,
					context: any,
				): TOKEN_DISTRIBUTION_METHOD | undefined => {
					if (context.data.asset_choice !== TOKEN_TYPE.ERC721) {
						if (value) {
							return value;
						}
						errors.push({ type: "required" });
					}
					return undefined;
				},
			},
			distribution_options: {
				type: "array",
				items: {
					type: "string",
					positive: true,
				},
				optional: true,
				custom: (
					value: string[],
					errors: any[],
					schema: any,
					name: any,
					parent: any,
					context: any,
				): string[] | undefined => {
					if (context.data.asset_choice !== TOKEN_TYPE.ERC721) {
						if (value) {
							if (context.data.distribution_method === TOKEN_DISTRIBUTION_METHOD.PERCENTAGE) {
								console.log(value)
								if (value.reduce((sum, val) => sum + Number(val.slice(0,2)), 0) === 100) {
									return value;
								}
								errors.push({ type: "numberEqual", expected: 100 });
							}
							return value;
						}
						errors.push({ type: "required" });
					}
					return undefined;
				},
			},
			fees_amount: { type: "string" },
			number_of_tokens: {
				type: "string",
				positive: true,
				optional: true,
				custom: (
					value: string,
					errors: any[],
					schema: any,
					name: any,
					parent: any,
					context: any,
				): string | undefined => {
					if (context.data.asset_choice !== TOKEN_TYPE.ERC721) {
						if (value) {
							return value;
						}
						errors.push({ type: "required" });
					}
					return undefined;
				},
			},
			wallet: { type: "startsWith", expected: "0x", length: 42 },
			final_rewards: {
				type:  "array",
				items: {
					type: "string",
				},
				optional: true,
				custom: (
					value: string[],
					errors: any[],
					schema: any,
					name: any,
					parent: any,
					context: any,
				): string[] | undefined => {
					if (context.data.distribution_method === TOKEN_DISTRIBUTION_METHOD.PERCENTAGE) {
						if (value) {
							return value;
						}
						errors.push({ type: "required" });
					}
					return undefined;
				},
			},
			num_of_winners: { type: "number", integer: true, positive: true },
			asset_choice: { type: "enum", values: Object.values(TOKEN_TYPE) },
			erc20_choice: {
				type: "enum",
				values: Object.values(ERC20_TYPE),
				optional: true,
				custom: (
					value: string,
					errors: any[],
					schema: any,
					name: any,
					parent: any,
					context: any,
				): string | undefined => {
					if (context.data.asset_choice === TOKEN_TYPE.ERC20) {
						if (value) {
							return value;
						}
						errors.push({ type: "required" });
					}
					return undefined;
				},
			},
			nfts_choice: {
				type: "array",
				items: {
					type: "object",
					props: {
						name: { type: "string" },
						token_id: { type: "number", integer: true, positive: true },
						contract_address: { type: "string", required: true },
					},
				},
				optional: true,
				custom: (
					value: object[],
					errors: any[],
					schema: any,
					name: any,
					parent: any,
					context: any,
				): object[] | undefined => {
					if (context.data.asset_choice === TOKEN_TYPE.ERC721) {
						if (value) {
							return value;
						}
						errors.push({ type: "required" });
					}
					return undefined;
				},
			},
			twitter: {
				type: "object",
				optional: false,
				custom: (
					value: object,
					errors: any[],
					schema: any,
					name: any,
					parent: any,
					context: any,
				): object => {
					const twitterReq: (keyof ITwitter)[] = ["content", "follow", "like", "retweet"];
					if (!hasProperty(context.data.twitter, twitterReq)) {
						errors.push({ type: "twitterFieldRequired" });
					}
					return value;
				},
				props: {
					like: {
						type: "string",
						pattern: regex.twitter.post,
						optional: true,
					},
					content: { type: "string", min: 3, max: 280, optional: true },
					retweet: {
						type: "string",
						pattern: regex.twitter.post,
						optional: true,
					},
					follow: { type: "string", pattern: regex.twitter.username, optional: true },
					wallet_post: { type: "string", pattern: regex.twitter.post, optional: false },
				},
			},
			$$strict: "remove",
		},
	},

	dependencies: [{ name: "twitter", version: 1 }],

	actions: {},

	/**
	 * Hooks
	 */
	hooks: {
		after: {
			async create(ctx: Context<LotteryEntity>, savedLottery: LotteryEntity) {
				const { distribution_method, wallet, num_of_winners, distribution_options, number_of_tokens, final_rewards } = ctx.params;
				const data = {
					lotteryType: distribution_method, // SPLIT OR PERCENTAGE
					author: wallet,
					numOfWinners: num_of_winners, 
					rewardAmounts: distribution_options,
					totalReward: number_of_tokens,
					finalRewards: final_rewards,
					rewardProportions: distribution_options,
				};
				await ctx.call("v1.matic.openLottery", data, { timeout: 0 });
				// It works \/
				await (this.actions as ActionSchema).update({ id: savedLottery._id, active: true });

				return savedLottery;
			}
		}
	},

	/**
	 * Methods
	 */
	methods: {
		async getWinners() {
			const endedLotteries = await this.fetchEndedLotteries();
			if (endedLotteries) {
				for await (const endedLottery of endedLotteries) {
					const lotteryExist = await this.broker.call(`v1.${ endedLottery.asset_choice.toLowerCase() }.checkIfLotteryExists`, { lotteryId: endedLotteries.id }, { timeout: 0 });
					if (!lotteryExist) {
						// eslint-disable-next-line no-continue
						continue;
					}

					const wallets = await this.getParticipants(endedLottery);
					
					if (wallets && await this.actions.update({ id: endedLottery._id, active: false })) {
						const data = { lotteryId: endedLottery.id, participants: wallets };

						await this.broker.call(`v1.${ endedLottery.asset_choice.toLowerCase() }.addParticipants`, data, { timeout: 0 });
					}
				}
			}
			setTimeout(this.getWinners, 15 * 60 * 1000); // call after 15 mins // twitter rate limiting 
		},
		fetchEndedLotteries() {
			return this.actions.find({ query: { active: true, lottery_end: { $lte: new Date().getTime() } } });
		},
		async getParticipants(endedLottery: LotteryEntity) {
			const { createdAt, twitter } = endedLottery;
			const { wallet_post, ...reqs } = twitter;
			const twitterRequirements = Object.entries(reqs);

			const participants = [];
			for await (const [key, value] of twitterRequirements) {
				switch (key) {
					case "like":
						participants.push(await this.broker.call("v1.twitter.likes", { wallet_post, post_url: value }, { timeout: 0 }));
						break;
					case "content":
						participants.push(await this.broker.call("v1.twitter.content", { wallet_post, content: value, date_from: createdAt }, { timeout: 0 }));
						break;
					case "retweet":
						participants.push(await this.broker.call("v1.twitter.retweets", { wallet_post, post_url: value }, { timeout: 0 }));
						break;
					case "follow":
						participants.push(await this.broker.call("v1.twitter.followers", { wallet_post, user: value }, { timeout: 0 }));
						break;
					default:
						console.log("default", key)
				}
			}
			return this.getWallets(participants);
		},
		getWallets(participants: any): string[] | null {
			const hasErrors = participants.some((result: any) => result.errors);
			const fetchingComplete = participants.every((result: any) => result.complete);

			if (hasErrors || !fetchingComplete) {
				// Log errors
				this.logger.error(participants.map((result: any) => result.errors));
				return null;
			}

			// Get wallets from content
			return participants
			.flatMap(({data}: any) => data
			.map(({text}: any) => text.match(regex.wallet)?.[0]));
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
		this.getWinners();
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	async stopped() {},
};

export default LotteryService;
