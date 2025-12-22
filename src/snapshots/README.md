# Snapshots Module

This module provides functionality to fetch NFT holder data from the Radix blockchain and store it in a MySQL database.

## Features

- Fetches NFT holder data from Radix Gateway API
- Stores NFT holders data in MySQL database
- Tracks ledger state to ensure incremental updates
- Provides REST API endpoints for data access

## Database Tables

### `nft_holders`

Stores wallet addresses and their corresponding NFT IDs.

| Column         | Type         | Description                   |
| -------------- | ------------ | ----------------------------- |
| id             | int          | Primary key (auto-increment)  |
| wallet_address | varchar(100) | Radix wallet address (unique) |
| nft_id         | varchar(50)  | NFT identifier                |
| created_at     | timestamp    | Record creation time          |
| updated_at     | timestamp    | Record last update time       |

### `ledger_states`

Stores the current ledger state information for tracking blockchain progress. This table contains only one entry which gets replaced with each update.

| Column                   | Type         | Description                  |
| ------------------------ | ------------ | ---------------------------- |
| id                       | int          | Primary key (auto-increment) |
| epoch                    | bigint       | Epoch number                 |
| network                  | varchar(50)  | Network identifier           |
| proposer_round_timestamp | varchar(255) | Round timestamp              |
| round                    | bigint       | Round number                 |
| state_version            | bigint       | Current state version        |
| created_at               | timestamp    | Record creation time         |

## API Endpoints

### POST `/snapshots/update-nft-holders`

Triggers an update of NFT holders data from the blockchain.

**Response:**

```json
{
  "success": true,
  "message": "NFT holders updated successfully",
  "data": {
    "ledger_state": { ... },
    "nft_holders": { ... }
  }
}
```

**Error Response:**

```json
{
  "message": "Failed to update NFT holders",
  "statusCode": 500
}
```

## Configuration

Update the addresses in `src/snapshots/config/radix.config.ts` with your actual dApp addresses:

- `DAPP_DEFINITION_ADDRESS`: Your dApp definition address
- `EXPECTED_ORIGIN`: Your dApp's domain

## How It Works

1. **Initial Fetch**: On first run, fetches all NFT holder data from genesis
2. **Incremental Updates**: Subsequent runs fetch only new data since the last stored ledger state
3. **Data Storage**:
   - Stores NFT holders in MySQL with wallet addresses as unique identifiers
   - Maintains a single ledger state entry that gets replaced with each update
4. **Optimized Processing**:
   - Fetches all existing NFT holders at once for efficient lookups
   - Only adds new holders that don't already exist (NFT IDs never change)
   - Uses batch operations for database writes
5. **Data Integrity**: NFT IDs for wallet addresses are immutable - once recorded, they never change

## Usage

1. Start the application
2. Call `POST /snapshots/update-nft-holders` to fetch and store initial data
3. Set up a cron job or scheduler to periodically call the update endpoint to keep data current
