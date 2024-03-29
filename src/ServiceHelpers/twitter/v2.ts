import type { TweetLikingUsersV2Paginator, TweetRetweetersUsersV2Paginator, TweetSearchRecentV2Paginator, TweetV2SingleResult, UserV2Result } from "twitter-api-v2";
import BaseApi from "./baseApi";

export default class extends BaseApi{

    async getTweetData(tweetId: string): Promise<TweetV2SingleResult> {
        return this.autoRetryOnRateLimitError(() => this.api.v2.singleTweet(tweetId, { "tweet.fields" : ["author_id", "conversation_id"] }));
    }

    /**
     * Get the retweets
     * @param tweetId ID of the tweet
     */
    async getRetweets(tweetId: string): Promise<TweetRetweetersUsersV2Paginator> {
        const retweets = await this.autoRetryOnRateLimitError(() => this.api.v2.tweetRetweetedBy(tweetId, { asPaginator: true }));

        while(!retweets.done) {
            await this.autoRetryOnRateLimitError(() => retweets.fetchNext(100));
        }

        return retweets;
    }

    /**
     * Get the users who liked the tweet
     * @param tweetId ID of the tweet
     */
    async getTweetLikes(tweetId: string): Promise<TweetLikingUsersV2Paginator> {
        const likes = await this.autoRetryOnRateLimitError(() => this.api.v2.tweetLikedBy(tweetId, { asPaginator: true }));

        while(!likes.done) {
            await this.autoRetryOnRateLimitError(() => likes.fetchNext(100));
        }

        return likes;
    }
    
    /**
     * Get all comments for a tweet
     * @param tweetId ID of the tweet
     */
    async getTweetComments(conversationId: string): Promise<TweetSearchRecentV2Paginator> {
        const comments = await this.autoRetryOnRateLimitError(() => this.api.search(`conversation_id:${conversationId}`, { "tweet.fields": ["author_id"] }));

        while(!comments.done) {
            await this.autoRetryOnRateLimitError(() => comments.fetchNext(100));
        }

        return comments;
    }

    /**
     * Find tweets created after the given date with specific content
     * @param content The searched phrase
     * @param dateFrom Start date
     */
    async searchTweets(content: string, dateFrom: Date): Promise<TweetSearchRecentV2Paginator > {
        const search = await this.autoRetryOnRateLimitError(() => this.api.search(content, { start_time: dateFrom.toISOString(), "tweet.fields": ["author_id"] }));
        
        while(!search.done) {
            await this.autoRetryOnRateLimitError(() => search.fetchNext(100));
        }

        return search;
    }

    async getUserData(userName: string): Promise<UserV2Result> {
		return this.autoRetryOnRateLimitError(() => this.api.v2.userByUsername(userName.substring(1, userName.length), { "user.fields": ["public_metrics"]}));
	}
}