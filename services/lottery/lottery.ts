import { model, Schema } from "mongoose";
import { ERC20_TYPE, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from "./enums";
import type { IERC20, IERC721, IMATIC } from "./interfaces/lottery";
import type { ITwitter } from "./interfaces/twitter";

export type LotteryDTO = ((IERC20 | IERC721 | IMATIC) | { tx_hash: string[] }) & { twitter: ITwitter };
export type LotteryEntity = (IERC20 | IERC721 | IMATIC) & { _id: string, lottery_end: Date; createdAt: Date, twitter: ITwitter };

type LotterySettings = IERC20 &
	IERC721 &
	IMATIC & { twitter: ITwitter; lottery_end: Date; active: boolean, createdAt: Date, updatedAt: Date };
	

const lotterySchema = new Schema<LotterySettings>(
	{
		lottery_id: {
			type: Number,
		},
		duration: {
			type: Number,
			required: true,
		},
		lottery_end: {
			type: Date,
			default: undefined,
		},
		distribution_method: {
			type: String,
			enum: TOKEN_DISTRIBUTION_METHOD,
			required: false,
			default: undefined,
		},
		distribution_options: {
			type: [String],
			required: false,
			default: undefined,
		},
		number_of_tokens: {
			type: String,
			required: false,
			default: undefined,
		},
		fees_amount: {
			type: String,
		},
		wallet: {
			type: String,
			required: true,
		},
		final_rewards: {
			type: [String],
			required: false,
			default: undefined
		},
		num_of_winners: {
			type: Number,
			required: true,
		},
		asset_choice: {
			type: String,
			enum: TOKEN_TYPE,
			required: true,
		},
		erc20_choice: {
			type: String,
			enum: ERC20_TYPE,
			default: undefined,
			required: [
				function (this: IERC20) {
					return this.asset_choice === TOKEN_TYPE.ERC20;
				},
				"erc20_choice is required if asset_choice is ERC20",
			],
		},
		nfts_choice: {
			type: [{ name: String, token_id: Number, contract_address: String }],
			default: undefined,
			required: [
				function (this: IERC721) {
					return this.asset_choice === TOKEN_TYPE.ERC721;
				},
				"nfts_choice is required if asset_choice is ERC721",
			],
		},
		twitter: {
			type: Object,
			required: true,
			like: {
				type: String,
				required: false,
				default: undefined,
			},
			content: {
				type: String,
				required: false,
				default: undefined,
			},
			retweet: {
				type: String,
				required: false,
				default: undefined,
			},
			follow: {
				type: String,
				required: false,
				default: undefined,
			},
			wallet_post: {
				type: String,
				required: true,
				default: undefined,
			},
		},
		active: {
			type: Boolean,
			required: false,
			default: false,
		},
		tx_hash: {
			type: [{ value: String, status: String }],
			required: true
		},
		participants: {
			type: [{ id: String, text: String }],
			required: false
		}
	},
	{
		timestamps: true,
	},
);

lotterySchema.pre("save", function(next) {
	// const timezoneOffsetMS = new Date().getTime() + -new Date().getTimezoneOffset() * 60 * 1000;
	// Set lottery end date
	const lotteryEndMS = new Date().getTime() + this.duration * 60 * 60 * 1000;
	this.lottery_end = new Date(lotteryEndMS);

	next();
});

lotterySchema.method('assignLotteryId', async function() {
	if (this.lottery_id) { return }

	const erc = { asset_choice: { "$ne": "MATIC" } };
	const matic = { asset_choice: TOKEN_TYPE.MATIC };
	const assetType = (this.asset_choice === TOKEN_TYPE.MATIC) ? matic : erc;

	const lastId = (await this.constructor.find(assetType).sort({ lottery_id: -1}).limit(1))[0]?.lottery_id as number;
	
	// set lottery id
	this.lottery_id = lastId
	? lastId + 1
	: 1;
});

export const lottery = model<LotterySettings>("Lottery", lotterySchema);