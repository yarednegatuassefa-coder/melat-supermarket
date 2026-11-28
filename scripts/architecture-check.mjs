#!/usr/bin/env node
/**
 * Dependency-cycle and client/server-boundary checker.
 * Uses the repository's existing TypeScript compiler API; adds no dependency.
 * Static and source-only: never executes project modules.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let ts;
try { ts = require("typescript"); }
catch {
  console.error("Architecture check requires the repository's existing TypeScript devDependency.");
  process.exit(2);
}

const root = process.cwd();
const configPath = path.join(root, ".architecture-check.json");
if (!fs.existsSync(configPath)) {
  console.error("Missing .architecture-check.json");
  process.exit(2);
}
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const ignored = new Set(["node_modules", ".next", "dist", "build", "coverage", ".git", ".turbo"]);
const sourceExts = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);
const normalize = value => value.split(path.sep).join("/");
const rel = value => normalize(path.relative(root, value));
const isIgnored = value => value.split(path.sep).some(part => ignored.has(part));

function discoverConfigs(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) discoverConfigs(path.join(dir, entry.name), found);
    } else if (/^tsconfig.*\.json$/.test(entry.name)) found.push(path.join(dir, entry.name));
  }
  return found;
}

const projectFiles = new Set();
const optionsByFile = new Map();
const configFiles = discoverConfigs(root);
if (!configFiles.length) {
  console.error("No tsconfig*.json found; refusing to silently pass.");
  process.exit(2);
}
for (const file of configFiles) {
  const read = ts.readConfigFile(file, ts.sys.readFile);
  if (read.error) continue;
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(file), undefined, file);
  for (const source of parsed.fileNames) {
    if (!isIgnored(source) && sourceExts.has(path.extname(source))) {
      projectFiles.add(path.resolve(source));
      if (!optionsByFile.has(path.resolve(source))) optionsByFile.set(path.resolve(source), parsed.options);
    }
  }
}
if (!projectFiles.size) {
  console.error("No TypeScript/JavaScript source files were found in discovered projects.");
  process.exit(2);
}

const graph = new Map([...projectFiles].map(file => [file, new Set()]));
const edges = [];
const serverSpecifiers = new Set(config.serverImportSpecifiers ?? ["server-only", "next/headers", "next/server"]);
const clientRoots = (config.clientRoots ?? []).map(x => path.resolve(root, x));
const serverRoots = (config.serverRoots ?? []).map(x => path.resolve(root, x));

function isWithin(file, roots) {
  return roots.some(base => file === base || file.startsWith(base + path.sep));
}
function isClientFile(file, sourceFile) {
  if (isWithin(file, clientRoots)) return true;
  return sourceFile.statements.some(statement =>
    ts.isExpressionStatement(statement) &&
    ts.isStringLiteral(statement.expression) &&
    statement.expression.text === "use client"
  ) || /\.client\.[cm]?[jt]sx?$/.test(file);
}
function collectSpecifiers(sourceFile) {
  const found = [];
  for (const statement of sourceFile.statements) {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
        statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      found.push(statement.moduleSpecifier.text);
    }
  }
  const visit = node => {
    if (ts.isCallExpression(node)) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
           (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
        found.push(arg.text);
      }
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)) found.push(node.argument.literal.text);
    ts.forEachChild(node, visit);
  };
  sourceFile.forEachChild(visit);
  return [...new Set(found)];
}

const boundaryViolations = [];
for (const file of projectFiles) {
  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    /\.tsx?$/.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  for (const specifier of collectSpecifiers(source)) {
    const options = optionsByFile.get(file) ?? {};
    const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule?.resolvedFileName;
    if (resolved) {
      const target = path.resolve(resolved);
      if (projectFiles.has(target)) {
        graph.get(file).add(target);
        edges.push({ from: file, to: target, specifier });
      }
      if (isClientFile(file, source) &&
          (isWithin(target, serverRoots) || /(^|[/\\])server([/\\]|$)|\.server\.[cm]?[jt]sx?$/.test(target))) {
        boundaryViolations.push({ from: file, to: target, specifier });
      }
    }
    if (isClientFile(file, source) && serverSpecifiers.has(specifier)) {
      boundaryViolations.push({ from: file, to: specifier, specifier });
    }
  }
}

// Tarjan SCCs: each component with >1 node, or a self-edge, is a dependency cycle.
let nextIndex = 0;
const index = new Map(), low = new Map(), stack = [], onStack = new Set(), cycles = [];
function strongConnect(node) {
  index.set(node, nextIndex); low.set(node, nextIndex); nextIndex++;
  stack.push(node); onStack.add(node);
  for (const target of graph.get(node) ?? []) {
    if (!index.has(target)) { strongConnect(target); low.set(node, Math.min(low.get(node), low.get(target))); }
    else if (onStack.has(target)) low.set(node, Math.min(low.get(node), index.get(target)));
  }
  if (low.get(node) === index.get(node)) {
    const component = [];
    let item;
    do { item = stack.pop(); onStack.delete(item); component.push(item); } while (item !== node);
    if (component.length > 1 || graph.get(node)?.has(node)) cycles.push(component);
  }
}
for (const file of projectFiles) if (!index.has(file)) strongConnect(file);

const errors = cycles.length + boundaryViolations.length;
console.log(`Architecture check: ${projectFiles.size} source files, ${edges.length} internal dependency edges`);
if (cycles.length) {
  console.error(`\nDependency cycles (${cycles.length}):`);
  for (const cycle of cycles) {
    console.error("  " + cycle.map(rel).sort().join(" <-> "));
  }
}
if (boundaryViolations.length) {
  console.error(`\nClient-to-server boundary violations (${boundaryViolations.length}):`);
  for (const item of boundaryViolations) {
    console.error(`  ${rel(item.from)} -> ${typeof item.to === "string" ? item.to : rel(item.to)} [${item.specifier}]`);
  }
}
if (!errors) console.log("PASS: no dependency cycles or configured client/server boundary violations.");
console.log("\nSemantic review still required: inspect touched public interfaces for leaked mutable/internal fields and shallow or pass-through modules. This AST check cannot prove encapsulation or cohesion.");
process.exit(errors ? 1 : 0);
