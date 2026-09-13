import fs from "fs";

const content = fs.readFileSync("dist/assets/index-CxJDgmUp.js", "utf8");

// Search for fetchEmployees in the bundle
// fetchEmployees has: .from("User").select("*, tenant:Tenant(*)")
const idx = content.indexOf('select("*, tenant:Tenant(*)")');
console.log("Found select index:", idx);
if (idx !== -1) {
  console.log("Snippet around index:");
  console.log(content.slice(idx - 100, idx + 300));
}
