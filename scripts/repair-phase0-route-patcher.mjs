import fs from "node:fs";

const patcherPath =
  "scripts/apply-phase0-route-topology.mjs";

let source =
  fs.readFileSync(
    patcherPath,
    "utf8",
  ).replace(
    /\r\n/g,
    "\n",
  );

const start =
  source.indexOf(
    "function functionRange(",
  );

const end =
  source.indexOf(
    "const timestamp =",
    start,
  );

if (
  start < 0 ||
  end < 0 ||
  end <= start
) {
  throw new Error(
    "Could not locate the old functionRange helper.",
  );
}

const replacement = `function functionRange(
  content,
  signature,
) {
  const start =
    content.indexOf(
      signature,
    );

  if (start < 0) {
    throw new Error(
      \`Function not found: \${signature}\`,
    );
  }

  /*
   * Locate the real function-body brace.
   *
   * The previous parser selected the first brace after the function name.
   * For a function declared with a destructured argument:
   *
   *   function example({ value }) {
   *
   * that first brace belongs to the parameter, not the function body.
   */
  const parameterStart =
    content.indexOf(
      "(",
      start,
    );

  if (parameterStart < 0) {
    throw new Error(
      \`Parameter list not found: \${signature}\`,
    );
  }

  let parameterEnd = -1;
  let parenthesisDepth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (
    let index = parameterStart;
    index < content.length;
    index += 1
  ) {
    const character =
      content[index];

    const next =
      content[index + 1];

    if (lineComment) {
      if (character === "\\n") {
        lineComment = false;
      }

      continue;
    }

    if (blockComment) {
      if (
        character === "*" &&
        next === "/"
      ) {
        blockComment = false;
        index += 1;
      }

      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\\\") {
        escaped = true;
        continue;
      }

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (
      character === "/" &&
      next === "/"
    ) {
      lineComment = true;
      index += 1;
      continue;
    }

    if (
      character === "/" &&
      next === "*"
    ) {
      blockComment = true;
      index += 1;
      continue;
    }

    if (
      character === '"' ||
      character === "'" ||
      character === "\`"
    ) {
      quote = character;
      continue;
    }

    if (character === "(") {
      parenthesisDepth += 1;
      continue;
    }

    if (character === ")") {
      parenthesisDepth -= 1;

      if (parenthesisDepth === 0) {
        parameterEnd = index;
        break;
      }
    }
  }

  if (parameterEnd < 0) {
    throw new Error(
      \`Parameter list did not close: \${signature}\`,
    );
  }

  const openingBrace =
    content.indexOf(
      "{",
      parameterEnd + 1,
    );

  if (openingBrace < 0) {
    throw new Error(
      \`Function body not found: \${signature}\`,
    );
  }

  let depth = 0;
  quote = null;
  escaped = false;
  lineComment = false;
  blockComment = false;

  for (
    let index = openingBrace;
    index < content.length;
    index += 1
  ) {
    const character =
      content[index];

    const next =
      content[index + 1];

    if (lineComment) {
      if (character === "\\n") {
        lineComment = false;
      }

      continue;
    }

    if (blockComment) {
      if (
        character === "*" &&
        next === "/"
      ) {
        blockComment = false;
        index += 1;
      }

      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\\\") {
        escaped = true;
        continue;
      }

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (
      character === "/" &&
      next === "/"
    ) {
      lineComment = true;
      index += 1;
      continue;
    }

    if (
      character === "/" &&
      next === "*"
    ) {
      blockComment = true;
      index += 1;
      continue;
    }

    if (
      character === '"' ||
      character === "'" ||
      character === "\`"
    ) {
      quote = character;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return {
          start,
          end:
            index + 1,
        };
      }
    }
  }

  throw new Error(
    \`Closing brace not found: \${signature}\`,
  );
}

`;

source =
  source.slice(
    0,
    start,
  ) +
  replacement +
  source.slice(
    end,
  );

fs.writeFileSync(
  patcherPath,
  source,
  "utf8",
);

console.log(
  "✓ Route patcher now handles destructured function parameters.",
);
