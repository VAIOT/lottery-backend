// eslint-disable-next-line @typescript-eslint/naming-convention, import/no-extraneous-dependencies, @typescript-eslint/no-var-requires
import { Botometer } from "botometer";

const botometer = new Botometer({
    consumerKey: process.env.TWITTER_CONSUMER_TOKEN,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET_TOKEN,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_SECRET_TOKEN,
    rapidApiKey: process.env.RAPID_API_KEY,
    supressLogs: false,
});

function getScores(users: string[]): Promise<any[]> {
    return botometer.getScores(users);
}

export default async function filterBots(users: string[]): Promise<any[]> {
    const scores = await getScores(users);

    return scores
}