import { useState, useEffect } from 'react'
import { useWallet } from './WalletProvider'
import { useLunesContract } from '../hooks/useLunesContract'
import { useSolanaContract } from '../hooks/useSolanaContract'
import { useBridgeAPI, useTransactionPolling, TransactionRecord } from '../api/bridgeClient'
import { DataValidator, SecureErrorHandler, ClientRateLimiter, WalletSecurity } from '../utils/security'
import { CONTRACT_ADDRESSES } from '../contracts/addresses'
import { useToast } from './ui/Toast'
import { ArrowLeftRight, AlertCircle, CheckCircle, Loader2, Terminal, Activity, ArrowRight } from 'lucide-react'

type BridgeDirection = 'solana-to-lunes' | 'lunes-to-solana'

export function BridgeInterface() {
  const { solanaWallet, lunesWallet } = useWallet()
  const {
    burnLusdt,
    calculateFee,
    isPaused,
    getMonthlyVolume,
    getLusdtBalance,
    isReady,
    error: contractError,
    checkTaxManagerApproval,
    approveLusdtForTaxManager,
    approveLunesForTaxManager,
  } = useLunesContract()
  const {
    transferUsdt,
    getUsdtBalance,
  } = useSolanaContract()
  const { client: bridgeAPI, isConnected: bridgeConnected } = useBridgeAPI()
  const { toast } = useToast()

  const [direction, setDirection] = useState<BridgeDirection>('solana-to-lunes')
  const [amount, setAmount] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [txStatus, setTxStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [txHash, setTxHash] = useState('')
  const [activeTxId, setActiveTxId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [contractPaused, setContractPaused] = useState(false)
  const [approvalStatus, setApprovalStatus] = useState<{
    lusdtApproved: boolean;
    lunesApproved: boolean;
    checking: boolean;
    approving: string | null; // 'lusdt' | 'lunes' | null
  }>({ lusdtApproved: false, lunesApproved: false, checking: false, approving: null })

  // Polling para monitorar transação ativa
  useTransactionPolling(
    bridgeAPI,
    activeTxId,
    (tx: TransactionRecord) => {
      if (tx.status === 'completed') {
        setTxStatus('success')
        setIsProcessing(false)
        setActiveTxId(null)
      } else if (tx.status === 'failed') {
        setTxStatus('error')
        setErrorMessage('OFF-CHAIN VERIFICATION FAILED.')
        setIsProcessing(false)
        setActiveTxId(null)
      }
    },
    !!activeTxId
  )

  const [monthlyVolume, setMonthlyVolume] = useState('0')
  const [feeInfo, setFeeInfo] = useState<{
    feeAmount: string
    feeCurrency: string
    netAmount: string
    feePercentBps: number
    volumeTier: 'low' | 'medium' | 'high'
  } | null>(null)

  const sourceNetwork = direction === 'solana-to-lunes' ? 'solana' : 'lunes'
  const targetNetwork = direction === 'solana-to-lunes' ? 'lunes' : 'solana'
  const sourceWallet = sourceNetwork === 'solana' ? solanaWallet : lunesWallet
  const targetWallet = targetNetwork === 'solana' ? solanaWallet : lunesWallet

  // Verificar status do contrato e volume
  useEffect(() => {
    const checkContractStatus = async () => {
      try {
        const [paused, volume] = await Promise.all([
          isPaused(),
          getMonthlyVolume()
        ])
        setContractPaused(paused)
        setMonthlyVolume(volume)
      } catch (error) {
        console.error('Erro ao verificar status:', error)
      }
    }

    if (lunesWallet) {
      checkContractStatus()
    }
  }, [lunesWallet, isPaused, getMonthlyVolume])

  // Check Tax Manager approvals when user selects burn direction
  useEffect(() => {
    const checkApprovals = async () => {
      if (direction !== 'lunes-to-solana' || !lunesWallet) return
      setApprovalStatus(prev => ({ ...prev, checking: true }))
      try {
        const result = await checkTaxManagerApproval()
        setApprovalStatus({
          lusdtApproved: result.lusdtApproved,
          lunesApproved: result.lunesApproved,
          checking: false,
          approving: null,
        })
      } catch {
        setApprovalStatus(prev => ({ ...prev, checking: false }))
      }
    }
    checkApprovals()
  }, [direction, lunesWallet, checkTaxManagerApproval])

  const handleApproveLusdt = async () => {
    setApprovalStatus(prev => ({ ...prev, approving: 'lusdt' }))
    try {
      await approveLusdtForTaxManager()
      setApprovalStatus(prev => ({ ...prev, lusdtApproved: true, approving: null }))
      toast.success("APPROVAL_OK", "LUSDT approved for Tax Manager")
    } catch (err) {
      setApprovalStatus(prev => ({ ...prev, approving: null }))
      toast.error("APPROVAL_FAILED", "Failed to approve LUSDT")
    }
  }

  const handleApproveLunes = async () => {
    setApprovalStatus(prev => ({ ...prev, approving: 'lunes' }))
    try {
      await approveLunesForTaxManager()
      setApprovalStatus(prev => ({ ...prev, lunesApproved: true, approving: null }))
      toast.success("APPROVAL_OK", "LUNES approved for Tax Manager")
    } catch (err) {
      setApprovalStatus(prev => ({ ...prev, approving: null }))
      toast.error("APPROVAL_FAILED", "Failed to approve LUNES")
    }
  }

  const needsApproval = direction === 'lunes-to-solana' && (!approvalStatus.lusdtApproved || !approvalStatus.lunesApproved)

  const switchDirection = () => {
    setDirection(direction === 'solana-to-lunes' ? 'lunes-to-solana' : 'solana-to-lunes')
    setAmount('')
    setTxStatus('idle')
    setErrorMessage('')
  }

  // Validação segura de entrada
  const validateAmount = (value: string): string | null => {
    const validation = DataValidator.validateTransactionAmount(value);
    if (!validation.isValid) {
      return validation.errors[0] || 'INVALID_AMOUNT';
    }
    return null;
  }

  // Calcular taxas com validação
  const updateFeeInfo = async (value: string) => {
    const validation = DataValidator.validateTransactionAmount(value);
    if (!validation.isValid || parseFloat(validation.sanitizedAmount) <= 0) {
      setFeeInfo(null);
      return;
    }

    try {
      const fees = await calculateFee(validation.sanitizedAmount);
      setFeeInfo(fees);
    } catch (error) {
      SecureErrorHandler.logError(error, 'Fee calculation failed');
      setFeeInfo(null);
      toast.error("FEE_CALC_ERROR", "Failed to calculate transaction fees. Please retry.");
    }
  }

  const handleBridge = async () => {
    if (!sourceWallet || !targetWallet || !amount) return

    // Rate limiting
    const rateLimiter = ClientRateLimiter.getInstance();
    if (!rateLimiter.canExecute('bridge_transaction', 3, 300000)) {
      const timeUntilReset = Math.ceil(rateLimiter.getTimeUntilReset('bridge_transaction') / 1000 / 60);
      setErrorMessage(`RATE_LIMIT_EXCEEDED: WAIT ${timeUntilReset}M`);
      setTxStatus('error');
      return;
    }

    // Validações de segurança
    if (!WalletSecurity.validateWalletConnection(sourceWallet)) {
      setErrorMessage('SOURCE_WALLET_INVALID');
      setTxStatus('error');
      return;
    }

    if (!WalletSecurity.validateWalletConnection(targetWallet)) {
      setErrorMessage('TARGET_WALLET_INVALID');
      setTxStatus('error');
      return;
    }

    if (contractPaused) {
      setErrorMessage('CONTRACT_PAUSED_EMERGENCY');
      setTxStatus('error');
      return;
    }

    if (!bridgeConnected) {
      setErrorMessage('BRIDGE_NODE_OFFLINE');
      setTxStatus('error');
      return;
    }

    const amountValidation = DataValidator.validateTransactionAmount(amount);
    if (!amountValidation.isValid) {
      setErrorMessage(amountValidation.errors[0]);
      setTxStatus('error');
      return;
    }

    setIsProcessing(true);
    setTxStatus('processing');

    try {
      let txHash: string;
      let bridgeTransactionId: string;

      if (direction === 'solana-to-lunes') {
        txHash = await transferUsdt(
          CONTRACT_ADDRESSES.solana.bridgeAddress,
          amountValidation.sanitizedAmount,
          `Bridge to ${targetWallet.address}`
        );

        const bridgeTx = await bridgeAPI.createBridgeTransaction({
          sourceChain: 'solana',
          destinationChain: 'lunes',
          amount: amountValidation.sanitizedAmount,
          sourceAddress: sourceWallet.address,
          destinationAddress: targetWallet.address,
          sourceSignature: txHash
        });

        bridgeTransactionId = bridgeTx.transactionId;

      } else {
        txHash = await burnLusdt(amountValidation.sanitizedAmount, targetWallet.address);

        const bridgeTx = await bridgeAPI.createBridgeTransaction({
          sourceChain: 'lunes',
          destinationChain: 'solana',
          amount: amountValidation.sanitizedAmount,
          sourceAddress: sourceWallet.address,
          destinationAddress: targetWallet.address,
          sourceSignature: txHash
        });


        bridgeTransactionId = bridgeTx.transactionId;

        toast.success("ASSET_MIGRATION_INITIATED", "Funds transferred. Verification in progress.");
      }

      setTxHash(bridgeTransactionId);
      setActiveTxId(bridgeTransactionId);

      try {
        await bridgeAPI.sendWebhookNotification('transaction_created', {
          transactionId: bridgeTransactionId,
          type: direction,
          amount: amountValidation.sanitizedAmount,
          userAddress: sourceWallet.address
        });
      } catch (webhookError) {
        console.warn('Webhook notification failed:', webhookError);
      }

    } catch (error) {
      SecureErrorHandler.logError(error, 'Bridge transaction failed');
      setTxStatus('error');
      setIsProcessing(false);
      const msg = SecureErrorHandler.sanitizeErrorMessage(error);
      setErrorMessage(msg);
      toast.error("TRANSACTION_FAILED", msg);
    }
  }

  const canBridge = sourceWallet && targetWallet && amount && !isProcessing && !contractPaused && !validateAmount(amount)

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
      <div className="relative bg-black/80 border border-white/10 rounded-lg p-1 font-mono backdrop-blur-xl">

        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h2 className="text-white font-bold flex items-center gap-2 tracking-widest text-sm">
            <Terminal className="w-4 h-4 text-green-400" />
            BRIDGE_CONTROLLER // <span className="text-green-500">{direction === 'solana-to-lunes' ? 'SOL' : 'LUNES'}</span>
          </h2>
          <div className="flex items-center gap-2 text-[10px] tracking-wider">
            <span className={`w-1.5 h-1.5 rounded-full ${contractPaused ? 'bg-red-500 animate-pulse' : 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]'}`}></span>
            <span className={`${contractPaused ? 'text-red-500' : 'text-green-500'}`}>{contractPaused ? 'SYSTEM_HALTED' : 'ONLINE'}</span>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Direction Selector - Cyberpunk Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-black/50 border border-white/5 rounded-md relative overflow-hidden">
            <button
              onClick={() => direction !== 'solana-to-lunes' && switchDirection()}
              className={`py-3 px-4 text-xs font-bold tracking-wider transition-all duration-300 relative flex items-center justify-center gap-2 ${direction === 'solana-to-lunes' ? 'bg-zinc-900 border border-green-500/30 text-green-400 shadow-[0_0_20px_-5px_rgba(34,197,94,0.1)]' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              <div className={`w-2 h-2 rounded-full ${direction === 'solana-to-lunes' ? 'bg-green-500' : 'bg-zinc-800'}`} />
              SOLANA_NET
            </button>
            <button
              onClick={() => direction !== 'lunes-to-solana' && switchDirection()}
              className={`py-3 px-4 text-xs font-bold tracking-wider transition-all duration-300 relative flex items-center justify-center gap-2 ${direction === 'lunes-to-solana' ? 'bg-zinc-900 border border-blue-500/30 text-blue-400 shadow-[0_0_20px_-5px_rgba(59,130,246,0.1)]' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              <div className={`w-2 h-2 rounded-full ${direction === 'lunes-to-solana' ? 'bg-blue-500' : 'bg-zinc-800'}`} />
              LUNES_NET
            </button>
          </div>

          {/* Wallets Visualization */}
          <div className="flex items-center justify-between gap-4 text-xs">
            <div className={`flex-1 p-4 border rounded-sm transition-all duration-500 ${sourceWallet ? 'border-green-500/20 bg-green-500/5' : 'border-white/5 bg-white/5 opacity-50'}`}>
              <div className="flex justify-between items-center mb-2 opacity-50">
                <span>SOURCE</span>
                <Activity className="w-3 h-3" />
              </div>
              <div className="font-mono text-white/90 truncate">
                {sourceWallet ? sourceWallet.address.substring(0, 12) + '...' : 'DISCONNECTED'}
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-zinc-600 animate-pulse" />

            <div className={`flex-1 p-4 border rounded-sm transition-all duration-500 ${targetWallet ? 'border-blue-500/20 bg-blue-500/5' : 'border-white/5 bg-white/5 opacity-50'}`}>
              <div className="flex justify-between items-center mb-2 opacity-50">
                <span>TARGET</span>
                <Activity className="w-3 h-3" />
              </div>
              <div className="font-mono text-white/90 truncate">
                {targetWallet ? targetWallet.address.substring(0, 12) + '...' : 'DISCONNECTED'}
              </div>
            </div>
          </div>

          {/* Amount Input with Cyber Glitch Effect */}
          <div className="relative group">
            <div className={`absolute -inset-0.5 bg-gradient-to-r ${amount && !validateAmount(amount) ? 'from-green-500/50 to-emerald-500/50' : 'from-red-500/0 to-red-500/0'} rounded blur opacity-20 transition duration-500`}></div>
            <div className="relative">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 block">Quantized Amount</label>
              <div className="flex items-center border-b-2 border-zinc-800 focus-within:border-green-500/50 transition-colors bg-black/20">
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Regex: Allow positive decimals with up to 6 precision
                    if (val === '' || /^\d*\.?\d{0,6}$/.test(val)) {
                      setAmount(val);
                      setErrorMessage('');
                      if (parseFloat(val) > 0) updateFeeInfo(val);
                      else setFeeInfo(null);
                    }
                  }}
                  placeholder="0.00"
                  className="w-full bg-transparent text-3xl font-bold py-4 text-white placeholder:text-zinc-800 focus:outline-none font-mono tracking-tighter"
                  disabled={!sourceWallet || !targetWallet || contractPaused}
                />
                <span className="text-zinc-500 font-bold px-4">{sourceNetwork === 'solana' ? 'USDT' : 'LUSDT'}</span>
              </div>
            </div>
          </div>

          {/* Quick Selectors */}
          <div className="flex gap-2 justify-end">
            {['100', '1000', 'MAX'].map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  if (opt === 'MAX') {
                    (async () => {
                      try {
                        let maxBalance = '0';
                        if (sourceNetwork === 'solana' && solanaWallet) {
                          maxBalance = await getUsdtBalance();
                        } else if (sourceNetwork === 'lunes' && lunesWallet) {
                          maxBalance = await getLusdtBalance();
                        }
                        const parsed = parseFloat(maxBalance);
                        if (parsed > 0) {
                          const maxStr = parsed.toString();
                          setAmount(maxStr);
                          updateFeeInfo(maxStr);
                        } else {
                          toast.info("ZERO_BALANCE", "Saldo disponível é zero.");
                        }
                      } catch {
                        toast.error("FETCH_ERROR", "Erro ao buscar saldo máximo.");
                      }
                    })();
                  } else {
                    setAmount(opt);
                    updateFeeInfo(opt);
                  }
                }}
                className="text-[10px] border border-zinc-800 hover:border-green-500/50 hover:text-green-400 text-zinc-600 px-3 py-1.5 rounded-sm transition-all tracking-wider"
              >
                [{opt}]
              </button>
            ))}
          </div>

          {/* Fee Info - Holographic Style */}
          {amount && feeInfo && (
            <div className="bg-black/40 border border-green-900/30 p-4 rounded-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-8 h-8 bg-green-500/10 blur-xl rounded-full"></div>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between text-zinc-500">
                  <span>PROTOCOL_FEE ({(feeInfo.feePercentBps / 100).toFixed(2)}%)</span>
                  <span>${feeInfo.feeAmount} {sourceNetwork === 'solana' ? 'USDT' : 'LUSDT'}</span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>VOLUME_TIER</span>
                  <span>{feeInfo.volumeTier.toUpperCase()}</span>
                </div>
                <div className="h-px bg-white/5 my-2"></div>
                <div className="flex justify-between items-center">
                  <span className="text-green-500/80">ESTIMATED_ARRIVAL</span>
                  <span className="text-xl text-green-400 font-bold tracking-tighter">{feeInfo.netAmount} <span className="text-sm font-normal text-zinc-500">TOKENS</span></span>
                </div>
              </div>
            </div>
          )}

          {/* Status Display */}
          {txStatus !== 'idle' && (
            <div className={`mb-6 p-4 border rounded-sm ${txStatus === 'processing' ? 'bg-blue-900/10 border-blue-500/30' :
              txStatus === 'success' ? 'bg-green-900/10 border-green-500/30' :
                'bg-red-900/10 border-red-500/30'
              }`}>
              <div className="flex items-center gap-3">
                {txStatus === 'processing' && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
                {txStatus === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                {txStatus === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}

                <div className="font-mono text-xs">
                  <div className={`font-bold ${txStatus === 'processing' ? 'text-blue-400' :
                    txStatus === 'success' ? 'text-green-400' : 'text-red-400'
                    }`}>
                    {txStatus === 'processing' ? 'PROCESSING_TRANSACTION...' :
                      txStatus === 'success' ? 'TRANSACTION_CONFIRMED' : 'TRANSACTION_FAILED'}
                  </div>
                  {errorMessage && <div className="text-red-400 mt-1">{errorMessage}</div>}
                  {txHash && <div className="text-zinc-500 mt-1 truncate max-w-[200px]">{txHash}</div>}
                </div>
              </div>
            </div>
          )}

          {/* Approval Buttons (v3: required before burn for Tax Manager fee collection) */}
          {direction === 'lunes-to-solana' && lunesWallet && needsApproval && (
            <div className="space-y-2">
              <div className="text-[10px] text-yellow-500 tracking-wider mb-2">
                ⚠ APPROVAL_REQUIRED: Tax Manager needs permission to collect fees
              </div>
              {!approvalStatus.lusdtApproved && (
                <button
                  onClick={handleApproveLusdt}
                  disabled={approvalStatus.approving === 'lusdt'}
                  className="w-full py-3 text-xs font-bold tracking-wider rounded-sm flex items-center justify-center gap-2 transition-all bg-blue-900/30 border border-blue-500/30 text-blue-400 hover:bg-blue-900/50"
                >
                  {approvalStatus.approving === 'lusdt' ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /><span>APPROVING_LUSDT...</span></>
                  ) : (
                    <span>APPROVE_LUSDT_FOR_TAX_MANAGER</span>
                  )}
                </button>
              )}
              {!approvalStatus.lunesApproved && (
                <button
                  onClick={handleApproveLunes}
                  disabled={approvalStatus.approving === 'lunes'}
                  className="w-full py-3 text-xs font-bold tracking-wider rounded-sm flex items-center justify-center gap-2 transition-all bg-purple-900/30 border border-purple-500/30 text-purple-400 hover:bg-purple-900/50"
                >
                  {approvalStatus.approving === 'lunes' ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /><span>APPROVING_LUNES...</span></>
                  ) : (
                    <span>APPROVE_LUNES_FOR_BURN_FEE</span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleBridge}
            disabled={!canBridge || needsApproval}
            className={`w-full py-4 text-sm font-bold tracking-wider rounded-sm flex items-center justify-center gap-2 transition-all ${canBridge && !needsApproval
              ? 'bg-green-600 hover:bg-green-500 text-zinc-950 shadow-[0_0_15px_-3px_rgba(34,197,94,0.4)]'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>PROCESSING...</span>
              </>
            ) : (
              <>
                <span>EXECUTE_BRIDGE_PROTOCOL</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {!contractPaused && (!sourceWallet || !targetWallet) && (
            <div className="mt-4 text-center">
              <span className="text-[10px] text-yellow-600 bg-yellow-900/10 border border-yellow-900/30 px-3 py-1 rounded-sm animate-pulse">
                ⚠ WARNING: WALLETS_DISCONNECTED
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}