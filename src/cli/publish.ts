import { Command } from 'commander'
import { ContentIndex } from '../utils/content-index'
import { Nostr } from '../utils/nostr'
import { hexToBytes } from '@noble/hashes/utils'
import { getPublicKey } from 'nostr-tools'

export function registerPublish(program: Command): void {
	program
		.command('publish')
		.description('Publish an index file to nostr')
		.argument('<file>', 'Path to index file (YAML or JSON)')
		.requiredOption('--privkey <key>', 'Private key for signing (hex format)')
		.option(
			'-r, --relay <url>',
			'Relay URL to publish to (can be repeated)',
			(value, previous: string[] | undefined) => (previous ? [...previous, value] : [value])
		)
		.action(async (file: string, options: { privkey: string; relay?: string[] }) => {
			console.log(`📄 Loading index file: ${file}`)
			const index = ContentIndex.fromFile(file)

			console.log(`   Primary Key: ${index.primaryKey}`)
			if (index.title) console.log(`   Title: ${index.title}`)
			if (index.summary) console.log(`   Summary: ${index.summary}`)
			if (index.url) console.log(`   URL: ${index.url}`)
			console.log(`   Items: ${index.items.length}`)
			console.log()

			const events = ContentIndex.toEvents(index)
			await Nostr.signAndPublishMany(events, hexToBytes(options.privkey))

			console.log()
			console.log(
				`URI: nci:${getPublicKey(hexToBytes(options.privkey))}?k=${index.primaryKey}`
			)
		})
}
