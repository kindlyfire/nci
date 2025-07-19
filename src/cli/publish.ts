import { Command } from 'commander'
import { ContentIndex } from '../utils/content-index'
import { Nostr } from '../utils/nostr'
import { hexToBytes } from '@noble/hashes/utils'
import { getPublicKey } from 'nostr-tools'
import chalk from 'chalk'

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
			const index = ContentIndex.fromFile(file)

			console.log(`${chalk.bold('primary-key:')} ${index.primaryKey}`)
			console.log(`${chalk.bold('items:      ')} ${index.items.length}`)
			console.log(
				`${chalk.bold('uri:        ')} nci:${getPublicKey(hexToBytes(options.privkey))}?k=${
					index.primaryKey
				}`
			)
			console.log()

			const events = ContentIndex.toEvents(index)
			await Nostr.signAndPublishMany(events, hexToBytes(options.privkey))
		})
}
