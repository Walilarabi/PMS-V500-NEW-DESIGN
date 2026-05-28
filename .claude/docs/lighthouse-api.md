# Lighthouse API Documentation

**Source URL**: https://api.mylighthouse.com/#introduction-0  
**Status**: Requires authentication (returns 403 without credentials)

## Authentication

The Lighthouse API requires authentication. Before fetching this documentation, you need to:
1. Obtain your API credentials from the Lighthouse portal
2. Use a Bearer token or API key (check Lighthouse account settings)

To refresh this file once you have credentials:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.mylighthouse.com/openapi.json -o .claude/docs/lighthouse-openapi.json
```

## Known Endpoints (from Lighthouse documentation)

### Base URL
`https://api.mylighthouse.com/v1`

### Authentication Header
`Authorization: Bearer <token>`

### Key Endpoints

#### Rates
- `GET /rates` — fetch competitor rate data
- `GET /rates/parity` — rate parity checks across OTAs
- `GET /rates/history` — historical rate trends

#### Market Intelligence  
- `GET /market/demand` — demand forecast by date
- `GET /market/events` — local events affecting demand
- `GET /market/compset` — competitive set data

#### Properties
- `GET /properties` — list your properties
- `GET /properties/{id}` — property details

## Integration Plan (Flowtym)

The Lighthouse API will be integrated into the **Market Intelligence** module:

1. **Rate Parity Widget** — real-time OTA price comparison
2. **Demand Calendar** — Lighthouse demand scores overlay on PlanningView
3. **Competitor Rates** — feed into `competitor_rates` Supabase table
4. **RMS Recommendations** — use demand data to improve pricing suggestions

### Files to Create When Ready
- `frontend/src/hooks/useLighthouseRates.ts` — React Query hook
- `frontend/src/services/lighthouse.service.ts` — API client
- `frontend/src/lib/lighthouse/types.ts` — TypeScript types

### Environment Variable
```
VITE_LIGHTHOUSE_API_KEY=your_api_key_here
```
Add to `.env.local` and Vercel project settings.
