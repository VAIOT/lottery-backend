/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-continue */
import events from "events";
import type { ITwitter } from "@Interfaces";
import { twitter } from '@ServiceHelpers';
import { Context, Service as MoleculerService } from 'moleculer';
import { Action, Method, Service } from "moleculer-decorators";
import type { TweetV2, UserV2 } from "twitter-api-v2";

events.defaultMaxListeners = 100;

@Service({
	name: "twitter",
	version: 1
})
class TwitterService extends MoleculerService {

	@Action({ params: { postUrl: "string" }, visibility: "protected" })
	async likedBy(ctx: Context<ITwitter.TwitterInDto.post>): Promise<string[] | null> {
		const { postUrl } = ctx.params;
		try {
			return await this.getTweetLikesMethod(postUrl);
		} catch(e) {
			this.logger.error(e);
			return null;
		}
	}

	@Action({ params: { postUrl: "string" }, visibility: "protected" })
	async retweetedBy(ctx: Context<ITwitter.TwitterInDto.post>): Promise<string[] | null> {
		const { postUrl } = ctx.params;
		try {
			return await this.getTweetRetweetsMethod(postUrl);
		} catch(e) {
			this.logger.error(e);
			return null;
		}
	}

	@Action({ params: { userName: "string" }, visibility: "protected" })
	async followedBy(ctx: Context<ITwitter.TwitterInDto.user>): Promise<string[] | null> {
		const { userName } = ctx.params;
		try {
			return await this.getUserFollowersMethod(userName);
		} catch(e) {
			this.logger.error(e);
			return null;
		}
	}

	@Action({ params: { content: "string", dateFrom: "date" }, visibility: "protected" })
	async tweetedBy(ctx: Context<ITwitter.TwitterInDto.search>): Promise<string[] | null> {
		const { content, dateFrom } = ctx.params;
		try {
			return await this.searchTweetsMethod(content, dateFrom);
		} catch(e) {
			this.logger.error(e);
			return null;
		}
	}

	@Action({ params: { postUrl: "string" }, visibility: "protected" })
	async comments(ctx: Context<ITwitter.TwitterInDto.post>): Promise<ITwitter.TwitterOutDto.comment[] | null> {
		const { postUrl } = ctx.params;
		try {
			return await this.getTweetCommentsMethod(postUrl, true, true);
		} catch(e) {
			this.logger.error(e);
			return null;
		}
	}

	@Action({ params: { users: "array" }, visibility: "protected" })
	async filterBots(ctx: Context<ITwitter.TwitterInDto.users>): Promise<string[]> {
		const { users } = ctx.params;
		return this.filterBotsMethod(users);
	}

	@Action({ params: { postUrl: "string" }, visibility: "protected" })
	async checkIfTweetExists(ctx: Context<ITwitter.TwitterInDto.post>): Promise<boolean | null> {
		const { postUrl } = ctx.params;
		try {
			return await this.checkIfTweetExistsMethod(postUrl);
		} catch(e) {
			this.logger.error(e);
			return null;
		}
	}

	@Action({ params: { userName: "string" }, visibility: "protected" })
	async checkIfUserExists(ctx: Context<ITwitter.TwitterInDto.user>): Promise<boolean | null> {
		const { userName } = ctx.params;
		try {
			return await this.checkIfUserExistsMethod(userName);
		} catch(e) {
			this.logger.error(e);
			return null;
		}
	}


	@Method
	async filterBotsMethod(usersIds: string[]): Promise<string[]> {
		const realUsers: string[] = [];

		for await (const userId of usersIds) {
			this.logger.debug(`Getting bot score for: ${userId}`);
			const userScore = await twitter.botometer.getScoreFor(userId);

			if (userScore.cap?.universal > 0.94) {
				this.logger.debug(`User removed from lottery: ${userId}`);
				continue;
			}
			realUsers.push(userId);
		}
		return realUsers;
	}

	@Method
	async getTweetCommentsMethod(tweetUrl: string, removeDuplicatedAuthors: boolean, removeTweetAuthor: boolean): Promise<{ text: string; author_id: string; }[]> { // v2
        const tweetData = await this.getTweetDataMethod(twitter.getPostId(tweetUrl));
        
        const commentsData = await twitter.apiV2.getTweetComments(tweetData.conversation_id as string);

        let comments = commentsData.data.data.map(({text, author_id}) => ({text, author_id: author_id ?? '' }));

        if (comments.length) {
            if (removeTweetAuthor) {
                comments = comments.filter(({author_id}) => author_id !== tweetData.author_id);
            }

            if (removeDuplicatedAuthors) {
                comments = comments.filter((comment, index, self) => 
                    self.findIndex(({author_id}) => comment.author_id === author_id) === index);
            }
        }
        return comments;
    }

	@Method
	async getTweetLikesMethod(tweetUrl: string): Promise<string[]> { // v2
        const likes = await twitter.apiV2.getTweetLikes(twitter.getPostId(tweetUrl));

        return likes.data.data.flatMap(({id}) => id);
    }

	@Method
    async getTweetRetweetsMethod(tweetUrl: string): Promise<string[]> { // v2
        const retweets = await twitter.apiV2.getRetweets(twitter.getPostId(tweetUrl));

        return retweets.data.data.flatMap(({id}) => id);
    }

	@Method
    async getUserFollowersMethod(userName: string): Promise<string[]> { // v1
        const followers = await twitter.apiV1.getFollowers((await this.getUserDataMethod(userName)).id);

        return followers.ids;
    }

	@Method
    async searchTweetsMethod(content: string, dateFrom: Date): Promise<string[]> { // v2
        const search = await twitter.apiV2.searchTweets(content, dateFrom);

        return search.data.data.flatMap(({author_id}) => author_id ?? '');
    }

	@Method
    async checkIfTweetExistsMethod(tweetUrl: string): Promise<boolean> {
        return !!await this.getTweetDataMethod(twitter.getPostId(tweetUrl));
    }

	@Method
    async checkIfUserExistsMethod(userName: string): Promise<boolean> {
        return !!await this.getUserDataMethod(userName);
    }

	@Method
    async getUserFollowersCountMethod(userName: string): Promise<number> {
        return (await this.getUserDataMethod(userName)).public_metrics?.followers_count ?? 0;
    }

	@Method
	async getTweetDataMethod(tweetId: string): Promise<TweetV2> {
		return (await twitter.apiV2.getTweetData(tweetId)).data;
	}
	
	@Method
	async getUserDataMethod(userName: string): Promise<UserV2> {
		return (await twitter.apiV2.getUserData(userName)).data;
	}

	started(): void {}

	created(): void {}
	
	stopped(): void {}
}

export default TwitterService;
