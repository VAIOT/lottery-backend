/* eslint-disable @typescript-eslint/naming-convention */
import type { TweetLikingUsersV2Paginator, TweetRetweetersUsersV2Paginator, TweetSearchRecentV2Paginator, TweetV2SingleResult, UserV2Result } from "twitter-api-v2";
import BaseApi from "./baseApi";

export default class extends BaseApi<'v2'> {
    constructor() {
        super('v2');
    }

    async getTweetData(tweetId: string): Promise<TweetV2SingleResult> {
        return this.api.singleTweet(tweetId, { "tweet.fields" : ["author_id", "conversation_id"] });
    }

    /**
     * Get the retweets
     * @param tweetId ID of the tweet
     */
    async getRetweets(tweetId: string): Promise<TweetRetweetersUsersV2Paginator> {
        const retweets = await this.api.tweetRetweetedBy(tweetId, { asPaginator: true });

        if (retweets.errors.length) {
            throw new Error(retweets.errors[0].detail);
        }

        return this.autoRetryOnRateLimitError(() => retweets.fetchNext(100));
    }

    /**
     * Get the users who liked the tweet
     * @param tweetId ID of the tweet
     */
    async getTweetLikes(tweetId: string): Promise<TweetLikingUsersV2Paginator> {
        const likes = await this.api.tweetLikedBy(tweetId, { asPaginator: true });

        if (likes.errors.length) {
            throw new Error(likes.errors[0].detail);
        }

        return this.autoRetryOnRateLimitError(() => likes.fetchNext(100));
    }
    
    /**
     * Get all comments for a tweet
     * @param tweetId ID of the tweet
     */
    async getTweetComments(conversationId: string): Promise<TweetSearchRecentV2Paginator> {
        const comments = await this.api.search(`conversation_id:${conversationId}`, { "tweet.fields": ["author_id"] });

        if (comments.errors.length) {
            throw new Error(comments.errors[0].detail);
        }

        return this.autoRetryOnRateLimitError(() => comments.fetchNext(100));
    }

    /**
     * Find tweets created after the given date with specific content
     * @param content The searched phrase
     * @param dateFrom Start date
     */
    async searchTweets(content: string, dateFrom: Date): Promise<TweetSearchRecentV2Paginator > {
        const search = await this.api.search(content, { start_time: dateFrom.toISOString(), "tweet.fields": ["author_id"] });
        
        if (search.errors.length) {
            throw new Error(search.errors[0].detail);
        }

        return this.autoRetryOnRateLimitError(() => search.fetchNext(100));
    }

    async addTweet(content: string): Promise<string> {
        return (await this.api.tweet(content)).data.id;
    }

    async getUserData(userName: string): Promise<UserV2Result> {
		return this.api.userByUsername(userName.substring(1, userName.length));
	}
}