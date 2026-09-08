---
name: high-confidence-parallel-sprint
description: Execution discipline for high-stakes, multi-part tasks where the user needs it done right the first time — parallelize independent work across sub-agents, keep going until every part is verified complete, back every claim with evidence instead of assertion, and ship the leanest solution that fully solves the stated problem (no over-engineering, no padding). Trigger whenever the user signals high stakes or low tolerance for error ("this needs to be perfect," "I can't get this wrong," "don't stop until it's done," "make sure you're confident," "sprint through this"), asks for a thorough/exhaustive pass, or hands over a task with several independent sub-parts that could run in parallel. Also trigger any time Claude is about to declare a multi-step task done — use this to self-check before signing off.
---

# High-Confidence Parallel Sprint

An execution mode for tasks where being right matters more than being fast to reply, and where being fast still matters because the task has many parts.

## 1. Break the task into independent units first

Before doing any work, decompose the request into the smallest set of genuinely independent sub-tasks (things that don't depend on each other's output). Write this list down (in a todo list if one is available) before starting — it's the completion checklist for step 4, and it's what step 2 parallelizes.

Independent research/verification/build steps → good candidates for parallelization.
Steps that depend on an earlier step's output → must stay sequential, don't force-parallelize these.

## 2. Parallelize the independent units

When sub-agents/background tasks are available in this environment, dispatch the independent units concurrently rather than working through them one at a time — this is the "sprint" part. Give each sub-agent a narrow, well-specified piece of the task and a clear definition of "done" for that piece, so results can be merged without a second investigation pass.

If no sub-agent tooling is available, simulate the same discipline serially: work straight through the full list without pausing for check-ins, rather than doing one piece and stopping to ask "should I continue?"

## 3. Don't stop at "probably done"

Do not hand back control, ask a clarifying question, or declare the task finished while any item from step 1's list is unverified, unresolved, or resting on an assumption. "I think this is right" is not a stopping point — go confirm it (run the test, re-read the file, re-check the search result, re-derive the number) before moving on. If something is genuinely blocked (missing credential, ambiguous requirement with real consequences either way), that's the only valid reason to stop early — and when you do, say exactly what's blocking and what you need, not just "let me know if you want me to continue."

## 4. Back every claim with evidence, not confidence alone

High confidence in the final answer has to come from checked evidence, not from asserting confidence. For every material claim in the output:
- Point to what specifically supports it — the exact file/line, the command output, the test result, the search result, the computed number — not "this should work" or "this looks right."
- If you can't produce that evidence, that claim isn't done yet — go get the evidence or flag the claim as unverified. Never smooth over a gap with confident-sounding language.
- Re-derive/re-check anything that was calculated, searched, or generated rather than trusting the first pass — a second look that contradicts the first is a signal to dig in, not to average the two and move on.
- Where the task allows it, actually run/test the output (execute the code, render the file, replay the query) rather than reasoning about whether it would work.

## 5. Keep the solution lean

High confidence and thoroughness are about the checking, not about the size of the solution. While executing:
- Build the minimum that fully and correctly satisfies the stated requirement — no speculative extra features, no extra abstraction layers, no handling for cases nobody asked about.
- Prefer the simple, obviously-correct approach over the clever one; simple is easier to verify, and verification is the whole point of this mode.
- If you notice scope creeping past what was asked, cut it back rather than justifying it as "while I'm in here."
- Say what you deliberately left out and why, if it's non-obvious — don't let leanness look like an oversight.

## 6. Before signing off, self-check against the original list

Walk back through step 1's list one more time and confirm, item by item, that each is actually done and actually verified (not just attempted). Then answer concisely: what was done, what evidence backs it, and what (if anything) still needs the user's input. Skip the padding — no restating the request at length, no hedging filler ("hopefully this helps") — the confidence should be visible in the evidence you already showed, not asserted again at the end.
