# Scrape All Modal Implementation Instructions

## Objective
Implement a new Scrape All review modal for the multi-source Scrape All workflow only. Do not alter the existing single-scraper workflows or their current result modals.

## Absolute Rules
1. Leave all existing individual scraper behavior unchanged.
   - GEVI single-scrape must still use the existing GEVI result modal.
   - stash-box single-scrape must still use the existing stash-box result modal.
   - YAML and other single-scraper flows must still use their existing modal UI.
2. Do not replace the existing modal used by any single-scraper flow.
3. Do not make the existing “Scrape” button open the new Scrape All modal.
4. Do not change the existing scrape request/response handlers for the individual scraper routes unless absolutely required for the new Scrape All feature and only if those changes do not affect existing workflows.
5. Treat the new modal as an additive feature that only appears when the Scrape All endpoint returns multiple sources/results.

## Exact Implementation Plan
### 1. Preserve the current single-scraper flow completely
- Inspect the existing handler in [client/src/modules/media/pages/stash/SceneDetail.jsx](client/src/modules/media/pages/stash/SceneDetail.jsx) that handles the legacy single-scrape flow.
- Keep that handler intact.
- Keep the existing modal rendering logic for single-scrape results intact.
- Do not rename, remove, or reroute the existing modal state variables used by the old workflow.

### 2. Add a new, separate Scrape All modal component
- Create or use a new component dedicated only to the multi-source Scrape All experience.
- Do not reuse the existing single-scraper modal component for this feature.
- Give the new component its own props and state handling.

### 3. Wire the new component only from the Scrape All path
- Only open the new Scrape All modal when the Scrape All flow has returned multi-source results.
- Keep the original modal opening logic for single-scraper flows unchanged.
- Do not connect the new Scrape All modal to the GEVI, stash-box, or YAML single-scrape handlers.

### 4. Keep existing scraper workflows isolated
- The current GEVI scrape handler must still populate its existing scrape state and open its existing review UI.
- The current stash-box scrape handler must still populate its existing scrape state and open its existing review UI.
- The current YAML scraper handler must still behave exactly as it does today.
- The new Scrape All modal must not interfere with these flows.

## What is Allowed
- Add a new component for the multi-source Scrape All review experience.
- Add new state/handlers in [client/src/modules/media/pages/stash/SceneDetail.jsx](client/src/modules/media/pages/stash/SceneDetail.jsx) that are only used for the Scrape All workflow.
- Add a new button or action that only appears in the Scrape All flow.
- Add a new API response handling branch for the Scrape All endpoint that opens the new modal.

## What is Forbidden
- Changing the existing GEVI single-scrape modal.
- Changing the existing stash-box single-scrape modal.
- Changing the existing YAML scraper modal.
- Replacing the existing single-scrape modal with the new Scrape All modal.
- Making the new modal open for any individual scraper result.
- Mixing the custom order/Plex sync fixes into this work unless the user explicitly asks for that.

## File-Level Guardrails
### Primary frontend file
- [client/src/modules/media/pages/stash/SceneDetail.jsx](client/src/modules/media/pages/stash/SceneDetail.jsx)
- Only add Scrape All-specific state and UI here.
- Do not rewrite the existing single-scrape modal logic in this file.

### New/secondary frontend file
- [client/src/modules/media/pages/stash/components/ScrapeAllReviewModal.jsx](client/src/modules/media/pages/stash/components/ScrapeAllReviewModal.jsx)
- This file is for the new Scrape All modal only.
- Do not make this component render for single-scraper results.

### Backend files
- [server/routes/stash.js](server/routes/stash.js)
- [server/services/geviScraperService.js](server/services/geviScraperService.js)
- [server/stashSyncService.js](server/stashSyncService.js)
- Only make backend changes that are necessary for the Scrape All workflow.
- Do not change the single-scraper route behavior unless it is strictly required and still preserves the existing response shape.

## Implementation Checklist
- [ ] Inspect the current single-scraper modal flow in [client/src/modules/media/pages/stash/SceneDetail.jsx](client/src/modules/media/pages/stash/SceneDetail.jsx).
- [ ] Leave that flow unchanged.
- [ ] Add a new Scrape All-specific modal component.
- [ ] Wire that component only from the Scrape All multi-source result path.
- [ ] Verify that a single GEVI/stash-box/YAML scrape still opens the original modal.
- [ ] Build the frontend and confirm no regressions.

## Failure Conditions
If any of the following happen, stop and revise the approach:
- The existing GEVI scrape button opens the new Scrape All modal.
- The existing stash-box or YAML scrape flow changes behavior.
- The existing single-scraper modal UI is replaced or modified.
- The new modal appears for a single-scraper result.

## Final Requirement
When implementing this feature, preserve the old scraper experience exactly and add the new Scrape All experience as a separate, side-by-side workflow.
