'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const build = path.join(root, 'build', 'unit');
const unity = path.resolve(root, process.env.UNITY_SRC_DIR || 'unity/src');
const cc = process.env.CC || 'gcc';
const relative = file => path.relative(root, file) || '.';

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}

try {
  if (!fs.existsSync(path.join(unity, 'unity.c'))) {
    throw new Error('Unity not found. Clone it into unity/ or set UNITY_SRC_DIR.');
  }
  const suites = fs.readdirSync(path.join(root, 'test'))
    .filter(name => /^test_.*\.c$/.test(name) && !name.endsWith('_runner.c')).sort();
  if (!suites.length) throw new Error('No C test suites found.');
  fs.mkdirSync(build, { recursive: true });
  let count = 0;
  for (const suite of suites) {
    const source = path.join(root, 'test', suite);
    const tests = [...fs.readFileSync(source, 'utf8')
      .matchAll(/^void\s+(test_\w+)\s*\(\s*void\s*\)/gm)].map(match => match[1]);
    if (!tests.length) throw new Error(`No tests found in ${suite}`);
    const base = path.basename(suite, '.c');
    const runner = path.join(build, `${base}_runner.c`);
    const binary = path.join(build, base + (process.platform === 'win32' ? '.exe' : ''));
    fs.writeFileSync(runner, [
      '#include "unity.h"',
      ...tests.map(name => `void ${name}(void);`),
      'int main(void) {', '    UNITY_BEGIN();',
      ...tests.map(name => `    RUN_TEST(${name});`),
      '    return UNITY_END();', '}', ''
    ].join('\n'));
    run(cc, ['-std=c99', '-Wall', '-Wextra', '-Werror', '-I', 'inc',
      '-I', relative(unity), 'src/mode_logic_team.c',
      relative(path.join(unity, 'unity.c')), relative(source), relative(runner),
      '-o', relative(binary)]);
    run(binary, []);
    count += tests.length;
  }
  console.log(`\nC unit tests: ${count} tests in ${suites.length} suites passed.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
