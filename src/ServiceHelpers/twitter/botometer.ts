/**
 * source: https://github.com/andreyluiz/botometer/blob/master/src/index.ts
 */
import * as request from "superagent";
import type { TwitterApiv1 } from "twitter-api-v2";
import { TwitterApi } from "twitter-api-v2";

const FIFTEEN_MINUTES = 1000 * 60 * 15;

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export interface BotometerOptions {
  twitterToken: string;
  rapidApiKey: string;
  supressLogs?: boolean;
  waitOnRateLimit?: boolean;
  returnTwitterData?: boolean;
}

interface TwitterData {
  user?: any;
  timeline?: any;
  mentions?: any;
}

const defaultValues: BotometerOptions = {
  twitterToken: process.env.TWITTER_TOKEN as string,
  rapidApiKey: process.env.RAPID_API_KEY as string,
  supressLogs: false,
  waitOnRateLimit: true,
  returnTwitterData: false,
};

export default class Botometer {
  options: BotometerOptions;

  private api: TwitterApiv1;

  constructor() {
    const options = { ...defaultValues };
    if (
      !options.twitterToken ||
      !options.rapidApiKey
    ) {
      throw new Error('Required credentials options are missing.');
    }

    this.options = options;

    this.api = new TwitterApi(process.env.TWITTER_TOKEN as string).v1;
  }

  log(message?: any, ...args: any[]) {
    if (!this.options.supressLogs) console.log(message, ...args);
  }

  errorLog(message?: any, ...args: any[]) {
    if (!this.options.supressLogs) console.error(message, ...args);
  }

  async getTwitterData(userId: string) {
    try {
      const twitterData: TwitterData = {};

      const userTimeline = await this.api.get('statuses/user_timeline.json', {
        user_id: userId,
        count: 100 
      });
      const mentions = await this.api.get('search/tweets.json', {
        q: `from:${userId}`,
        count: 100,
      });

      twitterData.user = userTimeline[0].user;
      twitterData.timeline = userTimeline;
      twitterData.mentions = mentions;

      return twitterData;
    } catch (e) {
      console.log(e);
      throw new Error(e);
    }
  }

  async checkAccount(twitterData: TwitterData) {
    try {
      const res = await request
        .post(`https://botometer-pro.p.rapidapi.com/4/check_account`)
        .send(twitterData)
        .set("x-rapidapi-host", "botometer-pro.p.rapidapi.com")
        .set("x-rapidapi-key", this.options.rapidApiKey)
        .set("content-type", "application/json")
        .set("accept", "application/json");
      return res.body;
    } catch (e) {
      console.log(e);
      return { error: e };
    }
  }

  async getScoreFor(userId: string): Promise<any> {
    this.log(`Getting bot score for "${userId}"`);
    let twitterData = null;
    try {
      twitterData = await this.getTwitterData(userId);
    } catch (e) {
      if (e.code === 88 && this.options.waitOnRateLimit) {
        this.log("Rate limit reached. Waiting 15 minutes...");
        await delay(FIFTEEN_MINUTES);
        this.log("Rate limit timeout ended. Continuing...");
        try {
          twitterData = await this.getTwitterData(userId);
        } catch (e) {
          this.errorLog(e);
          return { error: e };
        }
      } else {
        this.errorLog(e);
        return { error: e };
      }
    }

    try {
      const botometerData = await this.checkAccount(twitterData);
      return {
        ...botometerData,
      }
    } catch (e) {
      this.errorLog(e);
      return { error: e };
    }
  }
}