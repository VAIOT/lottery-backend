import type { ERC20_TYPE, PAYMENT_STATUS, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from "@Meta/enums";

export namespace ILottery {
	export type LotteryDTO = (IERC20 | IERC721 | IMATIC) & { tx_hashes: string[]; twitter: TwitterDto; };
	export type LotteryEntity = (IERC20 | IERC721 | IMATIC) & { _id: string, lottery_end: Date; createdAt: Date, twitter: TwitterDto };
}

export interface TwitterDto {
	like?: string,
	content?: string,
	retweet?: string,
	follow?: string,
	wallet_post: string
}

type Tx = {
	hash: string,
	status: PAYMENT_STATUS
}

interface ILotteryBase {
	lottery_id: number;
	duration: number;
	distribution_method: TOKEN_DISTRIBUTION_METHOD;
	distribution_options: string[];
	number_of_tokens: string;
	wallet: string;
	fees_amount: string;
	num_of_winners: number;
	asset_choice: TOKEN_TYPE;
	final_rewards?: string[];
	participants?: { id: string, text: string }[];
	transactions: Tx[];
}

export interface IERC20 extends ILotteryBase {
	erc20_choice: ERC20_TYPE;
}

export interface IERC721 extends ILotteryBase {
	nfts_choice: {
		name: string,
		token_id: number,
		contract_address: string
	}[];
}

export type IMATIC = ILotteryBase;
