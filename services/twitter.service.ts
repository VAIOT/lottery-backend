import events from "events";
import { ITwitter } from "@Interfaces";
import { apiV1, apiV2, botometer, Consumer, getPostId } from '@ServiceHelpers';
import { Context, Service as MoleculerService } from 'moleculer';
import { Action, Method, Service } from "moleculer-decorators";
import type { TweetV2, UserV2 } from "twitter-api-v2";

events.defaultMaxListeners = 100;

@Service({
	name: "twitter",
	version: 1
})
class TwitterService extends MoleculerService {

	@Action({ params: { postUrl: "string" }, visibility: "public" })
	async likedBy(ctx: Context<ITwitter.In.post>): Promise<string[] | null> {
		const { postUrl } = ctx.params;
		try {
			return await this.getTweetLikesMethod(postUrl);
		} catch(e) {
			this.logger.error(e);
			return null;
		}
	}

	@Action({ params: { postUrl: "string" }, visibility: "public" })
	async retweetedBy(ctx: Context<ITwitter.In.post>): Promise<string[] | null> {
		const { postUrl } = ctx.params;
		try {
			return await this.getTweetRetweetsMethod(postUrl);
		} catch(e) {
			this.logger.error(e);
			return null;
		}
	}

	@Action({ params: { userName: "string" }, visibility: "public" })
	async followedBy(ctx: Context<ITwitter.In.user>): Promise<string[] | null> {
		const { userName } = ctx.params;
		try {
			return await this.getUserFollowersMethod(userName);
		} catch(e) {
			this.logger.error(e);
			return null;
		}
	}

	@Action({ params: { content: "string", dateFrom: "date" }, visibility: "public" })
	async tweetedBy(ctx: Context<ITwitter.In.search>): Promise<string[] | null> {
		const { content, dateFrom } = ctx.params;
		try {
			return await this.searchTweetsMethod(content, dateFrom);
		} catch(e) {
			this.logger.error(e);
			return null;
		}
	}

	@Action({ params: { postUrl: "string" }, visibility: "public" })
	async comments(ctx: Context<ITwitter.In.post>): Promise<ITwitter.Out.comment[] | null> {
		const { postUrl } = ctx.params;
		try {
			return await this.getTweetCommentsMethod(postUrl, true, true);
		} catch(e) {
			this.logger.error(e);
			return null;
		}
	}

	@Action({ params: { users: "array" }, visibility: "public" })
	async filterBots(ctx: Context<ITwitter.In.users>): Promise<string[]> {
		const { users } = ctx.params;
		return this.filterBotsMethod(users);
	}

	@Action({ params: { postUrl: "string" }, visibility: "public" })
	async getTweetData(ctx: Context<ITwitter.In.post, { tokens: ITwitter.In.accessTokens }>): Promise<TweetV2 | null> {
		const { postUrl } = ctx.params;
		const { tokens } = ctx.meta;
		try {
			return await this.getTweetDataMethod(getPostId(postUrl), tokens);
		} catch(e) {
			this.logger.error(e);
			return null;
		}
	}

	@Action({ params: { userName: "string" }, visibility: "public" })
	async getUserData(ctx: Context<ITwitter.In.user, { tokens: ITwitter.In.accessTokens }>): Promise<UserV2 | null> {
		const { userName } = ctx.params;
		const { tokens } = ctx.meta;
		try {
			return await this.getUserDataMethod(userName, tokens);
		} catch(e) {
			this.logger.error(e);
			return null;
		}
	}

	@Action({ visibility: "published", rest: { method: "GET", path: "/generateAuthLink" } })
	async generateAuthLink(ctx: Context<undefined, {session: {[x: string]: string}}>): Promise<{ authLink: string }> {
		const link = await new Consumer().generateAuthLink();

		ctx.meta.session.oauthToken = link.oauth_token;
		ctx.meta.session.oauthSecret = link.oauth_token_secret;

		return { authLink: link.url };
	}

	@Action({ params: { tokens: "object" }, visibility: "public" })
	async getUserTokens(ctx: Context<{ tokens: ITwitter.In.savedTokens & ITwitter.In.userTokens }>): Promise<any> {
		const { savedSecret, userToken, userVerifier } = ctx.params.tokens;
		return new Consumer({accessToken: userToken, accessSecret: savedSecret}).getUserTokens(userVerifier);
	}


	@Method
	async filterBotsMethod(usersIds: string[]): Promise<string[]> {
		const realUsers: string[] = [];

		for await (const userId of usersIds) {
			this.logger.debug(`Getting bot score for: ${userId}`);
			const userScore = await botometer.getScoreFor(userId);

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
        const tweetData = await this.getTweetDataMethod(getPostId(tweetUrl));
        
        const commentsData = await apiV2.getTweetComments(tweetData.conversation_id as string);

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
        const likes = await apiV2.getTweetLikes(getPostId(tweetUrl));

        return likes.data.data.flatMap(({id}) => id);
    }

	@Method
    async getTweetRetweetsMethod(tweetUrl: string): Promise<string[]> { // v2
        const retweets = await apiV2.getRetweets(getPostId(tweetUrl));

        return retweets.data.data.flatMap(({id}) => id);
    }

	@Method
    async getUserFollowersMethod(userName: string): Promise<string[]> { // v1
        const followers = await apiV1.getFollowers((await this.getUserDataMethod(userName)).id);

        return followers.ids;
    }

	@Method
    async searchTweetsMethod(content: string, dateFrom: Date): Promise<string[]> { // v2
        const search = await apiV2.searchTweets(content, dateFrom);

        return search.data.data.flatMap(({author_id}) => author_id ?? '');
    }

	@Method
	async getTweetDataMethod(tweetId: string, tokens?: ITwitter.In.accessTokens): Promise<TweetV2> {
		return tokens
		? (await new Consumer(tokens).getTweetData(tweetId)).data
		: (await apiV2.getTweetData(tweetId)).data
	}
	
	@Method
	async getUserDataMethod(userName: string, tokens?: ITwitter.In.accessTokens): Promise<UserV2> {
		return tokens
		? (await new Consumer(tokens).getUserData(userName)).data
		: (await apiV2.getUserData(userName)).data
	}

	started(): void {}

	created(): void {}
	
	stopped(): void {}
}

export default TwitterService;
