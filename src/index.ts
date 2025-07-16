#!/usr/bin/env node

import { Command } from 'commander'
import { registerSearch } from './cli/search.js'
import { registerPublish } from './cli/publish.js'
// import { registerDevEvents } from './cli/dev-events.js'
import { registerDelete } from './cli/delete.js'
import { registerListIndexes } from './cli/list-indexes.js'

const program = new Command()

program
	.name(process.argv[1]!.split('/').pop() || 'nci-cli')
	.description('CLI for managing content indexes on nostr')
	.version('1.0.0')

registerSearch(program)
registerPublish(program)
// registerDevEvents(program)
registerDelete(program)
registerListIndexes(program)

program
	.parseAsync()
	.then(() => {
		process.exit(0)
	})
	.catch(err => {
		console.error('❌ Error:', err instanceof Error ? err.message : err)
		process.exit(1)
	})
