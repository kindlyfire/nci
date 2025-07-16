# Content Index Spec

Version: 1

## Overview

A content index consists of multiple Nostr events with:

-   Event kind `30078`
-   A `t` tag with a value of `nci:<primary-key>`
-   A required metadata event that contains index metadata
-   Zero or more content events that contain the actual index items

The URL format is:

```
nci:<npub>?k=<key>
```

Where `<npub>` is the public key of the author of the content index (in npub or hex format), and
`<key>` is the primary key.

All events returned by a query of `kind=30078` and tag `#t: ["nci:<key>"]` will be merged into a
single content index.

## Event structure

### Metadata Events

Each content index **requires** a metadata event with:

-   `d` tag: `nci:<primary-key>:meta`
-   `t` tag: `nci`
-   `t` tag: `nci-meta`
-   `t` tag: `nci:<primary-key>`
-   `chunks`: total number of content events (chunks)
-   `items`: total number of items in the index
-   Optional tags:
    -   `title`
    -   `summary`
    -   `url`
-   Empty `content` field

### Content Events

Content events contain the chunks of items in the content index:

-   `d` tag: `nci:<primary-key>:<chunk-index>`
-   `t` tag: `nci`
-   `t` tag: `nci:<primary-key>`
-   `content` field contains JSON representation of:

```typescript
interface Content {
	items: Array<Item>
}
```

See "Index item" for the structure of `Item`.

## Index item

An index item consists of a title, a summary, a timestamp, and one or more URLs, encoded as an
array. In addition, it may contain tags after the URLs.

```json
[
	"My title",
	"My summary",
	1752310499,
	["http://example.com", "ipfs://example-cid", "magnet:?xt=urn:btih:examplehash"],
	["t", "technology"],
	["t", "tutorial"]
]
```

Type:

```ts
// Title, summary, timestamp, URLs, and optional tags
type Item = [string, string, number, string[], ...string[][]]
```

A title must be present. The summary may be empty, and the timestamp may be `0`, to mark them as
"not present". The URLs array may also be empty.

Tags are represented as key-value pairs where the first element is the tag type (typically "t") and
the second element is the tag value. When parsed, only tags with type "t" are extracted and used.

## Full index example

### Metadata Event

```json
{
	"kind": 30078,
	"pubkey": "npub1...",
	"tags": [
		["d", "nci:example-index:meta"],
		["t", "nci"],
		["t", "nci-meta"],
		["t", "nci:example-index"],
		["title", "Example Content Index"],
		["summary", "This is an example content index."],
		["url", "https://github.com/a-user/a-repo"],
		["chunks", "1"],
		["items", "1"]
	],
	"content": "",
	"created_at": 1700000000
}
```

### Content Event

```json
{
	"kind": 30078,
	"pubkey": "npub1...",
	"tags": [
		["d", "nci:example-index:0"],
		["t", "nci"],
		["t", "nci:example-index"]
	],
	"content": "{\"items\":[[\"My title\",\"My summary\",1752310499,[\"http://example.com\",\"ipfs://example-cid\",\"magnet:?xt=urn:btih:examplehash\"],[\"t\",\"technology\"]]]}"
}
```

## Chunking

Items must be chunked into multiple content events when they exceed a reasonable size (the reference
implementation uses 90KB). The index of the chunk is included in its `d` tag, and the number of
chunks is specified in the metadata event's `chunks` tag.

## Querying

To retrieve a complete content index:

1. Query for the index's events: `kind=30078` with `#t: ["nci:<primary-key>"]` and
   `authors:["<pubkey>"]`
2. Find the metadata event, then filter the returned content events to include only those with a
   chunk index below the total number of chunks
