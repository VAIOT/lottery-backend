import type { UserV2 } from "twitter-api-v2";

export interface ISocialService<User extends UserV2> {
	filterBots(): User // TODO make it a proxy
}
