# nci

`nci` is a program to search and publish content indexes (lists of URLs, IPFS
CIDs, magnet links, ...) hosted on the Nostr network.

Spec: [SPECIFICATION.md](SPECIFICATION.md)

## Installation

```bash
npx @kindlyfire/nci --help

# Or install it globally
npm install -g @kindlyfire/nci
nci --help

# Usage: nci [options] [command]
#
# CLI for managing content indexes on nostr
#
# Commands:
#   search [options] <source> [query]  Search content indexes
#   publish [options] <file>           Publish an index file to nostr
#   delete [options]                   Delete all NCI events associated with a private key
#   list-indexes [options]             List all content indexes
#   help [command]                     display help for command
```

## Usage

Publish an index:

```bash
$ npx @kindlyfire/nci publish example-index.yaml --privkey <your-private-key>
📄 Loading index file: example-index.yaml
   Primary Key: programming-tutorials
   Title: Programming Tutorials (dummy data)
   Summary: Collection of programming tutorials and courses  (dummy data)
   URL: https://github.com/example/programming-tutorials
   Items: 5

--- Event 1/2
✅ All relays succeeded

--- Event 2/2
✅ All relays succeeded

URI: nci:<public key>?k=programming-tutorials
```

Query an index:

```bash
$ npx @kindlyfire/nci search 'nci:<public key>?k=programming-tutorials' type
Found 1 matching item(s) in "Programming Tutorials (dummy data)":

1. TypeScript Fundamentals (1/15/2024)
   Complete guide to TypeScript from basics to advanced features
   typescript, javascript, programming
   https://example.com/typescript-fundamentals.mp4, ipfs://QmTypeScriptHash123456
```

List indexes. Without any kind of filters, this will list all indexes found on Nostr:

```bash
$ npx @kindlyfire/nci list-indexes
📋 Listing content indexes...

Found 1 index(es):

1. Programming Tutorials
   Collection of programming tutorials and courses
   URL: https://github.com/example/programming-tutorials
   URI: nci:null?k=programming-tutorials
   Items: 0
```

## Future Ideas

Potential ideas for future related work, not necessarily in this project:

-   An MCP server
-   A web interface
    -   This can be an SPA published on IPFS
-   Add JSON output option for the CLI commands
