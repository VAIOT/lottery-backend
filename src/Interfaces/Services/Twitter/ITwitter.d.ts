export namespace ITwitter {
	export namespace TwitterInDto {
		export type post = {
			postUrl: string;
		}
		export type user = {
			userName: string;
		}
		export type users = {
			users: string[];
		}
		export type search = {
			content: string;
			dateFrom: Date;
		}
		export type tokens = {
			userVerifier: string;
			userToken: string;
			savedToken: string;
			savedSecret: string;
		}
		export type meta = { tokens: tokens }
	}
	export namespace TwitterOutDto {
		export type comment = {
			text: string;
			author_id: string;
		}
	}
}