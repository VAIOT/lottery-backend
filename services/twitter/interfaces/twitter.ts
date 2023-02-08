export type TwitterDTO = { data?: {author_id: string, text: string, id: string}[], completed: boolean };

export type Post = { post_url: string };
export type PostContent = { content: string, date_from: Date };
export type Account = { user: string, post_url: string };
