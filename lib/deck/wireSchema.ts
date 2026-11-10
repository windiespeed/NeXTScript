/**
 * JSON Schema for structured outputs, built from DeckSchema.
 *
 * Structured outputs accept a subset of JSON Schema: types, properties/required, items, enum,
 * const, anyOf/allOf, $ref/$defs, a few string formats, minItems of 0 or 1, and
 * additionalProperties: false. Length and count limits aren't enforced by the grammar, so they're
 * written into each field's description in plain words ("At most 130 characters."), where the
 * model reads them, and DeckSchema checks them when the response comes back.
 *
 * The SDK's own zodOutputFormat helper does a similar conversion, but the installed version also
 * moves `enum` and `const` into descriptions, which would leave the slide `type` discriminator and
 * callout variants unenforced. This keeps them.
 */

import { z } from "zod";

type Json = Record<string, unknown>;

const KEEP_FORMATS = new Set(["date-time", "time", "date", "duration", "email", "hostname", "uri", "ipv4", "ipv6", "uuid"]);

function limitsText(node: Json): string[] {
  const out: string[] = [];
  const n = (k: string) => (typeof node[k] === "number" ? (node[k] as number) : undefined);
  const minLen = n("minLength");
  const maxLen = n("maxLength");
  if (maxLen !== undefined) out.push(`At most ${maxLen} characters.`);
  if (minLen !== undefined && minLen > 1) out.push(`At least ${minLen} characters.`);
  const minItems = n("minItems");
  const maxItems = n("maxItems");
  if (minItems !== undefined && maxItems !== undefined) out.push(`${minItems} to ${maxItems} items.`);
  else if (maxItems !== undefined) out.push(`At most ${maxItems} items.`);
  else if (minItems !== undefined && minItems > 1) out.push(`At least ${minItems} items.`);
  const min = n("minimum");
  const max = n("maximum");
  if (min !== undefined && max !== undefined) out.push(`Between ${min} and ${max}.`);
  else if (max !== undefined) out.push(`At most ${max}.`);
  else if (min !== undefined) out.push(`At least ${min}.`);
  return out;
}

function convert(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(convert);
  if (!node || typeof node !== "object") return node;
  const src = node as Json;
  const out: Json = {};

  for (const key of ["$ref", "type", "const", "enum", "required", "title"]) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  if (src.$defs) out.$defs = Object.fromEntries(Object.entries(src.$defs as Json).map(([k, v]) => [k, convert(v)]));
  if (src.properties) out.properties = Object.fromEntries(Object.entries(src.properties as Json).map(([k, v]) => [k, convert(v)]));
  if (src.items) out.items = convert(src.items);
  if (src.anyOf) out.anyOf = convert(src.anyOf);
  if (src.oneOf) out.anyOf = convert(src.oneOf);
  if (src.allOf) out.allOf = convert(src.allOf);
  if (out.type === "object" || src.properties) out.additionalProperties = false;
  if (typeof src.format === "string" && KEEP_FORMATS.has(src.format)) out.format = src.format;
  if (src.minItems === 0 || src.minItems === 1) out.minItems = src.minItems;

  const description = [typeof src.description === "string" ? src.description : null, ...limitsText(src)].filter(Boolean).join(" ");
  if (description) out.description = description;
  return out;
}

export function toStructuredOutputSchema(schema: z.ZodType): Json {
  return convert(z.toJSONSchema(schema, { reused: "ref", io: "output" })) as Json;
}
