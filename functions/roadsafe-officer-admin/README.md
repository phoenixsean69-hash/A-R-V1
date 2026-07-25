# RoadSafe Officer Admin Function

This Appwrite Function is the privileged server-side boundary for police officer onboarding and access management.

## Function ID

```text
roadsafe-officer-admin
```

## Runtime

```text
Node.js 22
```

## Entrypoint

```text
src/main.js
```

## Build command

```text
npm install
```

## Execute access

Grant execution to authenticated users. The Function performs a second, mandatory server-side check and accepts actions only from an active `station_admin` membership in the requested police-station Team.

## Dynamic API-key scopes

Enable only:

```text
users.read
users.write
teams.read
teams.write
```

The Function reads the caller from the injected `x-appwrite-user-id` header and uses the injected `x-appwrite-key` dynamic API key for privileged Users and Teams operations.

## Supported actions

```text
list_officers
create_officer
update_role
set_status
reset_password
remove_officer
```

No temporary password is stored in function logs or user preferences. It is returned once in the synchronous execution response.
