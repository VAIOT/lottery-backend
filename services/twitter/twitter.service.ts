import type { Context, ServiceSchema } from "moleculer";
import mongoose from "mongoose";
import { TwitterApi } from "twitter-api-v2";
import type { Account, Post, PostContent } from "./interfaces/twitter";
import methods from "./methods";

mongoose.connect(`mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_URI}`)
.catch((error) => {
	throw new Error(error)
});

const TwitterService: ServiceSchema = {
	name: "twitter",
	version: 1,

	settings: {
		apiClient: new TwitterApi(<string>process.env.TWITTER_TOKEN).readOnly,
	},

	actions: {
		likes: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/likes'
			},
			params: {
				post_url: "string"
			},
			handler(ctx: Context<Post>) {
				return this.fetchLikesWithComment(ctx.params.post_url);
			}
		},
		retweets: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/retweets'
			},
			params: {
				post_url: "string"
			},
			handler(ctx: Context<Post>) {
				return this.fetchRetweets(ctx.params.post_url);
			}
		},
		followers: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/followers'
			},
			params: {
				user: "string",
				post_url: "string"
			},
			handler(ctx: Context<Account>) {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				const { user, post_url } = ctx.params;
				return this.fetchFollowers(user, post_url);
			}
		},
		content: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/content'
			},
			params: {
				content: "string",
				date_from: "date"
			},
			async handler(ctx: Context<PostContent>) {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				const { content, date_from } = ctx.params;
				await this.fetchPostsWithContent(content, date_from);
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
		getWallet(content: string): string {
			return content; // TODO implementation
		},
		...methods
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
