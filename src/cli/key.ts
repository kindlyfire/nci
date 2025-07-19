import { Command } from 'commander'
import { generateSecretKey, getPublicKey } from 'nostr-tools'
import { nip19 } from 'nostr-tools'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'
import chalk from 'chalk'

export const registerKeyCommand = (program: Command) => {
  program
    .command('key [privkey]')
    .description('Generate or display Nostr keys')
    .action(async (privkey?: string) => {
      if (privkey) {
        // Display public key from provided private key
        if (!/^[0-9a-fA-F]+$/.test(privkey)) {
          console.error(chalk.red('Error: Private key must be in hexadecimal format'))
          process.exit(1)
        }

        if (privkey.length !== 64) {
          console.error(chalk.red('Error: Private key must be 32 bytes (64 hex characters)'))
          process.exit(1)
        }

        const privkeyBytes = hexToBytes(privkey)
        const pubkey = getPublicKey(privkeyBytes)
        const npub = nip19.npubEncode(pubkey)

        console.log(chalk.cyan('Public Key (npub):'), npub)
        console.log(chalk.cyan('Public Key (hex):'), pubkey)
      } else {
        // Generate new key pair
        const secretKey = generateSecretKey()
        const privkeyHex = bytesToHex(secretKey)
        const pubkey = getPublicKey(secretKey)
        const npub = nip19.npubEncode(pubkey)

        console.log(chalk.green('Private Key:'), privkeyHex)
        console.log(chalk.cyan('Public Key (npub):'), npub)
        console.log(chalk.cyan('Public Key (hex):'), pubkey)
      }
    })
}