/**
 * Resolves once the service at `origin` answers its health check, asking
 * every `intervalMs`; rejects if it hasn't within `timeoutMs`.
 */
export async function waitForService(
  origin: string,
  { timeoutMs = 20_000, intervalMs = 100 } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isHealthy(origin)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(
    `The FilmFile service didn’t start within ${String(timeoutMs / 1000)} seconds.`,
  );
}

async function isHealthy(origin: string): Promise<boolean> {
  try {
    return (await fetch(`${origin}/api/health`)).ok;
  } catch {
    // Not listening yet.
    return false;
  }
}
