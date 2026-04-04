/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { IpcClient } from '../../../webview/ui/IpcClient.js';
import { StateManager } from '../../../webview/ui/StateManager.js';
import { TestUtils } from '../../testUtils.js';

describe('StateManager Webview Unit Tests', () => {
    let mockIpc: { getState: Mock; setState: Mock };
    let manager: StateManager;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockIpc = {
            getState: vi.fn().mockReturnValue(undefined),
            setState: vi.fn()
        };
        manager = new StateManager(mockIpc as unknown as IpcClient);
    });

    it('should initialize with default state if persistence is empty', () => {
        const state = manager.getState();
        expect(state.selectedFiles).toEqual([]);
        expect(state.prePrompt).toBe('');
    });

    it('should notify subscribers on state update', () => {
        const listener = vi.fn();
        manager.subscribe(listener);

        manager.updateState({ prePrompt: 'Hello' });

        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ prePrompt: 'Hello' }));
        expect(mockIpc.setState).toHaveBeenCalled();
    });

    it('should merge partial updates correctly', () => {
        manager.updateState({ prePrompt: 'Part 1' });
        manager.updateState({ postPrompt: 'Part 2' });

        const state = manager.getState();
        expect(state.prePrompt).toBe('Part 1');
        expect(state.postPrompt).toBe('Part 2');
    });

    it('should manage file tree independently and notify', () => {
        const listener = vi.fn();
        manager.subscribe(listener);

        const mockTree = [{ name: 'src', relativePath: 'src', isDirectory: true, children: [] }];
        manager.setFileTree(mockTree);

        expect(manager.getFileTree()).toEqual(mockTree);
        expect(listener).toHaveBeenCalled();
    });

    it('should initialize with state from IPC if available', () => {
        const initialState = { 
            prePrompt: 'from ipc',
            instruction: '',
            postPrompt: '',
            selectedFiles: [],
            favorites: [],
            translations: {}
        };
        mockIpc.getState.mockReturnValue(initialState);
        const newManager = new StateManager(mockIpc as unknown as IpcClient);
        
        expect(newManager.getState()).toEqual(initialState);
    });

    it('should notify multiple subscribers', () => {
        const l1 = vi.fn();
        const l2 = vi.fn();
        manager.subscribe(l1);
        manager.subscribe(l2);

        manager.updateState({ instruction: 'Test' });

        expect(l1).toHaveBeenCalled();
        expect(l2).toHaveBeenCalled();
    });
});
