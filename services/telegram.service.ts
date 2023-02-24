import { Service as MoleculerService } from 'moleculer';
import { Service } from 'moleculer-decorators';
import Telegram from 'moleculer-telegram-bot';

// https://www.npmjs.com/package/moleculer-telegram-bot //

@Service({ 
	name: "telegram",
	mixins: [Telegram()]
})
class TelegramService extends MoleculerService {

	started(): void {}

	created(): void {}
	
	stopped(): void {}
}
export default TelegramService;