import importer from 'contracts';
import { instance as web3, Web3 } from 'web3-instance';
import * as Express from 'express';

import * as contracts from './Connector';
import ExpressServer from '../express/ExpressServer';

/* Watcher helps you listen for events on Ethereum dedicated for the mixer server */

export type action = (contract: any, err: any, result: Web3.DecodedLogEntryEvent<any>) => void;

export default class Watcher {
  // Will provide events when new mixes are requested through BallotDispenser contract
  private _mixRequestEvents: Web3.FilterResult;
  private _paymentEvents: Web3.FilterResult; // Will provide events when payments are received at the designated address
  private _redeemServer: ExpressServer;      // Used to listen for (http) redeem requests containing singed mix tokens
  private _voteEvents: Web3.FilterResult;
  private ballotDispenser: any;              // contract involved with exchanging voting pass -> ballot
  private ballotContract: any;               // contract involved with voting

  private applyContract(contract: any, action: action) {
    return (err: Error, result: Web3.LogEntryEvent) => {
      action(contract, err, result as Web3.DecodedLogEntryEvent<any>);
    };
  }

  public constructor() {
    this.ballotContract = contracts.VotingBallotContractInstance;
    this.ballotDispenser = contracts.BallotDispenserContractInstance;

    this._mixRequestEvents = this.ballotDispenser.JoinRequested();
    this._paymentEvents = this.ballotDispenser.FundsTransferred();
    // get all vote events that ever occured
    this._voteEvents = this.ballotContract.Transfer(null, { fromBlock: 0, toBlock: 'latest' });

    this._redeemServer = new ExpressServer({
      app: Express(),
      port: 8080,
      bind: '0.0.0.0',
      useHTTPS: false,
    });
  }

  public isOngoing(): boolean {
    // todo: We should actually compare outstanding JoinAccepted events to see if we should continue
    // with the previous mix parameters, or just start a new one. Currently always start a new mix.
    return false;
  }

  /* Set callback events on mix request events */
  public onMixRequest(action: action) {
    this._mixRequestEvents.watch(this.applyContract(this.ballotDispenser, action));
  }

  /* Set callback function on payment events */
  public onPayment(action: action) {
    this._paymentEvents.watch(this.applyContract(this.ballotDispenser, action));
  }

  /* Set callback function on redeem events
     Callback is called whenever aproperly formatted request is received
      for redeeming a signed token. */
  public onRedeem(action: (payload: Buffer) => Promise<boolean>) {
    // @TODO what to do if the server is already running?
    // Start server if necessary
    if (!this._redeemServer.IsRunning) {
      this._redeemServer.Start();
    }

    // @TODO check if there are errors that we should handle
    this._redeemServer.setRedeemHandler(action);
  }

  /* Set callback function on vote events */
  public onVote(action: action) {
    this._voteEvents.watch(this.applyContract(this.ballotContract, action));
  }

  /* Stop watching events */
  public stopWatching() {
    // tslint:disable:no-empty (for some reason the callback is required in the stopWatching function)
    this._mixRequestEvents.stopWatching(() => { });
    this._paymentEvents.stopWatching(() => { });
    // @TODO should we also set the redeemHandler to null/undefined?
    this._redeemServer.Stop();
  }
}
