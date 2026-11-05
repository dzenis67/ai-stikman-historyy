interface RequireContext {
  keys(): string[];
  (id: string): unknown;
}
declare const require: {
  context(directory: string, useSubdirectories: boolean, regExp: RegExp): RequireContext;
};
