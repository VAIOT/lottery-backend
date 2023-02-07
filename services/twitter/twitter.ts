import { model, Schema } from "mongoose";
import type { TweetLikingUsersV2Paginator, TweetSearchRecentV2Paginator, UserFollowersV2Paginator } from "twitter-api-v2";
import { ACTION } from "./enums";

type TwitterSettings = { 
	action_type: ACTION,
	action_id: string,
	action_data: TweetSearchRecentV2Paginator | UserFollowersV2Paginator | TweetLikingUsersV2Paginator
};

const twitterSchema = new Schema<TwitterSettings>({
	action_type: {
		type: String,
		enum: ACTION,
		required: true
	},
	action_id: {
		type: String,
		required: true
	},
	action_data: {
		type: Object,
		required: true
	}
}, {
	timestamps: true, strict: false
});

export default model<TwitterSettings>("Twitter", twitterSchema);
