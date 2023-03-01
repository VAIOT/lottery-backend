import type { TweetV2SingleResult, UserV2Result } from 'twitter-api-v2';
import { TwitterApi } from 'twitter-api-v2';

export const TOKENS = {
    appKey: process.env.TWITTER_CONSUMER_KEY as string,
    appSecret: process.env.TWITTER_CONSUMER_SECRET as string,
};

export class Consumer {
    protected api;

    constructor(additionalTokens?: object) {
        this.api = new TwitterApi({ ...TOKENS, ...additionalTokens });
    }

    async generateAuthLink(): Promise<{oauth_token: string; oauth_token_secret: string; oauth_callback_confirmed: "true"; url: string;}> {
        return this.api.generateAuthLink(process.env.TWITTER_CALLBACK_URL);
    }

    async getUserTokens(verifier: string): Promise<{accessToken: string, accessSecret: string}> {
        const { accessToken, accessSecret, screenName, userId } = await this.api.login(verifier);
        return { accessToken, accessSecret };
    }

    async getUserData(userName: string): Promise<UserV2Result> {
		return this.api.v2.userByUsername(userName.substring(1, userName.length), { "user.fields": ["public_metrics"]});
	}

    async getTweetData(tweetId: string): Promise<TweetV2SingleResult> {
        return this.api.v2.singleTweet(tweetId, { "tweet.fields" : ["author_id", "conversation_id"] });
    }
}