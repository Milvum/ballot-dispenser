import importer from 'contracts';
import {Validator} from '../Validator';
import web3 from 'web3-instance';

const BallotDispenserContract = web3.eth.contract(importer.getContractInfo('BallotDispenser').abi);
const VotingPassContract = web3.eth.contract(importer.getContractInfo('VotingPass').abi);
const VotingBallotContract = web3.eth.contract(importer.getContractInfo('VotingBallot').abi);

interface IMetadata {
   BallotDispenser: string;
   Migrations: string;
   VotingBallot: string;
   VotingPass: string;
}

// tslint:disable-next-line:no-var-requires
const metaRaw = require('../../../data/metadata.json');
const validator = new Validator<IMetadata>(metaRaw, [
  Validator.stringValidationRule<IMetadata>('BallotDispenser'),
  Validator.stringValidationRule<IMetadata>('Migrations'),
  Validator.stringValidationRule<IMetadata>('VotingBallot'),
  Validator.stringValidationRule<IMetadata>('VotingPass'),
]);

export const BallotDispenserContractInstance = BallotDispenserContract.at(validator.validate().BallotDispenser) as any;
export const VotingPassContractInstance = VotingPassContract.at(validator.validate().VotingPass) as any;
export const VotingBallotContractInstance = VotingBallotContract.at(validator.validate().VotingBallot) as any;
