import { ServiceBroker } from "moleculer";
import brokerConfig from "../../moleculer.config"
import { ERC20_TYPE, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from "../../services/lottery/enums";
import type { LotteryDTO } from "../../services/lottery/lottery";
import TestService from "../../services/lottery/lottery.service";

describe("Test 'lottery' service", () => {
	describe("Test actions", () => {
		const broker = new ServiceBroker(brokerConfig);
		broker.createService(TestService);

		beforeAll(() => broker.start());
		afterAll(() => broker.stop());

		const request: LotteryDTO = {
			id: 1,
			duration: 24,
			distribution_method: TOKEN_DISTRIBUTION_METHOD.SPLIT,
			number_of_tokens: 30,
			wallet: "0x0123456789012345678901234567890123456789",
			num_of_winners: 3,
			asset_choice: TOKEN_TYPE.ERC20,
			erc20_choice: ERC20_TYPE.USDT,
			twitter_like: "https://twitter.com/abc"
		}

		test("should add the new lottery", async () => {
			const res = await broker.call("v1.lottery.create", request);
			expect(res).toBe(true);
		});

		test("should update an lottery", async () => {
			const res = await broker.call("v1.lottery.update", { id: 1, twitter_like: "https://twitter.com/bac" });
			expect(res).toBe(true);
		});
	});
});
