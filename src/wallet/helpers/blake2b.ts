import { Buffer } from "buffer";

const toArrayBuffer = (buffer: Buffer): ArrayBuffer => {
  const arrayBuffer = new ArrayBuffer(buffer.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return arrayBuffer;
};

export const bufferToUnit8Array = (buffer: Buffer): Uint8Array =>
  new Uint8Array(toArrayBuffer(buffer));
