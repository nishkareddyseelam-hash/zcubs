import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

// Real server-side persistence using Node's built-in SQLite (no native
// binary download required — works offline/sandboxed). One file on disk,
// created and migrated on first import.

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "zcubs.db");

declare global {
  // eslint-disable-next-line no-var
  var __zcubsDb: DatabaseSync | undefined;
}

function open(): DatabaseSync {
  if (global.__zcubsDb) return global.__zcubsDb;
  const db = new DatabaseSync(DB_PATH);
  // Fix note: this module is imported once per worker process, and
  // `next build`'s page-data-collection phase spawns several worker
  // processes concurrently — each one used to open this same file and run
  // the full CREATE TABLE / ALTER TABLE migration block below with no busy
  // handling, so a worker that lost the race for the file lock threw
  // "database is locked" instead of waiting. busy_timeout tells SQLite to
  // retry internally (up to 8s) before giving up, which is the standard
  // fix for exactly this multi-process contention pattern. WAL mode is set
  // first so readers don't block writers once migration is done.
  db.exec("PRAGMA busy_timeout = 8000;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL, ageBand TEXT NOT NULL DEFAULT 'founder',
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS founder_profiles (
      id TEXT PRIMARY KEY, userId TEXT UNIQUE NOT NULL,
      strengths TEXT NOT NULL, develop TEXT NOT NULL, time TEXT NOT NULL,
      capital TEXT NOT NULL, risk TEXT NOT NULL DEFAULT 'Medium',
      categories TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, title TEXT NOT NULL,
      customer TEXT NOT NULL, problem TEXT NOT NULL,
      evidenceClass TEXT NOT NULL DEFAULT 'assumption', evidenceNote TEXT NOT NULL,
      difficulty TEXT NOT NULL DEFAULT 'Medium', capital TEXT NOT NULL DEFAULT 'Medium',
      mission TEXT NOT NULL,
      dimFit INTEGER NOT NULL DEFAULT 5, dimEvidence INTEGER NOT NULL DEFAULT 5,
      dimCustomer INTEGER NOT NULL DEFAULT 5, dimDefensibility INTEGER NOT NULL DEFAULT 5,
      dimCapital INTEGER NOT NULL DEFAULT 5, dimMargin INTEGER NOT NULL DEFAULT 5,
      dimScale INTEGER NOT NULL DEFAULT 5, dimSocial INTEGER NOT NULL DEFAULT 5,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, name TEXT NOT NULL,
      hypothesis TEXT NOT NULL, method TEXT NOT NULL, kpi TEXT NOT NULL,
      threshold TEXT NOT NULL, result TEXT NOT NULL DEFAULT '',
      metThreshold TEXT NOT NULL DEFAULT 'unknown', stopRule TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS evidence_items (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, claim TEXT NOT NULL,
      metric TEXT NOT NULL, evClass TEXT NOT NULL DEFAULT 'assumption',
      publisher TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL,
      geography TEXT NOT NULL DEFAULT '', dataPeriod TEXT NOT NULL DEFAULT '',
      license TEXT NOT NULL DEFAULT '', accessDate TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS risks (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, risk TEXT NOT NULL,
      mitigation TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'Medium', createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS financial_scenarios (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, scenario TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0, cac REAL NOT NULL DEFAULT 0,
      churn REAL NOT NULL DEFAULT 0.06, cogsPct REAL NOT NULL DEFAULT 0.35,
      fixedMonthly REAL NOT NULL DEFAULT 0, startUnits REAL NOT NULL DEFAULT 0,
      growth REAL NOT NULL DEFAULT 0,
      annualPriceGrowthPct REAL NOT NULL DEFAULT 0, annualCacInflationPct REAL NOT NULL DEFAULT 0,
      annualFixedCostInflationPct REAL NOT NULL DEFAULT 0, taxRatePct REAL NOT NULL DEFAULT 0,
      startingCash REAL NOT NULL DEFAULT 0,
      updatedAt TEXT NOT NULL,
      UNIQUE(userId, scenario)
    );
    CREATE TABLE IF NOT EXISTS mentor_messages (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, lens TEXT NOT NULL,
      role TEXT NOT NULL, content TEXT NOT NULL, createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, kind TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_state (
      userId TEXT PRIMARY KEY, activeOpportunityId TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS comparable_companies (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, opportunityId TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL, sourceUrl TEXT NOT NULL DEFAULT '', sourcePublisher TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'unknown', statusNote TEXT NOT NULL DEFAULT '',
      lastRechecked TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ecosystem_contacts (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, opportunityId TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'investor', name TEXT NOT NULL, focus TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT '', sourceUrl TEXT NOT NULL DEFAULT '',
      applicationStatus TEXT NOT NULL DEFAULT 'not_started', deadline TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS business_plan (
      userId TEXT PRIMARY KEY, executiveSummary TEXT NOT NULL DEFAULT '',
      marketSection TEXT NOT NULL DEFAULT '', businessModelSection TEXT NOT NULL DEFAULT '',
      goToMarketSection TEXT NOT NULL DEFAULT '', opsSection TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS actuals_log (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, opportunityId TEXT NOT NULL DEFAULT '',
      period TEXT NOT NULL, revenue REAL NOT NULL DEFAULT 0, customers REAL NOT NULL DEFAULT 0,
      costs REAL NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL,
      UNIQUE(userId, period)
    );
    CREATE TABLE IF NOT EXISTS dpr_inputs (
      userId TEXT PRIMARY KEY,
      landBuilding REAL NOT NULL DEFAULT 0, machinery REAL NOT NULL DEFAULT 0,
      workingCapitalMargin REAL NOT NULL DEFAULT 0, preliminaryExpenses REAL NOT NULL DEFAULT 0,
      contingency REAL NOT NULL DEFAULT 0, promoterContribution REAL NOT NULL DEFAULT 0,
      termLoanAmount REAL NOT NULL DEFAULT 0, termLoanRatePct REAL NOT NULL DEFAULT 0,
      termLoanTenureYears REAL NOT NULL DEFAULT 0, wcLoanAmount REAL NOT NULL DEFAULT 0,
      wcLoanRatePct REAL NOT NULL DEFAULT 0, updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS institutions (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, ownerUserId TEXT NOT NULL,
      inviteCode TEXT UNIQUE NOT NULL, createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS institution_members (
      id TEXT PRIMARY KEY, institutionId TEXT NOT NULL, userId TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'founder', joinedAt TEXT NOT NULL,
      UNIQUE(institutionId, userId)
    );
    CREATE TABLE IF NOT EXISTS guide_steps (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, stepId TEXT NOT NULL,
      fieldsJson TEXT NOT NULL DEFAULT '{}', itemsJson TEXT NOT NULL DEFAULT '{}',
      notes TEXT NOT NULL DEFAULT '', updatedAt TEXT NOT NULL,
      UNIQUE(userId, stepId)
    );
    CREATE TABLE IF NOT EXISTS guide_meta (
      userId TEXT PRIMARY KEY, businessName TEXT NOT NULL DEFAULT '',
      templateLabel TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
      customer TEXT NOT NULL DEFAULT '', problem TEXT NOT NULL DEFAULT '',
      mission TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL
    );
  `);
  // Migration: guide_meta originally only stored businessName/templateLabel/
  // notes — customer/problem/mission were added so every lazily-generated
  // Guide step (not just the ones drafted in the original bulk-template
  // pass) can stay consistent with the same real seed context.
  for (const col of ["customer", "problem", "mission"]) {
    try {
      db.exec(`ALTER TABLE guide_meta ADD COLUMN ${col} TEXT NOT NULL DEFAULT '';`);
    } catch {
      // Column already exists — fine.
    }
  }
  // Migration: financial_scenarios originally only modeled a flat monthly
  // unit trajectory with no inflation, tax or starting-capital concept —
  // these columns add realistic price/CAC/fixed-cost drift, a simplified
  // tax pass, and a real cash-runway calculation (see MoneyClient.tsx).
  // All default to 0 so nothing changes for a scenario that hasn't opted in.
  for (const col of ["annualPriceGrowthPct", "annualCacInflationPct", "annualFixedCostInflationPct", "taxRatePct", "startingCash"]) {
    try {
      db.exec(`ALTER TABLE financial_scenarios ADD COLUMN ${col} REAL NOT NULL DEFAULT 0;`);
    } catch {
      // Column already exists — fine.
    }
  }
  // Migration: existing databases created before the evidence-verdict fix
  // (readiness scoring used to award "customer evidence" points for any
  // recorded result, without checking whether the experiment's own
  // threshold was actually met) won't have this column yet.
  try {
    db.exec("ALTER TABLE experiments ADD COLUMN metThreshold TEXT NOT NULL DEFAULT 'unknown';");
  } catch {
    // Column already exists — fine.
  }
  // Migration: hypothesis-led validation needs an explicit stop rule
  // (per evidence-governance review — a threshold alone says what counts as
  // success; a stop rule says what makes the founder actually pivot/stop).
  try {
    db.exec("ALTER TABLE experiments ADD COLUMN stopRule TEXT NOT NULL DEFAULT '';");
  } catch {
    // Column already exists — fine.
  }
  // Migration: claim-level evidence provenance fields (geography, the
  // period the data covers, its licence, and when it was accessed) — added
  // so every evidence item can carry the same provenance rigor as the
  // pre-loaded REAL_EVIDENCE reference item, not just publisher + URL.
  for (const col of ["geography", "dataPeriod", "license", "accessDate"]) {
    try {
      db.exec(`ALTER TABLE evidence_items ADD COLUMN ${col} TEXT NOT NULL DEFAULT '';`);
    } catch {
      // Column already exists — fine.
    }
  }
  // Migration: link evidence items and experiments to a specific
  // Opportunity Card (optional — "" means account-wide / not idea-specific)
  // so a founder's journey through evidence and validation can stay
  // connected to the one idea they're actually working on.
  try {
    db.exec("ALTER TABLE evidence_items ADD COLUMN opportunityId TEXT NOT NULL DEFAULT '';");
  } catch {
    // Column already exists — fine.
  }
  try {
    db.exec("ALTER TABLE experiments ADD COLUMN opportunityId TEXT NOT NULL DEFAULT '';");
  } catch {
    // Column already exists — fine.
  }
  // Migration: correction log — an evidence item can explicitly supersede an
  // earlier one (same claim, corrected number/source) instead of silently
  // leaving two conflicting entries with no link between them.
  try {
    db.exec("ALTER TABLE evidence_items ADD COLUMN supersedesId TEXT NOT NULL DEFAULT '';");
  } catch {
    // Column already exists — fine.
  }
  global.__zcubsDb = db;
  return db;
}

export const db = open();
export const newId = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
