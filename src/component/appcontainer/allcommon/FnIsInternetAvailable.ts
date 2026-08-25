
/*
Runs a first connectivity using fetch.
If it fails, waits briefly, then retries one more time.
Returns true on success, false if both attempts fail.
*/

// we wil set here our own url
const DEFAULT_CHECK_URL = 'https://www.gstatic.com/generate_204';

async function pingInternet(checkUrl: string, timeoutMs: number): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
        await fetch(checkUrl, {
            method: 'HEAD',
            cache: 'no-store',
            mode: 'no-cors',
            signal: controller.signal,
        });
        return true;
    } catch {
        return false;
    } finally {
        window.clearTimeout(timeoutId);
    }
}

async function FnIsInternetAvailable(retryDelayMs = 300, timeoutMs = 3000): Promise<boolean> {
    if (await pingInternet(DEFAULT_CHECK_URL, timeoutMs)) {
        return true;
    }

    await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), retryDelayMs);
    });

    return pingInternet(DEFAULT_CHECK_URL, timeoutMs);
}
export { FnIsInternetAvailable }