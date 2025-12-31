import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// BIP39-like word list (simplified - 256 common words)
const WORD_LIST = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
  'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
  'acoustic', 'acquire', 'across', 'action', 'actor', 'actress', 'actual', 'adapt',
  'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance', 'advice',
  'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent', 'agree',
  'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol',
  'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone', 'alpha',
  'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among', 'amount',
  'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry', 'animal',
  'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique', 'anxiety',
  'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april', 'arch',
  'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor', 'army',
  'around', 'arrange', 'arrest', 'arrive', 'arrow', 'art', 'artefact', 'artist',
  'artwork', 'ask', 'aspect', 'assault', 'asset', 'assist', 'assume', 'asthma',
  'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction', 'audit',
  'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado', 'avoid',
  'awake', 'aware', 'away', 'awesome', 'awful', 'awkward', 'axis', 'baby',
  'bachelor', 'bacon', 'badge', 'bag', 'balance', 'balcony', 'ball', 'bamboo',
  'banana', 'banner', 'bar', 'barely', 'bargain', 'barrel', 'base', 'basic',
  'basket', 'battle', 'beach', 'bean', 'beauty', 'because', 'become', 'beef',
  'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt', 'bench',
  'benefit', 'best', 'betray', 'better', 'between', 'beyond', 'bicycle', 'bid',
  'bike', 'bind', 'biology', 'bird', 'birth', 'bitter', 'black', 'blade',
  'blame', 'blanket', 'blast', 'bleak', 'bless', 'blind', 'blood', 'blossom',
  'blouse', 'blue', 'blur', 'blush', 'board', 'boat', 'body', 'boil',
  'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring', 'borrow',
  'boss', 'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain', 'brand',
  'brass', 'brave', 'bread', 'breeze', 'brick', 'bridge', 'brief', 'bright',
  'bring', 'brisk', 'broccoli', 'broken', 'bronze', 'broom', 'brother', 'brown',
  'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build', 'bulb', 'bulk',
  'bullet', 'bundle', 'bunker', 'burden', 'burger', 'burst', 'bus', 'business',
  'busy', 'butter', 'buyer', 'buzz', 'cabbage', 'cabin', 'cable', 'cactus',
];

const SECURE_STORE_KEYS = {
  DEVICE_TOKEN: 'transit_device_token',
  RECOVERY_PHRASE: 'transit_recovery_phrase',
  HAS_PIN: 'transit_has_pin',
  USER_ID: 'transit_user_id',
  JWT_TOKEN: 'transit_jwt_token',
};

/**
 * Generate a random UUID for device identification
 */
export async function generateDeviceToken(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(new Uint8Array(randomBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a 12-word recovery phrase
 */
export async function generateRecoveryPhrase(): Promise<string> {
  const words: string[] = [];
  const randomBytes = await Crypto.getRandomBytesAsync(12);
  
  for (let i = 0; i < 12; i++) {
    const index = randomBytes[i] % WORD_LIST.length;
    words.push(WORD_LIST[index]);
  }
  
  return words.join(' ');
}

/**
 * Hash a string using SHA-256
 */
export async function hashString(input: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input
  );
  return digest;
}

/**
 * Hash the device token for sending to server
 */
export async function hashDeviceToken(token: string): Promise<string> {
  return hashString(token);
}

/**
 * Hash the recovery phrase for sending to server
 */
export async function hashRecoveryPhrase(phrase: string): Promise<string> {
  // Normalize: lowercase, trim, single spaces
  const normalized = phrase.toLowerCase().trim().replace(/\s+/g, ' ');
  return hashString(normalized);
}

// ========== SECURE STORAGE ==========

/**
 * Store device token securely
 */
export async function storeDeviceToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.DEVICE_TOKEN, token);
}

/**
 * Get stored device token
 */
export async function getStoredDeviceToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_KEYS.DEVICE_TOKEN);
}

/**
 * Store recovery phrase securely (only during registration)
 */
export async function storeRecoveryPhrase(phrase: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.RECOVERY_PHRASE, phrase);
}

/**
 * Get stored recovery phrase (for display to user)
 */
export async function getStoredRecoveryPhrase(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_KEYS.RECOVERY_PHRASE);
}

/**
 * Clear recovery phrase from storage (after user confirms they saved it)
 */
export async function clearRecoveryPhrase(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.RECOVERY_PHRASE);
}

/**
 * Store JWT token
 */
export async function storeJwtToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.JWT_TOKEN, token);
}

/**
 * Get stored JWT token
 */
export async function getStoredJwtToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_KEYS.JWT_TOKEN);
}

/**
 * Store user info
 */
export async function storeUserInfo(userId: number, hasPin: boolean): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.USER_ID, String(userId));
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.HAS_PIN, hasPin ? 'true' : 'false');
}

/**
 * Get stored user info
 */
export async function getStoredUserInfo(): Promise<{ userId: number; hasPin: boolean } | null> {
  const userId = await SecureStore.getItemAsync(SECURE_STORE_KEYS.USER_ID);
  const hasPin = await SecureStore.getItemAsync(SECURE_STORE_KEYS.HAS_PIN);
  
  if (!userId) return null;
  
  return {
    userId: parseInt(userId, 10),
    hasPin: hasPin === 'true',
  };
}

/**
 * Clear all stored auth data (logout)
 */
export async function clearAllAuthData(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.DEVICE_TOKEN),
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.RECOVERY_PHRASE),
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.HAS_PIN),
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER_ID),
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.JWT_TOKEN),
  ]);
}

/**
 * Validate recovery phrase format (12 words)
 */
export function validateRecoveryPhrase(phrase: string): boolean {
  const words = phrase.toLowerCase().trim().split(/\s+/);
  if (words.length !== 12) return false;
  
  // Check all words are in the word list
  return words.every((word) => WORD_LIST.includes(word));
}

/**
 * Validate PIN format (4-6 digits)
 */
export function validatePin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}
