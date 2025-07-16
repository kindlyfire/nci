import { readFileSync } from 'node:fs'
import { type Event, type EventTemplate } from 'nostr-tools'
import { parse as yaml } from 'yaml'
import z from 'zod'
import { Config } from '../config'
import { create, insertMultiple, search } from '@orama/orama'
import { Nostr } from './nostr'

const zContentIndexItem = z.object({
	title: z.string(),
	summary: z.string(),
	timestamp: z.number(),
	urls: z.array(z.string()).default(() => []),
	tags: z.array(z.string()).default(() => []),
})

const zContentIndexFile = z.object({
	title: z.string().optional(),
	summary: z.string().optional(),
	url: z.string().optional(),
	primaryKey: z.string(),
	items: z.array(zContentIndexItem),
})
type ContentIndex = z.infer<typeof zContentIndexFile>

// Nostr format uses arrays for space efficiency
// Item = [title, summary, timestamp, URLs, ...tags]
const zNostrItem = z
	.tuple([
		z.string(), // title
		z.string(), // summary
		z.number(), // timestamp
		z.array(z.string()), // URLs
	])
	.rest(z.array(z.string())) // optional tags
type NostrItem = z.infer<typeof zNostrItem>

const zNostrContent = z.object({
	items: z.array(zNostrItem),
})
type NostrContent = z.infer<typeof zNostrContent>

export interface IContentIndex {
	title?: string
	summary?: string
	url?: string
	primaryKey: string
	itemCount: number
	chunkCount: number
	items: z.infer<typeof zContentIndexItem>[]
}

export const ContentIndex = {
	/**
	 * Load a JSON or YAML file containing a ContentIndex.
	 */
	fromFile(filePath: string): IContentIndex {
		const raw = loadYamlOrJson(filePath)
		const parsed = zContentIndexFile.parse(raw)
		return {
			title: parsed.title,
			summary: parsed.summary,
			url: parsed.url,
			primaryKey: parsed.primaryKey,
			itemCount: parsed.items.length,
			chunkCount: 0,
			items: parsed.items,
		}
	},

	/**
	 * Create a ContentIndex from an array of Nostr events. The primaryKey is
	 * used to identify the right events.
	 */
	fromEvents(events: Event[], primaryKey: string): IContentIndex {
		const metaEvent = events.find(ev => {
			const tTags = Nostr.eventTagAll(ev, 't')
			return tTags.includes(`nci-meta`) && tTags.includes(`nci:${primaryKey}`)
		})
		if (!metaEvent) {
			throw new Error(`Metadata event missing.`)
		}

		const res: IContentIndex = {
			title: Nostr.eventTag(metaEvent, 'title'),
			summary: Nostr.eventTag(metaEvent, 'summary'),
			url: Nostr.eventTag(metaEvent, 'url'),
			primaryKey,
			itemCount: parseInt(Nostr.eventTag(metaEvent, 'items') || '0', 10) || 0,
			chunkCount: parseInt(Nostr.eventTag(metaEvent, 'chunks') || '0', 10) || 0,
			items: [],
		}

		for (const ev of events) {
			// Parse tags
			const tTags = Nostr.eventTagAll(ev, 't')
			if (!tTags.includes(`nci`) || !tTags.includes(`nci:${primaryKey}`)) continue
			if (tTags.includes(`nci-meta`)) {
				continue
			}

			const chunkIndexTag = Nostr.eventTag(ev, 'd')?.split(':')[2]
			if (!chunkIndexTag || isNaN(parseInt(chunkIndexTag, 10))) {
				console.warn(`Event ${ev.id} is missing chunk index tag.`)
				continue
			}

			if (res.chunkCount > 0 && parseInt(chunkIndexTag, 10) >= res.chunkCount) {
				console.warn(
					`Event ${ev.id} has chunk index ${chunkIndexTag}, but expected less than ${res.chunkCount}. Skipping.`
				)
				continue
			}

			try {
				var content = zNostrContent.parse(JSON.parse(ev.content))
			} catch (err) {
				console.warn(`Failed to parse content in event ${ev.id}:`, err)
				continue
			}

			res.items = res.items.concat(content.items.map(item => ContentIndex.itemParse(item)))
		}

		res.itemCount = res.items.length
		return res
	},

	/**
	 * Convert a ContentIndex to an array of Nostr events ready to be published.
	 */
	toEvents(index: IContentIndex) {
		const chunks = chunkItems(index.items.map(ContentIndex.itemStringify))
		index.chunkCount = chunks.length
		const events: EventTemplate[] = [createMetadataEvent(index)]
		for (const [chunkIndex, chunk] of chunks.entries()) {
			const contentEvent = createContentEvent(index, chunk, chunkIndex)
			events.push(contentEvent)
		}
		return events
	},

	/**
	 * Parse a Nostr item into a ContentIndex item.
	 */
	itemParse(item: z.infer<typeof zNostrItem>): z.infer<typeof zContentIndexItem> {
		const isTagPair = (value: unknown): value is [string, string] =>
			Array.isArray(value) &&
			value.length === 2 &&
			typeof value[0] === 'string' &&
			typeof value[1] === 'string'

		const [title, summary, timestamp, urls, ...rest] = item
		const tags = rest
			.filter(isTagPair)
			.filter(p => p[0] === 't')
			.map(p => p[1])
		return { title, summary, timestamp, urls, tags }
	},

	/**
	 * Convert a ContentIndex item to a Nostr item.
	 */
	itemStringify(item: z.infer<typeof zContentIndexItem>): z.infer<typeof zNostrItem> {
		const { title, summary, timestamp, urls, tags } = item
		return [title, summary, timestamp, urls, ...tags.map(tag => ['t', tag])]
	},

	/**
	 * Create a search index using Orama and search for items
	 */
	async search(options: {
		index: IContentIndex
		query: string
		limit: number
	}): Promise<ContentIndex['items']> {
		const db = ContentIndex.toOrama(options.index.items)
		const results = await search(db, {
			term: options.query,
			limit: options.limit,
			tolerance: 1,
		})
		const itemResults = results.hits.map(result => {
			return options.index.items[parseInt(result.id)]!
		})
		return itemResults
	},

	toOrama(items: IContentIndex['items']) {
		const db = create({
			schema: {
				title: 'string',
				summary: 'string',
				tags: 'string[]',
			},
		})
		insertMultiple(
			db,
			items.map((item, index) => {
				return {
					id: '' + index,
					title: item.title,
					summary: item.summary,
					tags: item.tags,
				}
			})
		)
		return db
	},
}

function loadYamlOrJson(path: string): unknown {
	const raw = readFileSync(path, 'utf8')

	if (path.endsWith('.json')) return JSON.parse(raw)
	if (path.endsWith('.yml') || path.endsWith('.yaml')) return yaml(raw)

	// Guess
	try {
		return yaml(raw)
	} catch {
		return JSON.parse(raw)
	}
}

const baseEvent = () => ({
	kind: 30078,
	created_at: Math.floor(Date.now() / 1000),
})

function createMetadataEvent(index: IContentIndex): EventTemplate {
	const tags: string[][] = [
		['t', 'nci'],
		['t', 'nci-meta'],
		['t', `nci:${index.primaryKey}`],
		['d', `nci:${index.primaryKey}:meta`],
		['items', index.items.length.toString()],
		['chunks', `${index.chunkCount}`],
	]
	if (index.title) tags.push(['title', index.title])
	if (index.summary) tags.push(['summary', index.summary])
	if (index.url) tags.push(['url', index.url])

	return {
		...baseEvent(),
		tags,
		content: '',
	}
}

function createContentEvent(
	index: IContentIndex,
	items: NostrContent['items'],
	chunkIndex: number
): EventTemplate {
	return {
		...baseEvent(),
		tags: [
			['t', 'nci'],
			['t', `nci:${index.primaryKey}`],
			['d', `nci:${index.primaryKey}:${chunkIndex}`],
		],
		content: JSON.stringify({ items } satisfies NostrContent),
	}
}

/**
 * Chunk items so their JSON.stringify'd size does not exceed
 * Config.eventSizeLimit.
 */
function chunkItems(items: NostrItem[]): NostrItem[][] {
	const res: NostrItem[][] = []
	let chunk: NostrItem[] = []
	const size = (a: NostrItem[]) => Buffer.byteLength(JSON.stringify(a), 'utf8')

	for (const it of items) {
		if (!chunk.length || size([...chunk, it]) <= Config.eventSizeLimit) {
			chunk.push(it)
		} else {
			res.push(chunk)
			chunk = [it]
		}
	}
	if (chunk.length) res.push(chunk)
	return res
}
