import { type Logger, createLogger } from './log';

export class Module {
  started = false;
  protected log: Logger;

  constructor() {
    this.log = createLogger(this.constructor.name);
    this.log.info('created');
  }

  start(): Promise<void> | void {
    this.started = true;
    this.log.info('started');
  }

  stop(): Promise<void> | void {
    if (!this.started) {
      throw new Error('cannot stop a module that is not started');
    }
    this.started = false;
    this.log.info('stopped');
  }
}
