import { BufReader } from "../vendor/https/deno.land/std/io/bufio.ts";
import { Buffer } from "../vendor/https/deno.land/std/io/buffer.ts";
import type * as types from "./types.ts";
import { EOFError, ErrorReplyError, InvalidStateError } from "../errors.ts";
import { decoder } from "./_util.ts";

const IntegerReplyCode = ":".charCodeAt(0);
const BulkReplyCode = "$".charCodeAt(0);
const SimpleStringCode = "+".charCodeAt(0);
const ArrayReplyCode = "*".charCodeAt(0);
const ErrorReplyCode = "-".charCodeAt(0);

const MapReplyCode = "%".charCodeAt(0);
const SetReplyCode = "~".charCodeAt(0);

export const replyTypes = {
  Integer: "integer",
  SimpleString: "simple string",
  Array: "array",
  BulkString: "bulk string",
  Map: "map",
  Set: "set",
} as const;

export function unwrapReply(
  reply: types.RedisReplyOrError,
): types.Raw | ErrorReplyError {
  if (reply instanceof ErrorReplyError) {
    return reply;
  }
  return reply.value();
}

export function createSimpleStringReply(
  status: string,
): types.SimpleStringReply {
  return new SimpleStringReply(status);
}

export function readArrayReply(reader: BufReader): Promise<types.ArrayReply> {
  return ArrayReply.decode(reader);
}

export async function readReply(
  reader: BufReader,
): Promise<types.RedisReply> {
  const res = await reader.peek(1);
  if (res === null) {
    throw new EOFError();
  }
  switch (res[0]) {
    case IntegerReplyCode:
      return await IntegerReply.decode(reader);
    case SimpleStringCode:
      return await SimpleStringReply.decode(reader);
    case BulkReplyCode:
      return await BulkReply.decode(reader);
    case ArrayReplyCode:
      return await ArrayReply.decode(reader);
    /* Start of RESP3 part */
    case MapReplyCode:
      return await MapReply.decode(reader);
    case SetReplyCode:
      return await SetReply.decode(reader);
    /* End of RESP3 part */
    case ErrorReplyCode:
      tryParseErrorReply(await readLine(reader));
  }
  throw new InvalidStateError();
}

class IntegerReply implements types.IntegerReply {
  #integer: types.Integer;

  constructor(integer: types.Integer) {
    this.#integer = integer;
  }

  static async decode(reader: BufReader): Promise<types.IntegerReply> {
    const line = await readLine(reader);
    if (line[0] === ":") {
      const str = line.substr(1, line.length - 3);
      return new IntegerReply(parseInt(str));
    }
    tryParseErrorReply(line);
  }

  get type(): "integer" {
    return replyTypes.Integer;
  }

  value(): types.Integer {
    return this.#integer;
  }
}

class BulkReply implements types.BulkReply {
  #buffer?: Uint8Array;

  constructor(buffer: Uint8Array | types.BulkNil) {
    this.#buffer = buffer;
  }

  static nil(): types.BulkReply {
    return new BulkReply(undefined);
  }

  static async decode(reader: BufReader): Promise<types.BulkReply> {
    const line = await readLine(reader);
    if (line[0] !== "$") {
      tryParseErrorReply(line);
    }
    const sizeStr = line.substr(1, line.length - 3);
    const size = parseInt(sizeStr);
    if (size < 0) {
      // nil bulk reply
      return BulkReply.nil();
    }
    const dest = new Uint8Array(size + 2);
    await reader.readFull(dest);
    return new BulkReply(dest);
  }

  get type(): "bulk string" {
    return replyTypes.BulkString;
  }

  value(): types.Bulk {
    return this.#buffer
      ? decoder.decode(this.#buffer.subarray(0, this.#buffer.length - 2))
      : undefined;
  }

  buffer(): Uint8Array | types.BulkNil {
    return this.#buffer?.subarray(0, this.#buffer.length - 2);
  }
}

class SimpleStringReply implements types.SimpleStringReply {
  #status: string;

  constructor(status: string) {
    this.#status = status;
  }

  static async decode(reader: BufReader): Promise<types.SimpleStringReply> {
    const line = await readLine(reader);
    if (line[0] === "+") {
      return new SimpleStringReply(line.substr(1, line.length - 3));
    }
    tryParseErrorReply(line);
  }

  get type(): "simple string" {
    return replyTypes.SimpleString;
  }

  value(): types.SimpleString {
    return this.#status;
  }
}

class ArrayReply implements types.ArrayReply {
  #array: types.ConditionalArray;

  constructor(array: types.ConditionalArray) {
    this.#array = array;
  }

  static async decode(reader: BufReader): Promise<types.ArrayReply> {
    const line = await readLine(reader);
    const argCount = parseInt(line.substr(1, line.length - 3));
    const result: types.ConditionalArray = [];
    for (let i = 0; i < argCount; i++) {
      const reply = await decodeReply(reader);
      result.push(reply.value());
    }
    return new ArrayReply(result);
  }

  get type(): "array" {
    return replyTypes.Array;
  }

  value() {
    return this.#array;
  }
}

class MapReply implements types.MapReply {
  #fields: types.ConditionalArray;

  constructor(fields: types.ConditionalArray) {
    this.#fields = fields;
  }

  static async decode(reader: BufReader): Promise<types.MapReply> {
    const line = await readLine(reader);
    const entryCount = parseInt(line.substr(1, line.length - 3));
    const result: types.ConditionalArray = [];
    for (let i = 0; i < entryCount; i++) {
      const keyReply = await decodeReply(reader);
      const valueReply = await decodeReply(reader);
      result.push(keyReply.value(), valueReply.value());
    }
    return new MapReply(result);
  }

  get type() {
    return replyTypes.Map;
  }

  value() {
    return this.#fields;
  }

  map(): types.ConditionalMap {
    const map = new Map<types.Raw, types.Raw>();
    for (let i = 0; i < this.#fields.length; i += 2) {
      const key = this.#fields[i];
      const value = this.#fields[i + 1];
      map.set(key, value);
    }
    return map;
  }
}

class SetReply implements types.SetReply {
  #members: types.ConditionalArray;

  constructor(members: types.ConditionalArray) {
    this.#members = members;
  }

  static async decode(reader: BufReader): Promise<types.SetReply> {
    const line = await readLine(reader);
    const memberCount = parseInt(line.substr(1, line.length - 3));
    const members = [] as types.ConditionalArray;
    for (let i = 0; i < memberCount; i++) {
      const member = await decodeReply(reader);
      members.push(member.value());
    }
    return new SetReply(members);
  }

  value() {
    return this.#members;
  }

  set() {
    return new Set(this.#members);
  }

  get type() {
    return replyTypes.Set;
  }
}

function tryParseErrorReply(line: string): never {
  const code = line[0];
  if (code === "-") {
    throw new ErrorReplyError(line);
  }
  throw new Error(`invalid line: ${line}`);
}

// TODO Consider using `std/io/bufio.ts` instead
async function readLine(reader: BufReader): Promise<string> {
  const buf = new Uint8Array(1024);
  let loc = 0;
  let d: number | null = null;
  while ((d = await reader.readByte()) && d !== null) {
    if (d === "\r".charCodeAt(0)) {
      const d1 = await reader.readByte();
      if (d1 === "\n".charCodeAt(0)) {
        buf[loc++] = d;
        buf[loc++] = d1;
        return decoder.decode(new Buffer(buf.subarray(0, loc)).bytes());
      }
    }
    buf[loc++] = d;
  }
  throw new InvalidStateError();
}

async function decodeReply(reader: BufReader): Promise<types.RedisReply> {
  const res = await reader.peek(1);
  if (res === null) {
    throw new EOFError();
  }
  switch (res[0]) {
    case SimpleStringCode:
      return SimpleStringReply.decode(reader);
    case BulkReplyCode:
      return BulkReply.decode(reader);
    case IntegerReplyCode:
      return IntegerReply.decode(reader);
    case ArrayReplyCode:
      return ArrayReply.decode(reader);
    case MapReplyCode:
      return MapReply.decode(reader);
    case SetReplyCode:
      return SetReply.decode(reader);
    case ErrorReplyCode:
      tryParseErrorReply(await readLine(reader));
  }
  throw new InvalidStateError();
}
