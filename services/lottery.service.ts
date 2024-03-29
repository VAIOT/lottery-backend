import { lottery } from '@Entities/lottery';
import { ILottery, TwitterDto } from '@Interfaces/index';
import { sleep } from '@Meta';
import { ERC20_TYPE, PAYMENT_STATUS, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from '@Meta/enums';
import type { ServiceDependency} from 'moleculer';
import { Context , Service as MoleculerService} from 'moleculer';
import DbService from "moleculer-db";
import MongooseAdapter from "moleculer-db-adapter-mongoose";
import { Action, Method, Service } from 'moleculer-decorators';
import type { TweetV2, UserV2 } from 'twitter-api-v2';
import * as rules from '@Validation/rules';

@Service({
    name: "lottery",
	version: 1,
    mixins: [DbService],
    adapter: process.env.NODE_ENV === 'test' 
        ? new DbService.MemoryAdapter() 
        : new MongooseAdapter(`mongodb+srv://${process.env.MONGO_URI}/${process.env.MONGO_DB_NAME}`, {
            user: process.env.MONGO_USER,
            pass: process.env.MONGO_PASS,
            keepAlive: true,
	    }),
    model: lottery,
    entityValidator: {
        duration: { type: "number", integer: true, positive: true, max: 168 },
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
                    pattern: rules.twitter.post,
                    optional: true,
                },
                content: { type: "string", min: 3, max: 280, optional: true },
                retweet: {
                    type: "string",
                    pattern: rules.twitter.post,
                    optional: true,
                },
                follow: { type: "string", pattern: rules.twitter.username, optional: true },
                wallet_post: { type: "string", pattern: rules.twitter.post, optional: false },
            },
        },
    },
    hooks: {
        before: {
			async create(ctx: Context<ILottery.LotteryDTO, {session: {[x: string]: string|object}}>) {
				const { tx_hashes, twitter } = ctx.params;
                const tokens = ctx.meta.session.accessTokens;
                console.log({gotTokens: tokens})

                if (twitter.follow) {
                    const user = await ctx.broker.call("v1.twitter.getUserData", { userName: twitter.follow }, { meta: { tokens }, timeout: 0 }) as UserV2;
                    if (!user) {
                        throw new Error("User does not exist!");
                    } else {
                        const followers = user.public_metrics?.followers_count;
                        if (followers && followers >= 1000000) {
                            throw new Error("User cannot participate in the lottery!");
                        }
                    }
                }

                const oneDay = new Date().setHours(new Date().getHours() - 24);
                if (twitter.like) {
                    const tweet = await ctx.broker.call("v1.twitter.getTweetData", { postUrl: twitter.like }, { meta: { tokens }, timeout: 0 }) as TweetV2;
                    if (!tweet) {
                        throw new Error("Tweet does not exist!");
                    }
                }
                if (twitter.retweet) {
                    const tweet = await ctx.broker.call("v1.twitter.getTweetData", { postUrl: twitter.retweet }, { meta: { tokens }, timeout: 0 }) as TweetV2;
                    if (!tweet) {
                        throw new Error("Tweet does not exist!");
                    }
                }
                if (twitter.wallet_post) {
                    const tweet = await ctx.broker.call("v1.twitter.getTweetData", { postUrl: twitter.wallet_post }, { meta: { tokens }, timeout: 0 }) as TweetV2;
                    if (!tweet) {
                        throw new Error("Tweet does not exist!");
                    } 
                    console.log({oneDay, dateNow: Date.parse(tweet.created_at!)})
                    if (oneDay > Date.parse(tweet.created_at!)) {
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
                ctx.service?.sendTelegramMessage(`New lottery #${_id} asset: ${asset_choice}, has been created!`)

                const tokenType = (asset_choice === TOKEN_TYPE.MATIC ? 'MATIC' : 'ETH');

                ctx.service?.handleTransactions(transactions, tokenType, lotteryEntity);

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

    @Action({
        rest: { 
            method: "POST", 
            path: "/setUserTokens" 
        },
        params: { 
            oauth_token: "string", 
            oauth_verifier: "string" 
        },
        visibility: "published"
    })
    async setUserTokens(ctx: Context<{oauth_token: string, oauth_verifier: string}, {session: {[x: string]: string|object}}>) {
        const { oauth_token, oauth_verifier } = ctx.params;

        const tokensDto = {
            userVerifier: oauth_verifier,
            userToken: oauth_token,
            savedToken: ctx.meta.session.oauthToken,
            savedSecret: ctx.meta.session.oauthSecret
        }
        
        const tokens = await this.broker.call("v1.twitter.getUserTokens", { tokens: tokensDto }, { timeout: 0 });
        console.log({tokens})

        ctx.meta.session.accessTokens = tokens as object;
        console.log({setTokens: ctx.meta.session.accessTokens})

        return { status: "OK" }
    }

    @Action({
        rest: { 
            method: "POST", 
            path: "/twitterRequirementsCheck" 
        },
        params: { 
            twitter_requirements: "object",
        },
        visibility: "published" 
    })
	async twitterRequirementsCheck(ctx: Context<{twitter_requirements: TwitterDto}, {session: {accessTokens:{accessToken: string; accessSecret: string;}}}>): Promise<any> {
		const { twitter_requirements } = ctx.params;
        const tokens = ctx.meta.session.accessTokens;
        console.log({tokens})
        
		try {
			return await this.twitterRequirementsCheckMethod(twitter_requirements, tokens);
		} catch(e) {
			this.logger.error(e);
			return null;
		}
	}

    @Method
    async twitterRequirementsCheckMethod(twitterRequirements: TwitterDto, tokens: { accessToken: string; accessSecret: string; }): Promise<{field: string, error: string} | null> {

        console.log({twitterRequirements})
        if (twitterRequirements.follow) {
            console.log(twitterRequirements.follow);
            const user = await this.broker.call("v1.twitter.getUserData", { userName: twitterRequirements.follow }, { meta: { tokens }, timeout: 0 }) as UserV2;
            console.log({user})
            if (!user) {
                return { field: "follow", error: "USER_NOT_EXIST" };
            }
            const followers = user.public_metrics?.followers_count;
            if (followers && followers >= 1000000) {
                return { field: "follow", error: "USER_BLACKLISTED" };
            }
        }

        const oneDay = new Date().setHours(new Date().getHours() - 24);
        if (twitterRequirements.like) {
            console.log(twitterRequirements.like);
            const tweet = await this.broker.call("v1.twitter.getTweetData", { postUrl: twitterRequirements.like }, { meta: { tokens }, timeout: 0 }) as TweetV2;
            console.log({tweet})
            if (!tweet) {
                return { field: "like", error: "TWEET_NOT_EXIST" };
            }
        }
        if (twitterRequirements.retweet) {
            console.log(twitterRequirements.retweet);
            const tweet = await this.broker.call("v1.twitter.getTweetData", { postUrl: twitterRequirements.retweet }, { meta: { tokens }, timeout: 0 }) as TweetV2;
            console.log({tweet})
            if (!tweet) {
                return { field: "retweet", error: "TWEET_NOT_EXIST" };
            }
        }
        if (twitterRequirements.wallet_post) {
            console.log(twitterRequirements.wallet_post);
            const tweet = await this.broker.call("v1.twitter.getTweetData", { postUrl: twitterRequirements.wallet_post }, { meta: { tokens }, timeout: 0 }) as TweetV2;
            console.log({tweet})
            if (!tweet) {
                return { field: "wallet_post", error: "TWEET_NOT_EXIST" };
            }
            console.log({oneDay, dateNow: Date.parse(tweet.created_at!)})
            if (oneDay > Date.parse(tweet.created_at!)) {
                return { field: "wallet_post", error: "TWEET_OVER_1_DAY" };
            }
        }
        return null;
    }

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
                lotteryType: distribution_method,
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
        }
    }

    @Method
    async checkIfLotteryExists(serviceName: string, lotteryId: number) {
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
                // Get participants
                let { participants } = (await this.actions.find({ query: { _id: endedLottery._id } }))[0] as { participants: {author_id: string, text: string }[] };
                // Get service name for service calls
                const serviceName = (endedLottery.asset_choice === TOKEN_TYPE.MATIC ? 'matic' : 'erc').toLowerCase();

                const lotteryId = endedLottery.lottery_id;
                const lotteryExists = await this.checkIfLotteryExists(serviceName, lotteryId);

                // Check if lottery exists
                if (!lotteryExists) {
                    this.logger.debug(`Lottery doesn't exists. Lottery #${endedLottery._id} deactivated.`);
                    this.deactivateLottery(endedLottery._id);

                    await this.emergencyCashback(endedLottery._id, endedLottery.lottery_id, endedLottery.asset_choice);
                    this.logger.debug(`Lottery #${endedLottery._id} emergency payout done.`);

                    this.logger.error(`Lottery ${endedLottery._id} does not exist in ${serviceName} service!`);
                    continue;
                }

                if (participants?.length > 0) {
                    this.logger.debug(`Found ${participants.length} participants in db.`);
                } else {
                    // Get all participants
                    this.logger.debug(`Getting participants.`);
                    const newParticipants = await this.getParticipants(endedLottery);

                    // If got error
                    if (!newParticipants) {
                        this.deactivateLottery(endedLottery._id);
                        await this.emergencyCashback(endedLottery._id, endedLottery.lottery_id, endedLottery.asset_choice);
                        continue;
                    }
                    participants = newParticipants;

                    // Save to db
                    await this.actions.update({ id: endedLottery._id, participants });

                    this.logger.debug(`Saved ${participants.length} participants to db.`);
                }

                if (participants.length < endedLottery.num_of_winners) {
                    this.logger.debug(`Participants.length < num_of_winners. Lottery #${endedLottery._id} deactivated.`);
                    this.deactivateLottery(endedLottery._id);

                    await this.emergencyCashback(endedLottery._id, endedLottery.lottery_id, endedLottery.asset_choice);
                    this.logger.debug(`Lottery #${endedLottery._id} emergency payout done.`);

                    this.sendTelegramMessage(`Too few participants in the lottery #${lotteryId} asset: ${endedLottery.asset_choice}.`);
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
            
                const message = winningWallets.length > 0
                ? `Winning wallets in the lottery #${lotteryId} asset: ${endedLottery.asset_choice} are: ${winningWallets.join(', ')}`
                : `Lottery #${lotteryId} asset: ${endedLottery.asset_choice} ended with no winners; No participants.`;

                this.sendTelegramMessage(message);

                // Set the lottery's active state to false
                this.deactivateLottery(endedLottery._id);

                // Log ended lottery ID
                this.logger.debug(`Lottery ended successfully! Id: ${endedLottery._id}.`);
            }
        } else {
            this.logger.debug(`No ended lotteries found; Waiting 15mins.`);
        }

        // Call after 15 mins // twitter rate limiting
        setTimeout(this.findAndStartLotteries, 15 * 60 * 1000); 
    }

    @Method
    async getParticipants(endedLottery: ILottery.LotteryEntity) {
        const { createdAt, twitter } = endedLottery;
        const { wallet_post, ...reqs } = twitter;
        const twitterRequirements = Object.entries(reqs);

        this.logger.debug(`Getting baseParticipants`);
        let baseParticipants: { text: string; author_id: string; }[] = await this.broker.call("v1.twitter.comments", { postUrl: wallet_post }, { timeout: 0 });
        this.logger.debug(`Got ${baseParticipants}`);

        if (baseParticipants) {
            for await (const [key, value] of twitterRequirements) {
                this.logger.debug(`Getting participants, key: ${key} value: ${value}.`);

                let participants: string[] = [];
                switch (key) {
                    case "like":
                        if (await this.broker.call("v1.twitter.getTweetData", { postUrl: value }, { timeout: 0 })) {
                            participants = await this.broker.call("v1.twitter.likedBy", { postUrl: value }, { timeout: 0 });
                        } else {
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
                            return null;
                        }
                        break;
                    case "follow":
                        if (await this.broker.call("v1.twitter.getUserData", { userName: value }, { timeout: 0 })) {
                            participants = await this.broker.call("v1.twitter.followedBy", { userName: value }, { timeout: 0 });
                        } else {
                            return null;
                        }
                        break;
                    default:
                        this.logger.error(`Unknown key ${key}.`);
                }

                // Keep users who meet requirements
                this.logger.debug(`Filtering users - ${key}.`);
                baseParticipants = baseParticipants.filter((comment: any) =>
                    participants.some((id) => comment.author_id === id)
                );
            }
            
            // Keep users who posted wallet
            this.logger.debug('Fetching wallets from comments.');
            baseParticipants = baseParticipants.map(({text, author_id}) => ({ author_id, text: text.match(rules.wallet)?.[0] ?? ''}));

            // Filter bots
            const filteredIds: string[] = await this.broker.call("v1.twitter.filterBots", { users: baseParticipants.map(({author_id}) => author_id) }, { timeout: 0 });
            
            baseParticipants = baseParticipants.filter(({author_id}) => filteredIds.includes(author_id));
        }
        return baseParticipants;
    }

    // Sends a Telegram message
    @Method
    sendTelegramMessage(message: string) {
        this.broker.call("v1.telegram.sendMessage", { message }, { timeout: 0 })
        .then(res => {
            this.logger.debug(`Sending telegram message!`)
        })
        .catch(this.logger.error);
    }

    @Method
    async emergencyCashback(_id: string, lotteryId: number, asset_choice: TOKEN_TYPE) {
        if (asset_choice === TOKEN_TYPE.MATIC) {
            await this.broker.call("v1.matic.emergencyCashback", { lotteryId }, { timeout: 0 });
        } else {
            await this.broker.call("v1.erc.emergencyCashback", { _id }, { timeout: 0 });
        }
    }
    
    // Start scanning
	started(): void {
        void this.findAndStartLotteries();
    }

	created(): void {}
	
	stopped(): void {}
}
export default LotteryService;