import { renderHook } from '@/tests/test-utils'
import { SafeCreationStatus, useSafeCreation } from '@/components/new-safe/create/steps/StatusStep/useSafeCreation'
import * as web3 from '@/hooks/wallets/web3'
import * as chain from '@/hooks/useChains'
import * as wallet from '@/hooks/wallets/useWallet'
import * as logic from '@/components/new-safe/create/logic'
import * as contracts from '@/services/contracts/safeContracts'
import * as txMonitor from '@/services/tx/txMonitor'
import * as usePendingSafe from '@/components/new-safe/create/steps/StatusStep/usePendingSafe'
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import type { ConnectedWallet } from '@/hooks/wallets/useOnboard'
import type { ChainInfo } from '@safe-global/safe-gateway-typescript-sdk'
import { BigNumber } from '@ethersproject/bignumber'
import { waitFor } from '@testing-library/react'
import type Safe from '@safe-global/safe-core-sdk'
import { hexZeroPad } from 'ethers/lib/utils'
import type CompatibilityFallbackHandlerEthersContract from '@safe-global/safe-ethers-lib/dist/src/contracts/CompatibilityFallbackHandler/CompatibilityFallbackHandlerEthersContract'
import { FEATURES } from '@/utils/chains'
import * as gasPrice from '@/hooks/useGasPrice'

const mockSafeInfo = {
  data: '0x',
  from: '0x1',
  to: '0x2',
  nonce: 1,
  value: BigNumber.from(0),
  startBlock: 1,
}

describe('useSafeCreation', () => {
  const mockPendingSafe = {
    name: 'joyful-rinkeby-safe',
    threshold: 1,
    owners: [],
    saltNonce: 123,
    address: '0x10',
  }
  const mockSetPendingSafe = jest.fn()
  const mockStatus = SafeCreationStatus.AWAITING
  const mockSetStatus = jest.fn()
  const mockProvider: Web3Provider = new Web3Provider(jest.fn())
  const mockReadOnlyProvider: JsonRpcProvider = new JsonRpcProvider()

  beforeEach(() => {
    jest.resetAllMocks()

    const mockChain = {
      chainId: '4',
      features: [],
    } as unknown as ChainInfo

    jest.spyOn(web3, 'useWeb3').mockImplementation(() => mockProvider)
    jest.spyOn(web3, 'getWeb3ReadOnly').mockImplementation(() => mockProvider)
    jest.spyOn(web3, 'useWeb3ReadOnly').mockImplementation(() => mockReadOnlyProvider)
    jest.spyOn(chain, 'useCurrentChain').mockImplementation(() => mockChain)
    jest.spyOn(wallet, 'default').mockReturnValue({} as ConnectedWallet)
    jest.spyOn(logic, 'getSafeCreationTxInfo').mockReturnValue(Promise.resolve(mockSafeInfo))
    jest
      .spyOn(contracts, 'getReadOnlyFallbackHandlerContract')
      .mockReturnValue({ getAddress: () => hexZeroPad('0x123', 20) } as CompatibilityFallbackHandlerEthersContract)
    jest
      .spyOn(gasPrice, 'default')
      .mockReturnValue([{ maxFeePerGas: BigNumber.from(123), maxPriorityFeePerGas: undefined }, undefined, false])
  })

  it('should create a safe with gas params if there is no txHash and status is AWAITING', async () => {
    const createSafeSpy = jest.spyOn(logic, 'createNewSafe').mockReturnValue(Promise.resolve({} as Safe))
    jest.spyOn(usePendingSafe, 'usePendingSafe').mockReturnValue([mockPendingSafe, mockSetPendingSafe])
    renderHook(() => useSafeCreation(mockStatus, mockSetStatus, false))

    await waitFor(() => {
      expect(createSafeSpy).toHaveBeenCalled()

      const { gasPrice, maxFeePerGas, maxPriorityFeePerGas } = createSafeSpy.mock.calls[0][1].options || {}

      expect(gasPrice).toBe('123')

      expect(maxFeePerGas).toBeUndefined()
      expect(maxPriorityFeePerGas).toBeUndefined()
    })
  })

  it('should create a safe with EIP-1559 gas params if there is no txHash and status is AWAITING', async () => {
    jest
      .spyOn(gasPrice, 'default')
      .mockReturnValue([
        { maxFeePerGas: BigNumber.from(123), maxPriorityFeePerGas: BigNumber.from(456) },
        undefined,
        false,
      ])

    jest.spyOn(chain, 'useCurrentChain').mockImplementation(
      () =>
        ({
          chainId: '4',
          features: [FEATURES.EIP1559],
        } as unknown as ChainInfo),
    )
    jest.spyOn(usePendingSafe, 'usePendingSafe').mockReturnValue([mockPendingSafe, mockSetPendingSafe])

    const createSafeSpy = jest.spyOn(logic, 'createNewSafe').mockReturnValue(Promise.resolve({} as Safe))

    renderHook(() => useSafeCreation(mockStatus, mockSetStatus, false))

    await waitFor(() => {
      expect(createSafeSpy).toHaveBeenCalled()

      const { gasPrice, maxFeePerGas, maxPriorityFeePerGas } = createSafeSpy.mock.calls[0][1].options || {}

      expect(maxFeePerGas).toBe('123')
      expect(maxPriorityFeePerGas).toBe('456')

      expect(gasPrice).toBeUndefined()
    })
  })

  it('should create a safe with no gas params if the gas estimation threw, there is no txHash and status is AWAITING', async () => {
    jest.spyOn(gasPrice, 'default').mockReturnValue([undefined, Error('Error for testing'), false])
    jest.spyOn(usePendingSafe, 'usePendingSafe').mockReturnValue([mockPendingSafe, mockSetPendingSafe])

    const createSafeSpy = jest.spyOn(logic, 'createNewSafe').mockReturnValue(Promise.resolve({} as Safe))

    renderHook(() => useSafeCreation(mockStatus, mockSetStatus, false))

    await waitFor(() => {
      expect(createSafeSpy).toHaveBeenCalled()

      const { gasPrice, maxFeePerGas, maxPriorityFeePerGas } = createSafeSpy.mock.calls[0][1].options || {}

      expect(gasPrice).toBeUndefined()
      expect(maxFeePerGas).toBeUndefined()
      expect(maxPriorityFeePerGas).toBeUndefined()
    })
  })

  it('should not create a safe if there is no txHash, status is AWAITING but gas is loading', async () => {
    jest.spyOn(gasPrice, 'default').mockReturnValue([undefined, undefined, true])
    jest.spyOn(usePendingSafe, 'usePendingSafe').mockReturnValue([mockPendingSafe, mockSetPendingSafe])

    const createSafeSpy = jest.spyOn(logic, 'createNewSafe').mockReturnValue(Promise.resolve({} as Safe))

    renderHook(() => useSafeCreation(mockStatus, mockSetStatus, false))

    await waitFor(() => {
      expect(createSafeSpy).not.toHaveBeenCalled()
    })
  })

  it('should not create a safe if the status is not AWAITING', async () => {
    const createSafeSpy = jest.spyOn(logic, 'createNewSafe')
    jest.spyOn(usePendingSafe, 'usePendingSafe').mockReturnValue([mockPendingSafe, mockSetPendingSafe])

    renderHook(() => useSafeCreation(SafeCreationStatus.WALLET_REJECTED, mockSetStatus, false))

    await waitFor(() => {
      expect(createSafeSpy).not.toHaveBeenCalled()
    })

    renderHook(() => useSafeCreation(SafeCreationStatus.PROCESSING, mockSetStatus, false))

    await waitFor(() => {
      expect(createSafeSpy).not.toHaveBeenCalled()
    })

    renderHook(() => useSafeCreation(SafeCreationStatus.ERROR, mockSetStatus, false))

    await waitFor(() => {
      expect(createSafeSpy).not.toHaveBeenCalled()
    })

    renderHook(() => useSafeCreation(SafeCreationStatus.REVERTED, mockSetStatus, false))

    await waitFor(() => {
      expect(createSafeSpy).not.toHaveBeenCalled()
    })

    renderHook(() => useSafeCreation(SafeCreationStatus.TIMEOUT, mockSetStatus, false))

    await waitFor(() => {
      expect(createSafeSpy).not.toHaveBeenCalled()
    })

    renderHook(() => useSafeCreation(SafeCreationStatus.SUCCESS, mockSetStatus, false))

    await waitFor(() => {
      expect(createSafeSpy).not.toHaveBeenCalled()
    })

    renderHook(() => useSafeCreation(SafeCreationStatus.INDEXED, mockSetStatus, false))

    await waitFor(() => {
      expect(createSafeSpy).not.toHaveBeenCalled()
    })

    renderHook(() => useSafeCreation(SafeCreationStatus.INDEX_FAILED, mockSetStatus, false))

    await waitFor(() => {
      expect(createSafeSpy).not.toHaveBeenCalled()
    })
  })

  it('should not create a safe if there is a txHash', async () => {
    const createSafeSpy = jest.spyOn(logic, 'createNewSafe')
    jest
      .spyOn(usePendingSafe, 'usePendingSafe')
      .mockReturnValue([{ ...mockPendingSafe, txHash: '0x123' }, mockSetPendingSafe])

    renderHook(() => useSafeCreation(SafeCreationStatus.AWAITING, mockSetStatus, false))

    await waitFor(() => {
      expect(createSafeSpy).not.toHaveBeenCalled()
    })
  })

  it('should watch a tx if there is a txHash and a tx object', async () => {
    const watchSafeTxSpy = jest.spyOn(logic, 'checkSafeCreationTx')
    jest.spyOn(usePendingSafe, 'usePendingSafe').mockReturnValue([
      {
        ...mockPendingSafe,
        txHash: '0x123',
        tx: {
          data: '0x',
          from: '0x1234',
          nonce: 0,
          startBlock: 0,
          to: '0x456',
          value: BigNumber.from(0),
        },
      },
      mockSetPendingSafe,
    ])
    renderHook(() => useSafeCreation(mockStatus, mockSetStatus, false))

    await waitFor(() => {
      expect(watchSafeTxSpy).toHaveBeenCalledTimes(1)
    })
  })

  it('should watch a tx even if no wallet is connected', async () => {
    jest.spyOn(wallet, 'default').mockReturnValue(null)
    jest.spyOn(usePendingSafe, 'usePendingSafe').mockReturnValue([
      {
        ...mockPendingSafe,
        txHash: '0x123',
        tx: {
          data: '0x',
          from: '0x1234',
          nonce: 0,
          startBlock: 0,
          to: '0x456',
          value: BigNumber.from(0),
        },
      },
      mockSetPendingSafe,
    ])
    const watchSafeTxSpy = jest.spyOn(logic, 'checkSafeCreationTx')

    renderHook(() => useSafeCreation(mockStatus, mockSetStatus, false))

    await waitFor(() => {
      expect(watchSafeTxSpy).toHaveBeenCalledTimes(1)
    })
  })

  it('should not watch a tx if there is no txHash', async () => {
    const watchSafeTxSpy = jest.spyOn(logic, 'checkSafeCreationTx')
    jest.spyOn(usePendingSafe, 'usePendingSafe').mockReturnValue([mockPendingSafe, mockSetPendingSafe])
    renderHook(() => useSafeCreation(mockStatus, mockSetStatus, false))

    await waitFor(() => {
      expect(watchSafeTxSpy).not.toHaveBeenCalled()
    })
  })

  it('should not watch a tx if there is no tx object', async () => {
    const watchSafeTxSpy = jest.spyOn(logic, 'checkSafeCreationTx')
    jest.spyOn(usePendingSafe, 'usePendingSafe').mockReturnValue([
      {
        ...mockPendingSafe,
        tx: {
          data: '0x',
          from: '0x1234',
          nonce: 0,
          startBlock: 0,
          to: '0x456',
          value: BigNumber.from(0),
        },
      },
      mockSetPendingSafe,
    ])
    renderHook(() => useSafeCreation(mockStatus, mockSetStatus, false))

    await waitFor(() => {
      expect(watchSafeTxSpy).not.toHaveBeenCalled()
    })
  })

  it('should set a PROCESSING state when watching a tx', async () => {
    jest.spyOn(usePendingSafe, 'usePendingSafe').mockReturnValue([
      {
        ...mockPendingSafe,
        txHash: '0x123',
        tx: {
          data: '0x',
          from: '0x1234',
          nonce: 0,
          startBlock: 0,
          to: '0x456',
          value: BigNumber.from(0),
        },
      },
      mockSetPendingSafe,
    ])

    renderHook(() => useSafeCreation(mockStatus, mockSetStatus, false))

    await waitFor(() => {
      expect(mockSetStatus).toHaveBeenCalledWith(SafeCreationStatus.PROCESSING)
    })
  })

  it('should set a PROCESSING state and monitor relay taskId after successfully tx relay', async () => {
    jest.spyOn(logic, 'relaySafeCreation').mockResolvedValue('0x456')
    jest.spyOn(usePendingSafe, 'usePendingSafe').mockReturnValue([
      {
        ...mockPendingSafe,
      },
      mockSetPendingSafe,
    ])
    const txMonitorSpy = jest.spyOn(txMonitor, 'waitForCreateSafeTx').mockImplementation(jest.fn())

    const initialStatus = SafeCreationStatus.PROCESSING

    renderHook(() => useSafeCreation(initialStatus, mockSetStatus, true))

    await waitFor(() => {
      expect(mockSetStatus).toHaveBeenCalledWith(SafeCreationStatus.PROCESSING)
      expect(txMonitorSpy).toHaveBeenCalledWith('0x456', expect.anything())
    })
  })
})
