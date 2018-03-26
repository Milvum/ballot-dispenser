# [StemApp](https://milvum.github.io/stemapp/)

At the end of 2016 we started our journey with the goal: making digital voting possible for The Netherlands. In co-creation with five municipalities, we worked together to enable citizen participation on the blockchain. We believe this is a perfect step for making digital voting on the blockchain a reality. We have worked hard to realize the project and are pleased that a first version is now available for further development. That is why we are now doing an Open Source release of our StemApp project. We invite developers and security researchers to help The Netherlands in the next phase of digital voting. We be

Please mention [Milvum](https://milvum.com) in communications when using this code.

# Ballot Dispenser

This is the ballot dispenser service that exchanges voting passes for voting ballots. It uses a modified version of the [Blindcoin protocol](http://fc15.ifca.ai/preproceedings/bitcoin/paper_3.pdf) to do so. This service has multiple responsibilities:

1. It listens to the BallotDispenser contract (see the contracts project) for events and reacts to them.
1. It listens to http requests on `/beg` and gives Ether and a voting pass to the given wallet.
1. It listens to http requests on `/redeem` and gives a voting ballot if a correctly signed warranty is provided. 
1. It listens to http requests on `/votes` and returns the amount of votes that have been cast so far to each wallet.

The HTTP requests are merely temporary, they were implemented for convenience of a demo. Eventually `/beg` should be taken care of by authorised people handing out Voting passes (e.g. using [Overseer](https://github.com/Milvum/contracts). `/redeem` should be replaced by [Whisper](https://github.com/ethereum/wiki/wiki/Whisper) (or some other anonymous communication protocol). Finally, `/votes` can be taken care of by everyone with access to the ethereum chain (perhaps a stand-alone server of [stemdashboard](https://github.com/Milvum/stemdashboard)). 

## StemApp-stack dependencies
This project depends on the following StemApp projects:
* web3j-instance (npm module)
* contracts (npm module)
  * also requires the adresses of the deployed smart contracts
  
## Starting the server
This project is meant to run on a server, or in a terminal on your local computer. To get it running, complete the following steps:

1. Ensure `data/metadata.json` contains the correct addresses (you can obtain them by running `test-deploy` of [contracts](https://github.com/Milvum/contracts))
1. Run `npm install`
1. Run `npm build`
1. Run `npm start`

__Make sure that the server is running whenever you start one of the StemApp-stack projects that depend on it.__

## Disclaimer

The project in the current state is not market ready and thus should only be used for pilots or testing. In its current state the StemApp is not yet fully tested and not entirely secure (see open issues in the [whitepaper](https://milvum.com/en/download-stemapp-whitepaper/)). This version is also not yet ready for a release on the public Ethereum network. Milvum is not accountable for the use of the StemApp in any way, and the possible outcomes this may have.
