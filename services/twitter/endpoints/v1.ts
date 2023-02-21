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
        const followers = await this.api.userFollowerIds({ user_id: userId });
        
        return this.autoRetryOnRateLimitError(() => followers.fetchNext(5000));
    }
}