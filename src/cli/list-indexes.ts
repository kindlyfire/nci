import { Command } from 'commander'
import { Nostr } from '../utils/nostr'
import { ContentIndex } from '../utils/content-index'

export function registerListIndexes(program: Command): void {
	program
		.command('list-indexes')
		.description('List all content indexes')
		.option('--user <pubkey>', 'Filter by user pubkey (npub or hex)')
		.option('--limit <number>', 'Limit number of results', '20')
		.action(async (options: { user?: string; limit: string }) => {
			const limit = parseInt(options.limit)
			let pubkey = options.user ? Nostr.pubkeyParse(options.user) : null
			console.log('📋 Listing content indexes...')
			if (pubkey) {
				console.log(`   Filtering by user: ${pubkey}`)
			}
			console.log()
			const indexes = await Nostr.queryIndexes(pubkey || null)
			if (indexes.length === 0) {
				console.log('No indexes found.')
				return
			}
			console.log(`Found ${indexes.length} index(es):`)
			console.log()
			for (const [i, result] of indexes.slice(0, limit).entries()) {
				const index = ContentIndex.fromEvents(result.events, result.primaryKey)
				console.log(`${i + 1}. ${index.title || index.primaryKey}`)
				if (index.summary) console.log(`   ${index.summary}`)
				if (index.url) console.log(`   URL: ${index.url}`)
				console.log(`   URI: nci:${pubkey}?k=${index.primaryKey}`)
				console.log(`   Items: ${index.itemCount}`)
				console.log()
			}
			if (indexes.length > limit) {
				console.log(`... and ${indexes.length - limit} more indexes`)
			}
		})
}
