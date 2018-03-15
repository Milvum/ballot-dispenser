import * as Winston from 'winston';
import web3 from 'web3-instance';
import * as Fs from 'fs';
import * as EthereumBlocks from 'ethereum-blocks';

import {IMixState} from './ethereum/MixState';

export default class BlockClock {
  private blocks: any;
  private blindCoinDescriptor: IMixState;
  private initialBlock: Promise<number>;

  constructor() {
    this.blocks = new EthereumBlocks({ web3 });

    // This promise will only be resolved once we have successfully received mined blocks.
    this.initialBlock = new Promise((resolve, reject) => {
      this.blocks.registerHandler('initBlock', (eventType, blockId, data) => {
        resolve(data.number);
        this.blocks.deregisterHandler('initBlock');
      });
    });
  }

  // Does not return a Promise, as all work-flows depend on the initialBlock, which is only set once
  // ethereum-blocks starts listening.
  public startTimer(state: IMixState) {
    this.blindCoinDescriptor = state;
    this.blocks.start()
      .then((started) => {
        Winston.info( started ? 'Started' : 'Already running');
      })
      .catch((err) => {
        /* error */
        Winston.error( this.blocks.isRunning );
      });
  }

  private genericBlindCoindDeadline(name, offset): Promise<void> {
    return new Promise((resolve, reject) => {
      this.blocks.registerHandler(name, (eventType, blockId, data) => {
        this.initialBlock.then((initialBlock) => {
          if (data.number - initialBlock >= offset) {
            resolve();
            this.blocks.deregisterHandler(name);
          }
        });
      });
    });
  }

  public deadlineTransferClient(): Promise<void> {
    return this.genericBlindCoindDeadline('deadlineTransferClient',
                                          this.blindCoinDescriptor.deadlineTransferClient);
  }

  public deadlineProvideWarranty(): Promise<void> {
    return this.genericBlindCoindDeadline('deadlineProvideWarranty',
                                          this.blindCoinDescriptor.deadlineTransferClient +
                                          this.blindCoinDescriptor.deadlineProvideWarranty);
  }

  public deadlineUnblindAddress(): Promise<void> {
    return this.genericBlindCoindDeadline('deadlineUnblindAddress',
                                          this.blindCoinDescriptor.deadlineTransferClient +
                                          this.blindCoinDescriptor.deadlineProvideWarranty +
                                          this.blindCoinDescriptor.deadlineUnblindAddress);
  }

  public deadlineTransferMixer(): Promise<void> {
    return this.genericBlindCoindDeadline('deadlineTransferMixer',
                                          this.blindCoinDescriptor.deadlineTransferClient +
                                          this.blindCoinDescriptor.deadlineProvideWarranty +
                                          this.blindCoinDescriptor.deadlineUnblindAddress +
                                          this.blindCoinDescriptor.deadlineTransferClient);
  }
}
