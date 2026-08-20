export type Params<T extends Record<string, string>> = {
  params: Promise<T>;
};

export type Search = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
