import { model, Schema } from "mongoose";
import type { TweetLikingUsersV2Paginator, TweetSearchRecentV2Paginator, UserFollowersV2Paginator } from "twitter-api-v2";
import { ACTION } from "./enums";

type TwitterSettings = { 
	pagination_type: ACTION,
	pagination_id: string,
	pagination_data: TweetSearchRecentV2Paginator | UserFollowersV2Paginator | TweetLikingUsersV2Paginator,
};

const twitterSchema = new Schema<TwitterSettings>({
	pagination_type: {
		type: String,
		enum: ACTION,
		required: true
	},
	pagination_id: {
		type: String,
		required: true
	},
	pagination_data: {
		type: Object,
		required: true
	},
}, {
	timestamps: true
});

// remove document after 1h //
twitterSchema.index({"updatedAt": 1 },{ expireAfterSeconds: 3600 });


export default model<TwitterSettings>("Twitter", twitterSchema);
