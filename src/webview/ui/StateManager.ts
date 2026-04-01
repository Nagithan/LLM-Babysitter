import { AppState, FileNode } from "../../types/index.js";
import { IpcClient } from "./IpcClient.js";

export class StateManager {
    private state: AppState;
    private fileTree: FileNode[] = [];
    private listeners: ((state: AppState) => void)[] = [];

    constructor(private ipc: IpcClient) {
        this.state = ipc.getState() || {
            prePrompt: '',
            instruction: '',
            postPrompt: '',
            selectedFiles: [],
            favorites: [],
            translations: {}
        };
    }

    public getState(): AppState {
        return this.state;
    }

    public getFileTree(): FileNode[] {
        return this.fileTree;
    }

    public updateState(partial: Partial<AppState>): void {
        this.state = { ...this.state, ...partial };
        this.ipc.setState(this.state);
        this.notify();
    }

    public setFileTree(tree: FileNode[]): void {
        this.fileTree = tree;
        this.notify();
    }

    public subscribe(listener: (state: AppState) => void): void {
        this.listeners.push(listener);
    }

    private notify(): void {
        this.listeners.forEach(l => l(this.state));
    }
}
