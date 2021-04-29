import { ErrorReplyError } from "../errors.ts";

/**
 * @see https://redis.io/topics/protocol
 */

export type RedisValue = string | number | Uint8Array;

/**
 * @description Represents the type of the value returned by `SimpleStringReply#value()`.
 */
export type SimpleString = string;

/**
 * @description Represents the type of the value returned by `IntegerReply#value()`.
 */
export type Integer = number;

/**
 * @description Represents the type of the value returned by `BulkReply#value()`.
 */
export type Bulk = BulkString | BulkNil;

/**
 * @description Represents the **bulk string** type in the RESP2 protocol.
 */
export type BulkString = string;

/**
 * @description Represents the **null bulk string** in the RESP2 protocol.
 */
export type BulkNil = undefined;

/**
 * @description Represents the some type in the RESP2/RESP3 protocol.
 */
export type Raw =
  | SimpleString
  | Integer
  | Bulk
  | ConditionalArray
  | ConditionalMap
  | ConditionalSet;

export type Binary = Uint8Array;

/**
 * @description Represents the type of the value returned by `ArrayReply#value()`.
 */
export type ConditionalArray = Raw[];

/**
 * @description Represents the type of the value returned by `MapReply#map()`.
 */
export type ConditionalMap = Map<Raw, Raw>;

/**
 * @description Represents the type of the value returned by `SetReply#set()`.
 */
export type ConditionalSet = Set<Raw>;

export type RedisReply =
  | IntegerReply
  | BulkReply
  | SimpleStringReply
  | ArrayReply
  // RESP3
  | MapReply
  | SetReply;

export type RedisReplyOrError = RedisReply | ErrorReplyError;

// TODO(uki00a): Add `attributes()` methods when implementing RESP3
export interface Reply<T> {
  type: string;
  value(): T;
}

/**
 * @description Represents the **integer** reply in the RESP2 protocol.
 */
export interface IntegerReply extends Reply<Integer> {
  type: "integer";
  value(): Integer;
}

/**
 * @description Represents the **bulk string** or **null bulk string** reply in the RESP2 protocol.
 */
export interface BulkReply extends Reply<Bulk> {
  type: "bulk string";
  value(): Bulk;
  buffer(): Binary | BulkNil;
}

/**
 * @description Represents the **simple string** reply in the RESP2 protocol.
 */
export interface SimpleStringReply extends Reply<SimpleString> {
  type: "simple string";
  value(): SimpleString;
}

/**
 * @description Represents the **array** reply in the RESP2 protocol.
 */
export interface ArrayReply extends Reply<ConditionalArray> {
  type: "array";
  value(): ConditionalArray;
}

/**
 * @description Represents the **map** reply in the RESP3 protocol.
 */
export interface MapReply extends Reply<ConditionalArray> {
  type: "map";
  value(): ConditionalArray;
  map(): ConditionalMap;
}

export interface SetReply extends Reply<ConditionalArray> {
  type: "set";
  value(): ConditionalArray;
  set(): ConditionalSet;
}
