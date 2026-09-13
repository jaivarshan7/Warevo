import fs from "fs";

const content = fs.readFileSync("dist/assets/index-CxJDgmUp.js", "utf8");

let pos = 0;
while (true) {
  const found = content.indexOf("jne(", pos);
  if (found === -1) break;
  console.log("Usage of jne at:", found);
  console.log(content.slice(Math.max(0, found - 150), Math.min(content.length, found + 250)));
  console.log("-------------------");
  pos = found + 4;
}
