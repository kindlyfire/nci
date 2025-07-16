import { Command } from 'commander'
import chalk from 'chalk'
import { ContentIndex, type IContentIndex } from '../utils/content-index'
import { Nostr } from '../utils/nostr'

function parseNciUrl(url: string): { npub: string; key: string } | null {
	const match = url.match(/^nci:([^?]+)\?k=(.+)$/)
	if (!match || !match[1] || !match[2]) return null
	return { npub: match[1], key: match[2] }
}

function displayResults(index: IContentIndex, items: IContentIndex['items'], limit: number) {
	if (items.length === 0) {
		console.log(chalk.yellow('No results found.'))
		return
	}

	console.log(`Found ${items.length} matching item(s) in "${index.title || index.primaryKey}":`)

	for (const [i, item] of items.slice(0, limit).entries()) {
		console.log()
		console.log(
			chalk.bold(`${i + 1}. ${item.title}`) +
				chalk.dim.bold(
					item.timestamp > 0
						? ` (${new Date(item.timestamp * 1000).toLocaleDateString()})`
						: ''
				)
		)
		console.log(`   ${item.summary}`)
		if (item.tags.length > 0) console.log(chalk.magenta(`   ${item.tags.join(', ')}`))
		if (item.urls.length > 0) console.log(chalk.cyan(`   ${item.urls.join(', ')}`))
	}

	if (items.length > limit) {
		console.log(chalk.yellow(`... and ${items.length - limit} more results`))
	}
}

export function registerSearch(program: Command): void {
	program
		.command('search')
		.description('Search content indexes')
		.argument('<source>', 'File path or nci:<npub>?k=<key> URL')
		.argument('[query]', 'Optional search query')
		.option('--limit <number>', 'Limit number of results', '10')
		.action(async (source: string, query?: string, options?: { limit: string }) => {
			const limit = parseInt(options?.limit || '10')
			const nciUrl = parseNciUrl(source)

			let index: IContentIndex | null = null
			if (nciUrl) {
				const events = await Nostr.queryIndex(nciUrl.npub, nciUrl.key)
				index = ContentIndex.fromEvents(events, nciUrl.key)
			} else {
				index = ContentIndex.fromFile(source)
			}

			const matchingItems = await ContentIndex.search({
				index,
				query: query || '',
				limit,
			})
			displayResults(index, matchingItems, limit)
		})
}
