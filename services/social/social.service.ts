import type { Context, ServiceSchema } from "moleculer";
import type { Account, Post, PostContent } from "./interfaces/twitter";
import { twitter } from "./socials";

const SocialService: ServiceSchema = {
	name: "social",
	version: 1,

	settings: {},

	actions: {
		likes: {
			visibility: "protected",
			params: {
				post_url: "string",
				date_from: "date",
				date_to: "date"
			},
			async handler(ctx: Context<Post>) {
				const data = ctx.params;
				return twitter.likes(data.post_url);
			}
		},
		retweets: {
			visibility: "protected",
			params: {
				post_url: "string",
				date_from: "date",
				date_to: "date"
			},
			async handler(ctx: Context<Post>) {
				const data = ctx.params;
				await twitter.retweets(data.post_url);
			}
		},
		followers: {
			visibility: "protected",
			params: {
				user: "string",
				post_url: "string",
				date_from: "date",
				date_to: "date"
			},
			async handler(ctx: Context<Account>) {
				const data = ctx.params;
				await twitter.followers(data.user, data.post_url);
			}
		},
		content: {
			visibility: "protected",
			params: {
				content: "string",
				date_from: "date",
				date_to: "date"
			},
			async handler(ctx: Context<PostContent>): Promise<string[]> {
				const data = ctx.params;
				const wallets: string[] = [];

				const posts = await twitter.postsWithContent(data.content, data.date_from, data.date_to);
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
