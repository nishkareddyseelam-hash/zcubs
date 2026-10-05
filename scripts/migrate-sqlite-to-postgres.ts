// One-shot data preservation (see docs/DECISION_LOG.md D-003): copies every
// row out of the old data/zcubs.db (node:sqlite) into Postgres, mapping the
// old implicit single-tenant world into a generated "Demonstration
// Institution" so nothing created during earlier sessions is silently
// discarded by the Postgres migration. Safe to run once; re-running skips
// users that already exist (matched by email).
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { q, qOne, newId, now } from "../src/lib/pg";
import * as inst from "../src/lib/institutional";

const DB_PATH = path.join(process.cwd(), "data", "zcubs.db");

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.log("No data/zcubs.db found — nothing to migrate.");
    return;
  }
  const sqlite = new DatabaseSync(DB_PATH);
  const oldUsers = sqlite.prepare("SELECT * FROM users").all() as Record<string, unknown>[];
  console.log(`Found ${oldUsers.length} user(s) in the old SQLite database.`);
  if (oldUsers.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  const idMap = new Map<string, string>(); // old sqlite user id -> new postgres user id

  for (const u of oldUsers) {
    const email = String(u.email);
    const existing = await qOne<{ id: string }>(`SELECT id FROM users WHERE email=$1`, [email]);
    if (existing) {
      idMap.set(String(u.id), existing.id);
      console.log(`  skip (already migrated): ${email}`);
      continue;
    }
    const newUserId = newId();
    await q(
      `INSERT INTO users (id,name,email,password_hash,age_band,created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [newUserId, u.name, email, u.passwordHash, u.ageBand, u.createdAt]
    );
    idMap.set(String(u.id), newUserId);
    console.log(`  migrated user: ${email}`);
  }

  // Table -> (sqlite columns in order matching the INSERT below).
  const tableCopies: { table: string; insert: (row: Record<string, unknown>, newUserId: string) => Promise<void> }[] = [
    {
      table: "founder_profiles",
      insert: async (r, uid) => { await q(`INSERT INTO founder_profiles (id,user_id,strengths,develop,time,capital,risk,categories,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (user_id) DO NOTHING`, [newId(), uid, r.strengths, r.develop, r.time, r.capital, r.risk, r.categories, r.updatedAt]); },
    },
    {
      table: "opportunities",
      insert: async (r, uid) => { await q(
        `INSERT INTO opportunities (id,user_id,title,customer,problem,evidence_class,evidence_note,difficulty,capital,mission,dim_fit,dim_evidence,dim_customer,dim_defensibility,dim_capital,dim_margin,dim_scale,dim_social,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [newId(), uid, r.title, r.customer, r.problem, r.evidenceClass, r.evidenceNote, r.difficulty, r.capital, r.mission, r.dimFit, r.dimEvidence, r.dimCustomer, r.dimDefensibility, r.dimCapital, r.dimMargin, r.dimScale, r.dimSocial, r.createdAt]
      ); },
    },
    {
      table: "experiments",
      insert: async (r, uid) => { await q(
        `INSERT INTO experiments (id,user_id,name,hypothesis,method,kpi,threshold,result,met_threshold,stop_rule,opportunity_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [newId(), uid, r.name, r.hypothesis, r.method, r.kpi, r.threshold, r.result, r.metThreshold, r.stopRule, r.opportunityId, r.createdAt]
      ); },
    },
    {
      table: "evidence_items",
      insert: async (r, uid) => { await q(
        `INSERT INTO evidence_items (id,user_id,claim,metric,ev_class,publisher,url,created_at,geography,data_period,license,access_date,opportunity_id,supersedes_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [newId(), uid, r.claim, r.metric, r.evClass, r.publisher, r.url, r.createdAt, r.geography, r.dataPeriod, r.license, r.accessDate, r.opportunityId, r.supersedesId]
      ); },
    },
    {
      table: "risks",
      insert: async (r, uid) => { await q(`INSERT INTO risks (id,user_id,risk,mitigation,severity,created_at) VALUES ($1,$2,$3,$4,$5,$6)`, [newId(), uid, r.risk, r.mitigation, r.severity, r.createdAt]); },
    },
    {
      table: "financial_scenarios",
      insert: async (r, uid) => { await q(
        `INSERT INTO financial_scenarios (id,user_id,scenario,price,cac,churn,cogs_pct,fixed_monthly,start_units,growth,annual_price_growth_pct,annual_cac_inflation_pct,annual_fixed_cost_inflation_pct,tax_rate_pct,starting_cash,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (user_id, scenario) DO NOTHING`,
        [newId(), uid, r.scenario, r.price, r.cac, r.churn, r.cogsPct, r.fixedMonthly, r.startUnits, r.growth, r.annualPriceGrowthPct, r.annualCacInflationPct, r.annualFixedCostInflationPct, r.taxRatePct, r.startingCash, r.updatedAt]
      ); },
    },
    {
      table: "comparable_companies",
      insert: async (r, uid) => { await q(
        `INSERT INTO comparable_companies (id,user_id,opportunity_id,name,source_url,source_publisher,status,status_note,last_rechecked,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [newId(), uid, r.opportunityId, r.name, r.sourceUrl, r.sourcePublisher, r.status, r.statusNote, r.lastRechecked, r.notes, r.createdAt]
      ); },
    },
    {
      table: "ecosystem_contacts",
      insert: async (r, uid) => { await q(
        `INSERT INTO ecosystem_contacts (id,user_id,opportunity_id,kind,name,focus,stage,source_url,application_status,deadline,notes,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [newId(), uid, r.opportunityId, r.kind, r.name, r.focus, r.stage, r.sourceUrl, r.applicationStatus, r.deadline, r.notes, r.createdAt, r.updatedAt]
      ); },
    },
    {
      table: "business_plan",
      insert: async (r, uid) => { await q(
        `INSERT INTO business_plan (user_id,executive_summary,market_section,business_model_section,go_to_market_section,ops_section,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id) DO NOTHING`,
        [uid, r.executiveSummary, r.marketSection, r.businessModelSection, r.goToMarketSection, r.opsSection, r.updatedAt]
      ); },
    },
    {
      table: "actuals_log",
      insert: async (r, uid) => { await q(
        `INSERT INTO actuals_log (id,user_id,opportunity_id,period,revenue,customers,costs,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (user_id, period) DO NOTHING`,
        [newId(), uid, r.opportunityId, r.period, r.revenue, r.customers, r.costs, r.notes, r.createdAt]
      ); },
    },
    {
      table: "dpr_inputs",
      insert: async (r, uid) => { await q(
        `INSERT INTO dpr_inputs (user_id,land_building,machinery,working_capital_margin,preliminary_expenses,contingency,promoter_contribution,term_loan_amount,term_loan_rate_pct,term_loan_tenure_years,wc_loan_amount,wc_loan_rate_pct,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (user_id) DO NOTHING`,
        [uid, r.landBuilding, r.machinery, r.workingCapitalMargin, r.preliminaryExpenses, r.contingency, r.promoterContribution, r.termLoanAmount, r.termLoanRatePct, r.termLoanTenureYears, r.wcLoanAmount, r.wcLoanRatePct, r.updatedAt]
      ); },
    },
    {
      table: "guide_steps",
      insert: async (r, uid) => { await q(
        `INSERT INTO guide_steps (id,user_id,step_id,fields_json,items_json,notes,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id, step_id) DO NOTHING`,
        [newId(), uid, r.stepId, r.fieldsJson, r.itemsJson, r.notes, r.updatedAt]
      ); },
    },
    {
      table: "guide_meta",
      insert: async (r, uid) => { await q(
        `INSERT INTO guide_meta (user_id,business_name,template_label,notes,customer,problem,mission,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (user_id) DO NOTHING`,
        [uid, r.businessName, r.templateLabel, r.notes, r.customer, r.problem, r.mission, r.updatedAt]
      ); },
    },
    {
      table: "activity_log",
      insert: async (r, uid) => { await q(`INSERT INTO activity_log (id,user_id,kind,detail,created_at) VALUES ($1,$2,$3,$4,$5)`, [newId(), uid, r.kind, r.detail, r.createdAt]); },
    },
  ];

  for (const { table, insert } of tableCopies) {
    let rows: Record<string, unknown>[] = [];
    try {
      rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
    } catch {
      continue; // table didn't exist in this old DB version
    }
    let copied = 0;
    for (const r of rows) {
      const oldUid = String(r.userId ?? "");
      const newUid = idMap.get(oldUid);
      if (!newUid) continue; // orphaned row or a user we skipped
      await insert(r, newUid);
      copied++;
    }
    console.log(`  ${table}: copied ${copied}/${rows.length} row(s)`);
  }

  // Wrap every migrated founder into one visible "Demonstration Institution"
  // so old data isn't just floating with no institutional home, and so this
  // migration's effect is inspectable in the new UI. Skipped if it already exists.
  const existingDemo = await qOne<{ id: string }>(`SELECT id FROM institutions WHERE name = 'Migrated Data — Demonstration Institution'`);
  if (!existingDemo && idMap.size > 0) {
    const firstUid = [...idMap.values()][0];
    const institution = await inst.createInstitution(firstUid, {
      name: "Migrated Data — Demonstration Institution",
      institutionType: "university",
    });
    console.log(`Created Demonstration Institution ${institution.id}, owned by the first migrated user.`);
  }

  console.log("SQLite -> Postgres data migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
