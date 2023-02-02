import type { TYPE } from "../enums/twitter";

export interface IType {
	[TYPE.LIKE]: Post;
	[TYPE.RETWEET]: Post;
	[TYPE.POST]: PostContent;
	[TYPE.FOLLOW]: Account;
}

export interface IDates {
	date_from: Date,
	date_to: Date
}

export type Post = { postUrl: string } & IDates
export type PostContent = { content: string } & IDates
export type Account = { account: string } & IDates
