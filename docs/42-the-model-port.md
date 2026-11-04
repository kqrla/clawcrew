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
