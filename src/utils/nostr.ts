import { SimplePool, type Filter, type Event, type EventTemplate, finalizeEvent } from 'nostr-tools'
import { decode } from 'nostr-tools/nip19'
import { withTimeout } from './async'
import { Config } from '../config'
import { setTimeout } from 'node:timers/promises'

interface PublishResult {
	/** List of OK relays */
	ok: string[]
	/** Map of relay URLs to error messages */
	errors: Record<string, string>
}

let _pool: SimplePool | null = null
function pool() {
	if (!_pool) {
		_pool = new SimplePool()
	}
	return _pool
}

export const Nostr = {
	pubkeyParse(pubkey: string): string {
		if (pubkey.startsWith('npub')) {
			const decoded = decode(pubkey)
			if (decoded.type === 'npub') return decoded.data
		}
		return pubkey
	},

	async query(filter: Filter) {
		return await withTimeout(
			pool().querySync(Config.relays, filter),
			15000,
			'Query timeout after 15s'
		)
	},

	async queryIndex(userPubkey: string, primaryKey: string): Promise<Event[]> {
		// TODO: Ability to query more events than 1000 (or whatever the relay
		// actually caps it at)
		const events = await this.query({
			kinds: [30078],
			limit: 1000,
			authors: [userPubkey],
			'#t': [`nci:${primaryKey}`],
		})

		return events
	},

	async queryIndexes(pubkey: string | null): Promise<
		{
			pubkey: string
			primaryKey: string
			events: Event[]
		}[]
	> {
		const filter: Filter = {
			kinds: [30078],
			limit: 100,
			'#t': ['nci-meta'],
			authors: pubkey ? [pubkey] : undefined,
		}
		const events = await this.query(filter)

		const byPrimaryKey = Object.groupBy(
			events.filter(
				ev =>
					this.eventTag(ev, 'd')?.startsWith('nci:') &&
					this.eventTag(ev, 'd')?.endsWith(':meta')
			),
			ev => this.eventTag(ev, 'd')?.split(':')[1] || ''
		)
		return Object.entries(byPrimaryKey).map(([primaryKey, events]) => {
			return {
				pubkey: events![0]!.pubkey,
				primaryKey,
				events: events!,
			}
		})
	},

	async publish(event: Event): Promise<PublishResult> {
		const publishPromises = pool().publish(Config.relays, event)
		const res = (await Promise.allSettled(publishPromises)).map((result, index) => {
			return [
				Config.relays[index]!,
				result.status === 'fulfilled' ? true : `${result.reason}`,
			] as const
		})
		return {
			ok: res.filter(([, status]) => status === true).map(([relay]) => relay),
			errors: Object.fromEntries(
				res.filter(([, status]) => status !== true) as [string, string][]
			),
		}
	},

	async signAndPublish(
		event: EventTemplate | Event,
		secretKey: Uint8Array
	): Promise<PublishResult> {
		const finalizedEvent = finalizeEvent(event, secretKey)
		return await this.publish(finalizedEvent)
	},

	async signAndPublishMany(events: EventTemplate[], secretKey: Uint8Array): Promise<void> {
		for (const [index, event] of events.entries()) {
			if (index > 0) console.log()
			const heading = `--- Event ${index + 1}/${events.length}`
			process.stdout.write(heading)

			if (index > 3) {
				process.stdout.write(`\r${heading} (publishing in 10s)`)
				await setTimeout(10000)
				process.stdout.cursorTo(0)
				process.stdout.clearLine(1)
			}
			process.stdout.write('\n')

			const res = await this.signAndPublish(event, secretKey)
			console.log(this.formatPublishResult(res))
		}
	},

	async delete(ids: string[], secretKey: Uint8Array): Promise<void> {
		const publishResult = await this.signAndPublish(
			{
				kind: 5,
				created_at: Math.floor(Date.now() / 1000),
				tags: ids.map(id => ['e', id]),
				content: 'Deleting all events',
			},
			secretKey
		)
		console.log(this.formatPublishResult(publishResult))
	},

	formatPublishResult(result: PublishResult): string {
		let s = ''
		if (result.ok.length === Config.relays.length) {
			return `✅ All relays succeeded`
		} else if (result.ok.length) {
			s = `✅ ` + result.ok.join(', ')
		}
		const errors = Object.entries(result.errors)
		if (errors.length) {
			s += `\n`
			s += errors.map(([relay, status]) => `❌ ${relay}: ${status}`).join('\n')
		}
		return s
	},

	eventTag(event: Event, key: string): string | undefined {
		const tag = event.tags.find(t => t[0] === key)
		return tag ? tag[1] : undefined
	},

	eventTagAll(event: Event, key: string): string[] {
		const tags = event.tags.filter(t => t[0] === key)
		return tags.length > 0 ? tags.map(t => t[1]).filter(v => v != null) : []
	},
}
