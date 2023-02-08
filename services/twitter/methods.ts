import events from "events";
import type Moleculer from "moleculer";
import { Errors } from "moleculer";
import type { TweetV2, UserV2 } from "twitter-api-v2";
import { ApiResponseError, TweetLikingUsersV2Paginator , TweetSearchRecentV2Paginator, TwitterApiV2Settings, UserFollowersV2Paginator } from "twitter-api-v2";
import { ACTION } from "./enums";
import type { TwitterDTO } from "./interfaces/twitter";
import twitter from "./twitter";

TwitterApiV2Settings.debug = false;
events.defaultMaxListeners = 100;


// Not very elegant, but it works //
// TODO Refactor
const methods = {
	async findAndAssignPagination<T extends (TweetSearchRecentV2Paginator | UserFollowersV2Paginator | TweetLikingUsersV2Paginator) & { prototype: T }>(contentId: string, action: ACTION, classType: T): Promise<T> {
		const db = await twitter.findOne({pagination_type: action, pagination_id: contentId}).lean();
		
		return db
		? Object.assign(Object.create(classType.prototype), db.pagination_data)
		: null;
	},

	getPostId(url: string): string {
		const postID = url.split("/").find((el, index, obj) => obj[index-1] === "status")?.split('?')[0];
		if (!postID) {
			throw new Errors.MoleculerError("Post ID not found.", 422, "ERR_TWITTER_POST_ID", url);
		}
		return postID;
	},

	async getConversationID(this: Moleculer.Service<Moleculer.ServiceSettingSchema>, postUrl: string): Promise<string> {
		try {
			const tweet = await this.settings?.apiClient.v2.singleTweet(this.getPostId(postUrl), { "tweet.fields" : ["conversation_id"] });
			if (tweet.data?.conversation_id) {
				return tweet.data.conversation_id;
			} 
			throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", {error: { message: "Conversation_id is missing"}, response: tweet});
		} catch(error) {
			throw new Errors.MoleculerError("Twitter api error.", error.code, "ERR_TWITTER", error);
		}
	},

	async getUserID(this: Moleculer.Service<Moleculer.ServiceSettingSchema>, user: string): Promise<string> {
		try {
			const tuser = await this.settings?.apiClient.v2.userByUsername(user.substring(1, user.length));
			if (tuser.data?.id) {
				return tuser.data.id
			}
			throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", {error: { message: "User id is missing is missing"}, response: tuser});
		} catch(error) {
			throw new Errors.MoleculerError("Twitter api error.", error.code, "ERR_TWITTER", error);
		}
	},

	// TWITTER POST TO LIKE
	async fetchLikesWithComment(this: Moleculer.Service<Moleculer.ServiceSettingSchema>, postUrl: string): Promise<TwitterDTO> {
		let paginatedResponses: TweetSearchRecentV2Paginator = await this.findAndAssignPagination(postUrl, ACTION.LIKE, TweetSearchRecentV2Paginator);
		let paginatedLikes: TweetLikingUsersV2Paginator = await this.findAndAssignPagination(postUrl, ACTION.LIKE, TweetLikingUsersV2Paginator);

		try {
			// fetch tweet responses with conversation_id
			paginatedResponses = await this.settings.apiClient.v2.search(`conversation_id:${await this.getConversationID(postUrl)}`, { "tweet.fields": ["author_id"]});
		} catch(error) {
			throw new Errors.MoleculerError("Twitter api error.", error.code, "ERR_TWITTER", error);
		}

		if (paginatedResponses.unusable) {
			throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", paginatedResponses.errors);
		} else if(!paginatedResponses.done) {
			while(!paginatedResponses.done) {
				try {
					// eslint-disable-next-line no-await-in-loop
					await paginatedResponses.fetchNext();
					this.logger.debug(`[Responses] Fetched: ${paginatedResponses.meta.result_count}`);
				} catch(error) {
					if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
						this.logger.info(`[Responses] Ratelimit: ${error.rateLimit} | ${error.rateLimitError}`);
						break;
					} else {
						throw new Errors.MoleculerError("Twitter service error.", error.code, "ERR_TWITTER_SERVICE", error);
					}
				}
			}
			await twitter.findOneAndUpdate({pagination_type: ACTION.LIKE, pagination_id: postUrl}, {pagination_type: ACTION.LIKE, pagination_id: postUrl, pagination_data: paginatedResponses}, {upsert: true})
			this.logger.debug(`[Responses] Saved with: ${paginatedResponses.meta.result_count} results`);
		}

		try {
			// fetch likes
			paginatedLikes = await this.settings?.apiClient.v2.tweetLikedBy(this.getPostId(postUrl), { asPaginator: true });
		} catch(error) {
			throw new Errors.MoleculerError("Twitter api error.", error.code, "ERR_TWITTER", error);
		}

		if (paginatedLikes.unusable) {
			throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", paginatedLikes.errors);
		} else {
			while(!paginatedLikes.done) {
				try {
					// eslint-disable-next-line no-await-in-loop
					await paginatedLikes.fetchNext();
					this.logger.debug(`[Likes] Fetched: ${paginatedLikes.meta.result_count}`);
				} catch(error) {
					if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
						this.logger.info(`[Likes] Ratelimit: ${error.rateLimit} | ${error.rateLimitError}`);
						break;
					} else {
						throw new Errors.MoleculerError("Twitter service error.", error.code, "ERR_TWITTER_SERVICE", error);
					}
				}
			}
			await twitter.findOneAndUpdate({pagination_type: ACTION.LIKE, pagination_id: postUrl}, {pagination_type: ACTION.LIKE, pagination_id: postUrl, pagination_data: paginatedLikes}, {upsert: true})
			this.logger.debug(`[Likes] Saved with: ${paginatedLikes.meta.result_count} results`);
		}

		// return users who liked the post and left a comment
		const data = paginatedLikes.done && paginatedResponses ? 
			paginatedResponses.data.data.filter(response => 
				paginatedLikes.data.data.some(like => like.id === response.author_id))
					// eslint-disable-next-line @typescript-eslint/naming-convention
					.map(({author_id, text, id}) => ({author_id: author_id??'', text, id})): null;

		return {
			...(data && {data}), 
			completed: paginatedLikes.done 
		};
	},

	// TWITTER POST TO RETWEET
	async fetchRetweets(this: Moleculer.Service<Moleculer.ServiceSettingSchema>, postUrl: string): Promise<TwitterDTO> {
		let paginatedRetweets: TweetSearchRecentV2Paginator = await this.findAndAssignPagination(postUrl, ACTION.RETWEET, TweetSearchRecentV2Paginator);
		
		if (!paginatedRetweets) {
			try {
				paginatedRetweets = await this.settings.apiClient.v2.search(`url:${this.getPostId(postUrl)}`, { "tweet.fields": ["author_id"]});
			} catch(error) {
				throw new Errors.MoleculerError("Twitter api error.", error.code, "ERR_TWITTER", error);
			}
		}
		
		if (paginatedRetweets.unusable) {
			throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", paginatedRetweets.errors);
		} else if(!paginatedRetweets.done) {
			while(!paginatedRetweets.done) {
				try {
					// eslint-disable-next-line no-await-in-loop
					await paginatedRetweets.fetchNext();
					this.logger.debug(`[Retweets] Fetched: ${paginatedRetweets.meta.result_count}`);
				} catch(error) {
					if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
						this.logger.info(`[Retweets] Ratelimit: ${error.rateLimit} | ${error.rateLimitError}`);
						break;
					} else {
						throw new Errors.MoleculerError("Twitter service error.", error.code, "ERR_TWITTER_SERVICE", error);
					}
				}
			}
			await twitter.findOneAndUpdate({pagination_type: ACTION.RETWEET, pagination_id: postUrl}, {pagination_type: ACTION.RETWEET, pagination_id: postUrl, pagination_data: paginatedRetweets}, {upsert: true})
			this.logger.debug(`[Retweets] Saved with: ${paginatedRetweets.meta.result_count} results`);
		}
		
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const data = paginatedRetweets.data.data.map(({author_id, text, id}) => ({ author_id: author_id??'', text, id}))
		
		return {
			...(data && {data}),
			completed: paginatedRetweets.done 
		};
	},

	// TWITTER POST CONTENT
	async fetchPostsWithContent(this: Moleculer.Service<Moleculer.ServiceSettingSchema>, content: string, dateFrom: Date): Promise<TwitterDTO> {
		let paginatedSearch: TweetSearchRecentV2Paginator = await this.findAndAssignPagination(content, ACTION.CONTENT, TweetSearchRecentV2Paginator);

		if (!paginatedSearch) {
			try {
				paginatedSearch = await this.settings.apiClient.v2.search(content, { start_time: dateFrom.toISOString(), "tweet.fields": ["author_id"] }) as TweetSearchRecentV2Paginator;
			} catch(error) {
				throw new Errors.MoleculerError("Twitter api error.", error.code, "ERR_TWITTER", error);
			}
		}

		if (paginatedSearch.unusable) {
			throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", paginatedSearch.errors);
		} else if (!paginatedSearch.done) {
			while (!paginatedSearch.done) {
				try {
					// eslint-disable-next-line no-await-in-loop
					await paginatedSearch.fetchNext(100);
					this.logger.debug(`[Content] Fetched: ${paginatedSearch.meta.result_count}`);
				} catch(error) {
					if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
						this.logger.info(`[Content] Ratelimit: ${error.rateLimit} | ${error.rateLimitError}`);
						break;
					} else {
						throw new Errors.MoleculerError("Twitter service error.", error.code, "ERR_TWITTER_SERVICE", error);
					}
				}
			}
			await twitter.findOneAndUpdate({pagination_type: ACTION.CONTENT, pagination_id: content}, {pagination_type: ACTION.CONTENT, pagination_id: content, pagination_data: paginatedSearch}, {upsert: true})
			this.logger.debug(`[Content] Saved with: ${paginatedSearch.meta.result_count} results`);
		}

		// eslint-disable-next-line @typescript-eslint/naming-convention
		const posts = paginatedSearch.done ? paginatedSearch.data.data.map(({author_id, text, id}) => ({ author_id: author_id??'', text, id})): null;

		return {
			...(posts && {data: posts}),
			completed: paginatedSearch.done
		};
	},

	// TWITTER ACCOUNT TO FOLLOW
	async followers(this: Moleculer.Service<Moleculer.ServiceSettingSchema>, user: string, postUrl: string): Promise<TwitterDTO> {
		let tweetResponses: TweetSearchRecentV2Paginator = await this.findAndAssignPagination(postUrl, ACTION.FOLLOW, TweetSearchRecentV2Paginator);
		let paginatedFollowers: UserFollowersV2Paginator = await this.findAndAssignPagination(user, ACTION.FOLLOW, UserFollowersV2Paginator);
		
		if (!tweetResponses) {
			try {
				// fetch tweet responses with conversation_id
				tweetResponses = <TweetSearchRecentV2Paginator>await this.settings.apiClient.v2.search(`conversation_id:${await this.getConversationID(postUrl)}`, { "tweet.fields": ["author_id"]});
			} catch(error) {
				throw new Errors.MoleculerError("Twitter api error.", error.code, "ERR_TWITTER", error);
			}
		}

		if (tweetResponses.unusable) {
			throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", tweetResponses.errors);
		} else if(!tweetResponses.done) {
			while(!tweetResponses.done) {
				try {
					// eslint-disable-next-line no-await-in-loop
					await tweetResponses.fetchNext(100);
					this.logger.debug(`[Responses] Fetched: ${tweetResponses.meta.result_count}`);
				} catch(error) {
					if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
						this.logger.info(`[Responses] Ratelimit: ${error.rateLimit} | ${error.rateLimitError}`);
						break;
					} else {
						throw new Errors.MoleculerError("Twitter api error.", error.code, "ERR_TWITTER", error);
					}
				}
			}
			await twitter.findOneAndUpdate({pagination_type: ACTION.FOLLOW, pagination_id: postUrl}, {pagination_type: ACTION.FOLLOW, pagination_id: postUrl, pagination_data: tweetResponses}, {upsert: true})
			this.logger.debug(`[Responses] Saved with: ${tweetResponses.meta.result_count} results`);
		}

		if (!paginatedFollowers) {
			try {
				paginatedFollowers = <UserFollowersV2Paginator>await this.settings.apiClient.v2.followers(await this.getUserID(user), { asPaginator: true });
			} catch(error) {
				throw new Errors.MoleculerError("Twitter api error.", error.code, "ERR_TWITTER", error);
			}
		}

		if (paginatedFollowers.unusable) {
			throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", paginatedFollowers.errors);
		} else if(!paginatedFollowers.done) {
			while(!paginatedFollowers.done) {
				try {
					// eslint-disable-next-line no-await-in-loop
					await paginatedFollowers.fetchNext(1000);
					this.logger.debug(`[Followers] Fetched: ${paginatedFollowers.meta.result_count}`);
				} catch(error) {
					if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
						this.logger.info(`[Followers] Ratelimit: ${error.rateLimit} | ${error.rateLimitError}`);
						break;
					} else {
						throw new Errors.MoleculerError("Twitter api error.", error.code, "ERR_TWITTER", error);
					}
				}
			}
			await twitter.findOneAndUpdate({pagination_type: ACTION.FOLLOW, pagination_id: user}, {pagination_type: ACTION.FOLLOW, pagination_id: user, pagination_data: paginatedFollowers}, {upsert: true})
			this.logger.debug(`[Followers] Saved with: ${paginatedFollowers.meta.result_count} results`);
		}

		// return users who follow the user and have left a comment
		const data = paginatedFollowers.done ? 
			tweetResponses?.data.data.filter((response: TweetV2) => 
				paginatedFollowers?.data.data.some((follower: UserV2) => follower.id === response.author_id))
					// eslint-disable-next-line @typescript-eslint/naming-convention
					.map(({author_id, text, id}) => ({author_id: author_id??'', text, id})): null;

		return {
			...(data && {data}), 
			completed: paginatedFollowers?.done
		};
	}
}

export default methods;