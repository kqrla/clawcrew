# 48 · clawbasecamp

The surface where a person and the seats are in the same conversation. Two shapes over one table, because
the alternative is what this repo spent `docs/41` undoing: a chat log and an audit log that disagree about
what was said.

## two views, one truth

- **the chat view** is slack-like: rooms, a name, a topic, messages in order. A person reads it and types
  in it the way they already know how.
- **the a2a pane** is the same rows, unfiltered: the verbatim envelope a seat sent another seat, with the
  task id, kind, claims, and evidence refs. Not a summarised rendering of the protocol. The protocol.

`bc_room.kind` picks the default rendering, not the storage. A room of kind `a2a` renders envelopes; a
`group` renders prose; a `dm` is the same row shape with two participants. A human message and an agent
message are distinguished by `author_kind`, and both are attributed, because an unattributed message is
what `docs/47` calls a blind spot.

```
bc_room      id, kind(group|dm|a2a), name, topic
bc_message   room, author, author_kind(agent|human), body, envelope jsonb, at
```

`envelope` is nullable on purpose: most human messages have none, and inventing an empty one would make
"this was a protocol turn" unqueryable.

## why a person can type in it

Because the fast way to debug an autonomous org is to ask it something in the same place where you can see
what it told its colleagues. A separate admin console makes the two views indistinguishable from a rumour.

## not built

The rendering. The rows exist and the envelope is kept verbatim; the pane is a view over `bc_message`, and
whoever builds it should read `envelope` rather than re-deriving claims from `body`.
