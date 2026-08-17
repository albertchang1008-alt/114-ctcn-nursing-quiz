#!/usr/bin/env node
"use strict";

// 為教師 Google 帳號設定 Firebase admin Custom Claim。預設預覽，--apply 才會修改。
const { execFileSync } = require("child_process");
const args = process.argv.slice(2);
const valueOf = name => (args.find(v => v.startsWith(`--${name}=`)) || "").split("=").slice(1).join("=");
const projectId = valueOf("project");
const email = valueOf("email").trim().toLowerCase();
const apply = args.includes("--apply");
if (!projectId || !email) {
  console.error("用法：node set_admin_claim.js --project=PROJECT_ID --email=TEACHER_EMAIL [--apply]");
  process.exit(1);
}

function token() {
  if (process.env.GOOGLE_OAUTH_ACCESS_TOKEN) return process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  return execFileSync("gcloud", ["auth", "application-default", "print-access-token"], { encoding: "utf8" }).trim();
}

async function call(method, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
}

(async () => {
  const lookup = await call("lookup", { email: [email] });
  const user = (lookup.users || [])[0];
  if (!user) throw new Error(`Firebase Authentication 找不到 ${email}`);
  let claims = {};
  try { claims = JSON.parse(user.customAttributes || "{}"); } catch (_) {}
  console.log("目前 claims：", claims);
  console.log("預計 claims：", { ...claims, admin: true });
  if (!apply) {
    console.log("預覽模式，未修改。確認後加入 --apply。");
    return;
  }
  await call("update", { localId: user.localId, customAttributes: JSON.stringify({ ...claims, admin: true }) });
  console.log(`已為 ${email} 設定 admin=true；請讓該帳號登出再登入以更新 ID token。`);
})().catch(err => {
  console.error("設定失敗：", err.message);
  process.exitCode = 1;
});
