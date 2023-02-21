import type { TweetLikingUsersV2Paginator, TweetSearchRecentV2Paginator, UserFollowersV2Paginator } from "twitter-api-v2";

export type TwitterDTO = { data?: {author_id: string, text: string, id: string}[], completed: boolean };

export type Paginator = TweetSearchRecentV2Paginator | UserFollowersV2Paginator | TweetLikingUsersV2Paginator | TweetRetweetersUsersV2Paginator;