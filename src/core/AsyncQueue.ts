/**
 * A lightweight, promise-based mutex queue to ensure asynchronous operations 
 * are executed sequentially. This is critical for preventing race conditions 
 * in file-based storage systems where read-modify-write cycles must be atomic.
 */
export class AsyncQueue {
    private queue: Promise<any> = Promise.resolve();

    /**
     * Enqueues a task and returns a promise that resolves when the task is complete.
     * @param task An asynchronous function to be executed sequentially.
     */
    public async run<T>(task: () => Promise<T>): Promise<T> {
        const result = this.queue.then(async () => {
            try {
                return await task();
            } catch (error) {
                // We catch errors to ensure the queue doesn't stall on failure
                throw error;
            }
        });

        // Chain the queue to the resulting promise (catching errors to keep it moving)
        this.queue = result.catch(() => {});
        
        return result;
    }
}
