/**
 * Minimal Foundry globals for importing the module's scripts in Node. Only what module-level code and the tested pure helpers touch;
 * tests that need more set it up themselves.
 */
const ID = "wayfarers-toolkit";
export class Doc {
  constructor(o) { Object.assign(this, o); this.flags ??= {}; }
  getFlag(s, k) { return this.flags[s]?.[k]; }
  async setFlag(s, k, v) { (this.flags[s] ??= {})[k] = v; }
  async unsetFlag(s, k) { delete this.flags[s]?.[k]; }
}
export class Item extends Doc {}
export class Actor extends Doc {
  constructor(o) { super(o); this.items ??= []; }
  async deleteEmbeddedDocuments(_, ids) { this.items = this.items.filter(i => !ids.includes(i.id)); }
  async createEmbeddedDocuments(_, data) { const made = data.map((d, n) => new Item({ ...d, id: `new${this.items.length + n}` })); this.items.push(...made); return made; }
  async update() {}
}
export class RollTable extends Doc {}
export const settings = {};
export const posted = [];
globalThis.Actor = Actor; globalThis.Item = Item; globalThis.RollTable = RollTable;
globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
globalThis.game = {
  user: { isGM: true, id: "gm1" }, users: { activeGM: null, contents: [], filter: () => [] },
  settings: { get: (ns, k) => { if (k in settings) return settings[k]; throw new Error(`setting ${k} not registered`); } },
  modules: { get: () => null }, packs: { get: () => null }, actors: { get: () => null, filter: () => [] }, scenes: [], tables: []
};
const merge = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = (v && typeof v === "object" && !Array.isArray(v)) ? merge(a[k] ?? {}, v) : v; return a; };
globalThis.foundry = { applications: { api: { ApplicationV2: class {} } }, utils: { mergeObject: merge, hasProperty: () => false, deepClone: o => structuredClone(o) } };
globalThis.ChatMessage = { create: async m => { posted.push(m); return m; } };
export { ID };
