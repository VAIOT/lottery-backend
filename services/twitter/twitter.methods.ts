/* eslint-disable @typescript-eslint/naming-convention */
import type { TweetV2, Tweetv2SearchParams, TwitterApiv2, UserV2, UserV2Result } from "twitter-api-v2";
import { ApiResponseError, TweetLikingUsersV2Paginator, TweetSearchRecentV2Paginator, TwitterApi, UserFollowersV2Paginator} from "twitter-api-v2";
import { SEARCH_TYPE } from "./enums";
import type { Paginator } from "./interfaces/twitter";
import twitter from "./twitter.schema";

export default class Twitter {
    private api: TwitterApiv2;

    constructor() {
        this.api = new TwitterApi(<string>process.env.TWITTER_TOKEN).v2;
    }

    /**
     * Get the author of a tweet given its URL
     * @param postUrl The URL of the tweet
     */
    async getTweetAuthor(postUrl: string): Promise<Promise<any>> {
        return this.getTweetData(postUrl, { "tweet.fields" : ["author_id"] });
    }

    /**
     * Get the users who liked the tweet
     * @param postUrl The URL of the tweet
     */
    async getTweetLikes(postUrl: string): Promise<TweetLikingUsersV2Paginator | { data: TweetV2[] | UserV2[], complete: boolean, errors?: never } | { errors: unknown[], data?: never }> {
        const completeQuery = `Likes:${postUrl}`;

        const postId = this.getPostId(postUrl);
        if (postId.errors) {
            return postId ;
        }

        let users = await this.loadPaginator(completeQuery, TweetLikingUsersV2Paginator.prototype);
        if (!users) {
            users = await this.api.tweetLikedBy(postId.data, { asPaginator: true });

            if (users.errors.length > 0) {
                return users;
            }
        }

        return this.iteratePaginator(users, completeQuery);
    }

    /**
     * Get all comments for a tweet
     * @param postUrl The URL of the tweet
     */
    async getTweetComments(postUrl: string): Promise<{data?: any, complete?: boolean } & { errors?: any[]}> {
        const tweetWithConversation = await this.getTweetData(postUrl, { "tweet.fields": ["conversation_id"] });

        if (tweetWithConversation.errors) {
            return tweetWithConversation;
        }
        const { conversation_id } = tweetWithConversation.data as TweetV2;
        const tweetComments = await this.searchTweets(conversation_id as string, { "tweet.fields": ["author_id"] }, SEARCH_TYPE.CONVERSATION);

        if (tweetComments.errors) {
            return tweetComments;
        }
        return tweetComments;
    }
    
    /**
     * Get the retweets
     * @param postUrl The URL of the tweet
     */
    async getRetweets(postUrl: string): Promise<{ data?: never, errors: unknown[] } | { data: any, errors?: never, complete: boolean }> {
        const postId = this.getPostId(postUrl);
        if (postId.errors) {
            return postId;
        }
        return this.searchTweets(postId.data, { "tweet.fields": ["author_id"] }, SEARCH_TYPE.URL);
    }

    /**
     * Find tweets created after the given date with specific content
     * @param content The searched phrase
     * @param dateFrom Start date
     */
    async findTweetsWithContent(content: string, dateFrom: Date): Promise<TweetSearchRecentV2Paginator | Partial<{ data: TweetV2[] | UserV2[], errors: unknown[], complete: boolean }>> {
        return this.searchTweets(content, { start_time: dateFrom.toISOString(), "tweet.fields": ["author_id"] }, SEARCH_TYPE.CONTENT);
    }

    /**
     * Retrieve followers for given user
     * @param user username of the user
    */
    async getFollowers(user: string): Promise<Partial<{ data: UserV2[]; errors: unknown[]; complete: boolean; }>> {
        const completeQuery = `Followers:${user}`;
        const userData = await this.getUserData(user);

        if (userData.errors) {
            return { errors: userData.errors };
        }
        
        let followers = await this.loadPaginator(completeQuery, UserFollowersV2Paginator.prototype);
        if (!followers) {
            followers = await this.api.followers(userData.data.id, { asPaginator: true });

            if (followers.errors.length > 0) {
                return { errors: followers.errors };
            }
        }

        const { data, errors, complete } = await this.iteratePaginator(followers, completeQuery, 1000);

        return { data: (data as UserV2[]), errors, complete }
    }

    /**
     * Adds new tweet using the passed content
     * @param content post content
    */
    async addPost(content: string): Promise<string> {
        return (await this.api.tweet(content)).data.id;
    }

    /**
     * Automatic pagination caching
     */
    private async searchTweets(query: string, fields?: Partial<Tweetv2SearchParams>, searchType: SEARCH_TYPE = SEARCH_TYPE.CONTENT) {
        const completeQuery = `${searchType}${query}`;

        let search = await this.loadPaginator(completeQuery, TweetSearchRecentV2Paginator.prototype);

        if (!search) {
            search = await this.api.search(completeQuery, fields);

            if (search.errors.length > 0) {
                return { errors: search.errors };
            } if (search.meta.result_count === 0) {
                return { data: [], complete: true }
            }
        }

        return this.iteratePaginator(search, completeQuery);
    }

    private async getTweetData(postUrl: string, fields?: Partial<Tweetv2SearchParams>) {
		const postId = this.getPostId(postUrl);
        
        if (postId.errors) {
            return postId;
        }
        const tweet = await this.api.singleTweet(postId.data, fields);

		return { data: tweet.data, errors: tweet.errors };
	}

    private getPostId(url: string) {
		const postId = url.split("/").find((el, index, obj) => obj[index-1] === "status")?.split('?')[0];
        if (!postId) {
			return { errors: [{ value: 'Post id not found' }] }
		}
		return { data: postId };
	}

    private async getUserData(user: string): Promise<UserV2Result> {
		return this.api.userByUsername(user.substring(1, user.length));
	}

    /**
     * Iterate and save
     */
    private async iteratePaginator<T extends Paginator>(paginator: T, key: string, fetchLimit = 100) {
        if (paginator.unusable) {
			return { errors: paginator.errors };
		}

        if (!paginator.done) {
            while(!paginator.done) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    await paginator.fetchNext(fetchLimit);
                } catch(error: unknown) {
                    if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
                        break;
                    } else {
                        return { errors: [error] };
                    }
                }
            }
            await this.savePaginator(key, paginator);
        }

        return { data: paginator.data.data ?? [], complete: paginator.done }
    }

    private async savePaginator(key: string, paginator: Paginator) {
        await twitter.findOneAndUpdate({key}, {key, paginator}, {upsert: true});
		console.info(`[Paginator] Saved with: ${paginator.meta.result_count} results`);
    }

    private async loadPaginator<T extends Paginator>(key: string, classPrototype: T): Promise<T> {
        const db = await twitter.findOne({key}).lean();

		return db
		? Object.assign(Object.create(classPrototype), db.paginator)
		: null;
    }
}