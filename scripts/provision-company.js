// Manual onboarding for the "For Companies" feature: create a companies row
// and print the dashboard magic link to send them.
//
//   node scripts/provision-company.js "Bloom & Stem" contact@bloomstem.com
//
// Any matching open row in company_requests is marked 'provisioned'.
require("dotenv").config();
const db = require("../server/db");
const { generateManageToken } = require("../server/lib/companies");

const [, , name, email] = process.argv;
if (!name || !email) {
  console.error('Usage: node scripts/provision-company.js "<Company Name>" <contact_email>');
  process.exit(1);
}

const token = generateManageToken();
db.prepare("INSERT INTO companies (manage_token, name, contact_email, created_at) VALUES (?, ?, ?, ?)").run(
  token,
  name,
  email,
  Date.now()
);
db.prepare("UPDATE company_requests SET status = 'provisioned' WHERE contact_email = ? AND status = 'new'").run(email);

const base = process.env.SITE_URL || "https://www.joue-joue.com";
console.log(`\nProvisioned "${name}".`);
console.log(`Send them this dashboard link:\n${base}/company/${token}\n`);
