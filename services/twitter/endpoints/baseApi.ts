/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
import { ApiResponseError, TwitterApi } from "twitter-api-v2";

type ApiVersion = "v1" | "v2";

export default class<T extends ApiVersion> {
    protected api: TwitterApi[T];
    
    constructor(version: T) {
        this.api = new TwitterApi(<string>process.env.TWITTER_TOKEN)[version];
    }

    protected async autoRetryOnRateLimitError<R>(callback: () => R | Promise<R>){
        while (true) {
            try {
                return await callback();
            } catch (error) {
                if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
                    const resetTimeout = error.rateLimit.reset * 1000; // 15 mins
                    const timeToWait = resetTimeout - Date.now();
            
                    await new Promise(resolve => setTimeout(resolve, timeToWait));
                    continue;
                }
        
                throw error;
            }
        }
    }
}