/* eslint-disable no-continue */
import events from "events";
import type { Context, ServiceSchema } from "moleculer";
import Botometer from "./botometer";
import Twitter from "./methods";

events.defaultMaxListeners = 100;

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
				try {
					return twitter.getTweetLikes(postUrl);
				} catch(e) {
					return [];
				}
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
				try {
					return twitter.getTweetRetweets(postUrl);
				} catch(e) {
					return [];
				}
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
				try {
					return twitter.getUserFollowers(userName);
				} catch(e) {
					return [];
				}
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
				try {
					return twitter.searchTweets(content, dateFrom);
				} catch(e) {
					return [];
				}
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
				try {
					return twitter.getTweetComments(postUrl, true, true);
				} catch(e) {
					return null;
				}
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
