import { useRouter } from 'next/router'
import { parse, type ParsedUrlQuery } from 'querystring'
import chains from '@/config/chains'
import { useAppSelector } from '@/store'
import { selectSession } from '@/store/sessionSlice'
import { parsePrefixedAddress } from '@/utils/addresses'
import { prefixedAddressRe } from '@/utils/url'
import useWallet from './wallets/useWallet'
import useChains from './useChains'

const KHALANI_TESTNET_CHAIN_ID = '10012'
const defaultChainId = KHALANI_TESTNET_CHAIN_ID

// Use the location object directly because Next.js's router.query is available only on mount
const getLocationQuery = (): ParsedUrlQuery => {
  if (typeof location === 'undefined') return {}

  const query = parse(location.search.slice(1))

  if (!query.safe) {
    const pathParam = location.pathname.split('/')[1]
    const safeParam = prefixedAddressRe.test(pathParam) ? pathParam : ''

    // Path param -> query param
    if (prefixedAddressRe.test(pathParam)) {
      query.safe = safeParam
    }
  }

  return query
}

export const useUrlChainId = (): string | undefined => {
  const router = useRouter()
  const { configs } = useChains()

  // Dynamic query params
  const query = router && (router.query.safe || router.query.chain) ? router.query : getLocationQuery()
  const chain = query.chain?.toString() || ''
  const safe = query.safe?.toString() || ''

  const { prefix } = parsePrefixedAddress(safe)
  const shortName = prefix || chain

  if (!shortName) return undefined

  return chains[shortName] || configs.find((item) => item.shortName === shortName)?.chainId
}

export const useChainId = (): string => {
  const session = useAppSelector(selectSession)
  const urlChainId = useUrlChainId()
  const wallet = useWallet()
  const { configs } = useChains()

  const walletChainId =
    wallet?.chainId && configs.some(({ chainId }) => chainId === wallet.chainId) ? wallet.chainId : undefined

  return urlChainId || walletChainId || session.lastChainId || defaultChainId
}

export default useChainId
