import * as NodeRSA from 'node-rsa';
import * as Fs from 'fs';
import * as Winston from 'winston';
import * as BigInt from 'big-integer';

const privateKeyData = Fs.readFileSync('data/id_rsa_2048');
const privateKey = new NodeRSA(privateKeyData);
const keyComponents: any = privateKey.exportKey('components-private');

const privateK = BigInt(keyComponents.d.toString('hex'), 16);
const modulus = BigInt(keyComponents.n.toString('hex'), 16);
const publicK = BigInt(keyComponents.e);

function sign(hexString: string): string {
  const msg = BigInt(hexString, 16);

  // signing equals simple RSA encryption (m^e mod N = s)
  const signature = msg.modPow(privateK, modulus).toString(16);

  return signature;
}

function verify(msg: string, signature: string): boolean {
  const msgBuffer = new Buffer(msg, 'utf8');
  const msgNumber = BigInt(msgBuffer.toString('hex'), 16);

  // decrypting signature gives original msg (m^e^d mod N = m)
  const originalMsg = BigInt(signature, 16).modPow(publicK, modulus);

  const validSignature = msgNumber.equals(originalMsg);

  if (!validSignature) {
    Winston.warn(`Invalid signature for msg: ${msg}`);
    Winston.warn(`A valid signature would be ${privateKey.sign(msg, 'hex')}`);
  }

  return validSignature;
}

export default {
  sign,
  verify,
};
