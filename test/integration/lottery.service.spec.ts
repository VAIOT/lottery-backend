import { ServiceBroker } from "moleculer";
import brokerConfig from "../../moleculer.config"
import { ERC20_TYPE, TOKEN_DISTRIBUTION_METHOD, TOKEN_TYPE } from "../../services/lottery/enums";
import type { LotteryDTO } from "../../services/lottery/lottery";
import LotteryService from "../../services/lottery/lottery.service";
import SocialService from "../../services/social/social.service";

describe("Test 'lottery' service", () => {
	describe("Test actions", () => {
		const broker = new ServiceBroker(brokerConfig);
		broker.createService(SocialService);
		broker.createService(LotteryService);

		beforeAll(() => broker.start());
		afterAll(() => broker.stop());

		const record: LotteryDTO = {
			_id: 1,
			duration: 24,
			distribution_method: TOKEN_DISTRIBUTION_METHOD.SPLIT,
			number_of_tokens: 30,
			wallet: "0x0123456789012345678901234567890123456789",
			num_of_winners: 3,
			asset_choice: TOKEN_TYPE.ERC20,
			erc20_choice: ERC20_TYPE.USDT,
			twitter: {
				like: "twitter.com/abc"
			}
		}

		// eslint-disable-next-line @typescript-eslint/naming-convention
		const response = (({ _id, erc20_choice, wallet, ...res }) => res)(record)

		test("should add the new lottery", async () => {
			const res = await broker.call("v1.lottery.create", record);
			expect(res).toStrictEqual(response);
		});

		test("should update an lottery", async () => {
			const res = await broker.call("v1.lottery.update", { id: 1, twitter: { like: "https://twitter.com/bac" } });
			response.twitter.like = "https://twitter.com/bac";
			expect(res).toStrictEqual(response);
		});

		test("should remove lottery", async () => {
			const res = await broker.call("v1.lottery.remove", { id: record._id});
			expect(res).toStrictEqual(response);
		});
	});
});
