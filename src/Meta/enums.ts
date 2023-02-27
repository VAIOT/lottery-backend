export enum TOKEN_DISTRIBUTION_METHOD { 
    PERCENTAGE = "PERCENTAGE", 
    SPLIT = "SPLIT" 
};

export enum TOKEN_TYPE { 
    MATIC = "MATIC", 
    ERC20 = "ERC20", 
    ERC721 = "ERC721" 
};
	
export enum ERC20_TYPE { 
    USDT = "USDT", 
    USDC = "USDC", 
    ETH = "ETH" 
};

export enum PAYMENT_STATUS {
    PENDING  = "PENDING",
    SUCCESS  = "SUCCESS",
    FAILED   = "FAILED",
    STUCK    = "STUCK",
    PAID_OUT = "PAID_OUT"
};