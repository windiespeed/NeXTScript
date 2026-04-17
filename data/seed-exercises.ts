import type { ExerciseInput } from "@/types/exercise";

export const SEED_EXERCISES: ExerciseInput[] = [
  // ─── DATA TYPES ──────────────────────────────────────────────────────────────
  {
    concept: "data-types", language: "javascript", difficulty: "beginner", type: "exercise", order: 1, isSeeded: true,
    title: "Identify the Type",
    description: "Use the `typeof` operator to return the data type of the given value as a string.",
    starterCode: `function solution(value) {
  // Return the data type of value
  // Hint: use the typeof operator
}`,
    tests: [
      { id: "t1", description: "solution(42) returns \"number\"", code: `assert(solution(42) === "number", 'solution(42) should return "number"')` },
      { id: "t2", description: "solution(\"hi\") returns \"string\"", code: `assert(solution("hi") === "string", 'solution("hi") should return "string"')` },
      { id: "t3", description: "solution(true) returns \"boolean\"", code: `assert(solution(true) === "boolean", 'solution(true) should return "boolean"')` },
      { id: "t4", description: "solution(undefined) returns \"undefined\"", code: `assert(solution(undefined) === "undefined", 'solution(undefined) should return "undefined"')` },
    ],
    hints: ["The typeof operator returns a string", "Try: typeof 42"],
    solution: `function solution(value) {\n  return typeof value;\n}`,
  },
  {
    concept: "data-types", language: "javascript", difficulty: "beginner", type: "exercise", order: 2, isSeeded: true,
    title: "Is It a Number?",
    description: "Return `true` if the value is a real number (not NaN), `false` otherwise.",
    starterCode: `function solution(value) {
  // Return true if value is a number (not NaN)
}`,
    tests: [
      { id: "t1", description: "solution(42) returns true", code: `assert(solution(42) === true, "solution(42) should return true")` },
      { id: "t2", description: "solution(\"42\") returns false", code: `assert(solution("42") === false, 'solution("42") should return false')` },
      { id: "t3", description: "solution(NaN) returns false", code: `assert(solution(NaN) === false, "solution(NaN) should return false")` },
      { id: "t4", description: "solution(3.14) returns true", code: `assert(solution(3.14) === true, "solution(3.14) should return true")` },
    ],
    hints: ["Use typeof to check the type", "typeof NaN is \"number\" — use isNaN() to catch it"],
    solution: `function solution(value) {\n  return typeof value === "number" && !isNaN(value);\n}`,
  },
  {
    concept: "data-types", language: "javascript", difficulty: "beginner", type: "exercise", order: 3, isSeeded: true,
    title: "Truthy or Falsy",
    description: "Return `true` if the value is truthy, `false` if it's falsy.\n\nFalsy values in JS: `false`, `0`, `\"\"`, `null`, `undefined`, `NaN`.",
    starterCode: `function solution(value) {
  // Return true if truthy, false if falsy
}`,
    tests: [
      { id: "t1", description: "solution(1) returns true", code: `assert(solution(1) === true, "solution(1) should return true")` },
      { id: "t2", description: "solution(0) returns false", code: `assert(solution(0) === false, "solution(0) should return false")` },
      { id: "t3", description: "solution(\"\") returns false", code: `assert(solution("") === false, 'solution("") should return false')` },
      { id: "t4", description: "solution(\"hello\") returns true", code: `assert(solution("hello") === true, 'solution("hello") should return true')` },
      { id: "t5", description: "solution(null) returns false", code: `assert(solution(null) === false, "solution(null) should return false")` },
    ],
    hints: ["Try the Boolean() function", "Or use the double-bang: !!value"],
    solution: `function solution(value) {\n  return Boolean(value);\n}`,
  },
  {
    concept: "data-types", language: "javascript", difficulty: "beginner", type: "exercise", order: 4, isSeeded: true,
    title: "Convert to Number",
    description: "Convert the given string to a number and return it.",
    starterCode: `function solution(str) {
  // Convert the string to a number
}`,
    tests: [
      { id: "t1", description: "solution(\"42\") returns 42", code: `assert(solution("42") === 42, 'solution("42") should return 42')` },
      { id: "t2", description: "solution(\"3.14\") returns 3.14", code: `assert(solution("3.14") === 3.14, 'solution("3.14") should return 3.14')` },
      { id: "t3", description: "solution(\"0\") returns 0", code: `assert(solution("0") === 0, 'solution("0") should return 0')` },
    ],
    hints: ["Use the Number() function", "parseInt() and parseFloat() also work"],
    solution: `function solution(str) {\n  return Number(str);\n}`,
  },
  {
    concept: "data-types", language: "javascript", difficulty: "beginner", type: "exercise", order: 5, isSeeded: true,
    title: "Convert to String",
    description: "Convert the given number to a string and return it.",
    starterCode: `function solution(num) {
  // Convert the number to a string
}`,
    tests: [
      { id: "t1", description: "solution(42) returns \"42\"", code: `assert(solution(42) === "42", 'solution(42) should return "42"')` },
      { id: "t2", description: "solution(0) returns \"0\"", code: `assert(solution(0) === "0", 'solution(0) should return "0"')` },
      { id: "t3", description: "solution(3.14) returns \"3.14\"", code: `assert(solution(3.14) === "3.14", 'solution(3.14) should return "3.14"')` },
    ],
    hints: ["Use the String() function", "Or num.toString()", "Template literals work too: `${num}`"],
    solution: `function solution(num) {\n  return String(num);\n}`,
  },
  {
    concept: "data-types", language: "javascript", difficulty: "beginner", type: "exercise", order: 6, isSeeded: true,
    title: "Null vs Undefined",
    description: "Return `\"null\"` if the value is `null`, `\"undefined\"` if it's `undefined`, or `\"other\"` for anything else.",
    starterCode: `function solution(value) {
  // Distinguish between null, undefined, and other values
}`,
    tests: [
      { id: "t1", description: "solution(null) returns \"null\"", code: `assert(solution(null) === "null", 'solution(null) should return "null"')` },
      { id: "t2", description: "solution(undefined) returns \"undefined\"", code: `assert(solution(undefined) === "undefined", 'solution(undefined) should return "undefined"')` },
      { id: "t3", description: "solution(42) returns \"other\"", code: `assert(solution(42) === "other", 'solution(42) should return "other"')` },
      { id: "t4", description: "solution(\"hello\") returns \"other\"", code: `assert(solution("hello") === "other", 'solution("hello") should return "other"')` },
    ],
    hints: ["Use === to check for null", "typeof undefined === \"undefined\""],
    solution: `function solution(value) {\n  if (value === null) return "null";\n  if (value === undefined) return "undefined";\n  return "other";\n}`,
  },
  {
    concept: "data-types", language: "javascript", difficulty: "intermediate", type: "challenge", order: 7, isSeeded: true,
    title: "Type Detective",
    description: "Write a function that returns a precise type description:\n- `\"null\"` for `null`\n- `\"array\"` for arrays\n- `\"NaN\"` for `NaN`\n- `typeof` for everything else\n\nThis tests your understanding of JavaScript's quirky type system.",
    starterCode: `function solution(value) {
  // Handle null, array, NaN, and regular typeof cases
}`,
    tests: [
      { id: "t1", description: "solution(null) returns \"null\"", code: `assert(solution(null) === "null", 'null should return "null"')` },
      { id: "t2", description: "solution([1,2,3]) returns \"array\"", code: `assert(solution([1,2,3]) === "array", 'arrays should return "array"')` },
      { id: "t3", description: "solution(NaN) returns \"NaN\"", code: `assert(solution(NaN) === "NaN", 'NaN should return "NaN"')` },
      { id: "t4", description: "solution(42) returns \"number\"", code: `assert(solution(42) === "number", '42 should return "number"')` },
      { id: "t5", description: "solution({}) returns \"object\"", code: `assert(solution({}) === "object", '{} should return "object"')` },
      { id: "t6", description: "solution(\"hi\") returns \"string\"", code: `assert(solution("hi") === "string", '"hi" should return "string"')` },
    ],
    hints: ["Check null before typeof (typeof null === \"object\")", "Use Array.isArray() to detect arrays", "typeof NaN === \"number\" — use isNaN() to detect it"],
    solution: `function solution(value) {\n  if (value === null) return "null";\n  if (Array.isArray(value)) return "array";\n  if (typeof value === "number" && isNaN(value)) return "NaN";\n  return typeof value;\n}`,
  },

  // ─── VARIABLES ───────────────────────────────────────────────────────────────
  {
    concept: "variables", language: "javascript", difficulty: "beginner", type: "exercise", order: 1, isSeeded: true,
    title: "Declare a Variable",
    description: "Declare a variable called `greeting` using `let` and assign it the string `\"Hello, World!\"`.",
    starterCode: `// Declare a variable called 'greeting' with the value "Hello, World!"
// Use the let keyword
`,
    tests: [
      { id: "t1", description: "greeting is defined", code: `assert(typeof greeting !== "undefined", "greeting should be declared")` },
      { id: "t2", description: "greeting equals \"Hello, World!\"", code: `assert(greeting === "Hello, World!", 'greeting should equal "Hello, World!"')` },
    ],
    hints: ["Syntax: let variableName = value;", "String values go inside quotes"],
    solution: `let greeting = "Hello, World!";`,
  },
  {
    concept: "variables", language: "javascript", difficulty: "beginner", type: "exercise", order: 2, isSeeded: true,
    title: "Update a Variable",
    description: "The variable `score` starts at `10`. Add `5` to it so it becomes `15`.",
    starterCode: `let score = 10;
// Add 5 to score
`,
    tests: [
      { id: "t1", description: "score equals 15", code: `assert(score === 15, "score should equal 15 after adding 5")` },
    ],
    hints: ["Use score += 5", "Or score = score + 5"],
    solution: `let score = 10;\nscore += 5;`,
  },
  {
    concept: "variables", language: "javascript", difficulty: "beginner", type: "exercise", order: 3, isSeeded: true,
    title: "Template Literal",
    description: "Use a template literal to return `\"Hello, [name]!\"` where `name` is the parameter.",
    starterCode: `function solution(name) {
  // Use a template literal to return "Hello, [name]!"
}`,
    tests: [
      { id: "t1", description: "solution(\"Alice\") returns \"Hello, Alice!\"", code: `assert(solution("Alice") === "Hello, Alice!", 'should return "Hello, Alice!"')` },
      { id: "t2", description: "solution(\"World\") returns \"Hello, World!\"", code: `assert(solution("World") === "Hello, World!", 'should return "Hello, World!"')` },
    ],
    hints: ["Template literals use backticks (`)", "Embed variables with ${variableName}"],
    solution: `function solution(name) {\n  return \`Hello, \${name}!\`;\n}`,
  },
  {
    concept: "variables", language: "javascript", difficulty: "beginner", type: "exercise", order: 4, isSeeded: true,
    title: "Swap Variables",
    description: "Swap the values of `a` and `b` using destructuring assignment, then return them as `[a, b]`.",
    starterCode: `function solution(a, b) {
  // Swap a and b using: [a, b] = [b, a]
  // Then return [a, b]
}`,
    tests: [
      { id: "t1", description: "solution(1, 2) returns [2, 1]", code: `assert(JSON.stringify(solution(1, 2)) === JSON.stringify([2, 1]), "solution(1, 2) should return [2, 1]")` },
      { id: "t2", description: "solution(\"x\", \"y\") returns [\"y\", \"x\"]", code: `assert(JSON.stringify(solution("x", "y")) === JSON.stringify(["y", "x"]), 'should swap strings too')` },
    ],
    hints: ["Destructuring swap: [a, b] = [b, a]", "Then return [a, b]"],
    solution: `function solution(a, b) {\n  [a, b] = [b, a];\n  return [a, b];\n}`,
  },
  {
    concept: "variables", language: "javascript", difficulty: "beginner", type: "exercise", order: 5, isSeeded: true,
    title: "const vs let",
    description: "Declare `PI` as a constant equal to `3.14159` and `count` as a variable starting at `0`, then increment `count` by `1`.",
    starterCode: `// Declare PI as a constant (3.14159)
// Declare count as a variable starting at 0
// Increment count by 1
`,
    tests: [
      { id: "t1", description: "PI equals 3.14159", code: `assert(PI === 3.14159, "PI should be 3.14159")` },
      { id: "t2", description: "count equals 1", code: `assert(count === 1, "count should be 1 after incrementing")` },
    ],
    hints: ["Use const for values that never change", "Use let for values you'll update", "count++ increments by 1"],
    solution: `const PI = 3.14159;\nlet count = 0;\ncount++;`,
  },
  {
    concept: "variables", language: "javascript", difficulty: "beginner", type: "exercise", order: 6, isSeeded: true,
    title: "Full Name",
    description: "Given a `first` and `last` name, use a template literal to return the full name as `\"First Last\"`.",
    starterCode: `function solution(first, last) {
  // Return the full name using a template literal
}`,
    tests: [
      { id: "t1", description: "solution(\"Jane\", \"Doe\") returns \"Jane Doe\"", code: `assert(solution("Jane", "Doe") === "Jane Doe", 'should return "Jane Doe"')` },
      { id: "t2", description: "solution(\"John\", \"Smith\") returns \"John Smith\"", code: `assert(solution("John", "Smith") === "John Smith", 'should return "John Smith"')` },
    ],
    hints: ["Use a template literal with a space between first and last"],
    solution: `function solution(first, last) {\n  return \`\${first} \${last}\`;\n}`,
  },
  {
    concept: "variables", language: "javascript", difficulty: "intermediate", type: "challenge", order: 7, isSeeded: true,
    title: "Counter Object",
    description: "Write a function that returns a counter object with three methods:\n- `increment()` — increases the count by 1\n- `decrement()` — decreases the count by 1\n- `getValue()` — returns the current count\n\nThe count starts at 0. This uses closures to keep state private.",
    starterCode: `function solution() {
  let count = 0;
  // Return an object with increment(), decrement(), and getValue()
}`,
    tests: [
      { id: "t1", description: "increment twice → getValue() returns 2", code: `const c = solution(); c.increment(); c.increment(); assert(c.getValue() === 2, "After 2 increments, getValue() should return 2")` },
      { id: "t2", description: "increment then decrement → getValue() returns 0", code: `const c = solution(); c.increment(); c.decrement(); assert(c.getValue() === 0, "Increment then decrement should return 0")` },
      { id: "t3", description: "starts at 0", code: `const c = solution(); assert(c.getValue() === 0, "Counter should start at 0")` },
    ],
    hints: ["Use let count = 0 inside the function (closure)", "Return an object with method properties", "Arrow functions in the object can access count via closure"],
    solution: `function solution() {\n  let count = 0;\n  return {\n    increment: () => { count++; },\n    decrement: () => { count--; },\n    getValue: () => count,\n  };\n}`,
  },

  // ─── OPERATORS ───────────────────────────────────────────────────────────────
  {
    concept: "operators", language: "javascript", difficulty: "beginner", type: "exercise", order: 1, isSeeded: true,
    title: "Average",
    description: "Return the average (mean) of `a` and `b`.",
    starterCode: `function solution(a, b) {
  // Return the average of a and b
}`,
    tests: [
      { id: "t1", description: "solution(2, 8) returns 5", code: `assert(solution(2, 8) === 5, "solution(2, 8) should return 5")` },
      { id: "t2", description: "solution(3, 7) returns 5", code: `assert(solution(3, 7) === 5, "solution(3, 7) should return 5")` },
      { id: "t3", description: "solution(1, 3) returns 2", code: `assert(solution(1, 3) === 2, "solution(1, 3) should return 2")` },
    ],
    hints: ["Add them together and divide by 2", "Use parentheses: (a + b) / 2"],
    solution: `function solution(a, b) {\n  return (a + b) / 2;\n}`,
  },
  {
    concept: "operators", language: "javascript", difficulty: "beginner", type: "exercise", order: 2, isSeeded: true,
    title: "Odd or Even",
    description: "Return `\"even\"` if `n` is even, `\"odd\"` if `n` is odd. Use the modulo (`%`) operator.",
    starterCode: `function solution(n) {
  // Use % to check if n is even or odd
}`,
    tests: [
      { id: "t1", description: "solution(4) returns \"even\"", code: `assert(solution(4) === "even", 'solution(4) should return "even"')` },
      { id: "t2", description: "solution(7) returns \"odd\"", code: `assert(solution(7) === "odd", 'solution(7) should return "odd"')` },
      { id: "t3", description: "solution(0) returns \"even\"", code: `assert(solution(0) === "even", 'solution(0) should return "even"')` },
      { id: "t4", description: "solution(1) returns \"odd\"", code: `assert(solution(1) === "odd", 'solution(1) should return "odd"')` },
    ],
    hints: ["n % 2 === 0 means even", "Use a ternary: condition ? \"even\" : \"odd\""],
    solution: `function solution(n) {\n  return n % 2 === 0 ? "even" : "odd";\n}`,
  },
  {
    concept: "operators", language: "javascript", difficulty: "beginner", type: "exercise", order: 3, isSeeded: true,
    title: "Greater Than",
    description: "Return `true` if `a` is strictly greater than `b`, `false` otherwise.",
    starterCode: `function solution(a, b) {
  // Return true if a > b
}`,
    tests: [
      { id: "t1", description: "solution(5, 3) returns true", code: `assert(solution(5, 3) === true, "5 > 3 should be true")` },
      { id: "t2", description: "solution(3, 5) returns false", code: `assert(solution(3, 5) === false, "3 > 5 should be false")` },
      { id: "t3", description: "solution(5, 5) returns false", code: `assert(solution(5, 5) === false, "5 > 5 should be false (not strictly greater)")` },
    ],
    hints: ["Use the > operator", "Strictly greater means equal returns false"],
    solution: `function solution(a, b) {\n  return a > b;\n}`,
  },
  {
    concept: "operators", language: "javascript", difficulty: "beginner", type: "exercise", order: 4, isSeeded: true,
    title: "Both True",
    description: "Return `true` only if both `a` AND `b` are `true`. Use the `&&` operator.",
    starterCode: `function solution(a, b) {
  // Return true only if both are true
}`,
    tests: [
      { id: "t1", description: "solution(true, true) returns true", code: `assert(solution(true, true) === true, "true && true should be true")` },
      { id: "t2", description: "solution(true, false) returns false", code: `assert(solution(true, false) === false, "true && false should be false")` },
      { id: "t3", description: "solution(false, true) returns false", code: `assert(solution(false, true) === false, "false && true should be false")` },
      { id: "t4", description: "solution(false, false) returns false", code: `assert(solution(false, false) === false, "false && false should be false")` },
    ],
    hints: ["Use the && (AND) operator", "Both sides must be true for && to return true"],
    solution: `function solution(a, b) {\n  return a && b;\n}`,
  },
  {
    concept: "operators", language: "javascript", difficulty: "beginner", type: "exercise", order: 5, isSeeded: true,
    title: "Ternary Operator",
    description: "Use the ternary operator to return `\"pass\"` if `score >= 60`, or `\"fail\"` otherwise.",
    starterCode: `function solution(score) {
  // Use: condition ? valueIfTrue : valueIfFalse
}`,
    tests: [
      { id: "t1", description: "solution(90) returns \"pass\"", code: `assert(solution(90) === "pass", 'solution(90) should return "pass"')` },
      { id: "t2", description: "solution(60) returns \"pass\"", code: `assert(solution(60) === "pass", 'solution(60) should return "pass" (exactly 60)')` },
      { id: "t3", description: "solution(59) returns \"fail\"", code: `assert(solution(59) === "fail", 'solution(59) should return "fail"')` },
      { id: "t4", description: "solution(0) returns \"fail\"", code: `assert(solution(0) === "fail", 'solution(0) should return "fail"')` },
    ],
    hints: ["Syntax: condition ? \"pass\" : \"fail\"", "No if/else needed — ternary is one expression"],
    solution: `function solution(score) {\n  return score >= 60 ? "pass" : "fail";\n}`,
  },
  {
    concept: "operators", language: "javascript", difficulty: "intermediate", type: "challenge", order: 6, isSeeded: true,
    title: "Calculator",
    description: "Build a calculator that handles `\"+\"`, `\"-\"`, `\"*\"`, and `\"/\"` operations.\n\nFor division by zero, throw `new Error(\"Division by zero\")`.",
    starterCode: `function solution(a, operator, b) {
  // Handle +, -, *, /
  // For division by zero, throw new Error("Division by zero")
}`,
    tests: [
      { id: "t1", description: "solution(5, \"+\", 3) returns 8", code: `assert(solution(5, "+", 3) === 8, "5 + 3 should be 8")` },
      { id: "t2", description: "solution(10, \"-\", 4) returns 6", code: `assert(solution(10, "-", 4) === 6, "10 - 4 should be 6")` },
      { id: "t3", description: "solution(3, \"*\", 4) returns 12", code: `assert(solution(3, "*", 4) === 12, "3 * 4 should be 12")` },
      { id: "t4", description: "solution(10, \"/\", 2) returns 5", code: `assert(solution(10, "/", 2) === 5, "10 / 2 should be 5")` },
      { id: "t5", description: "division by zero throws an error", code: `try { solution(5, "/", 0); assert(false, "Should have thrown"); } catch(e) { assert(e.message === "Division by zero", 'Error message should be "Division by zero"'); }` },
    ],
    hints: ["Use if/else or switch for each operator", "Check b === 0 before dividing", "throw new Error(\"message\") creates and throws an error"],
    solution: `function solution(a, operator, b) {\n  if (operator === "+") return a + b;\n  if (operator === "-") return a - b;\n  if (operator === "*") return a * b;\n  if (operator === "/") {\n    if (b === 0) throw new Error("Division by zero");\n    return a / b;\n  }\n}`,
  },

  // ─── STRINGS ─────────────────────────────────────────────────────────────────
  {
    concept: "strings", language: "javascript", difficulty: "beginner", type: "exercise", order: 1, isSeeded: true,
    title: "String Length",
    description: "Return the number of characters in the string.",
    starterCode: `function solution(str) {
  // Return the length of str
}`,
    tests: [
      { id: "t1", description: "solution(\"hello\") returns 5", code: `assert(solution("hello") === 5, 'solution("hello") should return 5')` },
      { id: "t2", description: "solution(\"\") returns 0", code: `assert(solution("") === 0, 'solution("") should return 0')` },
      { id: "t3", description: "solution(\"JavaScript\") returns 10", code: `assert(solution("JavaScript") === 10, 'solution("JavaScript") should return 10')` },
    ],
    hints: ["Every string has a .length property"],
    solution: `function solution(str) {\n  return str.length;\n}`,
  },
  {
    concept: "strings", language: "javascript", difficulty: "beginner", type: "exercise", order: 2, isSeeded: true,
    title: "To Uppercase",
    description: "Return the string converted to all uppercase letters.",
    starterCode: `function solution(str) {
  // Convert to uppercase
}`,
    tests: [
      { id: "t1", description: "solution(\"hello\") returns \"HELLO\"", code: `assert(solution("hello") === "HELLO", 'should return "HELLO"')` },
      { id: "t2", description: "solution(\"JavaScript\") returns \"JAVASCRIPT\"", code: `assert(solution("JavaScript") === "JAVASCRIPT", 'should return "JAVASCRIPT"')` },
    ],
    hints: ["Use .toUpperCase()"],
    solution: `function solution(str) {\n  return str.toUpperCase();\n}`,
  },
  {
    concept: "strings", language: "javascript", difficulty: "beginner", type: "exercise", order: 3, isSeeded: true,
    title: "Does It Contain?",
    description: "Return `true` if `str` contains `word` (case-sensitive), `false` otherwise.",
    starterCode: `function solution(str, word) {
  // Return true if str contains word
}`,
    tests: [
      { id: "t1", description: "\"Hello World\" contains \"World\"", code: `assert(solution("Hello World", "World") === true, 'should find "World"')` },
      { id: "t2", description: "case-sensitive: \"world\" not found", code: `assert(solution("Hello World", "world") === false, 'should be case-sensitive')` },
      { id: "t3", description: "\"JavaScript\" contains \"Script\"", code: `assert(solution("JavaScript", "Script") === true, 'should find "Script"')` },
    ],
    hints: ["Use .includes(word)"],
    solution: `function solution(str, word) {\n  return str.includes(word);\n}`,
  },
  {
    concept: "strings", language: "javascript", difficulty: "beginner", type: "exercise", order: 4, isSeeded: true,
    title: "First N Characters",
    description: "Return only the first `n` characters of `str`.",
    starterCode: `function solution(str, n) {
  // Return the first n characters
}`,
    tests: [
      { id: "t1", description: "solution(\"Hello\", 3) returns \"Hel\"", code: `assert(solution("Hello", 3) === "Hel", 'should return "Hel"')` },
      { id: "t2", description: "solution(\"JavaScript\", 4) returns \"Java\"", code: `assert(solution("JavaScript", 4) === "Java", 'should return "Java"')` },
      { id: "t3", description: "n larger than string returns whole string", code: `assert(solution("Hi", 5) === "Hi", 'when n > length, return full string')` },
    ],
    hints: ["Use .slice(start, end)", ".slice(0, n) gives the first n characters"],
    solution: `function solution(str, n) {\n  return str.slice(0, n);\n}`,
  },
  {
    concept: "strings", language: "javascript", difficulty: "beginner", type: "exercise", order: 5, isSeeded: true,
    title: "Replace All",
    description: "Replace every occurrence of `oldWord` with `newWord` in `str` and return the result.",
    starterCode: `function solution(str, oldWord, newWord) {
  // Replace all occurrences of oldWord with newWord
}`,
    tests: [
      { id: "t1", description: "replaces all occurrences", code: `assert(solution("Hello World World", "World", "JS") === "Hello JS JS", 'should replace all occurrences')` },
      { id: "t2", description: "solution(\"foo bar foo\", \"foo\", \"baz\")", code: `assert(solution("foo bar foo", "foo", "baz") === "baz bar baz", 'should replace all "foo"')` },
    ],
    hints: ["Try .split(oldWord).join(newWord) — this replaces ALL occurrences", ".replaceAll(oldWord, newWord) also works"],
    solution: `function solution(str, oldWord, newWord) {\n  return str.split(oldWord).join(newWord);\n}`,
  },
  {
    concept: "strings", language: "javascript", difficulty: "beginner", type: "exercise", order: 6, isSeeded: true,
    title: "Split Into Words",
    description: "Split the sentence by spaces and return an array of words.",
    starterCode: `function solution(sentence) {
  // Split by spaces to get an array of words
}`,
    tests: [
      { id: "t1", description: "solution(\"Hello World\") returns [\"Hello\", \"World\"]", code: `assert(JSON.stringify(solution("Hello World")) === JSON.stringify(["Hello", "World"]), 'should split into two words')` },
      { id: "t2", description: "three words → array of length 3", code: `assert(solution("one two three").length === 3, 'should return 3 words')` },
    ],
    hints: ["Use .split(\" \") to split on spaces"],
    solution: `function solution(sentence) {\n  return sentence.split(" ");\n}`,
  },
  {
    concept: "strings", language: "javascript", difficulty: "intermediate", type: "challenge", order: 7, isSeeded: true,
    title: "Reverse a String",
    description: "Return the string reversed. `\"hello\"` becomes `\"olleh\"`.\n\nHint: strings can't be reversed directly — think about converting to an array first.",
    starterCode: `function solution(str) {
  // Reverse the string
}`,
    tests: [
      { id: "t1", description: "solution(\"hello\") returns \"olleh\"", code: `assert(solution("hello") === "olleh", '"hello" reversed is "olleh"')` },
      { id: "t2", description: "solution(\"JavaScript\") returns \"tpircSavaJ\"", code: `assert(solution("JavaScript") === "tpircSavaJ", '"JavaScript" reversed')` },
      { id: "t3", description: "single character returns itself", code: `assert(solution("a") === "a", 'single char returns itself')` },
      { id: "t4", description: "empty string returns empty string", code: `assert(solution("") === "", 'empty string returns empty string')` },
    ],
    hints: ["split(\"\") converts string to array of characters", ".reverse() reverses an array in place", ".join(\"\") converts array back to string"],
    solution: `function solution(str) {\n  return str.split("").reverse().join("");\n}`,
  },

  // ─── ARRAYS ──────────────────────────────────────────────────────────────────
  {
    concept: "arrays", language: "javascript", difficulty: "beginner", type: "exercise", order: 1, isSeeded: true,
    title: "First and Last",
    description: "Return an array containing only the first and last elements of the input array.",
    starterCode: `function solution(arr) {
  // Return [firstElement, lastElement]
}`,
    tests: [
      { id: "t1", description: "solution([1,2,3,4,5]) returns [1,5]", code: `assert(JSON.stringify(solution([1,2,3,4,5])) === JSON.stringify([1,5]), "should return [1, 5]")` },
      { id: "t2", description: "solution([\"a\",\"b\",\"c\"]) returns [\"a\",\"c\"]", code: `assert(JSON.stringify(solution(["a","b","c"])) === JSON.stringify(["a","c"]), 'should return ["a","c"]')` },
    ],
    hints: ["Access first with arr[0]", "Access last with arr[arr.length - 1]"],
    solution: `function solution(arr) {\n  return [arr[0], arr[arr.length - 1]];\n}`,
  },
  {
    concept: "arrays", language: "javascript", difficulty: "beginner", type: "exercise", order: 2, isSeeded: true,
    title: "Add to Array",
    description: "Add `value` to the END of `arr` and return the updated array.",
    starterCode: `function solution(arr, value) {
  // Add value to the end of arr and return arr
}`,
    tests: [
      { id: "t1", description: "solution([1,2,3], 4) returns [1,2,3,4]", code: `assert(JSON.stringify(solution([1,2,3], 4)) === JSON.stringify([1,2,3,4]), "should add 4 to end")` },
      { id: "t2", description: "solution([], \"hello\") returns [\"hello\"]", code: `assert(JSON.stringify(solution([], "hello")) === JSON.stringify(["hello"]), 'should work on empty array')` },
    ],
    hints: ["Use .push(value) to add to the end", ".push() modifies the array in place and returns the new length"],
    solution: `function solution(arr, value) {\n  arr.push(value);\n  return arr;\n}`,
  },
  {
    concept: "arrays", language: "javascript", difficulty: "beginner", type: "exercise", order: 3, isSeeded: true,
    title: "Remove Last",
    description: "Remove and return the last element from the array.",
    starterCode: `function solution(arr) {
  // Remove and return the last element
}`,
    tests: [
      { id: "t1", description: "solution([1,2,3]) returns 3", code: `assert(solution([1,2,3]) === 3, "should return 3 (the last element)")` },
      { id: "t2", description: "solution([\"a\",\"b\"]) returns \"b\"", code: `assert(solution(["a","b"]) === "b", 'should return "b"')` },
    ],
    hints: ["Use .pop() — it removes AND returns the last element"],
    solution: `function solution(arr) {\n  return arr.pop();\n}`,
  },
  {
    concept: "arrays", language: "javascript", difficulty: "beginner", type: "exercise", order: 4, isSeeded: true,
    title: "Filter Evens",
    description: "Return only the even numbers from the array.",
    starterCode: `function solution(arr) {
  // Return an array of only even numbers
}`,
    tests: [
      { id: "t1", description: "filters to only even numbers", code: `assert(JSON.stringify(solution([1,2,3,4,5,6])) === JSON.stringify([2,4,6]), "should return [2,4,6]")` },
      { id: "t2", description: "no evens returns empty array", code: `assert(JSON.stringify(solution([1,3,5])) === JSON.stringify([]), "should return []")` },
    ],
    hints: ["Use .filter(callback)", "n % 2 === 0 checks if n is even"],
    solution: `function solution(arr) {\n  return arr.filter(n => n % 2 === 0);\n}`,
  },
  {
    concept: "arrays", language: "javascript", difficulty: "beginner", type: "exercise", order: 5, isSeeded: true,
    title: "Double the Values",
    description: "Return a new array with every number multiplied by 2.",
    starterCode: `function solution(arr) {
  // Return each number multiplied by 2
}`,
    tests: [
      { id: "t1", description: "solution([1,2,3]) returns [2,4,6]", code: `assert(JSON.stringify(solution([1,2,3])) === JSON.stringify([2,4,6]), "should double each element")` },
      { id: "t2", description: "solution([5,10]) returns [10,20]", code: `assert(JSON.stringify(solution([5,10])) === JSON.stringify([10,20]), "should double [5,10]")` },
    ],
    hints: ["Use .map(callback)", ".map() returns a new array"],
    solution: `function solution(arr) {\n  return arr.map(n => n * 2);\n}`,
  },
  {
    concept: "arrays", language: "javascript", difficulty: "beginner", type: "exercise", order: 6, isSeeded: true,
    title: "Find the First",
    description: "Return the first number in the array that is greater than 10, or `undefined` if none exists.",
    starterCode: `function solution(arr) {
  // Find the first number greater than 10
}`,
    tests: [
      { id: "t1", description: "solution([5, 15, 20]) returns 15", code: `assert(solution([5, 15, 20]) === 15, "should return 15, the first number > 10")` },
      { id: "t2", description: "solution([1, 2, 3]) returns undefined", code: `assert(solution([1, 2, 3]) === undefined, "should return undefined when none found")` },
      { id: "t3", description: "solution([11]) returns 11", code: `assert(solution([11]) === 11, "should return 11")` },
    ],
    hints: ["Use .find(callback)", ".find() returns the first matching element, or undefined"],
    solution: `function solution(arr) {\n  return arr.find(n => n > 10);\n}`,
  },
  {
    concept: "arrays", language: "javascript", difficulty: "beginner", type: "exercise", order: 7, isSeeded: true,
    title: "Sum an Array",
    description: "Return the sum of all numbers in the array. Return `0` for an empty array.",
    starterCode: `function solution(arr) {
  // Return the total sum using .reduce()
}`,
    tests: [
      { id: "t1", description: "solution([1,2,3,4,5]) returns 15", code: `assert(solution([1,2,3,4,5]) === 15, "1+2+3+4+5 should equal 15")` },
      { id: "t2", description: "solution([10,20]) returns 30", code: `assert(solution([10,20]) === 30, "10+20 should equal 30")` },
      { id: "t3", description: "solution([]) returns 0", code: `assert(solution([]) === 0, "empty array should return 0")` },
    ],
    hints: ["Use .reduce((accumulator, current) => accumulator + current, 0)", "The 0 is the starting value"],
    solution: `function solution(arr) {\n  return arr.reduce((sum, n) => sum + n, 0);\n}`,
  },
  {
    concept: "arrays", language: "javascript", difficulty: "beginner", type: "exercise", order: 8, isSeeded: true,
    title: "Sort Ascending",
    description: "Return the array sorted in ascending (smallest to largest) order.\n\n⚠️ Warning: `.sort()` without a compare function sorts lexicographically — `[10, 2]` becomes `[10, 2]` instead of `[2, 10]`!",
    starterCode: `function solution(arr) {
  // Return sorted ascending
  // Hint: sort((a, b) => a - b) sorts numerically
}`,
    tests: [
      { id: "t1", description: "solution([3,1,4,1,5,9]) returns [1,1,3,4,5,9]", code: `assert(JSON.stringify(solution([3,1,4,1,5,9])) === JSON.stringify([1,1,3,4,5,9]), "should sort numerically")` },
      { id: "t2", description: "solution([10,2,30]) returns [2,10,30]", code: `assert(JSON.stringify(solution([10,2,30])) === JSON.stringify([2,10,30]), "[10,2,30] should become [2,10,30]")` },
    ],
    hints: ["[...arr] creates a copy so you don't modify the original", "Use (a, b) => a - b as the compare function"],
    solution: `function solution(arr) {\n  return [...arr].sort((a, b) => a - b);\n}`,
  },
  {
    concept: "arrays", language: "javascript", difficulty: "intermediate", type: "challenge", order: 9, isSeeded: true,
    title: "Array Statistics",
    description: "Return an object with the `min`, `max`, and `average` of the array.\n\n`average` should be rounded to 2 decimal places.",
    starterCode: `function solution(arr) {
  // Return { min, max, average }
}`,
    tests: [
      { id: "t1", description: "solution([1,2,3,4,5]) returns {min:1, max:5, average:3}", code: `const r = solution([1,2,3,4,5]); assert(r.min === 1 && r.max === 5 && r.average === 3, "min=1, max=5, average=3")` },
      { id: "t2", description: "solution([10,20,30]) returns {min:10, max:30, average:20}", code: `const r = solution([10,20,30]); assert(r.min === 10 && r.max === 30 && r.average === 20, "min=10, max=30, average=20")` },
      { id: "t3", description: "average rounds to 2 decimal places", code: `const r = solution([1,2,3]); assert(r.average === 2, "average of 1,2,3 is 2")` },
    ],
    hints: ["Math.min(...arr) and Math.max(...arr) find min/max", "Use reduce() to sum, then divide by arr.length", "Math.round(n * 100) / 100 rounds to 2 decimals"],
    solution: `function solution(arr) {\n  const min = Math.min(...arr);\n  const max = Math.max(...arr);\n  const average = Math.round(arr.reduce((s, n) => s + n, 0) / arr.length * 100) / 100;\n  return { min, max, average };\n}`,
  },
  {
    concept: "arrays", language: "javascript", difficulty: "intermediate", type: "challenge", order: 10, isSeeded: true,
    title: "Flatten and Unique",
    description: "Given an array of arrays, flatten it into a single array, remove duplicates, and sort in ascending order.",
    starterCode: `function solution(arr) {
  // Flatten, deduplicate, sort ascending
}`,
    tests: [
      { id: "t1", description: "flattens and deduplicates", code: `assert(JSON.stringify(solution([[1,2],[2,3],[3,4]])) === JSON.stringify([1,2,3,4]), "should return [1,2,3,4]")` },
      { id: "t2", description: "handles all duplicates", code: `assert(JSON.stringify(solution([[5,5],[1,1]])) === JSON.stringify([1,5]), "should return [1,5]")` },
    ],
    hints: [".flat() flattens one level deep", "new Set(arr) removes duplicates (spread to convert back)", "Sort numerically with (a, b) => a - b"],
    solution: `function solution(arr) {\n  return [...new Set(arr.flat())].sort((a, b) => a - b);\n}`,
  },

  // ─── OBJECTS ─────────────────────────────────────────────────────────────────
  {
    concept: "objects", language: "javascript", difficulty: "beginner", type: "exercise", order: 1, isSeeded: true,
    title: "Create an Object",
    description: "Return an object representing a person with `name` and `age` properties.",
    starterCode: `function solution(name, age) {
  // Return an object with name and age properties
}`,
    tests: [
      { id: "t1", description: "has correct name and age", code: `const p = solution("Alice", 25); assert(p.name === "Alice" && p.age === 25, 'name should be "Alice" and age should be 25')` },
      { id: "t2", description: "works with different values", code: `const p = solution("Bob", 30); assert(p.name === "Bob" && p.age === 30, 'name should be "Bob" and age should be 30')` },
    ],
    hints: ["Return { name: name, age: age }", "Shorthand: { name, age } works when variable names match"],
    solution: `function solution(name, age) {\n  return { name, age };\n}`,
  },
  {
    concept: "objects", language: "javascript", difficulty: "beginner", type: "exercise", order: 2, isSeeded: true,
    title: "Access a Property",
    description: "Return the value of the given `key` from the object. The key is a variable — use bracket notation.",
    starterCode: `function solution(obj, key) {
  // Return the value of obj[key]
}`,
    tests: [
      { id: "t1", description: "accesses name property", code: `assert(solution({ name: "Alice", age: 25 }, "name") === "Alice", 'should return "Alice"')` },
      { id: "t2", description: "accesses age property", code: `assert(solution({ x: 10, y: 20 }, "y") === 20, 'should return 20')` },
    ],
    hints: ["Use bracket notation: obj[key]", "Dot notation (obj.key) doesn't work when key is a variable"],
    solution: `function solution(obj, key) {\n  return obj[key];\n}`,
  },
  {
    concept: "objects", language: "javascript", difficulty: "beginner", type: "exercise", order: 3, isSeeded: true,
    title: "Add a Property",
    description: "Add a new property `role` with value `\"student\"` to the object and return it.",
    starterCode: `function solution(obj) {
  // Add role: "student" to obj and return it
}`,
    tests: [
      { id: "t1", description: "adds role property", code: `const r = solution({ name: "Alice" }); assert(r.role === "student" && r.name === "Alice", 'should add role and keep existing properties')` },
    ],
    hints: ["Just assign: obj.role = \"student\"", "Then return obj"],
    solution: `function solution(obj) {\n  obj.role = "student";\n  return obj;\n}`,
  },
  {
    concept: "objects", language: "javascript", difficulty: "beginner", type: "exercise", order: 4, isSeeded: true,
    title: "Object Method",
    description: "Return an object with a `greet()` method that returns `\"Hi, I'm [name]!\"`.",
    starterCode: `function solution(name) {
  // Return an object with a greet() method
}`,
    tests: [
      { id: "t1", description: "greet() returns correct message", code: `assert(solution("Alice").greet() === "Hi, I'm Alice!", "greet() should return \"Hi, I'm Alice!\"")` },
      { id: "t2", description: "works with different names", code: `assert(solution("Bob").greet() === "Hi, I'm Bob!", "greet() should return \"Hi, I'm Bob!\"")` },
    ],
    hints: ["Return { greet: () => `Hi, I'm ${name}!` }", "The arrow function closes over the name parameter"],
    solution: "function solution(name) {\n  return { greet: () => `Hi, I'm ${name}!` };\n}",
  },
  {
    concept: "objects", language: "javascript", difficulty: "beginner", type: "exercise", order: 5, isSeeded: true,
    title: "Get All Keys",
    description: "Return an array of all the keys in the object.",
    starterCode: `function solution(obj) {
  // Return all keys as an array
}`,
    tests: [
      { id: "t1", description: "returns all 3 keys", code: `const keys = solution({a:1,b:2,c:3}); assert(keys.sort().join(",") === "a,b,c", 'should return ["a","b","c"]')` },
      { id: "t2", description: "empty object returns empty array", code: `assert(solution({}).length === 0, "empty object should return []")` },
    ],
    hints: ["Use Object.keys(obj)"],
    solution: `function solution(obj) {\n  return Object.keys(obj);\n}`,
  },
  {
    concept: "objects", language: "javascript", difficulty: "beginner", type: "exercise", order: 6, isSeeded: true,
    title: "Nested Object",
    description: "Return the `city` from the nested `address` object inside `person`.",
    starterCode: `function solution(person) {
  // Return person.address.city
}`,
    tests: [
      { id: "t1", description: "accesses nested city", code: `assert(solution({ name: "Alice", address: { city: "Austin", zip: "78701" } }) === "Austin", 'should return "Austin"')` },
      { id: "t2", description: "works with different city", code: `assert(solution({ name: "Bob", address: { city: "Dallas" } }) === "Dallas", 'should return "Dallas"')` },
    ],
    hints: ["Use dot notation twice: person.address.city"],
    solution: `function solution(person) {\n  return person.address.city;\n}`,
  },
  {
    concept: "objects", language: "javascript", difficulty: "intermediate", type: "challenge", order: 7, isSeeded: true,
    title: "Student Gradebook",
    description: "Write a function that returns a gradebook object with three methods:\n- `addGrade(grade)` — adds a grade (number 0–100)\n- `getAverage()` — returns the average of all grades (rounded to nearest whole number)\n- `getLetterGrade()` — returns `\"A\"` (90+), `\"B\"` (80+), `\"C\"` (70+), `\"D\"` (60+), or `\"F\"` (below 60) based on the average",
    starterCode: `function solution() {
  // Return an object with addGrade(), getAverage(), getLetterGrade()
}`,
    tests: [
      { id: "t1", description: "getAverage() works correctly", code: `const s = solution(); s.addGrade(90); s.addGrade(80); assert(s.getAverage() === 85, "average of 90 and 80 should be 85")` },
      { id: "t2", description: "getLetterGrade() returns A", code: `const s = solution(); s.addGrade(95); assert(s.getLetterGrade() === "A", "95 average should be A")` },
      { id: "t3", description: "getLetterGrade() returns C", code: `const s = solution(); s.addGrade(75); assert(s.getLetterGrade() === "C", "75 average should be C")` },
      { id: "t4", description: "getLetterGrade() returns F", code: `const s = solution(); s.addGrade(50); assert(s.getLetterGrade() === "F", "50 average should be F")` },
    ],
    hints: ["Use a closure to store grades in a private array", "reduce() to sum all grades, then divide by length", "Use if/else chain for letter grades"],
    solution: `function solution() {\n  const grades = [];\n  return {\n    addGrade: (g) => grades.push(g),\n    getAverage: () => Math.round(grades.reduce((s,g) => s+g, 0) / grades.length),\n    getLetterGrade: () => {\n      const avg = Math.round(grades.reduce((s,g) => s+g, 0) / grades.length);\n      if (avg >= 90) return "A";\n      if (avg >= 80) return "B";\n      if (avg >= 70) return "C";\n      if (avg >= 60) return "D";\n      return "F";\n    },\n  };\n}`,
  },

  // ─── CONTROL FLOW ────────────────────────────────────────────────────────────
  {
    concept: "control-flow", language: "javascript", difficulty: "beginner", type: "exercise", order: 1, isSeeded: true,
    title: "Positive, Negative, or Zero",
    description: "Return `\"positive\"` if `n > 0`, `\"negative\"` if `n < 0`, or `\"zero\"` if `n === 0`.",
    starterCode: `function solution(n) {
  // Return "positive", "negative", or "zero"
}`,
    tests: [
      { id: "t1", description: "solution(5) returns \"positive\"", code: `assert(solution(5) === "positive", 'should return "positive"')` },
      { id: "t2", description: "solution(-3) returns \"negative\"", code: `assert(solution(-3) === "negative", 'should return "negative"')` },
      { id: "t3", description: "solution(0) returns \"zero\"", code: `assert(solution(0) === "zero", 'should return "zero"')` },
    ],
    hints: ["Use if / else if / else", "Check for 0 last (or first — either works)"],
    solution: `function solution(n) {\n  if (n > 0) return "positive";\n  if (n < 0) return "negative";\n  return "zero";\n}`,
  },
  {
    concept: "control-flow", language: "javascript", difficulty: "beginner", type: "exercise", order: 2, isSeeded: true,
    title: "Letter Grade",
    description: "Return the letter grade: `\"A\"` (90+), `\"B\"` (80+), `\"C\"` (70+), `\"D\"` (60+), `\"F\"` (below 60).",
    starterCode: `function solution(score) {
  // Return the letter grade for the given score
}`,
    tests: [
      { id: "t1", description: "solution(95) returns \"A\"", code: `assert(solution(95) === "A", '95 should be "A"')` },
      { id: "t2", description: "solution(85) returns \"B\"", code: `assert(solution(85) === "B", '85 should be "B"')` },
      { id: "t3", description: "solution(75) returns \"C\"", code: `assert(solution(75) === "C", '75 should be "C"')` },
      { id: "t4", description: "solution(65) returns \"D\"", code: `assert(solution(65) === "D", '65 should be "D"')` },
      { id: "t5", description: "solution(55) returns \"F\"", code: `assert(solution(55) === "F", '55 should be "F"')` },
    ],
    hints: ["Use else if to chain conditions", "Check from highest to lowest so 95 hits \"A\" first"],
    solution: `function solution(score) {\n  if (score >= 90) return "A";\n  if (score >= 80) return "B";\n  if (score >= 70) return "C";\n  if (score >= 60) return "D";\n  return "F";\n}`,
  },
  {
    concept: "control-flow", language: "javascript", difficulty: "beginner", type: "exercise", order: 3, isSeeded: true,
    title: "Day of the Week",
    description: "Use a `switch` statement to return the day name for a number (1 = Monday, 7 = Sunday). Return `\"Invalid\"` for any other number.",
    starterCode: `function solution(day) {
  // Use a switch statement
}`,
    tests: [
      { id: "t1", description: "solution(1) returns \"Monday\"", code: `assert(solution(1) === "Monday", '1 should be "Monday"')` },
      { id: "t2", description: "solution(5) returns \"Friday\"", code: `assert(solution(5) === "Friday", '5 should be "Friday"')` },
      { id: "t3", description: "solution(7) returns \"Sunday\"", code: `assert(solution(7) === "Sunday", '7 should be "Sunday"')` },
      { id: "t4", description: "solution(0) returns \"Invalid\"", code: `assert(solution(0) === "Invalid", '0 should return "Invalid"')` },
    ],
    hints: ["switch(day) { case 1: return \"Monday\"; ... }", "Use default: for the invalid case"],
    solution: `function solution(day) {\n  switch(day) {\n    case 1: return "Monday";\n    case 2: return "Tuesday";\n    case 3: return "Wednesday";\n    case 4: return "Thursday";\n    case 5: return "Friday";\n    case 6: return "Saturday";\n    case 7: return "Sunday";\n    default: return "Invalid";\n  }\n}`,
  },
  {
    concept: "control-flow", language: "javascript", difficulty: "beginner", type: "exercise", order: 4, isSeeded: true,
    title: "Default Value",
    description: "Return `name` if it's a truthy string, otherwise return `\"Anonymous\"`.",
    starterCode: `function solution(name) {
  // Return name if truthy, otherwise "Anonymous"
}`,
    tests: [
      { id: "t1", description: "solution(\"Alice\") returns \"Alice\"", code: `assert(solution("Alice") === "Alice", 'should return "Alice"')` },
      { id: "t2", description: "solution(\"\") returns \"Anonymous\"", code: `assert(solution("") === "Anonymous", 'empty string should return "Anonymous"')` },
      { id: "t3", description: "solution(null) returns \"Anonymous\"", code: `assert(solution(null) === "Anonymous", 'null should return "Anonymous"')` },
      { id: "t4", description: "solution(undefined) returns \"Anonymous\"", code: `assert(solution(undefined) === "Anonymous", 'undefined should return "Anonymous"')` },
    ],
    hints: ["Use the || (OR) operator: name || \"Anonymous\"", "Falsy values fall through to the right side of ||"],
    solution: `function solution(name) {\n  return name || "Anonymous";\n}`,
  },
  {
    concept: "control-flow", language: "javascript", difficulty: "beginner", type: "exercise", order: 5, isSeeded: true,
    title: "Can Vote?",
    description: "Return `true` if a person can vote — they must be `age >= 18` AND `citizen === true`.",
    starterCode: `function solution(age, citizen) {
  // Both conditions must be true
}`,
    tests: [
      { id: "t1", description: "solution(18, true) returns true", code: `assert(solution(18, true) === true, "18 and citizen should return true")` },
      { id: "t2", description: "solution(17, true) returns false", code: `assert(solution(17, true) === false, "under 18 should return false")` },
      { id: "t3", description: "solution(20, false) returns false", code: `assert(solution(20, false) === false, "not a citizen should return false")` },
    ],
    hints: ["Use && (AND) — both conditions must be true"],
    solution: `function solution(age, citizen) {\n  return age >= 18 && citizen === true;\n}`,
  },
  {
    concept: "control-flow", language: "javascript", difficulty: "intermediate", type: "challenge", order: 6, isSeeded: true,
    title: "Traffic Light",
    description: "Simulate a traffic light sequence:\n- `\"red\"` → `\"green\"`\n- `\"green\"` → `\"yellow\"`\n- `\"yellow\"` → `\"red\"`\n- Anything else → `\"unknown\"`",
    starterCode: `function solution(color) {
  // Return the next color in the traffic light sequence
}`,
    tests: [
      { id: "t1", description: "red → green", code: `assert(solution("red") === "green", '"red" should go to "green"')` },
      { id: "t2", description: "green → yellow", code: `assert(solution("green") === "yellow", '"green" should go to "yellow"')` },
      { id: "t3", description: "yellow → red", code: `assert(solution("yellow") === "red", '"yellow" should go to "red"')` },
      { id: "t4", description: "invalid color → unknown", code: `assert(solution("blue") === "unknown", 'invalid should return "unknown"')` },
    ],
    hints: ["A lookup object is elegant: const next = { red: \"green\", ... }", "next[color] || \"unknown\" handles the invalid case"],
    solution: `function solution(color) {\n  const next = { red: "green", green: "yellow", yellow: "red" };\n  return next[color] || "unknown";\n}`,
  },

  // ─── LOOPS ───────────────────────────────────────────────────────────────────
  {
    concept: "loops", language: "javascript", difficulty: "beginner", type: "exercise", order: 1, isSeeded: true,
    title: "Count Up",
    description: "Return an array of numbers from `1` to `n` using a `for` loop.",
    starterCode: `function solution(n) {
  // Build and return an array [1, 2, ..., n]
}`,
    tests: [
      { id: "t1", description: "solution(5) returns [1,2,3,4,5]", code: `assert(JSON.stringify(solution(5)) === JSON.stringify([1,2,3,4,5]), "should return [1,2,3,4,5]")` },
      { id: "t2", description: "solution(1) returns [1]", code: `assert(JSON.stringify(solution(1)) === JSON.stringify([1]), "should return [1]")` },
      { id: "t3", description: "solution(0) returns []", code: `assert(solution(0).length === 0, "should return empty array for 0")` },
    ],
    hints: ["Start an empty array, then push inside the loop", "for (let i = 1; i <= n; i++)"],
    solution: `function solution(n) {\n  const result = [];\n  for (let i = 1; i <= n; i++) result.push(i);\n  return result;\n}`,
  },
  {
    concept: "loops", language: "javascript", difficulty: "beginner", type: "exercise", order: 2, isSeeded: true,
    title: "Sum with Loop",
    description: "Return the sum of all integers from `1` to `n` using a loop.",
    starterCode: `function solution(n) {
  // Add 1 + 2 + ... + n using a loop
}`,
    tests: [
      { id: "t1", description: "solution(5) returns 15", code: `assert(solution(5) === 15, "1+2+3+4+5 = 15")` },
      { id: "t2", description: "solution(10) returns 55", code: `assert(solution(10) === 55, "sum 1 to 10 = 55")` },
      { id: "t3", description: "solution(1) returns 1", code: `assert(solution(1) === 1, "sum 1 to 1 = 1")` },
    ],
    hints: ["Declare sum = 0 before the loop", "Add i to sum each iteration"],
    solution: `function solution(n) {\n  let sum = 0;\n  for (let i = 1; i <= n; i++) sum += i;\n  return sum;\n}`,
  },
  {
    concept: "loops", language: "javascript", difficulty: "beginner", type: "exercise", order: 3, isSeeded: true,
    title: "Repeat a String",
    description: "Return `str` repeated `n` times using a `while` loop. `solution(\"ha\", 3)` → `\"hahaha\"`.",
    starterCode: `function solution(str, n) {
  // Repeat str n times using a while loop
  let result = "";
  // Your loop here
  return result;
}`,
    tests: [
      { id: "t1", description: "solution(\"ha\", 3) returns \"hahaha\"", code: `assert(solution("ha", 3) === "hahaha", 'should return "hahaha"')` },
      { id: "t2", description: "solution(\"ab\", 2) returns \"abab\"", code: `assert(solution("ab", 2) === "abab", 'should return "abab"')` },
      { id: "t3", description: "solution(\"x\", 0) returns \"\"", code: `assert(solution("x", 0) === "", 'repeating 0 times should return ""')` },
    ],
    hints: ["while (count < n) { result += str; count++; }", "Initialize a counter before the loop"],
    solution: `function solution(str, n) {\n  let result = "";\n  let i = 0;\n  while (i < n) { result += str; i++; }\n  return result;\n}`,
  },
  {
    concept: "loops", language: "javascript", difficulty: "beginner", type: "exercise", order: 4, isSeeded: true,
    title: "Sum with for...of",
    description: "Use a `for...of` loop to return the sum of all numbers in the array.",
    starterCode: `function solution(arr) {
  // Use for...of to sum the array
}`,
    tests: [
      { id: "t1", description: "solution([1,2,3,4]) returns 10", code: `assert(solution([1,2,3,4]) === 10, "1+2+3+4 = 10")` },
      { id: "t2", description: "solution([10,20,30]) returns 60", code: `assert(solution([10,20,30]) === 60, "10+20+30 = 60")` },
    ],
    hints: ["for (const num of arr) — no index needed", "Start sum at 0 and add each number"],
    solution: `function solution(arr) {\n  let sum = 0;\n  for (const n of arr) sum += n;\n  return sum;\n}`,
  },
  {
    concept: "loops", language: "javascript", difficulty: "beginner", type: "exercise", order: 5, isSeeded: true,
    title: "Find Index in Loop",
    description: "Return the index of the first number in the array that is greater than `target`. Return `-1` if none found.",
    starterCode: `function solution(arr, target) {
  // Return index of first element > target, or -1
}`,
    tests: [
      { id: "t1", description: "solution([1,5,3,8], 4) returns 1", code: `assert(solution([1,5,3,8], 4) === 1, "5 at index 1 is first > 4")` },
      { id: "t2", description: "solution([1,2,3], 10) returns -1", code: `assert(solution([1,2,3], 10) === -1, "none > 10 returns -1")` },
      { id: "t3", description: "solution([10,20,30], 5) returns 0", code: `assert(solution([10,20,30], 5) === 0, "10 at index 0 is first > 5")` },
    ],
    hints: ["Loop with an index: for (let i = 0; ...)", "return i immediately when found", "return -1 after the loop ends"],
    solution: `function solution(arr, target) {\n  for (let i = 0; i < arr.length; i++) {\n    if (arr[i] > target) return i;\n  }\n  return -1;\n}`,
  },
  {
    concept: "loops", language: "javascript", difficulty: "beginner", type: "exercise", order: 6, isSeeded: true,
    title: "Collect Values with for...in",
    description: "Use a `for...in` loop to return an array of all values in the object.",
    starterCode: `function solution(obj) {
  // Use for...in to collect all values
}`,
    tests: [
      { id: "t1", description: "returns all values", code: `const vals = solution({a:1,b:2,c:3}); assert(vals.sort((a,b)=>a-b).join(",") === "1,2,3", 'should return [1,2,3]')` },
      { id: "t2", description: "empty object returns []", code: `assert(solution({}).length === 0, "empty object returns []")` },
    ],
    hints: ["for (const key in obj) — iterates over keys", "Push obj[key] to collect the values"],
    solution: `function solution(obj) {\n  const values = [];\n  for (const key in obj) values.push(obj[key]);\n  return values;\n}`,
  },
  {
    concept: "loops", language: "javascript", difficulty: "intermediate", type: "challenge", order: 7, isSeeded: true,
    title: "FizzBuzz",
    description: "Return an array of FizzBuzz results from `1` to `n`:\n- Multiples of 3 AND 5 → `\"FizzBuzz\"`\n- Multiples of 3 only → `\"Fizz\"`\n- Multiples of 5 only → `\"Buzz\"`\n- Otherwise → the number itself\n\nThis is one of the most famous programming exercises!",
    starterCode: `function solution(n) {
  // Return FizzBuzz array from 1 to n
}`,
    tests: [
      { id: "t1", description: "15th element is \"FizzBuzz\"", code: `assert(solution(15)[14] === "FizzBuzz", 'index 14 (number 15) should be "FizzBuzz"')` },
      { id: "t2", description: "3rd element is \"Fizz\"", code: `assert(solution(15)[2] === "Fizz", 'index 2 (number 3) should be "Fizz"')` },
      { id: "t3", description: "5th element is \"Buzz\"", code: `assert(solution(15)[4] === "Buzz", 'index 4 (number 5) should be "Buzz"')` },
      { id: "t4", description: "1st element is 1 (the number)", code: `assert(solution(15)[0] === 1, 'index 0 (number 1) should be 1')` },
    ],
    hints: ["Check FizzBuzz (divisible by both) FIRST, then Fizz, then Buzz", "i % 15 === 0 is the same as (i % 3 === 0 && i % 5 === 0)", "Push the result each iteration"],
    solution: `function solution(n) {\n  const r = [];\n  for (let i = 1; i <= n; i++) {\n    if (i % 15 === 0) r.push("FizzBuzz");\n    else if (i % 3 === 0) r.push("Fizz");\n    else if (i % 5 === 0) r.push("Buzz");\n    else r.push(i);\n  }\n  return r;\n}`,
  },

  // ─── FUNCTIONS ───────────────────────────────────────────────────────────────
  {
    concept: "functions", language: "javascript", difficulty: "beginner", type: "exercise", order: 1, isSeeded: true,
    title: "Multiply",
    description: "Write a function that takes two numbers and returns their product.",
    starterCode: `function solution(a, b) {
  // Return the product of a and b
}`,
    tests: [
      { id: "t1", description: "solution(3, 4) returns 12", code: `assert(solution(3, 4) === 12, "3 * 4 should be 12")` },
      { id: "t2", description: "solution(0, 5) returns 0", code: `assert(solution(0, 5) === 0, "0 * 5 should be 0")` },
      { id: "t3", description: "solution(-2, 3) returns -6", code: `assert(solution(-2, 3) === -6, "-2 * 3 should be -6")` },
    ],
    hints: ["Use the * operator", "Just return a * b"],
    solution: `function solution(a, b) {\n  return a * b;\n}`,
  },
  {
    concept: "functions", language: "javascript", difficulty: "beginner", type: "exercise", order: 2, isSeeded: true,
    title: "Arrow Function",
    description: "Write an arrow function named `solution` that takes a number `n` and returns `n * 2`.",
    starterCode: `// Write an arrow function named 'solution'
// that takes n and returns n * 2
const solution = ???`,
    tests: [
      { id: "t1", description: "solution(5) returns 10", code: `assert(solution(5) === 10, "solution(5) should return 10")` },
      { id: "t2", description: "solution(0) returns 0", code: `assert(solution(0) === 0, "solution(0) should return 0")` },
      { id: "t3", description: "solution(-3) returns -6", code: `assert(solution(-3) === -6, "solution(-3) should return -6")` },
    ],
    hints: ["Syntax: const fn = (param) => expression", "For a single expression, no curly braces or return needed"],
    solution: `const solution = n => n * 2;`,
  },
  {
    concept: "functions", language: "javascript", difficulty: "beginner", type: "exercise", order: 3, isSeeded: true,
    title: "Default Parameter",
    description: "Write a `greet` function with a default parameter. If no name is provided, use `\"stranger\"`.",
    starterCode: `function solution(name = ???) {
  // Return "Hello, [name]!"
}`,
    tests: [
      { id: "t1", description: "solution(\"Alice\") returns \"Hello, Alice!\"", code: `assert(solution("Alice") === "Hello, Alice!", 'should return "Hello, Alice!"')` },
      { id: "t2", description: "solution() uses default \"stranger\"", code: `assert(solution() === "Hello, stranger!", 'no argument should return "Hello, stranger!"')` },
    ],
    hints: ["Default: function solution(name = \"stranger\")", "The default is only used when no argument is passed"],
    solution: 'function solution(name = "stranger") {\n  return `Hello, ${name}!`;\n}',
  },
  {
    concept: "functions", language: "javascript", difficulty: "beginner", type: "exercise", order: 4, isSeeded: true,
    title: "Early Return",
    description: "Return `\"too young\"` if `age < 18`, `\"too old\"` if `age > 65`, otherwise `\"eligible\"`.\n\nUse early returns to keep the code clean.",
    starterCode: `function solution(age) {
  // Use early returns for each edge case
}`,
    tests: [
      { id: "t1", description: "solution(17) returns \"too young\"", code: `assert(solution(17) === "too young", '17 should be "too young"')` },
      { id: "t2", description: "solution(66) returns \"too old\"", code: `assert(solution(66) === "too old", '66 should be "too old"')` },
      { id: "t3", description: "solution(25) returns \"eligible\"", code: `assert(solution(25) === "eligible", '25 should be "eligible"')` },
      { id: "t4", description: "boundary: 18 is eligible", code: `assert(solution(18) === "eligible", '18 should be "eligible"')` },
      { id: "t5", description: "boundary: 65 is eligible", code: `assert(solution(65) === "eligible", '65 should be "eligible"')` },
    ],
    hints: ["Return early for each special case", "The final return handles everything in between"],
    solution: `function solution(age) {\n  if (age < 18) return "too young";\n  if (age > 65) return "too old";\n  return "eligible";\n}`,
  },
  {
    concept: "functions", language: "javascript", difficulty: "beginner", type: "exercise", order: 5, isSeeded: true,
    title: "Apply Twice",
    description: "Write a function that takes another function `fn` and a `value`, applies `fn` to the value twice, and returns the result.",
    starterCode: `function solution(fn, value) {
  // Call fn(fn(value)) and return the result
}`,
    tests: [
      { id: "t1", description: "doubles twice: 3 → 12", code: `assert(solution(n => n * 2, 3) === 12, "double applied twice to 3 = 12")` },
      { id: "t2", description: "add 1 twice: 5 → 7", code: `assert(solution(n => n + 1, 5) === 7, "add 1 twice to 5 = 7")` },
      { id: "t3", description: "works with strings", code: `assert(solution(s => s + "!", "hi") === "hi!!", '"hi" + "!" twice = "hi!!"')` },
    ],
    hints: ["Call fn once, then call fn again on the result", "fn(fn(value)) is the answer"],
    solution: `function solution(fn, value) {\n  return fn(fn(value));\n}`,
  },
  {
    concept: "functions", language: "javascript", difficulty: "beginner", type: "exercise", order: 6, isSeeded: true,
    title: "Custom Filter",
    description: "Write a function that returns items from `arr` where `callback(item)` returns `true`.",
    starterCode: `function solution(arr, callback) {
  // Return items where callback(item) is true
}`,
    tests: [
      { id: "t1", description: "filters numbers > 3", code: `assert(JSON.stringify(solution([1,2,3,4,5], n => n > 3)) === JSON.stringify([4,5]), "should return [4,5]")` },
      { id: "t2", description: "filters strings by length", code: `assert(JSON.stringify(solution(["a","bb","ccc"], s => s.length > 1)) === JSON.stringify(["bb","ccc"]), 'should return ["bb","ccc"]')` },
    ],
    hints: ["You're reimplementing .filter()", "Loop through arr, push to result if callback(item) is true"],
    solution: `function solution(arr, callback) {\n  return arr.filter(callback);\n}`,
  },
  {
    concept: "functions", language: "javascript", difficulty: "intermediate", type: "challenge", order: 7, isSeeded: true,
    title: "Function Composition",
    description: "Write a `compose` function that takes two functions `f` and `g` and returns a new function that applies `g` first, then `f`.\n\n`compose(f, g)(x)` is the same as `f(g(x))`.",
    starterCode: `function solution(f, g) {
  // Return a new function: x => f(g(x))
}`,
    tests: [
      { id: "t1", description: "double(addOne(3)) = 8", code: `const double = n => n * 2; const addOne = n => n + 1; const fn = solution(double, addOne); assert(fn(3) === 8, "double(addOne(3)) should be 8")` },
      { id: "t2", description: "upper(exclaim(\"hello\")) = \"HELLO!\"", code: `const upper = s => s.toUpperCase(); const exclaim = s => s + "!"; const fn = solution(upper, exclaim); assert(fn("hello") === "HELLO!", 'should return "HELLO!"')` },
    ],
    hints: ["Return a function: return (x) => f(g(x))", "g runs first, then f runs on g's result"],
    solution: `function solution(f, g) {\n  return x => f(g(x));\n}`,
  },
  {
    concept: "functions", language: "javascript", difficulty: "intermediate", type: "challenge", order: 8, isSeeded: true,
    title: "Memoize",
    description: "Write a `memoize` function that caches the result of a function call. If the function is called again with the same argument, return the cached result instead of recomputing.\n\nThis is an important performance optimization technique.",
    starterCode: `function solution(fn) {
  // Return a memoized version of fn
  // Cache results based on the first argument
}`,
    tests: [
      { id: "t1", description: "only computes once for same input", code: `let count = 0; const fn = solution(n => { count++; return n * 2; }); fn(5); fn(5); fn(5); assert(count === 1, "should only compute once for the same input")` },
      { id: "t2", description: "returns correct results", code: `const fn = solution(n => n * 3); assert(fn(4) === 12 && fn(10) === 30, "should return correct results")` },
      { id: "t3", description: "computes separately for different inputs", code: `let count = 0; const fn = solution(n => { count++; return n; }); fn(1); fn(2); fn(1); assert(count === 2, "should compute for each unique input")` },
    ],
    hints: ["Use a cache object: const cache = {}", "Check if cache[x] !== undefined before calling fn", "Store result: cache[x] = fn(x)"],
    solution: `function solution(fn) {\n  const cache = {};\n  return function(x) {\n    if (cache[x] !== undefined) return cache[x];\n    cache[x] = fn(x);\n    return cache[x];\n  };\n}`,
  },
];
