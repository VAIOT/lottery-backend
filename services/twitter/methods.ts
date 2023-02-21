/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/naming-convention */
import V1 from "./endpoints/v1";
import V2 from "./endpoints/v2";

export default class Twitter {
    private ApiV1;

    private ApiV2;

    constructor() {
        this.ApiV1 = new V1();
        this.ApiV2 = new V2();
    }

    async getTweetComments(tweetUrl: string, removeDuplicatedAuthors: boolean, removeTweetAuthor: boolean): Promise<{ text: string; author_id: string; }[]> { // v2
        const tweetData = await this.getTweetData(this.getPostId(tweetUrl));
        
        const commentsData = await this.ApiV2.getTweetComments(tweetData.conversation_id!);

        let comments = commentsData.data.data
        ? commentsData.data.data.map(({text, author_id}) => ({text, author_id: author_id ?? '' }))
        : []

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

    async getTweetLikes(tweetUrl: string): Promise<string[]> { // v2
        const likes = await this.ApiV2.getTweetLikes(this.getPostId(tweetUrl));

        return likes.data.data
        ? likes.data.data.flatMap(({id}) => id)
        : []
    }

    async getTweetRetweets(tweetUrl: string): Promise<string[]> { // v2
        const retweets = await this.ApiV2.getRetweets(this.getPostId(tweetUrl));

        return retweets.data.data
        ? retweets.data.data.flatMap(({id}) => id)
        : []
    }

    async getUserFollowers(userName: string): Promise<string[]> { // v1
        const followers = await this.ApiV1.getFollowers(await this.getUserId(userName));

        return followers?.ids
    }

    async searchTweets(content: string, dateFrom: Date): Promise<string[]> { // v2
        const search = await this.ApiV2.searchTweets(content, dateFrom);

        return search.data.data
        ? search.data.data.flatMap(({author_id}) => author_id ?? '')
        : []
    }

    async addTweet(content: string): Promise<string> { // v2
        return this.ApiV2.addTweet(content);
    }

    private async getTweetData(tweetId: string) {
        return (await this.ApiV2.getTweetData(tweetId)).data;
    }

    private async getUserId(userName: string): Promise<string> {
        return (await this.ApiV2.getUserData(userName)).data.id;
    }

    private getPostId(url: string) {
		const postId = url.split("/").find((el, index, obj) => obj[index-1] === "status")?.split('?')[0];
        if (!postId) {
			return ''
		}
		return postId;
	}
}