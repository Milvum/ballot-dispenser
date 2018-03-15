import web3 from 'web3-instance';
import * as Fs from 'fs';
import * as Winston from 'winston';
import * as NodeRSA from 'node-rsa';

import * as contracts from './Connector';
import * as Transaction from './Transaction';
import Cipher from '../Cipher';

// Returns true iff the token in the payload was valid and has been redeemed successfully
const redeemer = async (payload: Buffer): Promise<boolean> => {
  // The payloadString has the shape: <address>-<nonce>-<signature>,
  //   where <signature> should be a valid sig of our private key on <address>-<nonce> (= the token)
  const payloadString: string = payload.toString('utf8');
  Winston.info(`checking payload: ${payloadString}`);
  const payloadElements: string[] = payloadString.split('-');

  if (payloadElements.length !== 3 ||
    !payloadElements.every((el) => el.length > 0)) {
    return false;
  }

  const [anonymousAddress, nonce, signature] = payloadElements;
  const validSignature = Cipher.verify(anonymousAddress + '-' + nonce, signature);

  const deposit = contracts.BallotDispenserContractInstance.currentMix()[0];
  Winston.debug(`deposit = ${deposit}`);

  if (validSignature) {
    Winston.info('signature is valid');

    // @TODO check if token has been claimed, and if nonce fits in uint16,
    //   to prevent use from burning gas unnecessarily.
    Transaction.contractTransaction(
      contracts.BallotDispenserContractInstance.giveSeededBallot, [
        anonymousAddress,
        nonce,
      ], {
        value: deposit,
        // @TODO check why the default amount of gas (90k) is too low (i.e. why it is so expensive),
        //   or use a better way to estimate the real gas cost.
        gas: 200000,
      });

    return true;
  } else {
    Winston.warn('signature is invalid, ignoring');
    return false;
  }
};

export default redeemer;
