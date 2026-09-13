import fs from "fs";

const content = fs.readFileSync("dist/assets/index-CxJDgmUp.js", "utf8");
console.log(content.slice(1250300, 1251200));
