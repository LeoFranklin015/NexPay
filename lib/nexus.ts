import { NexusSDK } from '@avail-project/nexus-core';

// Initialize Nexus SDK with testnet configuration
// This SDK connects to Avail's Nexus Network for unified balance queries
export const sdk = new NexusSDK({ network: 'testnet' });

/**
 * Check if Nexus SDK is initialized
 * @returns boolean indicating initialization status
 */
export function isInitialized(): boolean {
  return sdk.isInitialized();
}

/**
 * Initialize Nexus SDK with an EIP-1193 provider (e.g., MetaMask)
 * @param provider - EIP-1193 compatible provider (window.ethereum or wagmi connector provider)
 * @throws Error if no provider is found or initialization fails
 */
export async function initializeWithProvider(provider: any): Promise<void> {
  if (!provider) {
    throw new Error('No EIP-1193 provider found. Please connect your wallet first.');
  }

  // If the SDK is already initialized, return early
  if (sdk.isInitialized()) {
    console.log('Nexus SDK already initialized');
    return;
  }

  try {
    // Initialize the SDK with the provider
    await sdk.initialize(provider);
    
    console.log('Nexus SDK initialized successfully');
  } catch (error: any) {
    console.error('Failed to initialize Nexus SDK:', error);
    throw new Error(`Nexus initialization failed: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Deinitialize Nexus SDK and clean up resources
 */
export async function deinit(): Promise<void> {
  // If the SDK is not initialized, return early
  if (!sdk.isInitialized()) {
    console.log('Nexus SDK not initialized, nothing to deinitialize');
    return;
  }

  try {
    // Deinitialize the SDK
    await sdk.deinit();
    console.log('Nexus SDK deinitialized successfully');
  } catch (error: any) {
    console.error('Failed to deinitialize Nexus SDK:', error);
    throw new Error(`Nexus deinitialization failed: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Get unified balances across multiple chains
 * @returns Promise with unified balance data
 * @throws Error if SDK is not initialized
 */
export async function getUnifiedBalances(): Promise<any> {
  if (!sdk.isInitialized()) {
    throw new Error('Nexus SDK not initialized. Please initialize first.');
  }

  try {
    // Get the unified balances from the SDK
    const balances = await sdk.getUnifiedBalances();
    console.log('Unified balances fetched:', balances);
    return balances;
  } catch (error: any) {
    console.error('Failed to fetch unified balances:', error);
    throw new Error(`Failed to fetch balances: ${error?.message || 'Unknown error'}`);
  }
}
