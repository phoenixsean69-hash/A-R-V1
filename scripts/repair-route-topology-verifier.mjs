import fs from "node:fs";

const verifierPath =
  "scripts/verify-route-topology.mjs";

let source =
  fs.readFileSync(
    verifierPath,
    "utf8",
  ).replace(
    /\r\n/g,
    "\n",
  );

const oldAssertion = `  assert.equal(
    liveMalformedRoute
      .issues
      .some(
        (issue) =>
          issue.code ===
            "CatastrophicJump" ||
          issue.code ===
            "ReverseAfterApproach" ||
          issue.code ===
            "SevereDetour",
      ),
    true,
    "The malformed live route was not diagnosed.",
  );`;

const newAssertion = `  /*
   * Point 5 already enters the collision-capture area. The strongest and
   * earliest diagnosis is therefore PostCaptureContinuation: Point 6 and
   * Point 7 are invalid because the route has already reached Point Z.
   *
   * CatastrophicJump, ReverseAfterApproach and SevereDetour remain acceptable
   * diagnoses for malformed routes that have not entered collision capture.
   */
  assert.equal(
    liveMalformedRoute
      .issues
      .some(
        (issue) =>
          issue.code ===
            "PostCaptureContinuation" ||
          issue.code ===
            "CatastrophicJump" ||
          issue.code ===
            "ReverseAfterApproach" ||
          issue.code ===
            "SevereDetour",
      ),
    true,
    "The malformed live route was not diagnosed.",
  );

  assert.equal(
    liveMalformedRoute
      .issues
      .some(
        (issue) =>
          issue.code ===
          "PostCaptureContinuation",
      ),
    true,
    "The live route did not report continuation after collision capture.",
  );`;

if (!source.includes(oldAssertion)) {
  throw new Error(
    "Could not locate the old malformed-route assertion.",
  );
}

source =
  source.replace(
    oldAssertion,
    newAssertion,
  );

fs.writeFileSync(
  verifierPath,
  source,
  "utf8",
);

console.log(
  "✓ Live-route verifier now accepts the correct collision-capture diagnosis.",
);
