# Player Identity & Data Reconciliation System

Complete documentation at: This file contains comprehensive documentation for the Player Identity system.

## Quick Start

See the full documentation in this file for:
- Database schema
- Matching algorithms  
- Duplicate detection
- Data reconciliation
- Pre-rebuild validation
- Automatic repairs
- Admin tools
- Integration guides

## Key Files

- `src/lib/identity/normalizeName.ts` - Name normalization & fuzzy matching
- `src/lib/identity/matchPlayer.ts` - Multi-step player matching
- `src/lib/identity/detectDuplicates.ts` - Duplicate detection
- `src/lib/identity/reconcilePlayerData.ts` - Data reconciliation
- `src/lib/identity/validatePlayerUniverse.ts` - Pre-rebuild validation
- `src/lib/identity/autoRepair.ts` - Automatic repairs
- `supabase/functions/player-integrity/` - Admin debug endpoint

## Core Principle

**Never trust external data blindly.** Match with confidence scoring, detect conflicts early, validate before rebuild, and maintain complete audit history.

For detailed documentation, see PLAYER_IDENTITY_SYSTEM_FULL.md
