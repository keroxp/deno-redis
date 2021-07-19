import { ErrorReplyError } from "../mod.ts";
import type { Bulk, SimpleString } from "../protocol/mod.ts";
import {
  assert,
  assertEquals,
} from "../vendor/https/deno.land/std/testing/asserts.ts";
import {
  newClient,
  nextPort,
  startRedis,
  stopRedis,
  TestSuite,
} from "./test_util.ts";

const suite = new TestSuite("pipeline");
const port = nextPort();
const server = await startRedis({ port });
const opts = { hostname: "127.0.0.1", port };

suite.afterAll(() => {
  stopRedis(server);
});

suite.test("testPipeline", async () => {
  const client = await newClient(opts);
  const pl = client.pipeline();
  await Promise.all([
    pl.ping(),
    pl.ping(),
    pl.set("set1", "value1"),
    pl.set("set2", "value2"),
    pl.mget("set1", "set2"),
    pl.del("set1"),
    pl.del("set2"),
  ]);
  const ret = await pl.flush();
  assertEquals(ret.length, 7);
  assertEquals(ret[0], "PONG");
  assertEquals(ret[1], "PONG");
  assertEquals(ret[2], "OK");
  assertEquals(ret[3], "OK");
  assertEquals(ret[4], ["value1", "value2"]);
  assertEquals(ret[5], 1);
  assertEquals(ret[6], 1);
  client.close();
});

suite.test("testTx", async () => {
  const client = await newClient(opts);
  const tx1 = client.tx();
  const tx2 = client.tx();
  const tx3 = client.tx();
  await client.del("key");
  await Promise.all<unknown>([
    tx1.get("key"),
    tx1.incr("key"),
    tx1.incr("key"),
    tx1.incr("key"),
    tx1.get("key"),
    //
    tx2.get("key"),
    tx2.incr("key"),
    tx2.incr("key"),
    tx2.incr("key"),
    tx2.get("key"),
    //
    tx3.get("key"),
    tx3.incr("key"),
    tx3.incr("key"),
    tx3.incr("key"),
    tx3.get("key"),
  ]);
  const rep1 = await tx1.flush();
  const rep2 = await tx2.flush();
  const rep3 = await tx3.flush();
  assertEquals(
    parseInt(rep1[4] as SimpleString),
    parseInt(rep1[0] as SimpleString) + 3,
  );
  assertEquals(
    parseInt(rep2[4] as SimpleString),
    parseInt(rep2[0] as SimpleString) + 3,
  );
  assertEquals(
    parseInt(rep3[4] as SimpleString),
    parseInt(rep3[0] as SimpleString) + 3,
  );
  client.close();
});

suite.test("pipeline in concurrent", async () => {
  {
    const client = await newClient(opts);
    const tx = client.pipeline();
    const promises: Promise<unknown>[] = [];
    await client.del("a", "b", "c");
    for (const key of ["a", "b", "c"]) {
      promises.push(tx.set(key, key));
    }
    promises.push(tx.flush());
    for (const key of ["a", "b", "c"]) {
      promises.push(tx.get(key));
    }
    promises.push(tx.flush());
    const res = await Promise.all(promises) as [
      string,
      string,
      string,
      [SimpleString, SimpleString, SimpleString],
      string,
      string,
      string,
      [Bulk, Bulk, Bulk],
    ];

    assertEquals(res.length, 8);
    assertEquals(res[0], "OK"); // set(a)
    assertEquals(res[1], "OK"); // set(b)
    assertEquals(res[2], "OK"); // set(c)

    // flush()
    assertEquals(res[3], ["OK", "OK", "OK"]);

    assertEquals(res[4], "OK"); // get(a)
    assertEquals(res[5], "OK"); // get(b)
    assertEquals(res[6], "OK"); // get(c)

    // flush()
    assertEquals(res[7], ["a", "b", "c"]);

    client.close();
  }
});

suite.test("error while pipeline", async () => {
  const client = await newClient(opts);
  const tx = client.pipeline();
  tx.set("a", "a");
  tx.eval("var", ["k"], ["v"]);
  tx.get("a");
  const resp = await tx.flush();
  assertEquals(resp.length, 3);
  assertEquals(resp[0], "OK");
  assert(resp[1] instanceof ErrorReplyError);
  assertEquals(resp[2], "a");
  client.close();
});

suite.runTests();
