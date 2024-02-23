/* eslint-disable jest/no-commented-out-tests */
import type { ILottery } from "@Interfaces";
import { ERC20_TYPE, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from "@Meta/enums";
import LotteryService from "@MicroServices/lottery.service";
import TwitterService from "@MicroServices/twitter.service";
import { ServiceBroker } from "moleculer";
import brokerConfig from "../../moleculer.config"

describe("Test 'lottery' service", () => {
	const broker = new ServiceBroker({ logger: false });
	const twitterService = broker.createService(TwitterService);
	const lotteryService = broker.createService(LotteryService);

	beforeAll(() => broker.start());
	afterAll(() => broker.stop());

	const record: ILottery.LotteryDTO = {
		duration: 24,
		distribution_method: TOKEN_DISTRIBUTION_METHOD.PERCENTAGE,
		distribution_options: ["2000", "2000", "2000"],
		number_of_tokens: "3000",
		fees_amount: "1000",
		wallet: "0x0123456789012345678901234567890123456789",
		num_of_winners: 3,
		asset_choice: TOKEN_TYPE.ERC20,
		erc20_choice: ERC20_TYPE.USDT,
		tx_hashes: ["13231231212321312231"],
		lottery_id: 1,
		transactions: [],
		twitter: {
			like: "https://twitter.com/rickrollspam/status/1623189826098061312",
			wallet_post: "https://twitter.com/rickrollspam/status/1623189826098061312"
		}
	}

	const response = (({ erc20_choice, wallet, ...res }) => res)(record);
	
	describe("Test actions", () => {
		test("should add new lottery", () => {
			const res = broker.call("v1.lottery.create", record);
			return expect(res).resolves.toStrictEqual(response);
		});

		test("should update lottery", () => {
			const res = broker.call("v1.lottery.update", { id: 1, twitter: { like: "https://twitter.com/bac" } });
			response.twitter.like = "https://twitter.com/bac";
			return expect(res).resolves.toStrictEqual(response);
		});

		// test("should remove lottery", async () => {
		// 	const res = await broker.call("v1.lottery.remove", { id: record._id});
		// 	expect(res).toStrictEqual(response);
		// });
	});
});
