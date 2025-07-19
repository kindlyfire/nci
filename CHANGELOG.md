# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-07-19

### Added

-   New `key` command for Nostr key generation and management
    -   Generate new private keys with `nci key`
    -   Display public keys from private keys with `nci key <privkey>`
    -   Shows keys in both hex and npub formats

### Changed

-   Improved output formatting in `publish` command
