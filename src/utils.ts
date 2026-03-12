import type { ObjectLike } from "camelcase-keys";
import camelcaseKeys from "camelcase-keys";
import z from "zod";
import { KickAPIError, KickResponseShapeError } from "./errors.js";

export async function handleResponse<
  T extends ObjectLike | readonly ObjectLike[],
>(Schema: z.ZodType<T>, res: Response) {
  if (!res.ok) throw new KickAPIError(res);
  const parsed = Schema.safeParse(await res.json());
  if (!parsed.success) throw new KickResponseShapeError(parsed.error);
  return camelcaseKeys(parsed.data, { deep: true });
}
