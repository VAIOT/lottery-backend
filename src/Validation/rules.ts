
export const twitter = {
	post: "^(http(s)?:\\/\\/)?twitter\\.com\\/(?:#!\\/)?(\\w+)\\/status(es)?\\/(\\d+)$",
	username: "^@(\\w{1,15})$"
};

export const	wallet = /0x[a-fA-Z0-9]{40}/;