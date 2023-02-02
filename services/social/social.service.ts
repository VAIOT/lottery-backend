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
				postUrl: "string",
				date_from: "date",
				date_to: "date"
			},
			async handler(ctx: Context<Post>) {
				const data = ctx.params;
				await twitter.likes(data.postUrl)
			}
		},
		retweets: {
			visibility: "protected",
			params: {
				postUrl: "string",
				date_from: "date",
				date_to: "date"
			},
			async handler(ctx: Context<Post>) {
				const data = ctx.params;
				await twitter.retweets(data.postUrl)
			}
		},
		followers: {
			visibility: "protected",
			params: {
				account: "string",
				date_from: "date",
				date_to: "date"
			},
			async handler(ctx: Context<Account>) {
				const data = ctx.params;
				await twitter.followers(data.account)
				// get all followers before and save to db (id: account, followers: ...)
				// after x time compare followers
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
				for await (const post of posts) {
					wallets.push(this.findWallet(post.text));
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
		findWallet(content: string): string {
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
