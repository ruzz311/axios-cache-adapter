import isString from 'lodash/isString'
import isFunction from 'lodash/isFunction'
import map from 'lodash/map'

import serialize from './serialize'

async function write (config, req, res) {
  try {
    const entry = {
      expires: config.expires,
      data: serialize(config, req, res)
    }

    await config.store.setItem(config.uuid, entry)
  } catch (err) {
    config.debug('Could not store response', err)

    if (config.clearOnError) {
      try {
        await config.store.clear()
      } catch (err) {
        config.debug('Could not clear store', err)
      }
    }

    return false
  }

  return true
}

async function read (config, req) {
  const { uuid } = config

  const entry = await config.store.getItem(uuid)

  if (!entry || !entry.data) {
    config.debug('cache-miss', req.url)
    const error = new Error()

    error.reason = 'cache-miss'
    error.message = 'Entry not found from cache'

    throw error
  }

  const { expires, data } = entry

  // Do not check for stale cache if offline on client-side
  const offline = typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine

  if (!offline && !config.acceptStale && expires !== 0 && (expires < Date.now())) {
    config.debug('cache-stale', req.url)
    const error = new Error()

    error.reason = 'cache-stale'
    error.message = 'Entry is stale'

    throw error
  }

  config.debug(config.acceptStale ? 'cache-hit-stale' : 'cache-hit', req.url)

  return data
}

function key (config) {
  if (isFunction(config.key)) return config.key

  let cacheKey

  if (isString(config.key)) cacheKey = req => `${config.key}/${req.url}${serializeQuery(req)}`
  else cacheKey = req => req.url + serializeQuery(req)

  return cacheKey
}

function serializeQuery (req) {
  if (!req.params) return ''

  // Probably server-side, just stringify the object
  if (typeof URLSearchParams === 'undefined') return JSON.stringify(req.params)

  const isInstanceOfURLSearchParams = req.params instanceof URLSearchParams

  // Convert to an instance of URLSearchParams so it get serialized the same way
  if (!isInstanceOfURLSearchParams) {
    const params = req.params

    req.params = new URLSearchParams()

    // Using lodash/map even though we don't listen to output so we don't have to bundle lodash/forEach
    map(params, (value, key) => req.params.append(key, value))
  }

  return `?${req.params.toString()}`
}

export { read, write, key }
export default { read, write, key }
