import { model, Schema } from "mongoose";
import type { Paginator } from "./interfaces/twitter";

type TwitterSettings = { 
	key: string,
	paginator: Paginator,
};

const twitterSchema = new Schema<TwitterSettings>({
	key: {
		type: String,
		required: true
	},
	paginator: {
		type: Object,
		required: true
	},
}, {
	timestamps: true
});

// remove document after 1h //
twitterSchema.index({"updatedAt": 1 },{ expireAfterSeconds: 3600 });


export default model<TwitterSettings>("Twitter", twitterSchema);
