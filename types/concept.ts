export interface Concept {
  id: string;
  teacherId: string;
  classId: string;
  slug: string;
  label: string;
  description: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type ConceptInput = Omit<Concept, "id" | "teacherId" | "classId" | "createdAt" | "updatedAt">;

export const DEFAULT_JS_CONCEPTS: ConceptInput[] = [
  { slug: "data-types",   label: "Data Types",   description: "Understand strings, numbers, booleans, null, undefined, and how to check types.", order: 1 },
  { slug: "variables",    label: "Variables",    description: "Declare, assign, and scope variables using let, const, and template literals.", order: 2 },
  { slug: "operators",    label: "Operators",    description: "Calculate and compare values using arithmetic, comparison, and logical operators.", order: 3 },
  { slug: "strings",      label: "Strings",      description: "Declare and manipulate text using string methods and template literals.", order: 4 },
  { slug: "arrays",       label: "Arrays",       description: "Store and transform ordered lists of data using array methods.", order: 5 },
  { slug: "objects",      label: "Objects",      description: "Group related data and behavior into key-value structures.", order: 6 },
  { slug: "control-flow", label: "Control Flow", description: "Control program execution with if/else, switch, and conditional logic.", order: 7 },
  { slug: "loops",        label: "Loops",        description: "Repeat actions using for, while, for...of, and for...in loops.", order: 8 },
  { slug: "functions",    label: "Functions",    description: "Write reusable blocks, understand parameters, return values, and callbacks.", order: 9 },
];
