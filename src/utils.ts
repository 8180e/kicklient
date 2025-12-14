import type { ObjectLike } from "camelcase-keys";
import camelcaseKeys from "camelcase-keys";
import z from "zod";
import { KickAPIError } from "./errors.js";
import decamelizeKeys from "decamelize-keys";

export function parseSchema<T>(
  Schema: z.ZodType<T>,
  data: unknown,
  message = "Unexpected response shape"
) {
  const parsed = Schema.safeParse(data);
  if (!parsed.success) {
    throw new KickAPIError({
      message,
      details: { error: parsed.error.issues, received: data },
    });
  }
  return parsed.data;
}

export function formatData<T extends ObjectLike | readonly ObjectLike[]>(
  Schema: z.ZodType<T>,
  data: unknown
) {
  return camelcaseKeys(parseSchema(Schema, data), { deep: true });
}

export function formatRequestBody<T>(Schema: z.ZodType<T>, body: unknown) {
  const parsedBody = parseSchema(Schema, body, "Request body is invalid");
  return parsedBody && decamelizeKeys(parsedBody);
}
