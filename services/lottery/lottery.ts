import { model, Schema } from "mongoose";
import { ERC20_TYPE, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from "./enums";
import type { IERC20, IERC721, IMATIC } from "./interfaces/lottery";
import type { ITwitter } from "./interfaces/twitter";


export type LotteryDTO = (IERC20 | IERC721 | IMATIC) & ITwitter;
export type LotteryEntity = LotteryDTO & { lottery_end: Date };

type LotterySettings = IERC20 & IERC721 & IMATIC & ITwitter & { lottery_end: Date };

const lotterySchema = new Schema<LotterySettings>({
	id: {
		type: Number
	},
	duration: {
		type: Number,
		required: true
	},
	lottery_end: {
		type: Date,
		set(this: LotterySettings) {
			const milliseconds = new Date().getTime() + (this.duration * 60 * 60 * 1000);
			return new Date(milliseconds);
		}
	},
	distribution_method: {
		type: String,
		enum: TOKEN_DISTRIBUTION_METHOD,
		required: true
	},
	number_of_tokens: {
		type: Number,
		required: true
	},
	wallet: {
		type: String,
		required: true
	},
	num_of_winners: {
		type: Number,
		required: true
	},
	asset_choice: {
		type: String,
		enum: TOKEN_TYPE,
		required: true
	},
	erc20_choice: {
		type: String,
		enum: ERC20_TYPE,
		required: [
			function(this: IERC20) { return this.asset_choice === TOKEN_TYPE.ERC20 },
			'erc20_choice is required if asset_choice is ERC20'
		],
	},
	nfts_choice: {
		type: Object,
		required: [
			function(this: IERC721) { return this.asset_choice === TOKEN_TYPE.ERC721 },
			'nfts_choice is required if asset_choice is ERC721'
		],
		token_id: {
			type: Number,
			required: true
		},
		contract_address: {
			type: String,
			required: true
		}
	},
	twitter_like: {
		type: String,
		required: false
	},
	twitter_content: {
		type: String,
		required: false
	},
	twitter_retweet: {
		type: String,
		required: false
	},
	twitter_follow: {
		type: String,
		required: false
	}
}, {
	timestamps: true
});

lotterySchema.pre('save', function(next) {
	//this.id = set lottery id
	next();
});

export const lottery = model<LotterySettings>("Lottery", lotterySchema);
