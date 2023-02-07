import type { Context, ServiceSchema } from "moleculer";
import { followers, likes, postsWithContent, retweets } from "./functions";
import type { Account, Post, PostContent } from "./interfaces/twitter";

const SocialService: ServiceSchema = {
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
			async handler(ctx: Context<Post>) {
				return likes(ctx.params.post_url, this.logger);
			}
		},
		retweets: {
			visibility: "protected",
			rest: {
				method: 'GET',
				path: '/retweets'
			},
			params: {
				post_url: "string",
				date_from: "date"
			},
			async handler(ctx: Context<Post>) {
				const data = ctx.params;
				await retweets(data.post_url, this.logger);
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
				post_url: "string",
				date_from: "date"
			},
			async handler(ctx: Context<Account>) {
				const data = ctx.params;
				await followers(data.user, data.post_url, this.logger);
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
			async handler(ctx: Context<PostContent>): Promise<string[]> {
				const data = ctx.params;
				const wallets: string[] = [];

				const posts = await postsWithContent(data.content, data.date_from, this.logger);
				if (posts.data) {
					for await (const post of posts.data) {
						wallets.push(this.getWallet(post.text));
					}
				}
				return wallets;
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

export default SocialService;
