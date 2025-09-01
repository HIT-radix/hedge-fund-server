import { bls12_381 } from "@noble/curves/bls12-381";
// Convert hex string to Uint8Array
export function hexToUint8Array(hex: string): Uint8Array {
  // Remove '0x' prefix if present
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  // Ensure even length
  const paddedHex = cleanHex.length % 2 ? "0" + cleanHex : cleanHex;
  return new Uint8Array(
    paddedHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
  );
}

// Derive the public key from private key (supports both hex string and Uint8Array)
export function getPublicKey(privateKey: string | Uint8Array): string {
  let privateKeyBytes: Uint8Array;

  if (typeof privateKey === "string") {
    privateKeyBytes = hexToUint8Array(privateKey);
  } else {
    privateKeyBytes = privateKey;
  }

  // Get the public key point and convert to compressed bytes
  const publicKeyPoint = bls12_381.longSignatures.getPublicKey(privateKeyBytes);
  const publicKeyBytes = publicKeyPoint.toBytes(true); // true for compressed format

  return Array.from(publicKeyBytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

// Generate a random private key (32 bytes = 64 hex characters)
export function generateRandomPrivateKey(): string {
  const randomBytes = bls12_381.utils.randomSecretKey();
  return Array.from(randomBytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}
