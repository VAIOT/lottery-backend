import { ERC20_TYPE, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from "../enums";

interface ILotteryBase {
	id: number;
	duration: number;
	distribution_method: TOKEN_DISTRIBUTION_METHOD;
	number_of_tokens: number;
	wallet: string;
	num_of_winners: number;
	asset_choice: TOKEN_TYPE;
}

export interface IERC20 extends ILotteryBase {
	erc20_choice: ERC20_TYPE;
}

export interface IERC721 extends ILotteryBase {
	nfts_choice: {
		token_id: number,
		contract_address: string
	};
}

export interface IMATIC extends ILotteryBase {}
