import { Errors } from "moleculer";
import { ApiResponseError, TwitterApi } from "twitter-api-v2";
import type { TwitterDTO } from "../interfaces/twitter";

const client = new TwitterApi(<string>process.env.TWITTER_TOKEN);
const readOnlyClient = client.readOnly;

// TODO Refactor
class Twitter {
	async likes(postUrl: string): Promise<TwitterDTO> {
		const postId = this.getPostId(postUrl);
		// fetch tweet conversation_id
		const tweetConversationId = (await readOnlyClient.v2.singleTweet(postId, { "tweet.fields" : ["conversation_id"] }))?.data?.conversation_id;
	
		if (!tweetConversationId) { 
			throw new Errors.MoleculerError("Conversation ID not found.", 422, "ERR_TWITTER_CONVERSATION", tweetConversationId);
		}
		// fetch tweet responses with conversation_id
		const tweetResponses = await client.v2.search(`conversation_id:${tweetConversationId}`, { "tweet.fields": ["author_id"]});
		if (!tweetResponses.unusable) {
			while(!tweetResponses.done) {
				try {
					// eslint-disable-next-line no-await-in-loop
					await tweetResponses.fetchNext();
				} catch(error) {
					if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
						console.log(`error: ${tweetResponses.errors}`);
						// TODO save to the db
						break;
					}
				}
			}
		} else {
			throw new Errors.MoleculerError("Tweet responses not usable.", 422, "ERR_TWITTER_RES", tweetResponses);
		}

		const paginatedLikes = await readOnlyClient.v2.tweetLikedBy(postId, { asPaginator: true });
		if (!paginatedLikes.unusable) {
			while(!paginatedLikes.done) {
				try {
					// eslint-disable-next-line no-await-in-loop
					await paginatedLikes.fetchNext();
				} catch(error) {
					if (error instanceof ApiResponseError) {
						console.log(`error: ${paginatedLikes.errors}`);
						// TODO save to the db
						break;
					}
				}
			}
		} else {
			throw new Errors.MoleculerError("Likes not usable.", 422, "ERR_TWITTER_LIKES", paginatedLikes);
		}

		const likes = paginatedLikes.done ? 
			tweetResponses.data.data.filter(response => 
				paginatedLikes.data.data.some(like => like.id === response.author_id))
					.map(({author_id, text, id}) => ({author_id: author_id!, text, id})): null;

		return {
			...(likes && {data: likes}), 
			completed: paginatedLikes.done 
		};
	}

	async retweets(url: string): Promise<TwitterDTO> {
		const paginatedRetweets = await client.v2.search(`url:${this.getPostId(url)}`, { "tweet.fields": ["author_id"]});
		if (!paginatedRetweets.unusable) {
			while(!paginatedRetweets.done) {
				try {
					// eslint-disable-next-line no-await-in-loop
					await paginatedRetweets.fetchNext();
				} catch(error) {
					if (error instanceof ApiResponseError) {
						console.log(`error: ${paginatedRetweets.errors}`);
						// TODO save to the db
						break;
					}
				}
			}
		} else {
			throw new Errors.MoleculerError("Retweets not usable.", 422, "ERR_RETWEET", paginatedRetweets);
		}
		
		const retweets = paginatedRetweets.data.data.map(({author_id, text, id}) => ({ author_id: author_id!, text, id}))
		return {
			...(retweets && {data: retweets}),
			completed: paginatedRetweets.done 
		};
	}

	async postsWithContent(content: string, dateFrom: Date, dateTo: Date): Promise<TwitterDTO> {
		const paginatedSearch = await readOnlyClient.v2.search(content, { end_time: dateTo.toISOString(), "tweet.fields": ["author_id"] });
		if (!paginatedSearch.unusable) {
			while (!paginatedSearch.done) {
				try {
					// eslint-disable-next-line no-await-in-loop
					await paginatedSearch.fetchNext();
				} catch(error) {
					if (error instanceof ApiResponseError) {
						console.log(`error: ${paginatedSearch.errors}`);
						// TODO save to the db
						break;
					}
				}
			}
		} else {
			throw new Errors.MoleculerError("Post search not usable.", 422, "ERR_TWITTER_POST_SEARCH", paginatedSearch);
		}

		const posts = paginatedSearch.data.data.map(({author_id, text, id}) => ({ author_id: author_id!, text, id}))
		return {
			...(posts && {data: posts}),
			completed: paginatedSearch.done
		};
	}

	async followers(user: string, postUrl: string): Promise<TwitterDTO> {
		// fetch tweet conversation_id
		const tweetConversationId = (await readOnlyClient.v2.singleTweet(this.getPostId(postUrl), { "tweet.fields" : ["conversation_id"] }))?.data?.conversation_id;
	
		if (!tweetConversationId) { 
			throw new Errors.MoleculerError("Conversation ID not found.", 422, "ERR_TWITTER_CONVERSATION", tweetConversationId);
		}
		// fetch tweet responses with conversation_id
		const tweetResponses = await client.v2.search(`conversation_id:${tweetConversationId}`, { "tweet.fields": ["author_id"]});
		if (!tweetResponses.unusable) {
			while(!tweetResponses.done) {
				try {
					// eslint-disable-next-line no-await-in-loop
					await tweetResponses.fetchNext();
				} catch(error) {
					if (error instanceof ApiResponseError) {
						console.log(`error: ${tweetResponses.errors}`);
						// TODO save to the db
						break;
					}
				}
			}
		} else {
			throw new Errors.MoleculerError("Twitter responses not usable.", 422, "ERR_TWITTER_RES", tweetResponses);
		}

		const paginatedFollowers = await readOnlyClient.v2.followers(await this.getUserID(user), { asPaginator: true });
		if (!paginatedFollowers.unusable) {
			while(!paginatedFollowers.done) {
				try {
					// eslint-disable-next-line no-await-in-loop
					await paginatedFollowers.fetchNext();
				} catch(error) {
					if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
						console.log(`error: ${paginatedFollowers.errors}`);
						// TODO save to the db
						break;
					}
				}
			}
		} else {
			throw new Errors.MoleculerError("Followers not usable.", 422, "ERR_TWITTER_FOLLOWERS", paginatedFollowers);
		}

		const followers = paginatedFollowers.done ? 
			tweetResponses.data.data.filter(response => 
				paginatedFollowers.data.data.some(follower => follower.id === response.author_id))
					.map(({author_id, text, id}) => ({author_id: author_id!, text, id})): null;

		return {
			...(followers && {data: followers}), 
			completed: paginatedFollowers.done 
		};
	}

	private async getUserID(user: string): Promise<string> {
		return (await readOnlyClient.v2.userByUsername(user.substring(1, user.length))).data.id;
	}

	private getPostId(url: string): string {
		const postID = url.split("/").find((el, index, obj) => obj[index-1] === "status")?.split('?')[0];
		if (!postID) {
			throw new Errors.MoleculerError("Post ID not found.", 422, "ERR_TWITTER_POST_ID", url);
		}
		return postID;
	}
}

export const twitter = new Twitter();
