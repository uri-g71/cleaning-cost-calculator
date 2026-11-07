# November 2026 — Excel export (site version 20)

The exported tables have visible vertical and horizontal borders and centered columns
B and C. Each hourly cost, including 125%/150%, is a native Excel formula with a
Hebrew explanatory note. Per-group hourly tariffs and the site price depend on
the relevant group inputs. The visible calculation sheet exposes inputs, contribution
bases, leave entitlements, marginal overtime NI and markups. Only the export changed;
the pricing engine, saved proposal schema, database and print/PDF flow are unchanged.
Historical snapshots are never silently repriced by opening a spreadsheet.

Release verification reopens the generated XLSX and, with `VERIFY_XLSX_RECALC=1`,
independently recalculates 33 outputs in each of 50 scenarios after changing inputs.

# Calculator update — October 2026 (version 19)

- Added editable holiday gifts: ILS 300 per holiday, twice yearly; full entitlement
  from 91 regular monthly hours, otherwise hours / 182, as explicitly requested.
  Each employee group uses its own hours. The monthly amount is charged once;
  its NI is included in the existing bands. Back-to-back excludes both costs.
- Existing v2 snapshots and legacy form-only proposals default to a zero gift,
  preserving old quotes. New proposals use schema v3 and the ILS 300 default.
  No database migration or bulk rewrite of existing proposals is required.
- Added confirmed permanent deletion, strict ID validation, durable SQL DELETE,
  no-store history responses, and clearing of an active deleted proposal.
- Added top controls for section 1 printing before saving and full printing only
  for saved, unchanged proposals. Both open a reviewable A4 landscape preview.
- Print, PDF and saved HTML use the same measured pages, repeated table headers,
  Hebrew/RTL layout and intact rows. Long notes continue onto additional pages.
  Native print cleanup no longer leaves the editor locked in embedded browsers.
- Excel includes the gift amount, monthly cost, hourly cost and back-to-back terms;
  original two-sheet export and formula-backed site totals are retained.

Verification: calculation, Excel round-trip and persisted SQLite API tests cover
gift boundaries (including 90.99 / 91 hours), all 32 back-to-back combinations,
employee groups, NI bands/cap, overtime, legacy snapshots, and save/update/delete.
The original 16,968 workbook comparisons still pass. Browser checks cover the
gift toggle, reactive costs, saved-state print gating and A4 row boundaries.
PDF generation reaches a ready download link. The cloud browser's download event
times out, so actual browser-file download and native OS print/save dialogs have
not been verified; no claim of desktop Excel or PDF-viewer testing is made.

# Calculator update — September 2026

The hourly calculator, quote totals and saved snapshots now use a shared calculation
engine. A work-week change recalculates immediately. The uploaded workbook remains
the default source for vacation/recovery accrual tables and formulas, with updated
2026 monetary inputs. A separately labelled actual-hours costing basis is available;
the two formula bases must not be presented as identical.

Corrected holiday allowances for five/six-day work weeks and tenure, the sector wage
base for training-fund contributions, both national-insurance bands and the maximum
monthly insured income. National insurance on overtime is the incremental charge
on the employee's combined monthly gross, distributed across overtime wage pools.
Monthly travel, materials, other costs and monthly excellence awards are charged once
per employee, not again for every overtime hour. Employee-group site allocation uses
employees × regular monthly hours. Zero-hour and invalid-input quotations cannot be
saved or exported as valid prices.

The sickness allowance remains an explicitly adjustable commercial estimate (2.5%
by default), not a statutory accrual percentage. Back-to-back items are excluded from
the base quote and identified as separately billable with applicable employer costs;
the app does not determine individual event eligibility or issue payroll settlements.
The model is a quote-planning tool, not a certified government/payroll calculator.

Saved proposals now include versioned inputs and original numeric results. Opening a
new-format proposal preserves its original prices until the user chooses to edit.
Legacy proposals are labelled as recalculated and saved as new proposals, preserving
the old database record. The API validates inputs and calculates new saved totals on
the server. Local HTML proposals retain the screen's styling, contain embedded quote
data and can be reopened in the app. A native save-file picker lets supporting secure
browsers select a local folder; other browsers receive an explicit download link.

PDF and print use the same screen layout, static field values, and landscape A4.
Excel exports contain two formatted RTL sheets with wage components, rates,
explanations, base inputs, employee groups, site costs and cached/formula totals.

## Verification

- 16 automated tests passed, including 16,968 comparisons with the uploaded Excel's
  helper tables/formulas (1–6 workdays, 0–50 years in half-year steps and 40/91/182/200 hours).
- Tests cover all 16 back-to-back combinations, both NI bands, the cap, aggregated
  overtime, sector-based training fund, fixed monthly costs, zero hours and legacy imports.
- Generated XLSX buffers reopened successfully with ExcelJS and validated RTL sheets,
  Hebrew labels, B/B terms and cached formula totals. This is a file-format/content test,
  not a claim of testing Microsoft Excel's desktop application.
- Browser: immediate work-week recalculation, travel/pension toggle linkage, repeated
  groups, zero-hour export guard, save/reopen, and imports of JSON/HTML proposal fixtures.
- Browser: Excel and PDF generation reached a ready download link. The cloud browser
  did not complete blob downloads and explicitly blocked opening the blob PDF URL.
  Therefore visual PDF inspection, final OS download delivery, and native folder-picker
  behavior have NOT been verified. No security-policy workaround was used.

Run calculation checks with `node --test tests/calculator.test.mjs`. To compare against
the original uploaded workbook, set `SOURCE_WORKBOOK` to its local path. Full UI style
tests require a completed Sites build before `node --test tests/*.test.mjs`.
