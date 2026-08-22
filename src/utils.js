
// ─────────────────────────────────────────────────────────────────────────────
// withRetry — backoff exponencial com jitter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{
 *   maxAttempts?: number,
 *   baseDelayMs?: number,
 *   maxDelayMs?: number,
 *   retryIf?: (err: Error) => boolean,
 *   onRetry?: (info: { attempt: number, delay: number, error: Error }) => void,
 *   signal?: AbortSignal
 * }} opts
 * @returns {Promise<T>}
 */
async function withRetry(fn, {
    maxAttempts = 3,
    baseDelayMs = 900,
    maxDelayMs = 9_000,
    retryIf = () => true,
    onRetry,
    signal,
} = {}) {
    let attempt = 0;
    while (true) {
        if (signal?.aborted) {
            throw signal.reason || new DOMException('The user aborted a request.', 'AbortError');
        }

        try {
            return await fn();
        } catch (err) {
            if (signal?.aborted) {
                throw signal.reason || err;
            }

            attempt++;

            const shouldRetry =
                attempt < maxAttempts &&
                retryIf(err);

            if (!shouldRetry) {
                throw err;
            }

            const exponential = baseDelayMs * (2 ** (attempt - 1));
            const jitter = Math.random() * baseDelayMs * 0.5;
            const delay = Math.min(exponential + jitter, maxDelayMs);

            onRetry?.({
                attempt,
                delay,
                error: err,
            });

            await new Promise((resolve, reject) => {
                let timer = null;
                let abortHandler = null;

                if (signal) {
                    if (signal.aborted) {
                        return reject(signal.reason || new DOMException('The user aborted a request.', 'AbortError'));
                    }
                    abortHandler = () => {
                        if (timer) clearTimeout(timer);
                        reject(signal.reason || new DOMException('The user aborted a request.', 'AbortError'));
                    };
                    signal.addEventListener('abort', abortHandler, { once: true });
                }

                timer = setTimeout(() => {
                    if (signal && abortHandler) {
                        signal.removeEventListener('abort', abortHandler);
                    }
                    resolve();
                }, delay);
                timer.unref?.();
            });
        }
    }
}

module.exports = { withRetry };