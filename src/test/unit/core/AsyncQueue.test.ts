import { describe, it, expect, vi } from 'vitest';
import { AsyncQueue } from '../../../core/AsyncQueue.js';

describe('AsyncQueue Unit Tests', () => {
    it('should execute tasks sequentially', async () => {
        const queue = new AsyncQueue();
        const results: number[] = [];

        const task1 = async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            results.push(1);
            return 1;
        };

        const task2 = async () => {
            results.push(2);
            return 2;
        };

        const [p1, p2] = [queue.run(task1), queue.run(task2)];

        await Promise.all([p1, p2]);

        expect(results).toEqual([1, 2]);
    });

    it('should continue executing tasks even if one fails', async () => {
        const queue = new AsyncQueue();
        const results: string[] = [];

        const task1 = async () => {
            results.push('start1');
            throw new Error('fail');
        };

        const task2 = async () => {
            results.push('start2');
            return 'success';
        };

        const p1 = queue.run(task1).catch(() => 'caught');
        const p2 = queue.run(task2);

        const [r1, r2] = await Promise.all([p1, p2]);

        expect(r1).toBe('caught');
        expect(r2).toBe('success');
        expect(results).toEqual(['start1', 'start2']);
    });

    it('should handle multiple overlapping tasks', async () => {
        const queue = new AsyncQueue();
        const activeTasks: number[] = [];
        const maxConcurrency: number[] = [];

        const createTask = (id: number, delay: number) => async () => {
            activeTasks.push(id);
            maxConcurrency.push(activeTasks.length);
            await new Promise(resolve => setTimeout(resolve, delay));
            activeTasks.splice(activeTasks.indexOf(id), 1);
            return id;
        };

        const tasks = [
            queue.run(createTask(1, 40)),
            queue.run(createTask(2, 10)),
            queue.run(createTask(3, 20))
        ];

        await Promise.all(tasks);

        // Max concurrency should always be 1
        expect(Math.max(...maxConcurrency)).toBe(1);
    });
});
