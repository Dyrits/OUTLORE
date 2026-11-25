import { controlStyles } from "./controlStyles";
import { messageStyles } from "./messageStyles";
import { treeStyles } from "./treeStyles";

/** The styles every screen shares, in the Sketchbook look: ink outlines, hand-cut corners, flat lifts. */
export const styles = { ...controlStyles, ...messageStyles, ...treeStyles };
