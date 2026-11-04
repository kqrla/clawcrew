# 42 · the model port

`src/ports/model.ts` is the only file in this repo that names a vendor. it exposes one method, and three
things are true of it.

**it does not repair an answer.** a model that asks for `stripe.charge` keeps that call in the proposal,
so `auditProposal` refuses it as `tool_not_granted` and the seat takes a strike. an adapter that stripped
the call would be helping the model pass a test it should fail.

**it refuses what it cannot read.** prose instead of json throws `unreadable`, a 500 throws `http`, and
silence throws `timeout`. `runTurn` already turns a thrown provider into a scored refusal, so none of
these can be mistaken for success.

**it says who it is.** every provider carries a `label`, and the segment writes it on the row. a
template that reads like a model is the same defect as a plan that reads like a capability.

## the tests, and why they are a socket

`test/model.test.ts` starts a real http server and answers in four ways: a valid proposal, a call to a
tool it was not given, prose, and silence. that catches the class of bug a mocked `fetch` hides, because
the thing under test here is the mapping from a wire format to a proposal, and a mock would be testing
the mock. it also covers the anthropic text-block shape and a port that is closed.

## what a key looks like

```
ANTHROPIC_API_KEY=... ANTHROPIC_MODEL=claude-sonnet-5     # or
MODEL_API_KEY=... MODEL_BASE_URL=https://... MODEL_NAME=...  # anything openai-shaped
```

with no key set, `fromEnv` returns `null` and the segment runs the scripted rule, labelled. it never
guesses a provider and never quietly falls back without saying so.

## the first live run, and the three things it caught

model: `gpt-5.4-mini`, through the openai-compatible port. ticket `tkt.1005`, a cracked lid needed for
a gift on saturday.

1. **it refused, twice, and it was right.** the first two runs came back `arg_outside_scope` with
   `recipient: null`. the offer had listed `inbox.reply` as a bare name, so the seat had no way to
   know the tool takes a `recipient`, and no way to know the value must be `inbox`. a tool is now
   offered with its arguments and their allowed values, because a seat told only a name guesses, and
   a guess outside the grant costs it a strike.
2. **it refused a third time, and that was right too.** handed an id and a body with no statement of
   what the work was, it answered `block`: "no message content was provided to address ticket
   tkt.1005". the task payload now says the job. a seat that refuses an under-specified task is
   behaving correctly, and the fix belongs in the brief rather than in the prompt's sternness.
3. **the duplicate bridge.** the runner script carried its own copy of the model bridge, so edits to
   the real one changed nothing and the refusal looked like a model problem for three runs. there is
   now one bridge, in `src/jobs/support.ts`, and the script calls it.

the answer it wrote names the order, acknowledges the specific fault, and asks for a photograph, which
the second seat accepted. the row says `openai:gpt-5.4-mini@api.openai.com`, and the two tickets
answered before the key arrived still say `scripted:no-key`, because that is what wrote them.
