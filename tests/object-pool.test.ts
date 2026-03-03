import { describe, expect, it, vi } from "vitest";
import { ObjectPool } from "../src/core/ObjectPool";

describe("ObjectPool", () => {
  it("reuses released instances and calls reset", () => {
    let id = 0;
    const reset = vi.fn<(value: { id: number }) => void>();
    const pool = new ObjectPool(
      () => ({ id: ++id }),
      (value) => reset(value)
    );

    const first = pool.acquire();
    expect(first.id).toBe(1);
    expect(pool.size).toBe(0);

    pool.release(first);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(pool.size).toBe(1);

    const second = pool.acquire();
    expect(second).toBe(first);
    expect(pool.size).toBe(0);
  });

  it("creates new instances when pool is empty", () => {
    let created = 0;
    const pool = new ObjectPool(
      () => ({ index: created++ }),
      () => undefined
    );

    const a = pool.acquire();
    const b = pool.acquire();

    expect(a).not.toBe(b);
    expect(created).toBe(2);
  });
});
