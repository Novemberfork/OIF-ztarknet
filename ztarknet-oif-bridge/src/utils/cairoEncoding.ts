
export interface CairoU256 {
  low: bigint;
  high: bigint;
}

export interface CairoBytes {
  size: number;
  data: bigint[];
}

export function toCairoU256(value: number | bigint | string): CairoU256 {
  const bigValue = BigInt(value);
  const mask128 = (BigInt(1) << BigInt(128)) - BigInt(1);
  const low = bigValue & mask128;
  const high = bigValue >> BigInt(128);
  return { low, high };
}

export function hexToCairoBytes(hex: string): CairoBytes {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const size = cleanHex.length / 2;
  const data: bigint[] = [];
  
  // Split into 32-character chunks (16 bytes)
  for (let i = 0; i < cleanHex.length; i += 32) {
    const chunk = cleanHex.slice(i, i + 32);
    // Convert chunk to BigInt
    data.push(BigInt(`0x${chunk}`));
  }
  
  return {
    size,
    data
  };
}

