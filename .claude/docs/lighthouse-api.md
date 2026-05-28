# Lighthouse API — Reference (Flowtym Integration)

**Source:** https://api.mylighthouse.com/#introduction-0  
**Status:** Requires API key authentication (URL returns 403 without auth)

## Setup

Add to `frontend/.env.local`:
```
VITE_LIGHTHOUSE_API_KEY=your_api_key_here
VITE_LIGHTHOUSE_API_URL=https://api.mylighthouse.com
```

## Service stub

See `frontend/src/services/lighthouse.service.ts` — base client already wired,
ready to use once the API key is provided.

## To fetch full docs

```bash
curl -s \
  -H "Authorization: Bearer $VITE_LIGHTHOUSE_API_KEY" \
  "https://api.mylighthouse.com/docs" \
  | jq . >> .claude/docs/lighthouse-api-full.json
```

## Known / assumed endpoints (hotel competitive intel)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/hotels` | List monitored hotels |
| GET | `/v1/hotels/{id}/rates` | Competitor rate shopping |
| GET | `/v1/hotels/{id}/parity` | Rate parity violations |
| GET | `/v1/hotels/{id}/ranking` | OTA ranking signals |
| GET | `/v1/hotels/{id}/reviews` | Review scores + trends |
| POST | `/v1/hotels/{id}/refresh` | Force rate refresh |
| GET | `/v1/markets/{market}/rates` | Market-level benchmarks |

## Auth pattern (HTTP header)

```http
Authorization: Bearer {api_key}
Content-Type: application/json
```

## Integration plan (Flowtym)

1. Wire `VITE_LIGHTHOUSE_API_KEY` to Supabase secrets or `.env.local`
2. Use `lighthouse.service.ts` client in `useMarketIntelligence.ts`
3. Cache responses in `competitor_rates` table (already exists in DB)
4. Expose data in Distribution Analytics + Revenue Calendar competitive intel tab

## Notes

- Base URL may vary per region (`api.mylighthouse.com` / `eu.api.mylighthouse.com`)
- Rate data is typically refreshed every 15–30 min on their side
- Re-fetch this doc once authenticated:
  `WebFetch("https://api.mylighthouse.com/#introduction-0", "Extract all endpoints and auth details")`
