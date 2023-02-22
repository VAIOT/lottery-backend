/* eslint-disable @typescript-eslint/no-loop-func */
/* eslint-disable no-continue */
/* eslint-disable no-promise-executor-return */
/* eslint-disable no-await-in-loop */
import type { UserFollowerIdsV1Paginator } from "twitter-api-v2";
import BaseApi from "./baseApi";

export default class extends BaseApi<'v1'> {
    constructor() {
        super('v1');
    }

    /**
     * Retrieve followers for given user
     * @param userId ID of the user
    */
    async getFollowers(userId: string): Promise<UserFollowerIdsV1Paginator> {
        // fetchNext is buggy in v1 // pagination repeating first 10k results :)
        let followers = await this.autoRetryOnRateLimitError(() => this.api.userFollowerIds({ user_id: userId }));

        const followersIds: string[] = [];
        followersIds.push(...followers.data.ids);

        while(!followers.done) {
            followers = await this.autoRetryOnRateLimitError(() => followers.next());
            followersIds.push(...followers.data.ids);
        }
        followers.data.ids = followersIds;

        return followers;
    }
}