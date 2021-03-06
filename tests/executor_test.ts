import { BulkReply, replyTypes } from "../mod.ts";
import { assertEquals } from "../vendor/https/deno.land/std/testing/asserts.ts";
import {
  newClient,
  nextPort,
  startRedis,
  stopRedis,
  TestSuite,
} from "./test_util.ts";

const suite = new TestSuite("executor");
const port = nextPort();
const server = await startRedis({ port });
const opts = { hostname: "127.0.0.1", port };
const client = await newClient(opts);

suite.afterAll(() => {
  stopRedis(server);
  client.close();
});

suite.test("simple, string, and integer replies", async () => {
  // simple string
  {
    const reply = await client.executor.exec("SET", "key", "a");
    assertEquals(reply.type, replyTypes.SimpleString);
    assertEquals(reply.value(), "OK");
  }

  // bulk string
  {
    const reply = await client.executor.exec("GET", "key");
    assertEquals(reply.type, replyTypes.BulkString);
    assertEquals(reply.value(), "a");
  }

  // integer
  {
    const reply = await client.executor.exec("EXISTS", "key");
    assertEquals(reply.type, replyTypes.Integer);
    assertEquals(reply.value(), 1);
  }
});

suite.test("get the raw data as Uint8Array", async () => {
  const encoder = new TextEncoder();
  await client.set("key", encoder.encode("hello"));
  const reply = await client.executor.exec("GET", "key");
  assertEquals(reply.type, replyTypes.BulkString);
  assertEquals((reply as BulkReply).buffer(), encoder.encode("hello"));
});

suite.runTests();
