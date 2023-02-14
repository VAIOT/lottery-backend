import type { ERC20_TYPE, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from "../enums";

interface ILotteryBase {
	id: number;
	duration: number;
	distribution_method: TOKEN_DISTRIBUTION_METHOD;
	distribution_options: string[];
	number_of_tokens: string;
	wallet: string;
	fees_amount: string;
	num_of_winners: number;
	asset_choice: TOKEN_TYPE;
	final_rewards?: string[];
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

export interface IMATIC extends ILotteryBase {}
