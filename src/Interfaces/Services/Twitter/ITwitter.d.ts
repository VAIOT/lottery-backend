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
		export type userTokens = {
			userVerifier: string;
			userToken: string;
		}
		export type savedTokens = {
			savedToken: string;
			savedSecret: string;
		}
		export type accessTokens = {
			accessToken: string;
			accessSecret: string;
		}
	}
	export namespace TwitterOutDto {
		export type comment = {
			text: string;
			author_id: string;
		}
	}
}