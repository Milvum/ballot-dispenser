interface IServer {
  Start(): Promise<void>;
  Stop(): Promise<void>;
  readonly IsRunning: boolean;
}

export interface IServerOptions {
  // Added before all routes. Do not include a starting or ending slash.
  routePrefix?: string;
  port?: number;
  bind?: string;
  bind6?: string;
  useHTTPS?: boolean;
  certificateKey?: string;
  certificateFile?: string;
}

export default IServer;
