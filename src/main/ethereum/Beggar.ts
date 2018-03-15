/** Please kill the beggar in production */
import web3 from 'web3-instance';
import * as Winston from 'winston';

import * as contracts from './Connector';
import * as Transaction from './Transaction';

function giveEther(address: string) {
  Transaction.etherTransaction({
    to: address,
    value: 5000000000000000000,
    gas: 200000,
  });
}

function givePasses(address: string) {
  Transaction.contractTransaction(
    contracts.VotingPassContractInstance.give, [
      address,
    ], {
      gas: 200000,
    });
}

export default (address: string) => {
  givePasses(address);
  giveEther(address);
};
