// demo/scripts/index.js: the demo list. Every goal the demo plays is one
// data module in this folder, keyed by the route id it answers on
// (#/p/<id>). run.js reads the registry and plays whatever it finds; it
// never names a goal itself.
//
// Adding a demo is one file in this folder and one line in this map. Nothing
// else in src/demo/ changes.
import bakery from "./bakery.js";
import climbing from "./climbing.js";
import { defaultedFields, withPlayDefaults } from "./defaults.js";
import discordbot from "./discordbot.js";
import memes from "./memes.js";
import outreach from "./outreach.js";
import shopify from "./shopify.js";

// the order the demo list draws them in: the story the product was designed
// against first, then the goals it was remade for
export const DEMOS = [climbing, bakery, memes, discordbot, outreach, shopify].map(withPlayDefaults);

const BY_ID = new Map(DEMOS.map((s) => [s.id, s]));

export const scriptFor = (id) => (id ? BY_ID.get(id) || null : null);

// what the demo list needs, without playing anything
export const demoList = () => DEMOS.map((s) => ({ id: s.id, title: s.title, request: s.request, goal: s.goal || s.title }));

// what defaults.js had to fill for the scripts that predate those fields
export { defaultedFields };