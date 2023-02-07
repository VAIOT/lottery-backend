import events from "events";
import type Moleculer from "moleculer";
import { Errors } from "moleculer";
import type { TweetLikingUsersV2Paginator, TweetSearchRecentV2Paginator, TweetV2, UserFollowersV2Paginator, UserV2 } from "twitter-api-v2";
import { ApiResponseError, TwitterApi, TwitterApiV2Settings } from "twitter-api-v2";
import type { TwitterDTO } from "./interfaces/twitter";

const client = new TwitterApi(<string>process.env.TWITTER_TOKEN);
const readOnlyClient = client.readOnly;

TwitterApiV2Settings.debug = false;
events.defaultMaxListeners = 100;

function getPostId(url: string): string {
	const postID = url.split("/").find((el, index, obj) => obj[index-1] === "status")?.split('?')[0];
	if (!postID) {
		throw new Errors.MoleculerError("Post ID not found.", 422, "ERR_TWITTER_POST_ID", url);
	}
	return postID;
}

async function getConversationID(postUrl: string): Promise<string> {
	try {
		const tweet = await readOnlyClient.v2.singleTweet(getPostId(postUrl), { "tweet.fields" : ["conversation_id"] });
		if (tweet.data?.conversation_id) {
			return tweet.data.conversation_id;
		} 
		throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", {error: { message: "Conversation_id is missing"}, response: tweet});
	} catch(error) {
		throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", error);
	}
}

async function getUserID(user: string): Promise<string> {
	return (await readOnlyClient.v2.userByUsername(user.substring(1, user.length))).data.id;
}


export async function likes(postUrl: string, logger: Moleculer.LoggerInstance): Promise<TwitterDTO> {
	let paginatedResponses: TweetSearchRecentV2Paginator;
	let paginatedLikes: TweetLikingUsersV2Paginator;

	try {
		// fetch tweet responses with conversation_id
		paginatedResponses = await client.v2.search(`conversation_id:${await getConversationID(postUrl)}`, { "tweet.fields": ["author_id"]});
	} catch(error) {
		throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", error);
	}

	if (paginatedResponses.unusable) {
		throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", paginatedResponses.errors);
	} else {
		while(!paginatedResponses.done) {
			try {
				// eslint-disable-next-line no-await-in-loop
				await paginatedResponses.fetchNext();
				logger.debug(`[Responses] Fetched: ${paginatedResponses.meta.result_count}`);
			} catch(error) {
				if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
					logger.info(`[Responses] Ratelimit: ${error.rateLimit}`);
					// TODO save to the db
					break;
				} else {
					throw new Errors.MoleculerError("Twitter service error.", 422, "ERR_TWITTER_SERVICE", error);
				}
			}
		}
	}

	try {
		// fetch likes
		paginatedLikes = await readOnlyClient.v2.tweetLikedBy(getPostId(postUrl), { asPaginator: true });
	} catch(error) {
		throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", error);
	}

	if (paginatedLikes.unusable) {
		throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", paginatedLikes.errors);
	} else {
		while(!paginatedLikes.done) {
			try {
				// eslint-disable-next-line no-await-in-loop
				await paginatedLikes.fetchNext();
				logger.debug(`[Likes] Fetched: ${paginatedLikes.meta.result_count}`);
			} catch(error) {
				if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
					logger.info(`[Likes] Ratelimit: ${error.rateLimit}`);
					// TODO save to the db
					break;
				} else {
					throw new Errors.MoleculerError("Twitter service error.", 422, "ERR_TWITTER_SERVICE", error);
				}
			}
		}
	}

	const data = paginatedLikes.done && paginatedResponses ? 
		paginatedResponses.data.data.filter(response => 
			paginatedLikes.data.data.some(like => like.id === response.author_id))
				// eslint-disable-next-line @typescript-eslint/naming-convention
				.map(({author_id, text, id}) => ({author_id: author_id??'', text, id})): null;

	return {
		...(data && {data}), 
		completed: paginatedLikes.done 
	};
}

export async function retweets(url: string, logger: Moleculer.LoggerInstance): Promise<TwitterDTO> {
	let paginatedRetweets: TweetSearchRecentV2Paginator;
	
	try {
		paginatedRetweets = await client.v2.search(`url:${getPostId(url)}`, { "tweet.fields": ["author_id"]});
	} catch(error) {
		throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", error);
	}
	
	
	if (paginatedRetweets.unusable) {
		throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", paginatedRetweets.errors);
	} else {
		while(!paginatedRetweets.done) {
			try {
				// eslint-disable-next-line no-await-in-loop
				await paginatedRetweets.fetchNext();
				logger.debug(`[Retweets] Fetched: ${paginatedRetweets.meta.result_count}`);
			} catch(error) {
				if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
					logger.info(`[Retweets] Ratelimit: ${error.rateLimit}`);
					// TODO save to the db
					break;
				} else {
					throw new Errors.MoleculerError("Twitter service error.", 422, "ERR_TWITTER_SERVICE", error);
				}
			}
		}
	}
	
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const data = paginatedRetweets.data.data.map(({author_id, text, id}) => ({ author_id: author_id??'', text, id}))
	return {
		...(data && {data}),
		completed: paginatedRetweets.done 
	};
}

export async function postsWithContent(content: string, dateFrom: Date, logger: Moleculer.LoggerInstance): Promise<TwitterDTO> {
	let paginatedSearch: TweetSearchRecentV2Paginator;
	
	try {
		paginatedSearch = await readOnlyClient.v2.search(content, { start_time: dateFrom.toISOString(), "tweet.fields": ["author_id"] });
	} catch(error) {
		throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", error);
	}

	if (paginatedSearch.unusable) {
		throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", paginatedSearch.errors);
	} else {
		while (!paginatedSearch.done) {
			try {
				// eslint-disable-next-line no-await-in-loop
				await paginatedSearch.fetchNext(100);
				logger.debug(`[Content] Fetched: ${paginatedSearch.meta.result_count}`);
			} catch(error) {
				if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
					logger.info(`[Content] Ratelimit: ${error.rateLimit}`);
					// TODO save to the db
					break;
				} else {
					throw new Errors.MoleculerError("Twitter service error.", 422, "ERR_TWITTER_SERVICE", error);
				}
			}
		}
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	const posts = paginatedSearch.done ? paginatedSearch.data.data.map(({author_id, text, id}) => ({ author_id: author_id??'', text, id})): null;

	return {
		...(posts && {data: posts}),
		completed: paginatedSearch.done
	};
}

export async function followers(user: string, postUrl: string, logger: Moleculer.LoggerInstance): Promise<TwitterDTO> {
	let tweetResponses: TweetSearchRecentV2Paginator; // TODO search in db for occurrences (postUrl)
	let paginatedFollowers: UserFollowersV2Paginator; // TODO search in db for occurrences (user)
	
	try {
		// fetch tweet responses with conversation_id
		tweetResponses = await client.v2.search(`conversation_id:${await getConversationID(postUrl)}`, { "tweet.fields": ["author_id"]});
	} catch(error) {
		throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", error);
	}

	if (tweetResponses.unusable) {
		throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", tweetResponses.errors);
	} else {
		while(!tweetResponses.done) {
			try {
				// eslint-disable-next-line no-await-in-loop
				await tweetResponses.fetchNext(100);
				logger.debug(`[Responses] Fetched: ${tweetResponses.meta.result_count}`);
			} catch(error) {
				if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
					logger.info(`[Responses] Ratelimit: ${error.rateLimit}`);
					// TODO save to the db
					break;
				} else {
					throw new Errors.MoleculerError("Twitter service error.", 422, "ERR_TWITTER_SERVICE", error);
				}
			}
		}
	}

	try {
		paginatedFollowers = await readOnlyClient.v2.followers(await getUserID(user), { asPaginator: true });
	} catch(error) {
		throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", error);
	}

	if (paginatedFollowers.unusable) {
		throw new Errors.MoleculerError("Twitter api error.", 422, "ERR_TWITTER", paginatedFollowers.errors);
	} else {
		while(!paginatedFollowers.done) {
			try {
				// eslint-disable-next-line no-await-in-loop
				await paginatedFollowers.fetchNext(1000);
				logger.debug(`[Followers] Fetched: ${paginatedFollowers.meta.result_count}`);
			} catch(error) {
				if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
					logger.info(`[Followers] Ratelimit: ${error.rateLimit}`);
					// TODO save to the db
					break;
				} else {
					throw new Errors.MoleculerError("Twitter service error.", 422, "ERR_TWITTER_SERVICE", error);
				}
			}
		}
	}

	const data = paginatedFollowers.done ? 
		tweetResponses?.data?.data?.filter((response: TweetV2) => 
			paginatedFollowers.data.data.some((follower: UserV2) => follower.id === response.author_id))
				// eslint-disable-next-line @typescript-eslint/naming-convention
				.map(({author_id, text, id}) => ({author_id: author_id??'', text, id})): null;

	return {
		...(data && {data}), 
		completed: paginatedFollowers?.done
	};
}