import type { ObjectLike } from "camelcase-keys";
import camelcaseKeys from "camelcase-keys";
import z from "zod";
import { KickAPIError } from "./errors.js";

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
