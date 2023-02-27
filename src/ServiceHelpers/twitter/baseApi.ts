/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
import { ApiResponseError, TwitterApi } from "twitter-api-v2";

export default class {
    protected api;
    
    constructor() {
        this.api = new TwitterApi(<string>process.env.TWITTER_TOKEN);
    }

    protected async autoRetryOnRateLimitError<R>(callback: () => R | Promise<R>){
        while (true) {
            try {
                return await callback();
            } catch (error) {
                if (error instanceof ApiResponseError && error.rateLimitError && error.rateLimit) {
                    const resetTimeout = error.rateLimit.reset * 1000; // 15 mins
                    const timeToWait = resetTimeout - Date.now();
            
                    console.log('Got rate limit error; waiting', new Date(timeToWait).getMinutes(), 'minutes.'); 
                    await new Promise(resolve => setTimeout(resolve, timeToWait));
                    continue;
                }
        
                throw error;
            }
        }
    }
}