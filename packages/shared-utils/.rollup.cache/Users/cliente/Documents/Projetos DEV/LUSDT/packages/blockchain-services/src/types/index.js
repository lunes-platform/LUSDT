// Common types for blockchain services
// Error types
export class WalletError extends Error {
    code;
    cause;
    constructor(message, code, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = 'WalletError';
    }
}
export class TransactionError extends Error {
    code;
    transactionId;
    retryable;
    constructor(message, code, transactionId, retryable = false) {
        super(message);
        this.code = code;
        this.transactionId = transactionId;
        this.retryable = retryable;
        this.name = 'TransactionError';
    }
}
export class NetworkError extends Error {
    network;
    cause;
    constructor(message, network, cause) {
        super(message);
        this.network = network;
        this.cause = cause;
        this.name = 'NetworkError';
    }
}
//# sourceMappingURL=index.js.map