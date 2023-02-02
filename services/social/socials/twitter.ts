import { Errors } from "moleculer";
import type {
	TweetLikingUsersV2Paginator,
	TweetRetweetersUsersV2Paginator, TweetSearchAllV2Paginator,
	UserV2
} from "twitter-api-v2";
// eslint-disable-next-line import/no-extraneous-dependencies
import { TwitterApi } from "twitter-api-v2";

const client = new TwitterApi(<string>process.env.TWITTER_TOKEN);
const readOnlyClient = client.readOnly;

class Twitter {
	async likes(url: string): Promise<TweetLikingUsersV2Paginator> {
		const likes = await readOnlyClient.v2.tweetLikedBy(this.getPostId(url), { asPaginator: true, "tweet.fields": "created_at" });
		while (!likes.done) {
			await likes.fetchNext();
		}
		return likes
	}

	async retweets(url: string): Promise<TweetRetweetersUsersV2Paginator> {
		const retweets = await readOnlyClient.v2.tweetRetweetedBy(this.getPostId(url), { asPaginator: true, "tweet.fields": "created_at" });
		while (!retweets.done) {
			await retweets.fetchNext();
		}
		return retweets
	}

	async postsWithContent(content: string, dateFrom: Date, dateTo: Date): Promise<TweetSearchAllV2Paginator> {
		const search = await readOnlyClient.v2.searchAll(content, { start_time: dateFrom.toISOString(), end_time: dateTo.toISOString() });
		while (!search.done) {
			await search.fetchNext();
		}
		return search;
	}

	async followers(user: string): Promise<UserV2[]> {
		const followers = await readOnlyClient.v2.followers(await this.getUserID(user), { asPaginator: true });
		while (!followers.done) {
			await followers.fetchNext();
		}
		return followers.users;
	}

	private async getUserID(user: string): Promise<string> {
		return (await readOnlyClient.v2.userByUsername(user.substring(1, user.length))).data.id;
	}

	private getPostId(url: string): string {
		const postID = url.split("/").find((el, index, obj) => obj[index-1] === "status");
		if (!postID) {
			throw new Errors.MoleculerError("Post ID not found.", 422, "ERR_POST_ID", { url });
		}
		return postID;
	}
}

export const twitter = new Twitter();
