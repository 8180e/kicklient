import type { ObjectLike } from "camelcase-keys";
import camelcaseKeys from "camelcase-keys";
import z from "zod";

export function parseSchema<T>(Schema: z.ZodType<T>, data: unknown) {
  const parsed = Schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      "Unexpected response shape: " +
        parsed.error +
        "\nReceived: " +
        JSON.stringify(data, undefined, 2)
    );
  }
  return parsed.data;
}

export function formatData<T extends ObjectLike | readonly ObjectLike[]>(
  Schema: z.ZodType<T>,
  data: unknown
) {
  return camelcaseKeys(parseSchema(Schema, data), { deep: true });
}

export function createResponseSchema<T>(data: z.ZodType<T>) {
  return z.object({ data });
}
