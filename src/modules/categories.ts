import z from "zod";
import { KickAPIClient } from "../api-client.js";
import type { GetLivestreamsParams } from "./livestreams.js";

interface GetCategoriesOptions {
  limit?: number;
}

interface GetCategoriesParams extends GetCategoriesOptions {
  names?: string[];
  tags?: string[];
}

interface GetCategoriesByIdsParams extends GetCategoriesOptions {
  ids: number[];
}

const CategoriesSchema = z.array(
  z.object({ id: z.number(), name: z.string(), thumbnail: z.string() }),
);

export class CategoriesAPI extends KickAPIClient {
  private async *getCategoriesData(params: URLSearchParams, limit?: number) {
    if (limit) params.set("limit", limit.toString());

    const gen = this.getPaginatedData(
      "/v2/categories",
      params,
      CategoriesSchema,
    );

    for await (const page of gen) {
      yield page.map((category) => ({
        ...category,
        getLivestreams: (params: Omit<GetLivestreamsParams, "categoryId">) =>
          this.client.livestreams.getLivestreams({
            ...params,
            categoryId: category.id,
          }),
      }));
    }
  }

  getCategories({ names = [], tags = [], limit }: GetCategoriesParams) {
    const params = new URLSearchParams();
    for (const name of names) params.append("name", name);
    for (const tag of tags) params.append("tag", tag);
    return this.getCategoriesData(params, limit);
  }

  getCategoriesByIds({ ids, limit }: GetCategoriesByIdsParams) {
    const params = new URLSearchParams();
    for (const id of ids) params.append("id", id.toString());
    return this.getCategoriesData(params, limit);
  }
}
