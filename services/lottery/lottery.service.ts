/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-implied-eval */
import type { Context, Service, ServiceSchema } from "moleculer";
import type { DbServiceSettings, MoleculerDbMethods } from "moleculer-db";
import DbService from "moleculer-db";
import MongooseAdapter from "moleculer-db-adapter-mongoose";
import { ERC20_TYPE, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from "./enums";
import type { LotteryDTO, LotteryEntity } from "./lottery";
import { lottery } from "./lottery";
import { asyncEvery, sleep } from "./utils";

const regex = {
	twitter: {
		post: "^(http(s)?:\\/\\/)?twitter\\.com\\/(?:#!\\/)?(\\w+)\\/status(es)?\\/(\\d+)$",
		username: "^@(\\w{1,15})$"
	},
	wallet: /0x[a-fA-Z0-9]{40}/
};

interface LotteryThis extends Service, MoleculerDbMethods {
	adapter: MongooseAdapter<any>;
}

const LotteryService: ServiceSchema<DbServiceSettings> = {
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
			"wallets",
			"num_of_winners",
			"asset_choice",
			"transactions",
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
			tx_hashes: { type: "array" },
			twitter: {
				type: "object",
				optional: false,
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
		},
	},

	dependencies: [{ name: "twitter", version: 1 }],

	actions: {},

	/**
	 * Hooks
	 */
	hooks: {
		before: {
			create(ctx: Context<LotteryDTO>) {
				const { tx_hashes } = ctx.params;

				// Map the array of strings tx_hashes to array of objects
				ctx.params.transactions = tx_hashes?.map((hash: string) => ({hash, status: 'PENDING'}));
			}
		},
		after: {
			create(ctx: Context<Partial<LotteryDTO>>, lotteryEntity: LotteryEntity) {
				const { _id, 
					asset_choice,
					transactions } = lotteryEntity;

				ctx.service?.logger.info(`New lottery #${_id} created!`);

				if (process.env.NODE_ENV === "production") {
					const tokenType = (asset_choice === TOKEN_TYPE.MATIC ? 'MATIC' : 'ETH');

					ctx.service?.handleTransactions(transactions, tokenType, lotteryEntity);
				}
				return { result: true };
			},
		}
	},

	/**
	 * Methods
	 */
	methods: {
		async handleTransactions(this: LotteryThis, transactions: { hash: string, status: string }[], tokenType: "MATIC" | "ETH", lotteryEntity: LotteryEntity): Promise<void> {
			const { _id,
				asset_choice,
				distribution_method,
				wallet,
				num_of_winners,
				distribution_options,
				number_of_tokens,
				final_rewards } = lotteryEntity;

			const allTransactionsSuccessful = async () => {
				let timedOut = false;
				setTimeout(() => { timedOut = true }, 15 * 60 * 1000);

				return asyncEvery(transactions, async ({status, hash}) => {
					let result = status;

					while(result === "PENDING") {
						await sleep(5000);

						result = !timedOut
						? (await this.broker.call(`v1.tx.getTxStatus`, { tokenType, txHash: hash }) as { result: string }).result
						: "STUCK"
					}
					return result === "SUCCESS";
				});
			}

			if (await allTransactionsSuccessful()) {
				const data = {
					lotteryType: distribution_method, // SPLIT OR PERCENTAGE
					author: wallet,
					numOfWinners: num_of_winners, 
					rewardAmounts: distribution_options,
					totalReward: number_of_tokens,
					finalRewards: final_rewards,
					rewardProportions: distribution_options,
				};
				const serviceName = (asset_choice === TOKEN_TYPE.MATIC ? 'matic' : 'erc').toLowerCase();
				await this.broker.call(`v1.${ serviceName }.openLottery`, data);
				await this.service?.activateLottery(_id);
			} else {
				// TODO emergency payout
			}
		},

		async checkIfLotteryExists(this: LotteryThis, serviceName: string, lotteryId: number) {
			if (process.env.NODE_ENV === "development") {
				return true;
			}
			return this.broker.call(`v1.${ serviceName }.checkIfLotteryExists`, { lottery_id: lotteryId });
		},
		fetchEndedLotteries(this: LotteryThis) {
			const timezoneOffsetMS = new Date().getTime() + -new Date().getTimezoneOffset() * 60 * 1000;
			return this.adapter.find({ query: { active: true, lottery_end: { $lte: new Date(timezoneOffsetMS) }} });
		},
		deactivateLottery(this: LotteryThis, lotteryId: number) {
			return this.adapter.updateById(lotteryId, { active: false }).exec();
		},
		async activateLottery(this: LotteryThis, lotteryId: number) {
			const a = await this.adapter.findById(lotteryId);
			await a.assignLotteryId();
			a.active = true;
			return a.save();
		},

		async findAndStartLotteries(this: LotteryThis) {
			this.logger.debug(`Looking for ended lotteries...`);
			const endedLotteries = await this.fetchEndedLotteries();

			if (endedLotteries.length) {
				this.logger.debug(`Found ${endedLotteries.length} ended lotteries.`);

				for await (const endedLottery of endedLotteries as LotteryEntity[]) {
					let { participants } = (await this.actions.find({ query: { _id: endedLottery._id } }))[0] as { participants: {id: string, text: string }[]};

					if (participants?.length > 0) {
						this.logger.debug(`Found ${participants.length} participants in db.`);
					} else {
						this.logger.debug(`Found ${wallets.length} wallets in db.`);
					}
					
					if (process.env.NODE_ENV === "production") {

						const serviceName = (endedLottery.asset_choice === TOKEN_TYPE.MATIC ? 'matic' : 'erc').toLowerCase();

						const lotteryExists = await this.checkIfLotteryExists(serviceName, endedLotteries.lottery_id);
						const lotteryId = endedLottery.lottery_id;

						if (!lotteryExists) {
							this.logger.error(`Lottery ${endedLottery._id} does not exist in ${serviceName} service!`);
							continue;
						}
						
						// call services to pick winner(s)
						const addParticipantsResponse = await this.broker.call(`v1.${ serviceName }.addParticipants`, { lotteryId, participants: participants.map(({text}) => text) }, { timeout: 0 }) as { status: string, value: string };
						this.logger.debug('Participants added!');

						if (addParticipantsResponse.status !== "OK") {
							this.deactivateLottery(endedLottery._id);
							continue;
						}
						await sleep(15000);

						const pickRandomNumberResponse = await this.broker.call(`v1.${ serviceName }.pickRandomNumber`, { lotteryId }, { timeout: 0 }) as { status: string, value: string | number };
						this.logger.debug('Picked random number!');

						if (pickRandomNumberResponse.status !== "OK") {
							this.deactivateLottery(endedLottery._id);
							continue;
						}

						await this.broker.call(`v1.${ serviceName }.payoutWinners`, { lotteryId, _id: endedLottery._id }, { timeout: 0 });

						// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
						const winningWallets = await this.broker.call(`v1.${ serviceName }.getWinnersOfLottery`, { lotteryId }, { timeout: 0 }) as string[];
					
						this.sendTelegramMessage(winningWallets, endedLottery.asset_choice, lotteryId);
					}

					// Set the lottery's active state to false
					this.deactivateLottery(endedLottery._id);

					// Log ended lottery ID
					this.logger.debug(`Lottery ended! Id: ${endedLottery._id}.`);
				}
			}

			// call after 15 mins // twitter rate limiting
			setTimeout(this.findAndStartEndedLotteries, 15 * 60 * 1000); 
		},

		sendTelegramMessage(this: LotteryThis, winningWallets: string[], lotteryAsset: string, lotteryId: number) {
			
			const postText = winningWallets.length > 0
			? `Winning wallets in lottery #${lotteryId} asset: ${lotteryAsset} are: ${winningWallets.join(', ')}`
			: `Lottery #${lotteryId} asset: ${lotteryAsset} ended with no winners; No participants.`;

			console.log(postText);
			// TODO post lottery results to Telegram

			this.logger.debug(`Telegram message sent!`);
		},

		async getParticipants(this: LotteryThis, endedLottery: LotteryEntity) {
			const { createdAt, twitter } = endedLottery;
			const { wallet_post } = twitter;
			const twitterRequirements = Object.entries(twitter);
		

			const participants = [];
			for await (const [key, value] of twitterRequirements) {
				this.logger.debug(`Getting participants, key: ${key} value: ${value}.`);
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
						participants.push(await this.broker.call("v1.twitter.participants", { wallet_post }, { timeout: 0 }));
				}
			}
			return this.getWallets(participants);
		},

		/**
		* A function to get array of wallets from participants or return null if errors occured
		*/
		getWallets(participants: any): string[] | null {

			// Check for any errors in participants
			const hasErrors = participants.some((result: any) => result.errors);

			// Check if fetching is completed
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
		this.findAndStartEndedLotteries();
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	async stopped() {},
};

export default LotteryService;
