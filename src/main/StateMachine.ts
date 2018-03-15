import {TypeState} from 'typestate';
import {MixState} from './ethereum/MixState';
import * as Winston from 'winston';

export enum BallotDispenser {
  UNKNOWN,
  NO_MIX,
  WAITING_FOR_TRANSFER_CLIENT,
  PROVIDING_WARRANTY,
  WAITING_FOR_UNBLIND_ADDRESS,
  DISTRIBUTING_FUNDS,
  DONE,
}

export class BallotDispenserState {
  private fsm: TypeState.FiniteStateMachine<BallotDispenser>;

  constructor() {
    this.fsm = new TypeState.FiniteStateMachine<BallotDispenser>(BallotDispenser.UNKNOWN);

    // We can only go forward in states
    this.fsm.from(BallotDispenser.NO_MIX).to(BallotDispenser.WAITING_FOR_TRANSFER_CLIENT);
    this.fsm.from(BallotDispenser.WAITING_FOR_TRANSFER_CLIENT).to(BallotDispenser.PROVIDING_WARRANTY);
    this.fsm.from(BallotDispenser.PROVIDING_WARRANTY).to(BallotDispenser.WAITING_FOR_UNBLIND_ADDRESS);
    this.fsm.from(BallotDispenser.WAITING_FOR_UNBLIND_ADDRESS).to(BallotDispenser.DISTRIBUTING_FUNDS);
    this.fsm.from(BallotDispenser.DISTRIBUTING_FUNDS).to(BallotDispenser.DONE);

    // The unknown state exists to make sure we can initialize without knowing anything
    this.fsm.fromAny(BallotDispenser).to(BallotDispenser.UNKNOWN);
    this.fsm.from(BallotDispenser.UNKNOWN).toAny(BallotDispenser);
  }

  public advance(state: BallotDispenser): void {
    Winston.info(`Advancing state from ${this.loggingTag()} to ${BallotDispenser[state.toString()]}`);
    this.fsm.go(state);
  }

  public loggingTag(): string {
    return BallotDispenser[this.fsm.currentState.toString()];
  }

  public determineInitialState() {
    if (!this.fsm.is(BallotDispenser.UNKNOWN)) {
      throw new Error(`Trying to determine state while we are in state ${this.loggingTag()}`);
    }
    // TODO: Actually look at existing data to determine state
    this.fsm.go(BallotDispenser.NO_MIX);
  }

  public canHandleJoinRequest(): boolean {
    // return this.fsm.is(BallotDispenser.WAITING_FOR_TRANSFER_CLIENT);
    return true;
  }

  public canReceiveDeposit() {
    // return this.fsm.is(BallotDispenser.WAITING_FOR_TRANSFER_CLIENT);
    return true;
  }

  public provideWarranty(req: any) {
    // TODO: integrate with
  }

}
