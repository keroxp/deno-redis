import {
  assert,
  assertEquals,
} from "../vendor/https/deno.land/std/testing/asserts.ts";
import { nextPort, startRedis, stopRedis, TestSuite } from "./test_util.ts";
import { connect } from "../experimental/resp3/mod.ts";

const suite = new TestSuite("RESP3");
const port = nextPort();
const server = await startRedis({ port });
const client = await connect({
  hostname: "127.0.0.1",
  port,
});

suite.beforeEach(async () => {
  await client.flushdb();
});

suite.afterAll(() => {
  stopRedis(server);
  client.close();
});

suite.test("hgetallMap", async () => {
  await client.hset("hash", "foo", "bar");
  await client.hset("hash", "hoge", "piyo");
  const map = await client.hgetallMap("hash");
  assert(map);
  assertEquals(map.size, 2);
  assertEquals(map.get("foo"), "bar");
  assertEquals(map.get("hoge"), "piyo");
});

suite.test("smembersSet", async () => {
  await client.sadd("set", "a", "b", "c");
  const members = await client.smembersSet("set");
  assert(members instanceof Set);
  assertEquals(members.size, 3);
  assert(members.has("a"));
  assert(members.has("b"));
  assert(members.has("c"));
});

suite.runTests();
