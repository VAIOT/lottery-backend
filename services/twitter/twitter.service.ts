/* eslint-disable no-continue */
import events from "events";
import type { Context, ServiceSchema } from "moleculer";
import mongoose from "mongoose";
import Botometer from "./botometer";
import Twitter from "./methods";

events.defaultMaxListeners = 100;

mongoose.connect(`mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_URI}`)
.catch((error) => {
	throw new Error(error)
});

const twitter = new Twitter();

const TwitterService: ServiceSchema = {
	name: "twitter",
	version: 1,

	settings: {},

	actions: {
		likedBy: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/likedBy'
			},
			params: {
				postUrl: "string"
			},
			handler(ctx: Context<{postUrl: string}>) {
				const { postUrl } = ctx.params;
				return twitter.getTweetLikes(postUrl);
			}
		},
		retweetedBy: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/retweetedBy'
			},
			params: {
				postUrl: "string"
			},
			handler(ctx: Context<{postUrl: string}>) {
				const { postUrl } = ctx.params;
				return twitter.getTweetRetweets(postUrl);
			}
		},
		followedBy: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/followedBy'
			},
			params: {
				userName: "string"
			},
			handler(ctx: Context<{ userName: string }>) {
				const { userName } = ctx.params;
				return twitter.getUserFollowers(userName);
			}
		},
		tweetedBy: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/tweetedBy'
			},
			params: {
				content: "string",
				dateFrom: "date"
			},
			handler(ctx: Context<{content: string, dateFrom: Date}>) {
				const { content, dateFrom } = ctx.params;
				return twitter.searchTweets(content, dateFrom);
			}
		},
		comments: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/participants'
			},
			params: {
				postUrl: "string",
			},
			handler(ctx: Context<{ postUrl: string }>) {
				const { postUrl } = ctx.params;
				return twitter.getTweetComments(postUrl, true, true);
			}
		},
		filterBots: {
			visibility: "protected",
			rest: {
				method: 'POST',
				path: '/filterBots'
			},
			params: {
				users: "array",
			},
			handler(ctx: Context<{ users: string[] }>) {
				const { users } = ctx.params;
				return this.filterBots(users);
			}
		},
		addTweet: {
			visibility: "protected",
			rest: {
				method: 'POST',
				path: '/addTweet'
			},
			params: {
				content: "string"
			},
			async handler(ctx: Context<{ content: string }>) {
				const { content } = ctx.params;
				return new Twitter().addTweet(content);
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
	methods: {
		/**
		 * Filter bots from users ids
		 */
		async filterBots(usersIds: string[]) {
			const botometer = new Botometer();
			const realUsers: string[] = [];

			for await (const userId of usersIds) {
				this.logger.debug(`Getting bot score for: ${userId}`);
				const userScore = await botometer.getScoreFor(userId);

				if (userScore.cap?.universal > 0.94) {
					this.logger.debug(`User removed from lottery: ${userId}`);
					continue;
				}
				realUsers.push(userId);
			}
			return realUsers;
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

export default TwitterService;
