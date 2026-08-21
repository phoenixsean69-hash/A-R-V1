# RoadSafe — Registration → Owner → Driver Candidate Flow

This Step 4.0.3 flow supports cases where the investigator does **not yet know who was driving**.

## Forensic sequence

1. Record/select the involved vehicle or enter its registration number.
2. Query the authorised vehicle-registry gateway.
3. Record the returned vehicle and registered owner/keeper as an investigative lead.
4. If the owner is an individual and an identity number is returned, query that person in the Driver Registry.
5. Optionally copy the owner into the person form as **Possible driver — not confirmed**.
6. Confirm or reject the candidate later using CCTV, witness evidence, statements, scene/vehicle evidence, medical/hospital information, admissions or other authorised evidence.

**Registered owner / keeper does not equal confirmed driver.** RoadSafe never promotes a vehicle owner directly to a confirmed driver.

## Browser configuration

RoadSafe does not contain government-registry credentials. The browser calls an authorised server-side gateway.

```env
VITE_VEHICLE_REGISTRY_PROXY_URL=https://YOUR-AUTHORISED-BACKEND/verify-vehicle
VITE_DRIVER_REGISTRY_PROXY_URL=https://YOUR-AUTHORISED-BACKEND/verify-driver
```

For prototype demonstrations only:

```env
VITE_VEHICLE_REGISTRY_DEMO=true
VITE_DRIVER_REGISTRY_DEMO=true
```

Demo results are explicitly labelled and are not official registry records.

## Expected vehicle-registry gateway request

```json
{
  "caseId": "...",
  "caseNumber": "...",
  "purpose": "Road traffic accident investigation",
  "investigatingOfficer": "...",
  "policeStation": "...",
  "personLabel": "Unknown driver",
  "registration": "ABC 1234"
}
```

## Expected vehicle-registry gateway response

```json
{
  "status": "active",
  "registryReference": "...",
  "registration": "ABC 1234",
  "makeModel": "Toyota Corolla",
  "vehicleClass": "Passenger vehicle",
  "registrationStatus": "Active",
  "registeredOwnerName": "...",
  "registeredOwnerIdentityNumber": "...",
  "registeredOwnerType": "Individual",
  "message": "Lookup completed"
}
```

The existing Driver Registry gateway then receives the returned owner identity as a separate query. Registry responses are evidence leads, not conclusions about who was driving.
