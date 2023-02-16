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
				wallet_post: "string",
				post_url: "string"
			},
			async handler(ctx: Context<Post>) {
				const { post_url, wallet_post } = ctx.params;

				const likes = await this.getLikedAndCommented(post_url);
				if (likes.errors) {
					return likes;
				}
				return this.getParticipants(wallet_post, likes);
			}
		},
		retweets: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/retweets'
			},
			params: {
				wallet_post: "string",
				post_url: "string"
			},
			async handler(ctx: Context<Post>) {
				const { post_url, wallet_post } = ctx.params;

				const retweets = await this.getRetweets(post_url);
				if (retweets.errors) {
					return retweets;
				}
				return this.getParticipants(wallet_post, retweets);
			}
		},
		followers: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/followers'
			},
			params: {
				wallet_post: "string",
				user: "string"
			},
			async handler(ctx: Context<Account>) {
				const { user, wallet_post } = ctx.params;

				const followers = await this.getFollowers(user);
				if (followers.errors) {
					return followers;
				}
				return this.getParticipants(wallet_post, followers);
			}
		},
		content: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/content'
			},
			params: {
				wallet_post: "string",
				content: "string",
				date_from: "date"
			},
			async handler(ctx: Context<PostContent>) {
				const { content, date_from, wallet_post } = ctx.params;

				const tweets = await this.findTweetsWithContent(content, date_from);
				if (tweets.errors) {
					return tweets;
				}
				return this.getParticipants(wallet_post, tweets);
			}
		},
		getParticipants: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/participants'
			},
			params: {
				wallet_post: "string"
			},
			handler(ctx: Context<{ wallet_post: string }>) {
				const { wallet_post } = ctx.params;
				return this.getParticipants(wallet_post);
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
		async getParticipants(walletsPostUrl: string, results?: any): Promise<Partial<{ wallets: string[], errors: any, complete?: boolean}>> {
			const twitterInstance =  new Twitter();

			// wallets
			const tweetComments = await twitterInstance.getTweetComments(walletsPostUrl);
			if (tweetComments.errors) {
				return tweetComments;
			}
			const tweetWithAuthor = await twitterInstance.getTweetAuthor(walletsPostUrl);
			if (tweetWithAuthor.errors) {
				return tweetWithAuthor;
			}

			if (results) {
				// leave the wallet post of user who participated in the lottery
				tweetComments.data = tweetComments.data.filter((result: any) => results.data.some((wallet: any) => result.author_id ?? result.id === wallet.author_id))
			}
			
			// exclude lottery owner
			tweetComments.data = tweetComments.data.filter((wallet: any) => wallet.author_id !== tweetWithAuthor.data.author_id);

			const casualExtermination = await this.filterBots(tweetComments);

			return casualExtermination;
		},

		async filterBots(results: any) {
			const realUsers: any[] = [];
			
			for await (const result of results.data) {
				const userId = result.author_id ?? result.id;

				const botometer = await new Botometer().getScoreFor(userId);

				if (botometer.cap.universal > 0.94) {
					continue;
				}

				realUsers.push(result);
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
