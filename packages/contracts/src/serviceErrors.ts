import { Schema } from "effect";

/** The kinds of failure the app tells apart. */
export const ErrorKind = Schema.Literals([
  "InvalidInput",
  "NotFound",
  "StaleVersion",
  "AccessRefused",
  "Unsupported",
  "MissingDependency",
  "ExecutionFailure",
]);
export type ErrorKind = typeof ErrorKind.Type;

/** A failure as the app receives it. */
export const ServiceError = Schema.Struct({ kind: ErrorKind, message: Schema.String });
export type ServiceError = typeof ServiceError.Type;
