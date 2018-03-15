import importer from 'contracts';
import web3 from 'web3-instance';

const BallotDispenserContract = importer.getContract('BallotDispenser');

/* Provides a means to validate events (requests, payments and handing in of tokens) that occur during
 * the mixing protocol.
 */
class Validator {
  public validateJoinRequest(): boolean {
    BallotDispenserContract.deployed();
    return false;
  }

  public validatePayment(): boolean {
    return false;
  }

  public validateRedeem(): boolean {
    return false;
  }
}
