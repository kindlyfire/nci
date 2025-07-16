import { defineConfig } from 'vite'

export default defineConfig({
	build: {
		target: 'node20',
		lib: {
			entry: 'src/index.ts',
			formats: ['es'],
			fileName: `index`,
		},
		rollupOptions: {
			external: [
				'node:fs',
				'node:events',
				'node:child_process',
				'node:path',
				'node:process',
				'node:os',
				'node:tty',
				'node:crypto',
				'node:timers',
				'node:timers/promises',
			],
		},
	},
	resolve: {
		conditions: ['module', 'node', 'production'],
	},
})
