import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { Logger } from '../../../core/Logger.js';

describe('Logger Unit Tests', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset Singleton instance for clean tests
        (Logger as any).instance = undefined;
    });

    it('should be a singleton', () => {
        const l1 = Logger.getInstance();
        const l2 = Logger.getInstance();
        expect(l1).toBe(l2);
    });

    it('should create an output channel upon initialization', () => {
        Logger.getInstance();
        expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('LLM Babysitter', { log: true });
    });

    it('should log info messages to the channel', () => {
        const logger = Logger.getInstance();
        logger.info('test info');
        
        const mockChannel = (vscode.window.createOutputChannel as any).mock.results[0].value;
        expect(mockChannel.info).toHaveBeenCalledWith('test info');
    });

    it('should log error messages and show error message to user', () => {
        const logger = Logger.getInstance();
        logger.error('critical failure');
        
        const mockChannel = (vscode.window.createOutputChannel as any).mock.results[0].value;
        expect(mockChannel.error).toHaveBeenCalledWith('critical failure');
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('LLM Babysitter: critical failure');
    });

    it('should show the output channel', () => {
        const logger = Logger.getInstance();
        logger.show();
        
        const mockChannel = (vscode.window.createOutputChannel as any).mock.results[0].value;
        expect(mockChannel.show).toHaveBeenCalled();
    });

    it('should use correct log levels in the generic log method', () => {
        const logger = Logger.getInstance();
        const mockChannel = (vscode.window.createOutputChannel as any).mock.results[0].value;

        logger.log('msg1', 'info');
        expect(mockChannel.info).toHaveBeenCalledWith('msg1');

        logger.log('msg2', 'warn');
        expect(mockChannel.warn).toHaveBeenCalledWith('msg2');

        logger.log('msg3', 'error');
        expect(mockChannel.error).toHaveBeenCalledWith('msg3');
    });
});
