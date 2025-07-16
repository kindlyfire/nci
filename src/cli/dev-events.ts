import { Command } from 'commander'

export function registerDevEvents(program: Command): void {
	program
		.command('dev:events')
		.description('Pretty print all raw events for a pubkey (dev command)')
		.option('--pubkey <pubkey>', 'Public key to filter by (hex or npub format)')
		.action(async (options: { pubkey?: string }) => {
			// Needs to be redone (if I don't remove it altogether)
		})
}
