import * as Fs from 'fs';
import * as Express from 'express';
import * as Http from 'http';
import * as Https from 'https';
import * as Winston from 'winston';
import * as BodyParser from 'body-parser';
import * as Helmet from 'helmet';
// import * as Cors from 'cors';
// import * as tempfile from 'tempfile';

import IServer, { IServerOptions } from './IServer';
import Cipher from '../Cipher';
import beg from '../ethereum/Beggar';
import VoteCounter from '../VoteCounter';

export interface IExpressServerOptions extends IServerOptions {
  app: Express.Application;
}

class ExpressServer implements IServer {
  private readonly _app: Express.Application;

  private readonly _routePrefix: string;

  // Define all routes on this instead of _app
  private readonly _router: Express.Router;

  private readonly _port: number;
  // IPv4 address
  private readonly _bind: string;
  // IPv6 address
  private readonly _bind6?: string;

  private _server: Https.Server | Http.Server;
  private _server6: Https.Server | Http.Server;

  // Handler for properly formatted redeem requests
  private _redeemHandler: (payload: Buffer) => Promise<boolean>;

  constructor({
    app,
    routePrefix = '',
    port = 8080,
    bind = '0.0.0.0',
    bind6,
    useHTTPS = false,
    certificateKey,
    certificateFile,
  }: IExpressServerOptions) {
    this._routePrefix = routePrefix;
    this._port = port;
    this._bind = bind;
    this._bind6 = bind6;

    this._router = Express.Router();
    this._app = app;
    this._app.use(`/${this._routePrefix}`, this._router);

    // Init routes
    this.initRoutes();

    // Init servers
    this.initServer(useHTTPS, certificateKey, certificateFile);
  }

  private initRoutes() {
    if (!this._router) {
      Winston.error('Oh gosh, somehow initRoutes got called before express got initialised.');

      return;
    }

    // TODO: CORS is only here for development
    this._router.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    // Converts body to JSON
    this._router.use(BodyParser.json({
      limit: '100KB', // Random number #FDD
    }));

    this._router.use(BodyParser.urlencoded({
      extended: true,
    }));

    // Some secure HTTP header settings, basically secure = true
    this._router.use(Helmet());
    this._router.use(Helmet.noCache());
    this._router.use(Helmet.referrerPolicy());

    /*
    // Feels unnecessary, but skeleton life.
    this._router.use(Cors({
      // Allow cross-origin requests from ..
      origin: Program.production ? [
        'http://46.231.17.4:40404',
        'http://acceptance.tellape',
      ] : '*',
    }));
    */

    // Some random routes for debugging the server //
    this._router.get('/', (req, res) => {
      // A greeting is polite.
      res.send('hello world');
    });

    this._router.post('/hug', (req, res) => {
      if (req.body.hug === undefined) {
        return res.send('Missing param "hug", it can be anything');
      } else if (req.body.hug === 'give me a teapot') {
        return res.sendStatus(418);
      }

      return res.send(`I counter your hug with ${req.body.hug} hug(s)!`);
    });

    // The route for redeem requests
    this._router.post('/redeem', async (req, res, next) => {
      Winston.info('Received redeem');
      const payload: string = req.body.payload;

      // Badly formatted request
      if (!payload) {
        return res.sendStatus(400);
      }

      if (this._redeemHandler) {
        let isValid;

        try {
          isValid = await this._redeemHandler(new Buffer(payload, 'utf8'));
        } catch (err) {
          // Pass error to the error handler
          return next(err);
        }

        // Invalid redeem request: invalid token / signature, or already claimed
        if (!isValid) {
          return res.sendStatus(403);
        }

        // Successful redeem request
        return res.sendStatus(200);
      } else {
        Winston.info('... no redeem handler is set: ignoring the request');
        return res.sendStatus(404);
      }
    });

    this._router.post('/sign', (req, res, next) => {
      const payload: string = req.body.payload;

      if (!payload) {
        return res.sendStatus(400);
      }

      return res.send({ signature: Cipher.sign(payload) });
    });

    this._router.post('/verify', (req, res, next) => {
      const payload: string = req.body.payload;

      if (!payload) {
        return res.sendStatus(400);
      }

      const info = payload.split('-');
      const msg = info[0] + '-' + info[1];
      const signature = info[2];

      Winston.info(`${msg} verified for ${signature}`);
      const verification = Cipher.verify(msg, signature);

      Winston.info(`Sending verification ${verification}`);

      return res.send({ result: verification });
    });

    this._router.post('/beg', (req, res, next) => {
      const payload: string = req.body.payload;

      Winston.info('got beggar: ', payload);

      if (!payload) {
        return res.sendStatus(400);
      }

      // give payload (is address) loads of money and passes
      // In case of malformed payload: gives an UnhandledPromiseRejectionWarning,
      //   but doesn't crash.
      beg(payload);

      return res.sendStatus(200);
    });

    this._router.get('/votes', (req, res, next) => {
      const candidates = VoteCounter.getVotes();

      return res.send(JSON.stringify(candidates));
    });

    // !! Error handler should be the very last middleware / route that is added !!
    // Use error handler that doesn't print the error text in the body, and just returns 500
    this._router.use(this.ErrorHandler);
  }

  /**
   * Helper function to initialise server components.
   * @param useHTTPS whether https should be used
   */
  private initServer(
    useHTTPS: boolean = false,
    certificateKey: string = 'ssl/server-key.pem',
    certificateFile: string = 'ssl/server-cert.pem',
  ) {
    if (useHTTPS) { // Run on https
      try {
        const certification = {
          key: Fs.readFileSync(certificateKey),
          cert: Fs.readFileSync(certificateFile),
        } as Https.ServerOptions;

        this._server = Https.createServer(certification, this._app);

        // Only create IPv6 server if address is provided
        if (this._bind6) {
          this._server6 = Https.createServer(certification, this._app);
        }
      } catch (error) {
        Winston.error(
          'Server init failed',
          error,
          '\n\nThe certificates might be missing, try running "npm run gencert".\n',
        );
      }
    } else { // Run on http
      this._server = Http.createServer(this._app);

      // Only create IPv6 server if address is provided
      if (this._bind6) {
        this._server6 = Http.createServer(this._app);
      }
    }

    // Add event listeners
    this._server.on('error', this.ServerErrorHandler.bind(this, this._server));
    this._server.on('close', this.ServerCloseHandler.bind(this, this._server));
    this._server.on('listening', this.ListeningHandler.bind(this, this._server));

    if (this._server6) {
      this._server6.on('error', this.ServerErrorHandler.bind(this, this._server6));
      this._server6.on('close', this.ServerCloseHandler.bind(this, this._server6));
      this._server6.on('listening', this.ListeningHandler.bind(this, this._server6));
    }
  }

  public Start(): Promise<void> {
    const serverStartPromises: Array<Promise<void>> = [];

    // Start IPv4 server
    const ipv4Server = new Promise<void>((resolve, reject) => {
      if (!this._server) {
        Winston.error('this._server is not initialised.');

        return reject('Server is not initialised');
      }

      try {
        this._server.listen(this._port, this._bind, () => {
          // Server started
          return resolve();
        });
      } catch (error) {
        Winston.error(error);

        // Tell the people above something is wrong.
        reject(error);
      }
    });

    serverStartPromises.push(ipv4Server);

    // IPv6 server is not mandatory.
    if (this._server6) {
      const ipv6Server = new Promise<void>((resolve, reject) => {
        try {
          this._server6.listen(this._port, this._bind6, () => {
            // Server started
            return resolve();
          });
        } catch (error) {
          Winston.error(error);

          // Tell the people above something is wrong.
          reject(error);
        }
      });

      serverStartPromises.push(ipv6Server);
    }

    // Wait for all servers to start
    return Promise.all(serverStartPromises).then(() => {
      return;
    });
  }

  public Stop(): Promise<void> {
    const serverStopPromises: Array<Promise<void>> = [];

    const ipv4Promise = new Promise<void>((resolve, reject) => {
      if (this._server.address() == null) {
        // Don't close if it's not running
        return resolve();
      }

      this._server.close(() => {
        // Server closed
        resolve();
      });
    });

    serverStopPromises.push(ipv4Promise);

    if (this._server6) {
      const ipv6Promise = new Promise<void>((resolve, reject) => {
        // Don't close if it's not running
        if (this._server6.address() == null) {
          return resolve();
        }

        this._server6.close(() => {
          // Server closed
          resolve();
        });
      });

      serverStopPromises.push(ipv6Promise);
    }

    return Promise.all(serverStopPromises).then(() => {
      return;
    });
  }

  public get IsRunning(): boolean {
    // The IPv4 server is always started,
    // so it's a good assumption if this server is running, then both are running fine.
    // Otherwise an error/warning will be shown elsewhere.
    // A server is listening if it has an address, otherwise it will return null.
    return this._server && this._server.address() != null;
  }

  /* Handler is called whenever a properly formatted request is received
      for redeeming a signed token.
     It should return a Promise that resolves with true iff the token was redeemed successfully */
  public setRedeemHandler(handler: (payload: Buffer) => Promise<boolean>) {
    this._redeemHandler = handler;
  }

  private ServerErrorHandler(server: Http.Server | Https.Server, err: Error): void {
    Winston.error(err.message);
  }

  private ServerCloseHandler(server: Http.Server | Https.Server): void {
    // Server closed for some reason
    Winston.info('Server closed');
  }

  private ListeningHandler(server: Http.Server | Https.Server): void {
    // Print server info based on server type
    if (server.address().family === 'IPv4') {
      Winston.info('Server listening on %s:%d',
        server.address().address,
        server.address().port);
    } else if (server.address().family === 'IPv6') {
      Winston.info('Server listening on [%s]:%d',
        server.address().address,
        server.address().port);
    }
  }

  // Implements Express.ErrorRequestHandler
  private ErrorHandler(err: any, req: Express.Request, res: Express.Response, next: Express.NextFunction): any {
    Winston.warn('Got an error from while handling a request:');
    Winston.warn(err);

    res.sendStatus(500);
  }
}

export default ExpressServer;
