/**
 * Minimal generic object pool for frequently allocated gameplay objects.
 * `create` builds new instances, `reset` returns released instances to a reusable state.
 */
export class ObjectPool<T> {
  private readonly items: T[] = [];

  constructor(
    private readonly create: () => T,
    private readonly reset: (item: T) => void
  ) {}

  /** Returns a pooled instance or creates a new one when the pool is empty. */
  acquire(): T {
    return this.items.pop() ?? this.create();
  }

  /** Resets and stores an instance for future reuse. */
  release(item: T): void {
    this.reset(item);
    this.items.push(item);
  }

  /** Number of currently stored reusable instances. */
  get size(): number {
    return this.items.length;
  }
}
