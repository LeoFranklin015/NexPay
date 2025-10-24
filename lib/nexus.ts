import { NexusSDK } from '@avail-project/nexus-core';
import type { TransferParams, TransferResult, SimulationResult, BridgeParams, BridgeResult } from '@avail-project/nexus-core';

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

/**
 * Transfer tokens using the Nexus SDK
 * @param params - Transfer parameters including token, amount, chainId, recipient, and optional sourceChains
 * @returns Promise with transfer result
 * @throws Error if SDK is not initialized or transfer fails
 */
export async function transfer(params: TransferParams): Promise<TransferResult> {
  if (!sdk.isInitialized()) {
    throw new Error('Nexus SDK not initialized. Please initialize first.');
  }

  try {
    console.log('Initiating transfer with params:', params);
    const result = await sdk.transfer(params);
    console.log('Transfer result:', result);
    return result;
  } catch (error: any) {
    console.error('Transfer failed:', error);
    throw new Error(`Transfer failed: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Simulate a transfer to preview costs and optimization path
 * @param params - Transfer parameters for simulation
 * @returns Promise with simulation result
 * @throws Error if SDK is not initialized or simulation fails
 */
export async function simulateTransfer(params: TransferParams): Promise<SimulationResult> {
  if (!sdk.isInitialized()) {
    throw new Error('Nexus SDK not initialized. Please initialize first.');
  }

  try {
    console.log('Simulating transfer with params:', params);
    const result = await sdk.simulateTransfer(params);
    console.log('Simulation result:', result);
    return result;
  } catch (error: any) {
    console.error('Transfer simulation failed:', error);
    throw new Error(`Transfer simulation failed: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Bridge tokens using the Nexus SDK
 * @param params - Bridge parameters including token, amount, chainId, optional gas, and optional sourceChains
 * @returns Promise with bridge result
 * @throws Error if SDK is not initialized or bridge fails
 */
export async function bridge(params: BridgeParams): Promise<BridgeResult> {
  if (!sdk.isInitialized()) {
    throw new Error('Nexus SDK not initialized. Please initialize first.');
  }

  try {
    console.log('Initiating bridge with params:', params);
    const result = await sdk.bridge(params);
    console.log('Bridge result:', result);
    return result;
  } catch (error: any) {
    console.error('Bridge failed:', error);
    throw new Error(`Bridge failed: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Simulate a bridge to preview costs and optimization path
 * @param params - Bridge parameters for simulation
 * @returns Promise with simulation result
 * @throws Error if SDK is not initialized or simulation fails
 */
export async function simulateBridge(params: BridgeParams): Promise<SimulationResult> {
  if (!sdk.isInitialized()) {
    throw new Error('Nexus SDK not initialized. Please initialize first.');
  }

  try {
    console.log('Simulating bridge with params:', params);
    const result = await sdk.simulateBridge(params);
    console.log('Bridge simulation result:', result);
    return result;
  } catch (error: any) {
    console.error('Bridge simulation failed:', error);
    throw new Error(`Bridge simulation failed: ${error?.message || 'Unknown error'}`);
  }
}
