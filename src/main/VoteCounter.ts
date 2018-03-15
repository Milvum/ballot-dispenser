import * as Winston from 'winston';
import { Web3 } from 'web3-instance';

export interface ICandidate {
  address: string;
  amount: number;
};

const votes = {};

/* For each vote (Transfer event of VotingBallot) the number of votes linked to the targetaddress is incremented.
 * Non-existent addresses are set to 0 votes.
 */
function handleVoteEvent(contract: any, err: Error, result: Web3.DecodedLogEntryEvent<any>) {
  if (err) {
    Winston.error(`Vote error: ${err}`);
    return;
  }

  Winston.info(`Noticed a vote: ${JSON.stringify(result)}`);
  const targetAddress = result.args.to;
  const value = Number.parseInt(result.args.value);

  if (!(targetAddress in votes)) {
    votes[targetAddress] = 0;
  }
  votes[targetAddress] += value;
}

/* Maps the address->vote obejct of votes to an array of ICandidate */
function getVotes(): ICandidate[] {
  const candidates = Object.keys(votes).map((key) => {
    return { address: key, amount: votes[key] };
  });

  return candidates;
}

export default {
  handleVoteEvent,
  getVotes,
};
