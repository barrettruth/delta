import { createProgram } from "./program.js";

const pkg = require("../package.json") as { version: string };

createProgram(pkg.version).parse();
