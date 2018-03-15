import { instance as web3, Web3 } from 'web3-instance';
import * as Winston from 'winston';
import * as contracts from './Connector';

const mixerAddress = contracts.BallotDispenserContractInstance.mixer();

// Call function fn on the BallotDispenser contract.
// The function will be called with arguments functionArgs.
// The transaction will be sent with optional extra parameters transactionArgs
export const contractTransaction = (fn: Function, functionArgs: any[],
  transactionArgs?: Web3.CallTxDataBase): Promise<string> => {
  return new Promise((resolve, reject) => {
    (web3 as any).personal.unlockAccount(mixerAddress, 'decide-fifty-control-myself');
    functionArgs.push({
      ...transactionArgs,
      // Overwrite from with the mixerAddress
      from: mixerAddress,
    });
    functionArgs.push((err, txHash) => {
      if (!err) {
        resolve(txHash);
      } else {
        throw err;
      }
    });
    fn.apply(null, functionArgs);
  });
};

export const etherTransaction = (transactionRequest: Web3.CallTxDataBase): Promise<string> => {
  return new Promise((resolve, reject) => {
    const txData: Web3.TxData = { from: mixerAddress, ...transactionRequest };
    (web3 as any).personal.unlockAccount(mixerAddress, 'decide-fifty-control-myself');
    web3.eth.sendTransaction(txData, (err, txHash) => {
      if (!err) {
        resolve(txHash);
      } else {
        throw err;
      }
    });
  });
};

// Adapted from
// http://blog.bradlucas.com/posts/2017-08-22-wait-for-an-ethereum-transaction-to-be-mined/
export const minedTransaction = (txHash: string,
  interval: number = 500,
  tries: number = 100): Promise<Web3.TransactionReceipt> => {
  const self = this;
  const transactionReceiptAsync = (resolve, reject) => {
    web3.eth.getTransactionReceipt(txHash, (error, receipt) => {
      if (error) {
        reject(error);
      } else if (receipt == null) {
        if (tries-- <= 0) {
            Winston.error(`Timed out looking for receipt for txhash ${txHash}`);
            // @TODO respond intelligently to a timeout error,
            //   instead of just avoiding a crash.
            resolve('');
        } else {
            setTimeout(
                () => transactionReceiptAsync(resolve, reject),
                interval);
        }
      } else {
        resolve(receipt.toString());
      }
    });
  };

  return new Promise(transactionReceiptAsync);
};
