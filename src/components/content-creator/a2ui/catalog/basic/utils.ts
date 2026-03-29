export const LEAF_MARGIN = "8px";
export const CONTAINER_PADDING = "16px";
export const STANDARD_BORDER = "1px solid rgb(226 232 240)";
export const STANDARD_RADIUS = "20px";

export function mapJustify(value?: string): string {
  switch (value) {
    case "center":
      return "center";
    case "end":
      return "flex-end";
    case "spaceAround":
      return "space-around";
    case "spaceBetween":
      return "space-between";
    case "spaceEvenly":
      return "space-evenly";
    case "stretch":
      return "stretch";
    default:
      return "flex-start";
  }
}

export function mapAlign(value?: string): string {
  switch (value) {
    case "start":
      return "flex-start";
    case "center":
      return "center";
    case "end":
      return "flex-end";
    default:
      return "stretch";
  }
}
