export interface IDates {
	date_from: Date,
	date_to: Date
}

export type TwitterDTO = { data?: {author_id: string, text: string, id: string}[], completed: boolean };

export type Post = { post_url: string } & IDates;
export type PostContent = { content: string } & IDates;
export type Account = { user: string, post_url: string } & IDates;
