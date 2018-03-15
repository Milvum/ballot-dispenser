import * as Winston from 'winston';
import * as NodeRSA from 'node-rsa';
import web3 from 'web3-instance';
import * as Express from 'express';

import * as Fs from 'fs';

import * as contracts from './ethereum/Connector';
import Watcher from './ethereum/Watcher';
import redeemer from './ethereum/Redeemer';
import * as Transaction from './ethereum/Transaction';
import * as MixState from './ethereum/MixState';
import ExpressServer from './express/ExpressServer';
import { BallotDispenserState, BallotDispenser } from './StateMachine';
import BlockClock from './BlockClock';
import Cipher from './Cipher';
import VoteCounter from './VoteCounter';

const mixerAddress = contracts.BallotDispenserContractInstance.mixer();

const privateKeyData = Fs.readFileSync('data/id_rsa_2048');
const privateKey = new NodeRSA(privateKeyData);

const clock = new BlockClock();
const fsm = new BallotDispenserState();

const acceptedBlindTokens = {}; // TODO: read from blockchain on boot
let currentMix: MixState.MixState;

class App {

  private static async startMix() {
    Winston.info(`Starting a new mix from ${mixerAddress}`);
    // todo: Determine workable params
    const txHash = await Transaction.contractTransaction(contracts.BallotDispenserContractInstance.startMix,
      [10 * Math.pow(10, 16), // deposit in Wei (probably needs to be waaaay more)
        15, // relative blocks from startMix call
        15, // relative blocks from previous deadline
        15, // relative blocks from previous deadline
        15, // previous deadline
        1], // block confirmation waiting time
      // @TODO add automated gas estimation. Not
      // passing gas (lol) leads to not enough
      // gas being sent by web3
      { gas: 200000 });
    const receipt = await Transaction.minedTransaction(txHash);
    return MixState.MixState.fromRaw(contracts.BallotDispenserContractInstance.currentMix());
  }

  private static setupHandlers(watcher: Watcher) {
    watcher.onMixRequest(async (contract, err, result) => {
      if (err) {
        Winston.error(`Join Error: ${err}`);
      } else {
        Winston.info(`Incoming Join Event: ${JSON.stringify(result)}`);
        const destinationAddress = result.args.client;

        const mixToken = result.args.mixToken;

        if (fsm.canHandleJoinRequest()) {
          const data = JSON.stringify(result.args);
          const signature = privateKey.sign(data, 'hex');
          // TODO: Keep list of accepted people /w mixtoken (and TODO: recover on reboot)
          const txHash = await Transaction.contractTransaction(contract.acceptJoin,
            [destinationAddress, signature, true]);
          await Transaction.minedTransaction(txHash);
          acceptedBlindTokens[destinationAddress] = mixToken;
          Winston.info(`Accepted join for ${destinationAddress} token ${result.args.mixToken}`);
        } else {
          const txHash = await Transaction.contractTransaction(contract.rejectJoin, [destinationAddress]);
          await Transaction.minedTransaction(txHash);

          Winston.info(`Rejected join for ${destinationAddress} because of wrong state`);
        }
      }
    });

    watcher.onPayment(async (contract, err, result) => {
      if (err) {
        Winston.error(`Payment error: ${err}`);
      } else {
        Winston.info(`Incoming payment: ${JSON.stringify(result)}`);
        const amount = result.args.value;
        const clientAddress = result.args.client;

        // A hex string starting with 0x
        const blindToken = acceptedBlindTokens[clientAddress];

        if (!fsm.canReceiveDeposit()) {
          // GG scrub
          Winston.error('In wrong state to receive payment, ignoring it');
        } else if (blindToken == null) {
          Winston.error('Client blindToken was not found. Ignoring payment');
        } else if (parseInt(amount, 10) < currentMix.deposit) {
          // @TODO should we check for equality (to catch errors)? or do we not care if they pay too much? :P
          // @TODO don't use a global for currentMix
          Winston.error(`Payment value of ${amount} is lower than the deposit of ${currentMix.deposit}, ignoring it`);
        } else {
          // Remove client from acceptedBlindTokens
          delete acceptedBlindTokens[clientAddress];
          const signature = Cipher.sign(blindToken);

          const txHash = await Transaction.contractTransaction(contract.provideWarranty, [clientAddress, signature]);
          await Transaction.minedTransaction(txHash);
          Winston.info(`Provided warranty for ${clientAddress}: warranty (bT signature) = ${signature}`);
        }
      }
    });
  }

  public static async Main(args: string[]): Promise<number> {
    Winston.remove(Winston.transports.Console);

    // Don't log stuff while testing, it floods the logs.
    if (process.env.NODE_ENV !== 'test') {
      // Set Winston to report to console with timestamps.
      Winston.add(Winston.transports.Console, { timestamp: true });
    }
    const watcher = new Watcher();

    fsm.determineInitialState();

    if (!watcher.isOngoing()) {
      this.setupHandlers(watcher);
      // todo: Determine workable params
      // Set the currentMix global
      currentMix = await App.startMix();
      Winston.info(`Started mix with deposit: ${currentMix.deposit}`);
      clock.startTimer(currentMix);
      fsm.advance(BallotDispenser.WAITING_FOR_TRANSFER_CLIENT);
      clock.deadlineTransferClient().then(() => fsm.advance(BallotDispenser.PROVIDING_WARRANTY));
      clock.deadlineProvideWarranty().then(() => fsm.advance(BallotDispenser.WAITING_FOR_UNBLIND_ADDRESS));
      clock.deadlineUnblindAddress().then(() => fsm.advance(BallotDispenser.DISTRIBUTING_FUNDS));
      clock.deadlineTransferMixer().then(() => fsm.advance(BallotDispenser.DONE));

    }

    Winston.info('Continuing..');
    const logger = (constract, err, result: string) => {
      if (err) {
        Winston.error(err);
      } else {
        Winston.info(result);
      }
    };

    const redeemLogger = (payload: Buffer) => {
      Winston.info(`[RedeemLogger] got request with payload ${payload.toString('utf8')}`);
      return Promise.resolve(true);
    };

    // watcher.onMixRequest(logger);
    // watcher.onPayment(logger);
    watcher.onRedeem(redeemer);
    watcher.onVote(VoteCounter.handleVoteEvent);
    return 0;
  }
}

App.Main(process.argv);

// * The MixToken of the client, the paymnent address and the Mix (parameters)
