import type { ObjectLike } from "camelcase-keys";
import camelcaseKeys from "camelcase-keys";
import z from "zod";
import { KickAPIError, KickResponseShapeError } from "./errors.js";

export function parseData<T extends ObjectLike | readonly ObjectLike[]>(
  data: unknown,
  Schema: z.ZodType<T>,
) {
  const result = Schema.safeParse(data);
  if (!result.success) throw new KickResponseShapeError(result.error);
  return camelcaseKeys(result.data, { deep: true });
}

export async function handleResponse<
  T extends ObjectLike | readonly ObjectLike[],
>(Schema: z.ZodType<T>, res: Response) {
  if (!res.ok) throw new KickAPIError(res);
  return parseData(await res.json(), Schema);
}
