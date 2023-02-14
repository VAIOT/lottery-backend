import type { Model} from "mongoose";
import { model, Schema } from "mongoose";
import { ERC20_TYPE, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from "./enums";
import type { IERC20, IERC721, IMATIC } from "./interfaces/lottery";
import type { ITwitter } from "./interfaces/twitter";
import { hasProperty } from "./utils";

export type LotteryDTO = (IERC20 | IERC721 | IMATIC) & { twitter: ITwitter; fees_amount: number };
export type LotteryEntity = LotteryDTO & { lottery_end: Date; fees_amount: number, createdAt: Date };

type LotterySettings = IERC20 &
	IERC721 &
	IMATIC & { twitter: ITwitter; lottery_end: Date; fees_amount: number; active: boolean, final_rewards: string[] };

const lotterySchema = new Schema<LotterySettings>(
	{
		id: {
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
			type: [Number],
			required: false,
			default: undefined,
		},
		number_of_tokens: {
			type: Number,
			required: false,
			default: undefined,
		},
		fees_amount: {
			type: Number,
		},
		wallet: {
			type: String,
			required: true,
		},
		final_rewards: {
			type: [String],
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
	},
	{
		timestamps: true,
	},
);

lotterySchema.pre("validate", function (next) {
	const twitterReq: (keyof Omit<ITwitter, "wallet_post">)[] = ["content", "follow", "like", "retweet"];
	// eslint-disable-next-line @typescript-eslint/naming-convention
	if (hasProperty((({ wallet_post, ...data }) => data)(this.toObject().twitter), twitterReq)) {
		return next();
	}
	return next(new Error("At least one Twitter requirement should be defined."));
});


lotterySchema.pre("save", async function(next) {
	const erc = { asset_choice: { "$ne": "MATIC" } };
	const matic = { asset_choice: TOKEN_TYPE.MATIC };

	const assetType = (this.asset_choice === TOKEN_TYPE.MATIC) ? matic : erc;

	const lastId = (await (this.constructor as typeof Model).find(assetType).sort({ id: -1}).limit(1))[0]?.id as number;
	// set lottery id
	this.id = lastId
	? lastId + 1
	: 1;

	// set lottery end date
	const milliseconds = new Date().getTime() + this.duration * 60 * 60 * 1000;
	this.lottery_end = new Date(milliseconds);

	next();
});

export const lottery = model<LotterySettings>("Lottery", lotterySchema);