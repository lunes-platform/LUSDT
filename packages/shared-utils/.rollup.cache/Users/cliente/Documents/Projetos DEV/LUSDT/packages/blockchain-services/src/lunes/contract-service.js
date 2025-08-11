import { ContractPromise } from '@polkadot/api-contract';
import { TransactionError, WalletError } from '../types';
/**
 * Serviço para interações com contratos inteligentes na rede Lunes
 */
export class LunesContractService {
    api;
    walletService;
    contracts = new Map();
    constructor(api, walletService) {
        this.api = api;
        this.walletService = walletService;
    }
    /**
     * Registra um contrato para uso
     */
    registerContract(metadata) {
        try {
            const contract = new ContractPromise(this.api, metadata.abi, metadata.address);
            this.contracts.set(metadata.name, contract);
        }
        catch (error) {
            throw new TransactionError(`Failed to register contract ${metadata.name}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'CONTRACT_REGISTRATION_FAILED');
        }
    }
    /**
     * Obtém um contrato registrado
     */
    getContract(name) {
        return this.contracts.get(name) || null;
    }
    /**
     * Executa uma chamada de leitura (query) no contrato
     */
    async queryContract(contractName, method, args = [], value = 0) {
        const contract = this.contracts.get(contractName);
        if (!contract) {
            throw new TransactionError(`Contract ${contractName} not found`, 'CONTRACT_NOT_FOUND');
        }
        const wallet = this.walletService.getCurrentWallet();
        if (!wallet) {
            throw new WalletError('No wallet connected', 'NO_WALLET');
        }
        try {
            const gasLimit = this.api.registry.createType('WeightV2', {
                refTime: 1000000000,
                proofSize: 1000000
            });
            const { gasRequired, result, output } = await contract.query[method](wallet.address, {
                gasLimit,
                storageDepositLimit: null,
                value: value || 0
            }, ...args);
            if (result.isErr) {
                throw new Error(result.asErr.toString());
            }
            return output?.toHuman();
        }
        catch (error) {
            throw new TransactionError(`Failed to query contract ${contractName}.${method}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'CONTRACT_QUERY_FAILED');
        }
    }
    /**
     * Executa uma transação no contrato
     */
    async executeContract(call) {
        const contract = this.contracts.get(call.contractAddress);
        if (!contract) {
            throw new TransactionError(`Contract ${call.contractAddress} not found`, 'CONTRACT_NOT_FOUND');
        }
        const wallet = this.walletService.getCurrentWallet();
        if (!wallet) {
            throw new WalletError('No wallet connected', 'NO_WALLET');
        }
        try {
            const gasLimit = this.api.registry.createType('WeightV2', {
                refTime: call.gasLimit || 1000000000,
                proofSize: 1000000
            });
            // Execute the contract call
            const tx = contract.tx[call.method]({
                gasLimit,
                storageDepositLimit: null,
                value: call.value || 0
            }, ...call.args);
            // Sign and send transaction
            const hash = await tx.signAndSend(wallet.address, { signer: wallet.signer });
            // Wait for transaction to be included in block
            return new Promise((resolve, reject) => {
                const unsubscribe = tx.signAndSend(wallet.address, { signer: wallet.signer }, ({ status, events, dispatchError }) => {
                    if (status.isInBlock) {
                        console.log(`Transaction included at blockHash ${status.asInBlock}`);
                    }
                    else if (status.isFinalized) {
                        console.log(`Transaction finalized at blockHash ${status.asFinalized}`);
                        if (dispatchError) {
                            if (dispatchError.isModule) {
                                const decoded = this.api.registry.findMetaError(dispatchError.asModule);
                                const { docs, name, section } = decoded;
                                reject(new TransactionError(`${section}.${name}: ${docs.join(' ')}`, 'CONTRACT_EXECUTION_FAILED', hash.toString()));
                            }
                            else {
                                reject(new TransactionError(dispatchError.toString(), 'CONTRACT_EXECUTION_FAILED', hash.toString()));
                            }
                        }
                        else {
                            // Extract events and gas used
                            const contractEvents = events
                                .filter(({ event }) => this.api.events.contracts.ContractEmitted.is(event))
                                .map(({ event }) => event.data);
                            resolve({
                                transactionHash: hash.toString(),
                                blockNumber: 0, // Would need to get actual block number
                                gasUsed: 0, // Would need to calculate from events
                                success: true,
                                events: contractEvents
                            });
                        }
                        unsubscribe();
                    }
                });
            });
        }
        catch (error) {
            throw new TransactionError(`Failed to execute contract ${call.contractAddress}.${call.method}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'CONTRACT_EXECUTION_FAILED', undefined, true);
        }
    }
    /**
     * Obtém o saldo de um token PSP22
     */
    async getPSP22Balance(contractName, account) {
        try {
            const result = await this.queryContract(contractName, 'balanceOf', [account]);
            // Parse the result based on the contract's return format
            return parseInt(result?.Ok || result || '0');
        }
        catch (error) {
            throw new TransactionError(`Failed to get PSP22 balance: ${error instanceof Error ? error.message : 'Unknown error'}`, 'PSP22_BALANCE_FAILED');
        }
    }
    /**
     * Transfere tokens PSP22
     */
    async transferPSP22(contractName, to, amount) {
        return this.executeContract({
            contractAddress: contractName,
            method: 'transfer',
            args: [to, amount, []]
        });
    }
    /**
     * Aprova tokens PSP22 para gasto
     */
    async approvePSP22(contractName, spender, amount) {
        return this.executeContract({
            contractAddress: contractName,
            method: 'approve',
            args: [spender, amount]
        });
    }
    /**
     * Obtém informações do token PSP22
     */
    async getPSP22TokenInfo(contractName) {
        try {
            const [name, symbol, decimals, totalSupply] = await Promise.all([
                this.queryContract(contractName, 'tokenName', []),
                this.queryContract(contractName, 'tokenSymbol', []),
                this.queryContract(contractName, 'tokenDecimals', []),
                this.queryContract(contractName, 'totalSupply', [])
            ]);
            return {
                name: name?.Ok || name || 'Unknown',
                symbol: symbol?.Ok || symbol || 'UNKNOWN',
                decimals: parseInt(decimals?.Ok || decimals || '0'),
                totalSupply: parseInt(totalSupply?.Ok || totalSupply || '0')
            };
        }
        catch (error) {
            throw new TransactionError(`Failed to get PSP22 token info: ${error instanceof Error ? error.message : 'Unknown error'}`, 'PSP22_INFO_FAILED');
        }
    }
    /**
     * Estima o gas necessário para uma chamada de contrato
     */
    async estimateGas(contractName, method, args = [], value = 0) {
        const contract = this.contracts.get(contractName);
        if (!contract) {
            throw new TransactionError(`Contract ${contractName} not found`, 'CONTRACT_NOT_FOUND');
        }
        const wallet = this.walletService.getCurrentWallet();
        if (!wallet) {
            throw new WalletError('No wallet connected', 'NO_WALLET');
        }
        try {
            const gasLimit = this.api.registry.createType('WeightV2', {
                refTime: 1000000000,
                proofSize: 1000000
            });
            const { gasRequired } = await contract.query[method](wallet.address, {
                gasLimit,
                storageDepositLimit: null,
                value: value || 0
            }, ...args);
            return gasRequired.refTime.toNumber();
        }
        catch (error) {
            throw new TransactionError(`Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`, 'GAS_ESTIMATION_FAILED');
        }
    }
}
//# sourceMappingURL=contract-service.js.map