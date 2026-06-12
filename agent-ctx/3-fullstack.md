# Task 3 - Google OAuth Setup Flow

## Agent: fullstack

## Task Summary
Created a Google OAuth setup flow that allows configuring GOOGLE_CLIENT_ID through the application UI instead of environment variables.

## Changes Made

### 1. Updated `/src/app/api/auth/google/status/route.ts`
- Now checks BOTH `process.env.GOOGLE_CLIENT_ID` AND `PlatformSettings` DB table
- DB value takes priority over env var
- Gracefully handles DB unavailability (falls back to env var)

### 2. Updated `/src/app/api/auth/google/route.ts`
- GET handler: Checks PlatformSettings DB for `google_client_id` before env var
- POST handler: Same DB-first lookup for GIS token verification audience check

### 3. Created `/src/app/api/settings/google-oauth/route.ts`
- **GET**: Returns config status (configured, masked clientId, source)
- **POST**: Saves Google Client ID to PlatformSettings (validates format)
- **DELETE**: Removes Google Client ID from PlatformSettings

### 4. Created `/src/components/pepertect/google-oauth-setup.tsx`
- Dark-themed admin UI component matching existing design
- Shows current status (active/not configured with visual badges)
- Input for Client ID with save button
- Delete button for removing DB-stored ID
- Step-by-step setup instructions with Google Cloud Console link

### 5. Updated `/src/components/pepertect/pages/admin-page.tsx`
- Added "Settings" tab to admin page
- GoogleOAuthSetup component rendered in new Settings tab

## Verification
- `bun run lint` passes with no new errors
- `/api/auth/google/status` returns 200 correctly
- All changes are backward-compatible with existing env var approach
