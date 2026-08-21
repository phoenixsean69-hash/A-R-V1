# RoadSafe — National Driver Registry integration

## Purpose

RoadSafe only performs a registry check for a person recorded as a **Driver** in the current accident case.

The RoadSafe browser must **not** contain CVR/ZIMTIS credentials. The official integration is intentionally made through a secure server-side gateway.

## Front-end configuration

```env
VITE_DRIVER_REGISTRY_PROXY_URL=https://your-authorised-police-backend.example/verify-driver
```

For a local prototype only:

```env
VITE_DRIVER_REGISTRY_DEMO=true
```

Demo mode is clearly marked in the UI and must never be treated as an official result.

## Gateway request

RoadSafe sends a JSON `POST` request similar to:

```json
{
  "caseId": "...",
  "caseNumber": "...",
  "purpose": "Road traffic accident investigation",
  "investigatingOfficer": "...",
  "policeStation": "...",
  "personLabel": "Driver A",
  "fullName": "...",
  "identityNumber": "...",
  "licenceNumber": "..."
}
```

## Expected gateway response

```json
{
  "status": "valid",
  "registryReference": "CVR-...",
  "fullName": "...",
  "licenceNumber": "...",
  "licenceCodes": ["B"],
  "issueDate": "2024-06-01",
  "expiryDate": "2029-06-01",
  "penaltyPoints": 0,
  "restrictionSummary": "",
  "message": "Registry check completed"
}
```

Accepted status aliases are normalised into these officer-facing outcomes:

- Registered / valid
- Registered / expired
- Suspended / disqualified
- Not found
- Identity mismatch
- Registry unavailable
- Check failed

## Security requirements for the real gateway

The gateway should:

1. authenticate an authorised police user;
2. require a case ID / case number and investigation purpose;
3. authorise access to the driver-registry query;
4. hold registry credentials server-side only;
5. audit every lookup with officer, case, time and reason;
6. return only information needed for the accident investigation;
7. rate-limit and detect abusive searches;
8. use TLS and never log full National IDs or licence numbers in ordinary application logs.

The browser client deliberately has no mechanism for bypassing those controls.
