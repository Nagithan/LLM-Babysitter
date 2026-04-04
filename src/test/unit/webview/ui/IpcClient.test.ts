/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { IpcClient } from '../../../../webview/ui/IpcClient.js';
import { IpcMessageId, AppState, WebviewMessage } from '../../../../types/index.js';

interface MockVscodeApi {
    postMessage: Mock;
    getState: Mock;
    setState: Mock;
}

describe('IpcClient', () => {
    let mockVscodeApi: MockVscodeApi;

    beforeEach(() => {
        mockVscodeApi = {
            postMessage: vi.fn(),
            getState: vi.fn(),
            setState: vi.fn()
        };
        (window as unknown as { acquireVsCodeApi: Mock }).acquireVsCodeApi = vi.fn(() => mockVscodeApi);
    });

    afterEach(() => {
        delete (window as unknown as { acquireVsCodeApi?: Mock }).acquireVsCodeApi;
        vi.clearAllMocks();
    });

    it('should acquire VS Code API on instantiation', () => {
        new IpcClient();
        expect((window as unknown as { acquireVsCodeApi: Mock }).acquireVsCodeApi).toHaveBeenCalled();
    });

    it('should delegate postMessage to vscode api', () => {
        const client = new IpcClient();
        const message: WebviewMessage = { type: IpcMessageId.READY };
        client.postMessage(message);
        expect(mockVscodeApi.postMessage).toHaveBeenCalledWith(message);
    });

    it('should delegate getState to vscode api', () => {
        const client = new IpcClient();
        const state: Partial<AppState> = { selectedFiles: ['test.txt'] };
        mockVscodeApi.getState.mockReturnValue(state);
        
        expect(client.getState()).toEqual(state);
        expect(mockVscodeApi.getState).toHaveBeenCalled();
    });

    it('should delegate setState to vscode api', () => {
        const client = new IpcClient();
        const state: Partial<AppState> = { selectedFiles: ['test.txt'] };
        client.setState(state as AppState);
        expect(mockVscodeApi.setState).toHaveBeenCalledWith(state);
    });

    it('should register message listener', () => {
        const client = new IpcClient();
        const callback = vi.fn();
        const addEventSpy = vi.spyOn(window, 'addEventListener');
        
        client.onMessage(callback);
        expect(addEventSpy).toHaveBeenCalledWith('message', expect.any(Function));
        
        // Simulate message
        const data = { type: 'test' };
        const event = new MessageEvent('message', { data });
        window.dispatchEvent(event);
        
        expect(callback).toHaveBeenCalledWith(data);
    });

    it('should send READY message on ready()', () => {
        const client = new IpcClient();
        client.ready();
        expect(mockVscodeApi.postMessage).toHaveBeenCalledWith({ type: IpcMessageId.READY });
    });
});
