import { ApiPromise } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { LunesWalletService } from './wallet-service';
import { ContractCall, ContractResult } from '../types';
export interface ContractMetadata {
    abi: any;
    address: string;
    name: string;
}
/**
 * Serviço para interações com contratos inteligentes na rede Lunes
 */
export declare class LunesContractService {
    private api;
    private walletService;
    private contracts;
    constructor(api: ApiPromise, walletService: LunesWalletService);
    /**
     * Registra um contrato para uso
     */
    registerContract(metadata: ContractMetadata): void;
    /**
     * Obtém um contrato registrado
     */
    getContract(name: string): ContractPromise | null;
    /**
     * Executa uma chamada de leitura (query) no contrato
     */
    queryContract(contractName: string, method: string, args?: any[], value?: number): Promise<any>;
    /**
     * Executa uma transação no contrato
     */
    executeContract(call: ContractCall): Promise<ContractResult>;
    /**
     * Obtém o saldo de um token PSP22
     */
    getPSP22Balance(contractName: string, account: string): Promise<number>;
    /**
     * Transfere tokens PSP22
     */
    transferPSP22(contractName: string, to: string, amount: number): Promise<ContractResult>;
    /**
     * Aprova tokens PSP22 para gasto
     */
    approvePSP22(contractName: string, spender: string, amount: number): Promise<ContractResult>;
    /**
     * Obtém informações do token PSP22
     */
    getPSP22TokenInfo(contractName: string): Promise<{
        name: any;
        symbol: any;
        decimals: number;
        totalSupply: number;
    }>;
    /**
     * Estima o gas necessário para uma chamada de contrato
     */
    estimateGas(contractName: string, method: string, args?: any[], value?: number): Promise<number>;
}
//# sourceMappingURL=contract-service.d.ts.map