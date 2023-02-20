import type { TweetLikingUsersV2Paginator, TweetRetweetersUsersV2Paginator, TweetSearchRecentV2Paginator, UserFollowersV2Paginator } from "twitter-api-v2";

export type TwitterDTO = { data?: {author_id: string, text: string, id: string}[], completed: boolean };

export type Post = { post_url: string, wallet_post: string };
export type PostContent = { content: string, date_from: Date, wallet_post: string };
export type Account = { user: string, post_url: string, wallet_post: string };

export type Paginator = TweetSearchRecentV2Paginator | UserFollowersV2Paginator | TweetLikingUsersV2Paginator | TweetRetweetersUsersV2Paginator;