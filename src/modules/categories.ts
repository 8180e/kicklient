import type { AppClientOptions, UserClientOptions } from "../client.js";

export class CategoriesAPI {
  constructor(private readonly options: AppClientOptions | UserClientOptions) {}
}
