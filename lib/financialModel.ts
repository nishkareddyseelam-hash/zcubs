// A single, shared driver-based financial model — imported by both
// MoneyClient.tsx (the Money Lab UI) and repo.ts (plan-vs-actual and the
// India Ledger DPR's annualised cash-flow estimate), so the formula can
// never silently diverge between the places that use it, the way the old
// monthly-unit-trajectory formula did before this rewrite.
//
// Design notes (why this shape, not a fancier one):
// - Units follow units(m) = units(m-1) * (1 - churn) + growth. Churn always
//   erodes the existing base; "growth" is net NEW units won that month. This
//   is the standard subscription/customer-base formula, and the only one
//   consistent with the LTV figure this app already shows (LTV assumes
//   churn actually shrinks the base over time).
// - CAC spend applies only to units actually ACQUIRED that month (month 1's
//   starting units, or each later month's gross "growth" figure) — not to
//   the whole existing installed base. Charging CAC against your entire
//   customer count every month has no economic basis and used to silently
//   inflate opex in proportion to a number (total units) that has nothing
//   to do with acquisition spend.
// - Price, CAC and fixed costs can each drift with an annual % — applied as
//   a once-a-year step-up (not continuous monthly compounding), because
//   that's how founders actually plan ("we'll raise prices ~5% a year"),
//   and it's easy to verify by eye against the inputs.
// - Tax is a simplified flat rate applied only to months with positive
//   EBITDA — no depreciation, no loss carry-forward, no advance-tax
//   quarterly mechanics. That's a real simplification and the UI says so;
//   modeling India's actual tax code isn't in scope here.
// - Every input defaults to 0 except churn (a scenario-typical assumption,
//   already the case before this rewrite) — no field guesses a number for
//   the founder's specific venture.

export type ScenarioInputs = {
  price: number;
  cac: number;
  churn: number;
  cogsPct: number;
  fixedMonthly: number;
  startUnits: number;
  growth: number;
  annualPriceGrowthPct: number;
  annualCacInflationPct: number;
  annualFixedCostInflationPct: number;
  taxRatePct: number;
  startingCash: number;
};

export type MonthRow = {
  m: number;
  u: number;
  price: number;
  revenue: number;
  cogs: number;
  gross: number;
  fixedCost: number;
  cacSpend: number;
  ebitda: number;
  tax: number;
  net: number;
  cash: number;
};

export type YearRow = {
  year: number;
  endUnits: number;
  revenue: number;
  ebitda: number;
  tax: number;
  net: number;
};

function annualStepMultiplier(annualPct: number, yearIndex: number) {
  return Math.pow(1 + annualPct / 100, yearIndex);
}

/** Runs the model for `months` consecutive months starting at month 1,
 * returning one row per month plus the derived headline metrics. Used for
 * the 12-month P&L table and (with months = years*12) internally by
 * computeAnnualProjection below, so both read from one code path. */
export function computeMonthlyProjection(d: ScenarioInputs, months: number) {
  const rows: MonthRow[] = [];
  let units = d.startUnits;
  let cash = d.startingCash;
  let cumNet = 0;
  let breakEvenMonth: number | null = null; // first month this month's own net >= 0
  let paybackMonth: number | null = null; // first month cumulative net from operations >= 0
  let runwayMonth: number | null = null; // first month cash actually runs negative

  for (let m = 1; m <= months; m++) {
    const yearIndex = Math.floor((m - 1) / 12);
    const price = d.price * annualStepMultiplier(d.annualPriceGrowthPct, yearIndex);
    const cac = d.cac * annualStepMultiplier(d.annualCacInflationPct, yearIndex);
    const fixedCost = d.fixedMonthly * annualStepMultiplier(d.annualFixedCostInflationPct, yearIndex);

    const grossNewUnits = m === 1 ? d.startUnits : Math.max(0, d.growth);
    units = m === 1 ? d.startUnits : units * (1 - d.churn) + d.growth;

    const revenue = units * price;
    const cogs = revenue * d.cogsPct;
    const gross = revenue - cogs;
    const cacSpend = grossNewUnits * cac;
    const ebitda = gross - fixedCost - cacSpend;
    const tax = ebitda > 0 ? ebitda * (d.taxRatePct / 100) : 0;
    const net = ebitda - tax;

    cumNet += net;
    cash += net;
    if (breakEvenMonth === null && net >= 0) breakEvenMonth = m;
    if (paybackMonth === null && cumNet >= 0) paybackMonth = m;
    if (runwayMonth === null && cash < 0) runwayMonth = m;

    rows.push({ m, u: Math.round(units), price, revenue, cogs, gross, fixedCost, cacSpend, ebitda, tax, net, cash });
  }

  const ltv = d.churn > 0 ? d.price * (1 / d.churn) * (1 - d.cogsPct) : 0;
  const ratio = d.cac > 0 ? ltv / d.cac : null;

  return { rows, breakEvenMonth, paybackMonth, runwayMonth, ltv, ratio };
}

/** Same model, rolled up to whole years — not a separate model, just the
 * monthly projection summed per 12-month block. */
export function computeAnnualProjection(d: ScenarioInputs, years: number): YearRow[] {
  const { rows } = computeMonthlyProjection(d, years * 12);
  const out: YearRow[] = [];
  for (let y = 1; y <= years; y++) {
    const yearRows = rows.slice((y - 1) * 12, y * 12);
    out.push({
      year: y,
      endUnits: yearRows[yearRows.length - 1]?.u ?? 0,
      revenue: yearRows.reduce((s, r) => s + r.revenue, 0),
      ebitda: yearRows.reduce((s, r) => s + r.ebitda, 0),
      tax: yearRows.reduce((s, r) => s + r.tax, 0),
      net: yearRows.reduce((s, r) => s + r.net, 0),
    });
  }
  return out;
}
