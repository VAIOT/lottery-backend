/* eslint-disable no-continue */
/* eslint-disable @typescript-eslint/naming-convention */
import events from "events";
import type { Context, ServiceSchema } from "moleculer";
import mongoose from "mongoose";
import Botometer from "./botometer";
import type { Account, Post, PostContent } from "./interfaces/twitter";
import Twitter from "./twitter.methods";

events.defaultMaxListeners = 100;

mongoose.connect(`mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_URI}`)
.catch((error) => {
	throw new Error(error)
});

const TwitterService: ServiceSchema = {
	name: "twitter",
	version: 1,

	settings: {},

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
				const { post_url} = ctx.params;
				return this.getLikedAndCommented(post_url);
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
				const { post_url } = ctx.params;
				return this.getRetweets(post_url);
			}
		},
		followers: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/followers'
			},
			params: {
				user: "string"
			},
			handler(ctx: Context<Account>) {
				const { user } = ctx.params;

				return this.getFollowers(user);
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
			handler(ctx: Context<PostContent>) {
				const { content, date_from } = ctx.params;

				return this.findTweetsWithContent(content, date_from);
			}
		},
		participants: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/participants'
			},
			params: {
				wallet_post: "string",
			},
			handler(ctx: Context<{ wallet_post: string }>) {
				const { wallet_post } = ctx.params;
				return this.getFilteredComments(wallet_post);
			}
		},
		addPost: {
			visibility: "protected",
			rest: {
				method: 'POST',
				path: '/addPost'
			},
			params: {
				content: "string"
			},
			async handler(ctx: Context<{ content: string }>) {
				const { content } = ctx.params;
				return new Twitter().addPost(content);
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
		 * Filter bots from comments and optionally compare commenting users from basePost and results array
		 */
		async getFilteredComments(basePostUrl: string): Promise<Partial<{ wallets: string[], errors: any, complete?: boolean}>> {
			const twitterInstance =  new Twitter();

			// wallets
			const tweetComments = await twitterInstance.getTweetComments(basePostUrl);
			if (tweetComments.errors) {
				return tweetComments;
			}
			const tweetWithAuthor = await twitterInstance.getTweetAuthor(basePostUrl);
			if (tweetWithAuthor.errors) {
				return tweetWithAuthor;
			}
			
			// exclude lottery owner
			tweetComments.data = tweetComments.data.filter((wallet: any) => wallet.author_id !== tweetWithAuthor.data.author_id);

			tweetComments.data = this.removeDuplicatedUserEntries(tweetComments.data);

			const casualExtermination = await this.filterBots(tweetComments);

			return casualExtermination;
		},

		removeDuplicatedUserEntries(entries: any[]) {
			return entries.filter((entry, index, self) => self.findIndex(({author_id}) => entry.author_id === author_id) === index);
		},

		async filterBots(results: any) {
			const realUsers: { data: any[], complete: boolean} = { data: [], complete: results.complete};
			
			for await (const result of results.data) {
				const userId = result.author_id ?? result.id;

				this.logger.debug(`Getting bot score for: ${userId}`);

				const botometer = await new Botometer().getScoreFor(userId);

				if (botometer.cap?.universal > 0.94) {
					continue;
				}

				realUsers.data.push(result);
			}
			return realUsers;
		},

		async getLikedAndCommented(postUrl: string) {
			const twitterInstance = new Twitter();

			const comments = await twitterInstance.getTweetComments(postUrl);
			if (comments.errors) {
				return comments;
			}
			
			const likes = await twitterInstance.getTweetLikes(postUrl);
			if (likes.errors) {
				return likes;
			}
			
			comments.data = comments.data
			.filter((comment: any) => likes.data.some((like: any) => like.id === comment.author_id));

			return comments;
		},

		async getRetweets(postUrl: string) {
			const twitterInstance = new Twitter();

			const tweetWithAuthor = await twitterInstance.getTweetAuthor(postUrl);
			
			if (tweetWithAuthor.errors) {
				return tweetWithAuthor;
			}
			const retweets = await twitterInstance.getRetweets(postUrl);

			if (retweets.errors) {
				return retweets;
			}

			const data = retweets.data.filter(({author_id}: {author_id: string}) => author_id !== tweetWithAuthor.data.author_id);

			return { data, complete: retweets.complete };
		},

		async findTweetsWithContent(content: string, dateFrom: Date) {
			return new Twitter().findTweetsWithContent(content, dateFrom);
		},

		async getFollowers(user: string) {
			return new Twitter().getFollowers(user);
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
