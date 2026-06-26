export type AppName = "Partner" | "Sørvis" | "CLEOS";

export function parseAppName(app?: string): AppName | undefined {
  switch (app) {
    case "partner":
      return "Partner";
    case "sorvis":
      return "Sørvis";
    case "cleos":
      return "CLEOS";
    default:
      return undefined;
  }
}
