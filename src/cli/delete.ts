import { Command } from 'commander'
import { Nostr } from '../utils/nostr'
import { hexToBytes } from '@noble/hashes/utils'
import { getPublicKey } from 'nostr-tools'

export function registerDelete(program: Command): void {
	program
		.command('delete')
		.description('Delete all NCI events associated with a private key')
		.requiredOption('--privkey <key>', 'Private key for signing (hex format)')
		.option(
			'-r, --relay <url>',
			'Relay URL to publish deletion to (can be repeated)',
			(value, previous: string[] | undefined) => (previous ? [...previous, value] : [value])
		)
		.option('--confirm', 'Confirm deletion without prompting')
		.action(async (options: { privkey: string; relay?: string[]; confirm?: boolean }) => {
			// Safety confirmation
			if (!options.confirm) {
				console.log(
					'⚠️  WARNING: This will delete ALL NCI events associated with the private key!'
				)
				console.log('   This action cannot be undone.')
				console.log('   Add --confirm flag to proceed without this warning.')
				process.exit(1)
			}

			console.log('🗑️  Starting deletion process...')
			console.log()

			const events = await Nostr.query({
				authors: [getPublicKey(hexToBytes(options.privkey))],
				'#t': ['nci'],
			})
			console.log(`Found ${events.length} NCI events to delete. Deleting...`)
			await Nostr.delete(
				events.map(ev => ev.id),
				hexToBytes(options.privkey)
			)
		})
}
