import * as vscode from 'vscode';

export class Logger {
  private static instance: Logger;
  private logChannel: vscode.LogOutputChannel;

  private constructor() {
    this.logChannel = vscode.window.createOutputChannel('LLM Babysitter', { log: true });
    this.logChannel.info('Nursery is ready. Babysitter is on duty.');
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public info(message: string): void { this.logChannel.info(message); }
  public warn(message: string): void { this.logChannel.warn(message); }
  public error(message: string): void { 
    this.logChannel.error(message);
    vscode.window.showErrorMessage(`LLM Babysitter: ${message}`);
  }
  public debug(message: string): void { this.logChannel.debug(message); }
  public trace(message: string): void { this.logChannel.trace(message); }

  /**
   * legacy log method for backward compatibility
   */
  public log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    switch (level) {
      case 'error': this.error(message); break;
      case 'warn': this.warn(message); break;
      case 'info': default: this.info(message); break;
    }
  }

  public show(): void {
    this.logChannel.show();
  }
}
