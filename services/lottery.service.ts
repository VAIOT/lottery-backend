/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable no-param-reassign */
/* eslint-disable no-void */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable no-continue */
/* eslint-disable @typescript-eslint/no-implied-eval */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/naming-convention */
import { lottery } from '@Entities/lottery';
import { ILottery } from '@Interfaces/index';
import { sleep } from '@Meta';
import { ERC20_TYPE, PAYMENT_STATUS, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from '@Meta/enums';
import type { Context, ServiceDependency} from 'moleculer';
import { Service as MoleculerService } from 'moleculer';
import DbService from "moleculer-db";
import MongooseAdapter from "moleculer-db-adapter-mongoose";
import { Method, Service } from 'moleculer-decorators';
import type { TweetV2, UserV2 } from 'twitter-api-v2';

const regex = {
	twitter: {
		post: "^(http(s)?:\\/\\/)?twitter\\.com\\/(?:#!\\/)?(\\w+)\\/status(es)?\\/(\\d+)$",
		username: "^@(\\w{1,15})$"
	},
	wallet: /0x[a-fA-Z0-9]{40}/
};

@Service({ 
	name: "lottery",
    version: 1,
	mixins: [DbService],
    adapter: new MongooseAdapter(`mongodb+srv://${process.env.MONGO_URI}`, {
		user: process.env.MONGO_USER,
		pass: process.env.MONGO_PASS,
		keepAlive: true,
	}),
    model: lottery,
    entityValidator: {
        duration: { type: "number", integer: true, positive: true },
        oauth_token: { type: "string" },
        oauth_verifier: { type: "string" },
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
    hooks: {
        before: {
			async create(ctx: Context<ILottery.LotteryDTO, {session: {[x: string]: string|object}}>) {
				const { tx_hashes, twitter, oauth_token, oauth_verifier } = ctx.params;

                const tokensDto = {
                    userVerifier: oauth_verifier,
                    userToken: oauth_token,
                    savedToken: ctx.meta.session.oauthToken,
                    savedSecret: ctx.meta.session.oauthSecret
                }

                const tokens = await ctx.broker.call("v1.twitter.getUserTokens", { tokens: tokensDto }, { timeout: 0 });
                ctx.meta.session.accessTokens = tokens as object;

                if (twitter.follow) {
                    const user = await ctx.broker.call("v1.twitter.getUserData", { userName: twitter.follow }, { meta: { tokens }, timeout: 0 }) as UserV2;
                    if (!user) {
                        throw new Error("User does not exist!");
                    } else if (user.public_metrics?.followers_count?? 0 >= 1000000) {
                        throw new Error("User cannot participate in the lottery!");
                    }
                }

                const oneDay = new Date().getTime() + (1 * 24 * 60 * 60 * 1000);
                if (twitter.like) {
                    const tweet = await ctx.broker.call("v1.twitter.getTweetData", { postUrl: twitter.like }, { meta: { tokens }, timeout: 0 }) as TweetV2;
                    if (!tweet) {
                        throw new Error("Tweet does not exist!");
                    } else if (oneDay < new Date(tweet.created_at!).getTime()) {
                        throw new Error("Tweet cannot be older than 1 day!");
                    }
                }
                if (twitter.retweet) {
                    const tweet = await ctx.broker.call("v1.twitter.getTweetData", { postUrl: twitter.retweet }, { meta: { tokens }, timeout: 0 }) as TweetV2;
                    if (!tweet) {
                        throw new Error("Tweet does not exist!");
                    } else if (oneDay < new Date(tweet.created_at!).getTime()) {
                        throw new Error("Tweet cannot be older than 1 day!");
                    }
                }
                if (twitter.wallet_post) {
                    const tweet = await ctx.broker.call("v1.twitter.getTweetData", { postUrl: twitter.wallet_post }, { meta: { tokens }, timeout: 0 }) as TweetV2;
                    if (!tweet) {
                        throw new Error("Tweet does not exist!");
                    } else if (oneDay < new Date(tweet.created_at!).getTime()) {
                        throw new Error("Tweet cannot be older than 1 day!");
                    }
                }
                

				// Map the tx_hashes <array of strings> to transactions <array of objects>
				ctx.params.transactions = tx_hashes?.map((hash: string) => ({hash, status: PAYMENT_STATUS.PENDING}));

			}
		},
		after: {
			create(ctx: Context<Partial<ILottery.LotteryDTO>>, lotteryEntity: ILottery.LotteryEntity) {
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
    }
})
class LotteryService extends MoleculerService {

    dependencies: ServiceDependency[] = [
        { name: "tx", version: 1 }, 
		{ name: "twitter", version: 1 },
        { name: "telegram", version: 1 }
    ];

    @Method
    async handleTransactions(transactions: { hash: string, status: PAYMENT_STATUS }[], tokenType: "MATIC" | "ETH", lotteryEntity: ILottery.LotteryEntity): Promise<void> {
        const { _id,
            asset_choice,
            distribution_method,
            wallet,
            num_of_winners,
            distribution_options,
            number_of_tokens,
            final_rewards } = lotteryEntity;

        let timedOut = false;
        setTimeout(() => { timedOut = true }, 15 * 60 * 1000);

        transactions = await Promise.all(transactions.map(async ({status, hash}) => {
            while(status === PAYMENT_STATUS.PENDING) {
                await sleep(5000);

                status = !timedOut
                ? ((await this.broker.call(`v1.tx.getTxStatus`, { tokenType, txHash: hash })) as any).result
                : PAYMENT_STATUS.STUCK
            }
            return { hash, status }
        }));

        this.adapter.updateById(_id, { transactions }).exec();

        const allTransactionsSuccessful = transactions.every(({status}) => status === PAYMENT_STATUS.SUCCESS);

        if (allTransactionsSuccessful) {
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

            if (await this.activateLottery(_id)) {
                await this.broker.call(`v1.${ serviceName }.openLottery`, data);
            } else {
                this.logger.error("Couldn't activate lottery.")
            }
        } else {
            this.emergencyPayout(wallet);
        }
    }

    @Method
    async checkIfLotteryExists(serviceName: string, lotteryId: number) {
        if (process.env.NODE_ENV === "development") {
            return true;
        }
        return this.broker.call(`v1.${ serviceName }.checkIfLotteryExists`, { lotteryId });
    }

    @Method
    fetchEndedLotteries(): Promise<ILottery.LotteryEntity[]> {
        const timezoneOffsetMS = new Date().getTime() + -new Date().getTimezoneOffset() * 60 * 1000;
        return this.adapter.find({ query: { active: true, lottery_end: { $lte: new Date(timezoneOffsetMS) }} });
    }

    @Method
    deactivateLottery(lotteryId: string) {
        return this.adapter.updateById(lotteryId, { active: false }).exec();
    }

    @Method
    async activateLottery(lotteryId: string) {
        const lotteryEntity = await this.adapter.findById(lotteryId);

        await lotteryEntity.assignLotteryId();
        lotteryEntity.active = true;

        return lotteryEntity.save();
    }

    @Method
    async findAndStartLotteries() {
        this.logger.debug(`Looking for ended lotteries...`);
        const endedLotteries = await this.fetchEndedLotteries();

        if (endedLotteries.length) {
            this.logger.debug(`Found ${endedLotteries.length} ended lotteries.`);

            for await (const endedLottery of endedLotteries) {
                let { participants } = (await this.actions.find({ query: { _id: endedLottery._id } }))[0] as { participants: {author_id: string, text: string }[] };

                if (participants?.length > 0) {
                    this.logger.debug(`Found ${participants.length} participants in db.`);
                } else {
                    // Get all participants
                    const newParticipants = await this.getParticipants(endedLottery);

                    if (!newParticipants) {
                        continue;
                    }
                    participants = newParticipants;

                    // Save to db
                    await this.actions.update({ id: endedLottery._id, participants });

                    this.logger.debug(`Saved ${participants.length} participants to db.`);
                }
                
                if (process.env.NODE_ENV === "production") {

                    const serviceName = (endedLottery.asset_choice === TOKEN_TYPE.MATIC ? 'matic' : 'erc').toLowerCase();

                    const lotteryId = endedLottery.lottery_id;
                    const lotteryExists = await this.checkIfLotteryExists(serviceName, lotteryId);

                    if (!lotteryExists) {
                        this.logger.error(`Lottery ${endedLottery._id} does not exist in ${serviceName} service!`);
                        continue;
                    }
                    
                    // call services to pick winner(s)
                    const addParticipantsResponse: { status: string, value: string } = await this.broker.call(`v1.${ serviceName }.addParticipants`, { lotteryId, participants: participants.map(({text}) => text) }, { timeout: 0 });
                    this.logger.debug('Participants added!');

                    if (addParticipantsResponse.status !== "OK") {
                        this.deactivateLottery(endedLottery._id);
                        continue;
                    }
                    await sleep(15000);

                    const pickRandomNumberResponse: { status: string, value: string | number } = await this.broker.call(`v1.${ serviceName }.pickRandomNumber`, { lotteryId }, { timeout: 0 });
                    this.logger.debug('Picked random number!');

                    if (pickRandomNumberResponse.status !== "OK") {
                        this.deactivateLottery(endedLottery._id);
                        continue;
                    }
                    await sleep(40000);

                    await this.broker.call(`v1.${ serviceName }.payoutWinners`, { lotteryId, _id: endedLottery._id }, { timeout: 0 });

                    await sleep(5000);

                    const winningWallets: string[] = await this.broker.call(`v1.${ serviceName }.getWinnersOfLottery`, { lotteryId }, { timeout: 0 });
                
                    this.sendTelegramMessage(winningWallets, endedLottery.asset_choice, lotteryId);
                }

                // Set the lottery's active state to false
                this.deactivateLottery(endedLottery._id);

                // Log ended lottery ID
                this.logger.debug(`Lottery ended! Id: ${endedLottery._id}.`);
            }
        }

        // Call after 15 mins // twitter rate limiting
        setTimeout(this.findAndStartLotteries, 15 * 60 * 1000); 
    }

    @Method
    async getParticipants(endedLottery: ILottery.LotteryEntity) {
        const { createdAt, twitter, wallet, _id } = endedLottery;
        const { wallet_post, ...reqs } = twitter;
        const twitterRequirements = Object.entries(reqs);

        let baseParticipants: { text: string; author_id: string; }[] = await this.broker.call("v1.twitter.comments", { postUrl: wallet_post }, { timeout: 0 });

        if (baseParticipants) {
            for await (const [key, value] of twitterRequirements) {
                this.logger.debug(`Getting participants, key: ${key} value: ${value}.`);

                let participants: string[] = [];
                switch (key) {
                    case "like":
                        if (await this.broker.call("v1.twitter.getTweetData", { postUrl: value }, { timeout: 0 })) {
                            participants = await this.broker.call("v1.twitter.likedBy", { postUrl: value }, { timeout: 0 });
                        } else {
                            this.emergencyPayout(wallet, _id);
                            return null;
                        }
                        break;
                    case "content":
                        participants = await this.broker.call("v1.twitter.tweetedBy", { content: value, dateFrom: createdAt }, { timeout: 0 });
                        break;
                    case "retweet":
                        if (await this.broker.call("v1.twitter.getTweetData", { postUrl: value }, { timeout: 0 })) {
                            participants = await this.broker.call("v1.twitter.retweetedBy", { postUrl: value }, { timeout: 0 });
                        } else {
                            this.emergencyPayout(wallet, _id);
                            return null;
                        }
                        break;
                    case "follow":
                        if (await this.broker.call("v1.twitter.getUserData", { userName: value }, { timeout: 0 })) {
                            participants = await this.broker.call("v1.twitter.followedBy", { userName: value }, { timeout: 0 });
                        } else {
                            this.emergencyPayout(wallet, _id);
                            return null;
                        }
                        break;
                    default:
                        this.logger.error(`Unknown key ${key}`);
                }

                // Keep users who meet requirements
                baseParticipants = baseParticipants.filter((comment: any) =>
                    participants.some((id) => comment.author_id === id)
                );
            }
            // Keep users who posted wallet
            this.logger.debug('Fetching wallets from comments.');
            baseParticipants = baseParticipants.map(({text, author_id}) => ({ author_id, text: text.match(regex.wallet)?.[0] ?? ''}));

            // Filter bots
            const filteredIds: string[] = await this.broker.call("v1.twitter.filterBots", { users: baseParticipants.map(({author_id}) => author_id) }, { timeout: 0 });
            
            baseParticipants = baseParticipants.filter(({author_id}) => filteredIds.includes(author_id));
        }
        return baseParticipants;
    }

    @Method
    sendTelegramMessage( winningWallets: string[], lotteryAsset: string, lotteryId: number) {
        
        const lotteryMessage = winningWallets.length > 0
        ? `Winning wallets in lottery #${lotteryId} asset: ${lotteryAsset} are: ${winningWallets.join(', ')}`
        : `Lottery #${lotteryId} asset: ${lotteryAsset} ended with no winners; No participants.`;

        this.broker.call("v1.telegram.sendMessage", { message: lotteryMessage }, { timeout: 0 })
        .then(res => this.logger.debug(`Telegram message sent!`))
        .catch(this.logger.error);
    }

    @Method
    emergencyPayout(wallet: string, lotteryId = "") {
        if (lotteryId) {
            this.deactivateLottery(lotteryId);
        }
        // TODO 
    }
    
	started(): void {
        void this.findAndStartLotteries();
    }

	created(): void {}
	
	stopped(): void {}
}
export default LotteryService;